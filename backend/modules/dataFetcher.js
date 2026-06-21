/**
 * dataFetcher.js
 * Fetches OHLC data from Yahoo Finance, AlphaVantage, Finnhub
 */

const axios = require('axios');

async function fetchFromYahoo(symbol, interval = '1d', range = '6mo') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
  const { data } = await axios.get(url, {
    params: { interval, range, includePrePost: false },
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 10000
  });

  const result = data.chart.result[0];
  const timestamps = result.timestamp;
  const quote = result.indicators.quote[0];

  return timestamps.map((t, i) => ({
    time: t,
    open:   parseFloat((quote.open[i]   || 0).toFixed(4)),
    high:   parseFloat((quote.high[i]   || 0).toFixed(4)),
    low:    parseFloat((quote.low[i]    || 0).toFixed(4)),
    close:  parseFloat((quote.close[i]  || 0).toFixed(4)),
    volume: Math.round(quote.volume[i]  || 0)
  })).filter(c => c.open && c.close);
}

async function fetchFromAlphaVantage(symbol, interval = 'daily') {
  const key = process.env.ALPHA_VANTAGE_KEY;
  if (!key) throw new Error('AlphaVantage key not configured');

  const functionMap = {
    '1m':  'TIME_SERIES_INTRADAY',
    '5m':  'TIME_SERIES_INTRADAY',
    '15m': 'TIME_SERIES_INTRADAY',
    '1h':  'TIME_SERIES_INTRADAY',
    '1d':  'TIME_SERIES_DAILY',
    'daily': 'TIME_SERIES_DAILY'
  };

  const avInterval = ['1m','5m','15m','1h'].includes(interval) ? interval.replace('m', 'min') : null;
  const func = functionMap[interval] || 'TIME_SERIES_DAILY';

  const params = { function: func, symbol, apikey: key, outputsize: 'compact' };
  if (avInterval) params.interval = avInterval;

  const { data } = await axios.get('https://www.alphavantage.co/query', { params, timeout: 15000 });

  const key2 = Object.keys(data).find(k => k.includes('Time Series'));
  if (!key2) throw new Error('AlphaVantage: no data returned');

  const series = data[key2];
  return Object.entries(series).slice(0, 200).reverse().map(([dateStr, v]) => ({
    time:   Math.floor(new Date(dateStr).getTime() / 1000),
    open:   parseFloat(v['1. open']),
    high:   parseFloat(v['2. high']),
    low:    parseFloat(v['3. low']),
    close:  parseFloat(v['4. close']),
    volume: parseInt(v['5. volume']) || 0
  }));
}

async function fetchFromFinnhub(symbol, resolution = 'D', from, to) {
  const key = process.env.FINNHUB_KEY;
  if (!key) throw new Error('Finnhub key not configured');

  to   = to   || Math.floor(Date.now() / 1000);
  from = from || to - 60 * 60 * 24 * 180;

  const { data } = await axios.get('https://finnhub.io/api/v1/stock/candle', {
    params: { symbol, resolution, from, to, token: key },
    timeout: 10000
  });

  if (data.s !== 'ok') throw new Error('Finnhub: no data');

  return data.t.map((t, i) => ({
    time:   t,
    open:   parseFloat(data.o[i].toFixed(4)),
    high:   parseFloat(data.h[i].toFixed(4)),
    low:    parseFloat(data.l[i].toFixed(4)),
    close:  parseFloat(data.c[i].toFixed(4)),
    volume: data.v[i] || 0
  }));
}

async function fetchOHLC(symbol, interval = '1d', range = '6mo', source = 'yahoo') {
  switch (source.toLowerCase()) {
    case 'alphavantage': return fetchFromAlphaVantage(symbol, interval);
    case 'finnhub':      return fetchFromFinnhub(symbol);
    case 'yahoo':
    default:             return fetchFromYahoo(symbol, interval, range);
  }
}

// Generate mock OHLC for testing when APIs are unavailable
function generateMockOHLC(symbol = 'MOCK', candles = 100) {
  const data = [];
  let price = 150 + Math.random() * 50;
  let time  = Math.floor(Date.now() / 1000) - candles * 86400;
  for (let i = 0; i < candles; i++) {
    const change = (Math.random() - 0.48) * price * 0.02;
    const open   = price;
    const close  = parseFloat((price + change).toFixed(2));
    const high   = parseFloat((Math.max(open, close) + Math.random() * price * 0.01).toFixed(2));
    const low    = parseFloat((Math.min(open, close) - Math.random() * price * 0.01).toFixed(2));
    data.push({ time, open, high, low, close, volume: Math.floor(Math.random() * 5000000) });
    price = close;
    time += 86400;
  }
  return data;
}

module.exports = { fetchOHLC, fetchFromYahoo, fetchFromAlphaVantage, fetchFromFinnhub, generateMockOHLC };
