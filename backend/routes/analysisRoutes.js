const express = require('express');
const router = express.Router();
const indicatorEngine = require('../modules/indicatorEngine');
const patternEngine = require('../modules/patternEngine');
const predictionEngine = require('../modules/predictionEngine');

// POST /api/analyze-chart
router.post('/analyze-chart', async (req, res) => {
  try {
    const { ohlcData, symbol } = req.body;
    if (!ohlcData || !Array.isArray(ohlcData) || ohlcData.length < 20) {
      return res.status(400).json({ error: 'Need at least 20 OHLC candles' });
    }

    const closes = ohlcData.map(c => c.close);
    const highs  = ohlcData.map(c => c.high);
    const lows   = ohlcData.map(c => c.low);
    const volumes= ohlcData.map(c => c.volume || 0);

    // Indicators
    const rsi    = indicatorEngine.calculateRSI(closes, 14);
    const macd   = indicatorEngine.calculateMACD(closes);
    const ema20  = indicatorEngine.calculateEMA(closes, 20);
    const ema50  = indicatorEngine.calculateEMA(closes, 50);
    const ema200 = indicatorEngine.calculateEMA(closes, 200);
    const atr    = indicatorEngine.calculateATR(highs, lows, closes, 14);
    const { support, resistance } = indicatorEngine.findSupportResistance(highs, lows, closes);

    // Patterns
    const patterns = patternEngine.detectPatterns(ohlcData);

    // Prediction
    const indicators = { rsi, macd, ema20, ema50, ema200, atr, support, resistance, volumes };
    const prediction = predictionEngine.predict(ohlcData, indicators, patterns);

    const result = {
      symbol: symbol || 'UNKNOWN',
      timestamp: new Date(),
      indicators: { rsi, macd, ema20, ema50, ema200, atr, support, resistance },
      patterns,
      prediction,
      chartData: ohlcData
    };

    res.json({ success: true, analysis: result });
  } catch (err) {
    console.error('Analysis error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/history/:symbol
router.get('/history/:symbol', async (req, res) => {
  try {
    res.json({ success: true, symbol: req.params.symbol, history: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
