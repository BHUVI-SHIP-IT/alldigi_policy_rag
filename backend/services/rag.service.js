const fs = require('fs');
const pdfParse = require('pdf-parse');
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
    } catch(e) {
      console.error('Failed to load node-llama-cpp dynamically', e);
    }
  } else {
    console.warn(`LLM Model not found at ${LLM_MODEL_PATH}. Using mock LLM responses.`);
  }
};

// Text Extraction
const extractText = async (filePath, mimetype) => {
  if (mimetype === 'application/pdf') {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
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

const chunkText = (text, chunkSize = 800, overlap = 150) => {
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
    
    // Create points for Qdrant
    const points = await Promise.all(chunks.map(async (chunk, index) => {
      const vector = await generateEmbedding(chunk);
      return {
        id: `${documentId}-${index}`, // Using string IDs or UUIDs
        vector,
        payload: {
          documentId,
          text: chunk,
          chunkIndex: index
        }
      };
    }));

    // Generate numeric IDs or UUIDs for Qdrant
    const qdrantPoints = points.map((p, i) => ({
      id: documentId * 1000 + i, // simple numeric ID generation for this example
      vector: p.vector,
      payload: p.payload
    }));

    await qdrantClient.upsert(COLLECTION_NAME, {
      wait: true,
      points: qdrantPoints
    });

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
const queryPolicy = async (question) => {
  const queryVector = await generateEmbedding(question);
  
  const searchResult = await qdrantClient.search(COLLECTION_NAME, {
    vector: queryVector,
    limit: 10,
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
      
      const userPrompt = `You must ONLY answer the following question based on the provided Context below. 
You may correct obvious typos in the question to match the Context.
If the Context does not contain the answer, you must reply exactly with: "I cannot find the answer in the provided company policies."
Do not make up answers. Do not use outside knowledge.

Context:
${contextText}

Question: ${question}`;

      console.log('\n--- LLM is generating response ---');
      const response = await session.prompt(userPrompt, {
        maxTokens: 500,
        onTextChunk(chunk) {
          process.stdout.write(chunk);
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
