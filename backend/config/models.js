const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema({
  symbol: String,
  timestamp: { type: Date, default: Date.now },
  ohlcData: Array,
  indicators: {
    rsi: Number,
    macd: Object,
    ema20: Number,
    ema50: Number,
    ema200: Number,
    atr: Number,
    support: [Number],
    resistance: [Number]
  },
  patterns: [String],
  prediction: {
    signal: String, // BUY / SELL / HOLD
    confidence: Number,
    stopLoss: Number,
    takeProfit: Number,
    riskReward: Number,
    riskScore: Number
  }
});

module.exports = mongoose.model('Analysis', analysisSchema);
