const express = require('express');
const router = express.Router();
const dataFetcher = require('../modules/dataFetcher');

// GET /api/live-snapshot?symbol=AAPL
router.get('/live-snapshot', async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!symbol) return res.status(400).json({ error: 'Symbol required' });
    const data = await dataFetcher.fetchOHLC(symbol, '5m', '1d', 'yahoo');
    res.json({ success: true, symbol, data, timestamp: new Date() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
