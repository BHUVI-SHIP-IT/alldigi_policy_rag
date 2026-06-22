const { QdrantClient } = require('@qdrant/js-client-rest');
require('dotenv').config();

const qdrantClient = new QdrantClient({
  url: process.env.QDRANT_URL || 'http://localhost:6333',
});

const COLLECTION_NAME = 'policies';
// We will use 384 dimensions for typical embedding models like all-MiniLM-L6-v2.
// Adjust this based on the specific embedding model we choose later.
const VECTOR_SIZE = 384; 

const initializeQdrant = async () => {
  try {
    const collections = await qdrantClient.getCollections();
    const collectionExists = collections.collections.some(c => c.name === COLLECTION_NAME);

    if (!collectionExists) {
      await qdrantClient.createCollection(COLLECTION_NAME, {
        vectors: {
          'text-dense': {
            size: VECTOR_SIZE,
            distance: 'Cosine',
          },
        },
      });
      console.log(`Qdrant collection ${COLLECTION_NAME} created`);
    } else {
      console.log(`Qdrant collection ${COLLECTION_NAME} already exists`);
    }
  } catch (error) {
    console.error('Error initializing Qdrant:', error);
  }
};

initializeQdrant();

module.exports = {
  qdrantClient,
  COLLECTION_NAME
};
