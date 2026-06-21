const { qdrantClient } = require('./services/qdrant.service');
const { pipeline } = require('@xenova/transformers');

(async () => {
  const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  const res = await embedder('tell me about tarceops', { pooling: 'mean', normalize: true });
  const queryVector = Array.from(res.data);
  
  const searchResult = await qdrantClient.search('policies', { vector: queryVector, limit: 5 });
  const contextText = searchResult.map(r => r.payload.text).join('\n\n---\n\n').substring(0, 4000);
  
  console.log('--- GENERATED CONTEXT TEXT ---');
  console.log(contextText);
  console.log('------------------------------');
  process.exit(0);
})();
