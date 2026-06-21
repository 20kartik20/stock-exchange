/**
 * patternEngine.js
 * Detects chart patterns: Triangle, Flag, Double Top/Bottom, Head & Shoulders
 */

function getSwingHighs(highs, window = 3) {
  const swings = [];
  for (let i = window; i < highs.length - window; i++) {
    const slice = highs.slice(i - window, i + window + 1);
    if (highs[i] === Math.max(...slice)) swings.push({ index: i, value: highs[i] });
  }
  return swings;
}

function getSwingLows(lows, window = 3) {
  const swings = [];
  for (let i = window; i < lows.length - window; i++) {
    const slice = lows.slice(i - window, i + window + 1);
    if (lows[i] === Math.min(...slice)) swings.push({ index: i, value: lows[i] });
  }
  return swings;
}

function detectDoubleTop(highs, tolerance = 0.02) {
  const swings = getSwingHighs(highs);
  if (swings.length < 2) return false;
  const last = swings[swings.length - 1];
  const prev = swings[swings.length - 2];
  const diff = Math.abs(last.value - prev.value) / prev.value;
  return diff < tolerance && last.index - prev.index > 5;
}

function detectDoubleBottom(lows, tolerance = 0.02) {
  const swings = getSwingLows(lows);
  if (swings.length < 2) return false;
  const last = swings[swings.length - 1];
  const prev = swings[swings.length - 2];
  const diff = Math.abs(last.value - prev.value) / prev.value;
  return diff < tolerance && last.index - prev.index > 5;
}

function detectHeadAndShoulders(highs, lows) {
  const swings = getSwingHighs(highs, 2);
  if (swings.length < 3) return false;
  const len = swings.length;
  const left = swings[len - 3];
  const head = swings[len - 2];
  const right = swings[len - 1];
  const shouldersClose = Math.abs(left.value - right.value) / left.value < 0.03;
  const headHigher = head.value > left.value * 1.02 && head.value > right.value * 1.02;
  return shouldersClose && headHigher;
}

function detectInverseHeadAndShoulders(lows) {
  const swings = getSwingLows(lows, 2);
  if (swings.length < 3) return false;
  const len = swings.length;
  const left = swings[len - 3];
  const head = swings[len - 2];
  const right = swings[len - 1];
  const shouldersClose = Math.abs(left.value - right.value) / left.value < 0.03;
  const headLower = head.value < left.value * 0.98 && head.value < right.value * 0.98;
  return shouldersClose && headLower;
}

function detectAscendingTriangle(highs, lows) {
  const recentHighs = highs.slice(-15);
  const recentLows  = lows.slice(-15);
  const maxDiff = Math.max(...recentHighs) - Math.min(...recentHighs);
  const resistanceFlat = maxDiff / Math.max(...recentHighs) < 0.015;
  const lowsRising = recentLows[recentLows.length - 1] > recentLows[0] * 1.01;
  return resistanceFlat && lowsRising;
}

function detectDescendingTriangle(highs, lows) {
  const recentHighs = highs.slice(-15);
  const recentLows  = lows.slice(-15);
  const minDiff = Math.max(...recentLows) - Math.min(...recentLows);
  const supportFlat = minDiff / Math.min(...recentLows) < 0.015;
  const highsFalling = recentHighs[recentHighs.length - 1] < recentHighs[0] * 0.99;
  return supportFlat && highsFalling;
}

function detectSymmetricalTriangle(highs, lows) {
  const recentHighs = highs.slice(-15);
  const recentLows  = lows.slice(-15);
  const highsFalling = recentHighs[recentHighs.length - 1] < recentHighs[0] * 0.98;
  const lowsRising  = recentLows[recentLows.length - 1] > recentLows[0] * 1.01;
  return highsFalling && lowsRising;
}

function detectBullFlag(closes, highs, lows) {
  if (closes.length < 15) return false;
  const lookback = 10;
  const poleSlice = closes.slice(-20, -10);
  const flagSlice = closes.slice(-10);
  const poleGain = (poleSlice[poleSlice.length - 1] - poleSlice[0]) / poleSlice[0];
  const flagMove = (flagSlice[flagSlice.length - 1] - flagSlice[0]) / flagSlice[0];
  return poleGain > 0.05 && flagMove > -0.03 && flagMove < 0.01;
}

function detectBearFlag(closes) {
  if (closes.length < 20) return false;
  const poleSlice = closes.slice(-20, -10);
  const flagSlice = closes.slice(-10);
  const poleMove = (poleSlice[poleSlice.length - 1] - poleSlice[0]) / poleSlice[0];
  const flagMove = (flagSlice[flagSlice.length - 1] - flagSlice[0]) / flagSlice[0];
  return poleMove < -0.05 && flagMove < 0.03 && flagMove > -0.01;
}

function detectPatterns(ohlcData) {
  const highs  = ohlcData.map(c => c.high);
  const lows   = ohlcData.map(c => c.low);
  const closes = ohlcData.map(c => c.close);
  const detected = [];

  if (detectDoubleTop(highs))                  detected.push('Double Top');
  if (detectDoubleBottom(lows))                detected.push('Double Bottom');
  if (detectHeadAndShoulders(highs, lows))     detected.push('Head & Shoulders');
  if (detectInverseHeadAndShoulders(lows))     detected.push('Inverse Head & Shoulders');
  if (detectAscendingTriangle(highs, lows))    detected.push('Ascending Triangle');
  if (detectDescendingTriangle(highs, lows))   detected.push('Descending Triangle');
  if (detectSymmetricalTriangle(highs, lows))  detected.push('Symmetrical Triangle');
  if (detectBullFlag(closes, highs, lows))     detected.push('Bull Flag');
  if (detectBearFlag(closes))                  detected.push('Bear Flag');

  return detected;
}

module.exports = { detectPatterns, getSwingHighs, getSwingLows };
