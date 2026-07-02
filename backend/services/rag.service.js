const fs = require('fs');
const mammoth = require('mammoth');
const cheerio = require('cheerio');
const path = require('path');
const { qdrantClient, COLLECTION_NAME } = require('./qdrant.service');

// We expect the models to be placed in the backend/models directory
const MODEL_DIR = path.join(__dirname, '../models');
const LLM_MODEL_PATH = path.join(MODEL_DIR, 'llama-8b.gguf');
const EMBED_MODEL_PATH = path.join(MODEL_DIR, 'embedding-model.gguf');

let llmModel = null;
let llmContext = null;
let LlamaChatSession = null;

// Initialize LLM (lazy load or mock if file doesn't exist)
const initLLM = async () => {
  if (fs.existsSync(LLM_MODEL_PATH)) {
    console.log('Loading LLaMA model...');
    try {
      const { getLlama, LlamaChatSession: ChatSession } = await import('node-llama-cpp');
      // Forcing CPU mode to bypass the Vulkan VRAM allocation crash
      const llama = await getLlama({ gpu: false });
      LlamaChatSession = ChatSession;
      llmModel = await llama.loadModel({ modelPath: LLM_MODEL_PATH });
      llmContext = await llmModel.createContext();
      console.log('LLaMA model loaded successfully.');
    } catch (e) {
      console.error('Failed to load node-llama-cpp dynamically', e);
    }
  } else {
    console.warn(`LLM Model not found at ${LLM_MODEL_PATH}. Using mock LLM responses.`);
  }
};

// Extract text from a PDF buffer using pdfjs-dist (handles malformed XRef tables gracefully)
const extractPdfText = async (dataBuffer) => {
  // pdfjs-dist is an ES module — use dynamic import
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(dataBuffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
    // Lenient parsing — recover from bad XRef entries instead of throwing
    stopAtErrors: false,
  });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  const pageTexts = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    pageTexts.push(pageText);
  }

  return pageTexts.join('\n\n');
};

// Text Extraction
const extractText = async (filePath, mimetype) => {
  if (mimetype === 'application/pdf') {
    const dataBuffer = fs.readFileSync(filePath);
    return await extractPdfText(dataBuffer);
  } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  } else if (mimetype === 'text/plain') {
    return fs.readFileSync(filePath, 'utf-8');
  } else {
    throw new Error('Unsupported file type');
  }
};

const extractFromUrl = async (url) => {
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  return $('body').text().replace(/\s+/g, ' ').trim();
};

const chunkText = (text, chunkSize = 200, overlap = 50) => {
  const words = text.split(/\s+/);
  const chunks = [];
  let currentChunk = [];
  let currentLength = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (currentLength + word.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
      // Calculate how many words to keep for overlap
      let overlapLength = 0;
      let overlapWords = [];
      for (let j = currentChunk.length - 1; j >= 0; j--) {
        if (overlapLength + currentChunk[j].length > overlap) break;
        overlapWords.unshift(currentChunk[j]);
        overlapLength += currentChunk[j].length + 1;
      }
      currentChunk = [...overlapWords, word];
      currentLength = overlapLength + word.length + 1;
    } else {
      currentChunk.push(word);
      currentLength += word.length + 1;
    }
  }
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }
  return chunks;
};

let embedder = null;

const generateEmbedding = async (text) => {
  if (!embedder) {
    console.log('Loading local embedding model (this may take a moment on first run)...');
    const { pipeline } = await import('@xenova/transformers');
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  const result = await embedder(text, { pooling: 'mean', normalize: true });
  return Array.from(result.data);
};

const processDocument = async (filePath, mimetype, documentId) => {
  try {
    const text = await extractText(filePath, mimetype);
    // Semantic Overlapping Chunking
    const chunks = chunkText(text);

    // Pre-load the embedding model before processing chunks
    // (avoids all chunks racing to load it simultaneously)
    await generateEmbedding('warmup');

    // Process chunks sequentially to keep the event loop free for other requests
    const points = [];
    for (let index = 0; index < chunks.length; index++) {
      const chunk = chunks[index];
      const vector = await generateEmbedding(chunk);
      points.push({
        id: documentId * 1000 + index,
        vector: { "text-dense": vector },
        payload: { documentId, text: chunk, chunkIndex: index }
      });
      if ((index + 1) % 50 === 0) {
        console.log(`  Embedded ${index + 1}/${chunks.length} chunks for document ${documentId}`);
      }
    }

    // Batch upsert to stay under Qdrant's 32MB payload limit
    const BATCH_SIZE = 50;
    for (let i = 0; i < points.length; i += BATCH_SIZE) {
      const batch = points.slice(i, i + BATCH_SIZE);
      await qdrantClient.upsert(COLLECTION_NAME, { wait: true, points: batch });
      console.log(`  Indexed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(points.length / BATCH_SIZE)} for document ${documentId}`);
    }

    console.log(`Successfully processed and indexed document ${documentId}`);
    return true;
  } catch (error) {
    console.error('Error processing document:', error);
    throw error;
  }
};

const deleteDocumentChunks = async (documentId) => {
  try {
    await qdrantClient.delete(COLLECTION_NAME, {
      wait: true,
      filter: {
        must: [
          {
            key: "documentId",
            match: { value: documentId }
          }
        ]
      }
    });
    console.log(`Successfully deleted chunks for document ${documentId}`);
    return true;
  } catch (error) {
    console.error('Error deleting chunks from Qdrant:', error);
    throw error;
  }
};

// Querying
const queryPolicy = async (question, searchQuery, history, onChunk) => {
  // Use the combined searchQuery for embedding search to maintain context (e.g. resolving pronouns like "his projects")
  const queryVector = await generateEmbedding(searchQuery);

  const searchResult = await qdrantClient.search(COLLECTION_NAME, {
    vector: { name: 'text-dense', vector: queryVector },
    limit: 5, // Increased to 5 because chunks are now smaller (200 words)
  });

  const contextText = searchResult.map(r => r.payload.text).join('\n\n---\n\n');

  if (contextText.trim().length === 0) {
    return "I cannot find the answer in the provided company policies.";
  }

  if (llmContext) {
    const sequence = llmContext.getSequence();
    try {
      const systemPrompt = `You are an internal corporate assistant.`;

      const session = new LlamaChatSession({
        contextSequence: sequence,
        systemPrompt: systemPrompt
      });
      
      const formattedHistory = history.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
      const historySection = history.length > 0 ? `\nConversation History:\n${formattedHistory}\n` : '';

      const userPrompt = `You must ONLY answer the following question based on the provided Context below. 
You may use the Conversation History to understand pronouns or follow-up questions.
Please provide a detailed, conversational answer in complete sentences.
If the Context does not contain the answer, you must reply exactly with: "I cannot find the answer in the provided company policies."
Do not make up answers. Do not use outside knowledge.
${historySection}
Context:
${contextText}

Question: ${question}`;

      console.log('\n--- LLM is generating response ---');
      const response = await session.prompt(userPrompt, {
        maxTokens: 500,
        onTextChunk(chunk) {
          process.stdout.write(chunk);
          if (onChunk) onChunk(chunk);
        }
      });
      console.log('\n----------------------------------\n');
      return response;
    } finally {
      sequence.dispose();
    }
  } else {
    return `[MOCK RESPONSE] Based on the context: "${contextText.substring(0, 50)}...", the answer to "${question}" is [mocked because model is missing].`;
  }
};

module.exports = {
  extractText,
  extractFromUrl,
  processDocument,
  deleteDocumentChunks,
  queryPolicy,
  initLLM
};
