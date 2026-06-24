const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

const authRoutes = require('./routes/auth.routes');
const documentRoutes = require('./routes/document.routes');
const queryRoutes = require('./routes/query.routes');
const chatRoutes = require('./routes/chat.routes');
const { initLLM } = require('./services/rag.service');

app.use('/api/auth', authRoutes.router);
app.use('/api/docs', documentRoutes);
app.use('/api/query', queryRoutes);
app.use('/api/chat', chatRoutes);

// Initialize LLM mock/real
initLLM();

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'RAG Backend is running' });
});

// TODO: Mount document, and query routes here

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
server.setTimeout(0);
