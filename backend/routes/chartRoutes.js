const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const chartParser = require('../modules/chartParser');
const dataFetcher = require('../modules/dataFetcher');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../public/uploads')),
  filename: (req, file, cb) => cb(null, `chart_${Date.now()}${path.extname(file.originalname)}`)
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    if (allowed.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files allowed'));
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// POST /api/upload-chart
router.post('/upload-chart', upload.single('chart'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const ohlcData = await chartParser.extractOHLC(req.file.path);
    res.json({ success: true, filePath: req.file.path, ohlcData, message: 'Chart parsed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/fetch-chart?symbol=AAPL&interval=1d&range=6mo&source=yahoo
router.get('/fetch-chart', async (req, res) => {
  try {
    const { symbol, interval = '1d', range = '6mo', source = 'yahoo' } = req.query;
    if (!symbol) return res.status(400).json({ error: 'Symbol required' });
    const data = await dataFetcher.fetchOHLC(symbol, interval, range, source);
    res.json({ success: true, symbol, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
