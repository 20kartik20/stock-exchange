/**
 * liveFeedService.js
 * Manages WebSocket subscriptions and pushes live OHLC + indicator updates
 */

const WebSocket = require('ws');
const dataFetcher = require('./dataFetcher');
const indicatorEngine = require('./indicatorEngine');
const predictionEngine = require('./predictionEngine');
const patternEngine    = require('./patternEngine');

class LiveFeedService {
  constructor(wss) {
    this.wss = wss;
    this.subscriptions = new Map(); // ws → { symbol, interval, timer }
  }

  subscribe(ws, symbol, interval = '5s') {
    this.unsubscribe(ws); // clear any existing sub
    console.log(`📈 Live subscribe: ${symbol} @ ${interval}`);

    const ms = this._intervalToMs(interval);
    const timer = setInterval(async () => {
      if (ws.readyState !== WebSocket.OPEN) {
        this.unsubscribe(ws);
        return;
      }
      try {
        const data = await dataFetcher.fetchOHLC(symbol, '5m', '1d', 'yahoo');
        const closes  = data.map(c => c.close);
        const highs   = data.map(c => c.high);
        const lows    = data.map(c => c.low);
        const volumes = data.map(c => c.volume);

        const rsi     = indicatorEngine.calculateRSI(closes, 14);
        const macd    = indicatorEngine.calculateMACD(closes);
        const ema20   = indicatorEngine.calculateEMA(closes, 20);
        const ema50   = indicatorEngine.calculateEMA(closes, 50);
        const atr     = indicatorEngine.calculateATR(highs, lows, closes, 14);
        const { support, resistance } = indicatorEngine.findSupportResistance(highs, lows, closes);
        const patterns    = patternEngine.detectPatterns(data);
        const prediction  = predictionEngine.predict(data, { rsi, macd, ema20, ema50, ema200: null, atr, support, resistance, volumes }, patterns);

        ws.send(JSON.stringify({
          type: 'live_update',
          symbol,
          timestamp: new Date().toISOString(),
          latestCandle: data[data.length - 1],
          indicators: { rsi, macd, ema20, ema50, atr, support, resistance },
          patterns,
          prediction
        }));
      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: err.message }));
      }
    }, ms);

    this.subscriptions.set(ws, { symbol, interval, timer });
    ws.send(JSON.stringify({ type: 'subscribed', symbol, interval }));
  }

  unsubscribe(ws) {
    const sub = this.subscriptions.get(ws);
    if (sub) {
      clearInterval(sub.timer);
      this.subscriptions.delete(ws);
    }
  }

  _intervalToMs(interval) {
    const map = { '5s': 5000, '10s': 10000, '30s': 30000, '1m': 60000, '5m': 300000 };
    return map[interval] || 5000;
  }
}

module.exports = LiveFeedService;
