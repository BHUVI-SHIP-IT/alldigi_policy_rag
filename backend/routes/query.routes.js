const express = require('express');
const { queryPolicy } = require('../services/rag.service');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const answer = await queryPolicy(question);

    res.json({ question, answer });
  } catch (error) {
    console.error('Query error:', error);
    res.status(500).json({ error: 'Failed to process query' });
  }
});

module.exports = router;
