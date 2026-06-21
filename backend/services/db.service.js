const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: (process.env.POSTGRES_USER || 'rag_admin').trim(),
  host: (process.env.POSTGRES_HOST || '127.0.0.1').trim(),
  database: (process.env.POSTGRES_DB || 'rag_metadata').trim(),
  password: (process.env.POSTGRES_PASSWORD || 'rag_password').trim(),
  port: parseInt(process.env.POSTGRES_PORT || '15432', 10),
});

const initializeDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        object_name VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Postgres initialized successfully');
  } catch (error) {
    console.error('Error initializing Postgres:', error);
  }
};

initializeDB();

module.exports = {
  query: (text, params) => pool.query(text, params),
};
