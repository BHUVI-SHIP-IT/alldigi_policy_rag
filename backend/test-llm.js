const { qdrantClient } = require('./services/qdrant.service');
const { pipeline } = require('@xenova/transformers');
const path = require('path');

(async () => {
  const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  const res = await embedder('tell me about bhuvaneswar', { pooling: 'mean', normalize: true });
  const queryVector = Array.from(res.data);
  
  const searchResult = await qdrantClient.search('policies', { vector: queryVector, limit: 5 });
  const contextText = searchResult.map(r => r.payload.text).join('\n\n---\n\n').substring(0, 4000);
  
  const { getLlama, LlamaChatSession } = await import('node-llama-cpp');
  const llama = await getLlama();
  const model = await llama.loadModel({ modelPath: path.join(__dirname, 'models', 'llama-3b.gguf') });
  const context = await model.createContext({ contextSize: 4096 });
  const sequence = context.getSequence();
  const session = new LlamaChatSession({ contextSequence: sequence });
  
  const userPrompt = `Read the CONTEXT and then answer the QUESTION. Do not use outside knowledge. If the answer is not in the context, say "I don't know".

<CONTEXT>
${contextText}
</CONTEXT>

QUESTION: tell me about bhuvaneswar
ANSWER:`;

  const response = await session.prompt(userPrompt, { maxTokens: 500 });
  console.log('RESPONSE:', response);
  
  const userPrompt2 = `Read the CONTEXT and then answer the QUESTION. Do not use outside knowledge. If the answer is not in the context, say "I don't know".

<CONTEXT>
${contextText}
</CONTEXT>

QUESTION: tell me about tarceops
ANSWER:`;

  const response2 = await session.prompt(userPrompt2, { maxTokens: 500 });
  console.log('RESPONSE2:', response2);
  
  process.exit(0);
})();
