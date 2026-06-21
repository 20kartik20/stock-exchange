/**
 * indicatorEngine.js
 * Calculates all technical indicators: RSI, MACD, EMA, SMA, ATR, Support/Resistance
 */

function calculateSMA(data, period) {
  if (data.length < period) return null;
  const slice = data.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calculateEMA(data, period) {
  if (data.length < period) return null;
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  return parseFloat(ema.toFixed(4));
}

function calculateEMAArray(data, period) {
  const result = [];
  if (data.length < period) return result;
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(...new Array(period - 1).fill(null));
  result.push(parseFloat(ema.toFixed(4)));
  for (let i = period; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
    result.push(parseFloat(ema.toFixed(4)));
  }
  return result;
}

function calculateRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return parseFloat((100 - 100 / (1 + rs)).toFixed(2));
}

function calculateMACD(closes, fast = 12, slow = 26, signal = 9) {
  const emaFast = calculateEMAArray(closes, fast);
  const emaSlow = calculateEMAArray(closes, slow);
  const macdLine = [];
  for (let i = 0; i < closes.length; i++) {
    if (emaFast[i] !== null && emaSlow[i] !== null) {
      macdLine.push(parseFloat((emaFast[i] - emaSlow[i]).toFixed(4)));
    } else {
      macdLine.push(null);
    }
  }
  const validMacd = macdLine.filter(v => v !== null);
  const signalLine = calculateEMAArray(validMacd, signal);
  const lastMACD   = validMacd[validMacd.length - 1];
  const lastSignal = signalLine[signalLine.length - 1];
  const histogram  = lastMACD !== null && lastSignal !== null
    ? parseFloat((lastMACD - lastSignal).toFixed(4)) : null;
  const crossover =
    validMacd.length >= 2 && signalLine.length >= 2
      ? validMacd[validMacd.length - 2] < signalLine[signalLine.length - 2] &&
        lastMACD > lastSignal
        ? 'bullish'
        : validMacd[validMacd.length - 2] > signalLine[signalLine.length - 2] &&
          lastMACD < lastSignal
        ? 'bearish'
        : 'none'
      : 'none';
  return { macd: lastMACD, signal: lastSignal, histogram, crossover };
}

function calculateATR(highs, lows, closes, period = 14) {
  if (highs.length < period + 1) return null;
  const trueRanges = [];
  for (let i = 1; i < highs.length; i++) {
    const hl = highs[i] - lows[i];
    const hc = Math.abs(highs[i] - closes[i - 1]);
    const lc = Math.abs(lows[i] - closes[i - 1]);
    trueRanges.push(Math.max(hl, hc, lc));
  }
  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
  }
  return parseFloat(atr.toFixed(4));
}

function findSupportResistance(highs, lows, closes, lookback = 20) {
  const support = [], resistance = [];
  const recent = Math.max(0, highs.length - lookback);
  const recentHighs = highs.slice(recent);
  const recentLows  = lows.slice(recent);

  // Pivot-based swing detection
  for (let i = 1; i < recentHighs.length - 1; i++) {
    if (recentHighs[i] > recentHighs[i - 1] && recentHighs[i] > recentHighs[i + 1]) {
      resistance.push(parseFloat(recentHighs[i].toFixed(4)));
    }
    if (recentLows[i] < recentLows[i - 1] && recentLows[i] < recentLows[i + 1]) {
      support.push(parseFloat(recentLows[i].toFixed(4)));
    }
  }

  // Deduplicate levels within 0.5%
  const dedup = (arr) => {
    const sorted = [...arr].sort((a, b) => a - b);
    return sorted.filter((v, i) => i === 0 || Math.abs(v - sorted[i - 1]) / sorted[i - 1] > 0.005);
  };

  return {
    support: dedup(support).slice(-3),
    resistance: dedup(resistance).slice(-3)
  };
}

function calculateBollingerBands(closes, period = 20, multiplier = 2) {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const sma = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((sum, v) => sum + Math.pow(v - sma, 2), 0) / period;
  const stdDev = Math.sqrt(variance);
  return {
    upper: parseFloat((sma + multiplier * stdDev).toFixed(4)),
    middle: parseFloat(sma.toFixed(4)),
    lower: parseFloat((sma - multiplier * stdDev).toFixed(4))
  };
}

function calculateVWAP(ohlcData) {
  let cumTPV = 0, cumVol = 0;
  for (const c of ohlcData) {
    const tp = (c.high + c.low + c.close) / 3;
    cumTPV += tp * (c.volume || 1);
    cumVol += (c.volume || 1);
  }
  return cumVol > 0 ? parseFloat((cumTPV / cumVol).toFixed(4)) : null;
}

module.exports = {
  calculateSMA,
  calculateEMA,
  calculateEMAArray,
  calculateRSI,
  calculateMACD,
  calculateATR,
  calculateBollingerBands,
  calculateVWAP,
  findSupportResistance
};
