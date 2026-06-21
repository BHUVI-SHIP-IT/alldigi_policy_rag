const express = require('express');
const router = express.Router();
const db = require('../services/db.service');
const { queryPolicy } = require('../services/rag.service');
const { verifyToken } = require('./auth.routes');

// Get all conversations
router.get('/conversations', verifyToken, async (req, res) => {
  try {
    // Usually you'd filter by user_id, but here we keep it simple for MVP
    const result = await db.query('SELECT * FROM conversations ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Create a new conversation
router.post('/conversations', verifyToken, async (req, res) => {
  try {
    const { title } = req.body;
    const result = await db.query(
      'INSERT INTO conversations (title) VALUES ($1) RETURNING *',
      [title || 'New Conversation']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// Get messages for a conversation
router.get('/conversations/:id/messages', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Ask a question in a conversation
router.post('/conversations/:id/ask', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { question } = req.body;
  
  if (!question) {
    return res.status(400).json({ error: 'Question is required' });
  }

  try {
    // 1. Save user message
    await db.query(
      'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)',
      [id, 'user', question]
    );

    // 2. Query RAG and LLM
    const answer = await queryPolicy(question);

    // 3. Save assistant message
    const assistantMsgResult = await db.query(
      'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3) RETURNING *',
      [id, 'assistant', answer]
    );

    res.json({ answer, messageId: assistantMsgResult.rows[0].id });
  } catch (error) {
    console.error('Error in ask endpoint:', error);
    res.status(500).json({ error: 'Failed to answer question' });
  }
});

// Delete a conversation
router.delete('/conversations/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM conversations WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

module.exports = router;
