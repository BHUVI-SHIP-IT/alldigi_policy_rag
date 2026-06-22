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

// Ask a question in a conversation (Streaming SSE)
router.post('/conversations/:id/ask', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { question } = req.body;
  
  if (!question) {
    return res.status(400).json({ error: 'Question is required' });
  }

  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  // Flush headers immediately so frontend knows connection is established
  res.flushHeaders();

  try {
    // Fetch history BEFORE inserting the new message
    const historyResult = await db.query(
      'SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 10',
      [id]
    );
    const history = historyResult.rows;

    // 1. Save user message
    await db.query(
      'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)',
      [id, 'user', question]
    );

    // Update conversation title if it's the first message
    const msgCount = await db.query('SELECT count(*) FROM messages WHERE conversation_id = $1', [id]);
    if (parseInt(msgCount.rows[0].count) === 1) {
      const generatedTitle = question.length > 40 ? question.substring(0, 40) + '...' : question;
      await db.query('UPDATE conversations SET title = $1 WHERE id = $2', [generatedTitle, id]);
    }

    // Send initial chunk so frontend shows something instantly and proxy doesn't drop
    res.write(`data: ${JSON.stringify({ chunk: '⏳ *Thinking...*' })}\n\n`);

    // Keep-alive ping every 15 seconds to prevent browser/proxy from closing idle connection
    const keepAlive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 15000);

    // Create a search query using the last user message + current question to give the vector search context
    const previousUserMsg = history.filter(m => m.role === 'user').pop();
    const searchQuery = previousUserMsg ? `${previousUserMsg.content}. ${question}` : question;

    // 2. Query RAG and LLM with streaming callback
    let firstActualChunk = true;
    const answer = await queryPolicy(question, searchQuery, history, (chunk) => {
      if (firstActualChunk) {
        // Clear the "Thinking..." text by sending a clear flag
        res.write(`data: ${JSON.stringify({ clear: true, chunk })}\n\n`);
        firstActualChunk = false;
      } else {
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }
    });

    clearInterval(keepAlive);

    // If no chunks were streamed (e.g., immediate return from RAG or mock), send the answer as a single chunk
    if (firstActualChunk) {
      res.write(`data: ${JSON.stringify({ clear: true, chunk: answer })}\n\n`);
    }

    // 3. Save assistant message
    const assistantMsgResult = await db.query(
      'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3) RETURNING *',
      [id, 'assistant', answer]
    );

    // 4. Send [DONE] event with the message ID
    res.write(`data: ${JSON.stringify({ done: true, messageId: assistantMsgResult.rows[0].id })}\n\n`);
    res.end();
  } catch (error) {
    console.error('Error in ask endpoint:', error);
    // If headers already sent, we can't change status, just send an error event
    res.write(`data: ${JSON.stringify({ error: 'Failed to answer question' })}\n\n`);
    res.end();
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
