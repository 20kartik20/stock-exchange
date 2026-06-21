/**
 * predictionEngine.js
 * Generates Buy/Sell/Hold signals with risk metrics
 */

function predict(ohlcData, indicators, patterns) {
  const { rsi, macd, ema20, ema50, ema200, atr, support, resistance, volumes } = indicators;
  const closes = ohlcData.map(c => c.close);
  const currentPrice = closes[closes.length - 1];

  let buyScore  = 0;
  let sellScore = 0;
  const reasons = { buy: [], sell: [] };

  // ── RSI ──────────────────────────────────────────────────────────────
  if (rsi !== null) {
    if (rsi < 30) { buyScore += 2; reasons.buy.push(`RSI oversold (${rsi})`); }
    else if (rsi < 40) { buyScore += 1; reasons.buy.push(`RSI approaching oversold (${rsi})`); }
    if (rsi > 70) { sellScore += 2; reasons.sell.push(`RSI overbought (${rsi})`); }
    else if (rsi > 60) { sellScore += 1; reasons.sell.push(`RSI approaching overbought (${rsi})`); }
  }

  // ── MACD ─────────────────────────────────────────────────────────────
  if (macd) {
    if (macd.crossover === 'bullish') { buyScore += 2; reasons.buy.push('MACD bullish crossover'); }
    if (macd.crossover === 'bearish') { sellScore += 2; reasons.sell.push('MACD bearish crossover'); }
    if (macd.histogram > 0) { buyScore += 1; reasons.buy.push('MACD histogram positive'); }
    if (macd.histogram < 0) { sellScore += 1; reasons.sell.push('MACD histogram negative'); }
  }

  // ── EMA Trend ────────────────────────────────────────────────────────
  if (ema20 && ema50) {
    if (currentPrice > ema20 && ema20 > ema50) { buyScore += 1; reasons.buy.push('Price above EMA20 > EMA50'); }
    if (currentPrice < ema20 && ema20 < ema50) { sellScore += 1; reasons.sell.push('Price below EMA20 < EMA50'); }
  }
  if (ema200) {
    if (currentPrice > ema200) { buyScore += 1; reasons.buy.push('Price above EMA200 (bull trend)'); }
    else { sellScore += 1; reasons.sell.push('Price below EMA200 (bear trend)'); }
  }

  // ── Support / Resistance ─────────────────────────────────────────────
  if (support && support.length > 0) {
    const nearestSupport = support.reduce((a, b) => Math.abs(b - currentPrice) < Math.abs(a - currentPrice) ? b : a);
    const distSupport = (currentPrice - nearestSupport) / currentPrice;
    if (distSupport < 0.02) { buyScore += 2; reasons.buy.push(`Price near support (${nearestSupport.toFixed(2)})`); }
  }
  if (resistance && resistance.length > 0) {
    const nearestResistance = resistance.reduce((a, b) => Math.abs(b - currentPrice) < Math.abs(a - currentPrice) ? b : a);
    const distResistance = (nearestResistance - currentPrice) / currentPrice;
    if (distResistance < 0.02) { sellScore += 2; reasons.sell.push(`Price near resistance (${nearestResistance.toFixed(2)})`); }
  }

  // ── Volume ───────────────────────────────────────────────────────────
  if (volumes && volumes.length > 5) {
    const avgVol = volumes.slice(-10).reduce((a, b) => a + b, 0) / 10;
    const lastVol = volumes[volumes.length - 1];
    const lastCandle = ohlcData[ohlcData.length - 1];
    const isBullCandle = lastCandle.close > lastCandle.open;
    if (lastVol > avgVol * 1.5 && isBullCandle) { buyScore += 1; reasons.buy.push('High volume on bullish candle'); }
    if (lastVol > avgVol * 1.5 && !isBullCandle) { sellScore += 1; reasons.sell.push('High volume on bearish candle'); }
  }

  // ── Patterns ─────────────────────────────────────────────────────────
  const bullishPatterns = ['Double Bottom', 'Inverse Head & Shoulders', 'Ascending Triangle', 'Bull Flag'];
  const bearishPatterns = ['Double Top', 'Head & Shoulders', 'Descending Triangle', 'Bear Flag'];
  for (const p of patterns) {
    if (bullishPatterns.includes(p)) { buyScore += 2; reasons.buy.push(`Pattern: ${p}`); }
    if (bearishPatterns.includes(p)) { sellScore += 2; reasons.sell.push(`Pattern: ${p}`); }
  }

  // ── Signal ───────────────────────────────────────────────────────────
  const totalScore = buyScore + sellScore || 1;
  let signal, confidence;
  if (buyScore > sellScore + 2) {
    signal = 'BUY';
    confidence = Math.min(95, Math.round((buyScore / totalScore) * 100));
  } else if (sellScore > buyScore + 2) {
    signal = 'SELL';
    confidence = Math.min(95, Math.round((sellScore / totalScore) * 100));
  } else {
    signal = 'HOLD';
    confidence = 50;
  }

  // ── Risk Metrics ─────────────────────────────────────────────────────
  const atrValue = atr || currentPrice * 0.02;
  const stopLoss   = signal === 'BUY' ? parseFloat((currentPrice - atrValue * 1.5).toFixed(4))
                   : signal === 'SELL' ? parseFloat((currentPrice + atrValue * 1.5).toFixed(4))
                   : null;
  const takeProfit = signal === 'BUY' ? parseFloat((currentPrice + atrValue * 3).toFixed(4))
                   : signal === 'SELL' ? parseFloat((currentPrice - atrValue * 3).toFixed(4))
                   : null;
  const riskReward = stopLoss && takeProfit
    ? parseFloat((Math.abs(takeProfit - currentPrice) / Math.abs(currentPrice - stopLoss)).toFixed(2))
    : null;
  const riskScore = Math.round(((sellScore / (totalScore)) * 10));

  return {
    signal,
    confidence,
    buyScore,
    sellScore,
    reasons,
    stopLoss,
    takeProfit,
    riskReward,
    riskScore,
    currentPrice
  };
}

module.exports = { predict };
