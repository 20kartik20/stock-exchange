/**
 * app.js — StockAI Frontend
 * Handles chart rendering (Lightweight Charts), API calls, WebSocket live feed, UI interactions
 */

// ═══════════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════════
const state = {
  symbol:       'AAPL',
  interval:     '1d',
  range:        '1mo',
  source:       'yahoo',
  ohlcData:     [],
  analysis:     null,
  mainChart:    null,
  candleSeries: null,
  ema20Series:  null,
  ema50Series:  null,
  ema200Series: null,
  volumeSeries: null,
  subChart:     null,
  subSeries:    null,
  ws:           null,
  liveActive:   false,
  subMode:      'rsi'
};

const API = window.location.origin;

// ═══════════════════════════════════════════════════════════
//  CHART SETUP
// ═══════════════════════════════════════════════════════════
function initCharts() {
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const chartOpts = {
    layout: {
      background: { color: isDark ? '#0f1117' : '#f8fafc' },
      textColor:  isDark ? '#8b949e' : '#64748b'
    },
    grid: {
      vertLines:   { color: isDark ? '#1c2333' : '#e2e8f0' },
      horzLines:   { color: isDark ? '#1c2333' : '#e2e8f0' }
    },
    crosshair:   { mode: LightweightCharts.CrosshairMode.Normal },
    timeScale:   { borderColor: isDark ? '#2a3347' : '#e2e8f0', timeVisible: true },
    rightPriceScale: { borderColor: isDark ? '#2a3347' : '#e2e8f0' },
    handleScroll: true,
    handleScale:  true,
  };

  // Main chart
  const mainEl = document.getElementById('mainChart');
  state.mainChart = LightweightCharts.createChart(mainEl, { ...chartOpts, width: mainEl.clientWidth, height: mainEl.clientHeight });

  state.candleSeries = state.mainChart.addCandlestickSeries({
    upColor: '#10b981', downColor: '#ef4444',
    borderUpColor: '#10b981', borderDownColor: '#ef4444',
    wickUpColor: '#10b981', wickDownColor: '#ef4444'
  });

  state.ema20Series  = state.mainChart.addLineSeries({ color: '#3b82f6', lineWidth: 1.5, title: 'EMA20' });
  state.ema50Series  = state.mainChart.addLineSeries({ color: '#f59e0b', lineWidth: 1.5, title: 'EMA50' });
  state.ema200Series = state.mainChart.addLineSeries({ color: '#8b5cf6', lineWidth: 1.5, title: 'EMA200', visible: false });

  // Sub chart
  const subEl = document.getElementById('subChart');
  state.subChart = LightweightCharts.createChart(subEl, { ...chartOpts, width: subEl.clientWidth, height: subEl.clientHeight });
  state.subSeries = state.subChart.addLineSeries({ color: '#3b82f6', lineWidth: 1.5 });

  // Sync crosshair
  syncCharts(state.mainChart, state.subChart);

  // Resize observer
  const ro = new ResizeObserver(() => {
    state.mainChart.resize(mainEl.clientWidth, mainEl.clientHeight);
    state.subChart.resize(subEl.clientWidth, subEl.clientHeight);
  });
  ro.observe(mainEl);
  ro.observe(subEl);
}

function syncCharts(c1, c2) {
  c1.timeScale().subscribeVisibleLogicalRangeChange(range => {
    if (range) c2.timeScale().setVisibleLogicalRange(range);
  });
  c2.timeScale().subscribeVisibleLogicalRangeChange(range => {
    if (range) c1.timeScale().setVisibleLogicalRange(range);
  });
}

// ═══════════════════════════════════════════════════════════
//  DATA & RENDERING
// ═══════════════════════════════════════════════════════════
async function fetchAndRender() {
  const symbol   = document.getElementById('symbolInput').value.trim().toUpperCase();
  const interval = document.getElementById('intervalSelect').value;
  const source   = document.getElementById('sourceSelect').value;
  if (!symbol) return;

  state.symbol   = symbol;
  state.interval = interval;
  state.source   = source;
  document.getElementById('currentSymbol').textContent = symbol;

  showLoading(true);
  try {
    const res  = await fetch(`${API}/api/fetch-chart?symbol=${symbol}&interval=${interval}&range=${state.range}&source=${source}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error);

    state.ohlcData = json.data;
    renderCandles(json.data);
    updatePriceBar(json.data);
    showToast(`Loaded ${json.data.length} candles for ${symbol}`, 'success');
  } catch (err) {
    showToast(`Fetch failed: ${err.message}`, 'error');
    // Demo data fallback
    const demo = generateDemoData();
    state.ohlcData = demo;
    renderCandles(demo);
    updatePriceBar(demo);
  } finally {
    showLoading(false);
  }
}

function renderCandles(data) {
  const candles = data.map(c => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close }));
  state.candleSeries.setData(candles);

  // EMA lines
  renderEMALine(state.ema20Series,  data, 20,  document.getElementById('toggleEMA20').checked);
  renderEMALine(state.ema50Series,  data, 50,  document.getElementById('toggleEMA50').checked);
  renderEMALine(state.ema200Series, data, 200, document.getElementById('toggleEMA200').checked);

  renderSubChart(data);
  state.mainChart.timeScale().fitContent();
}

function renderEMALine(series, data, period, visible) {
  series.applyOptions({ visible });
  if (!visible) return;
  const closes = data.map(c => c.close);
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const points = [];
  for (let i = period; i < data.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
    points.push({ time: data[i].time, value: parseFloat(ema.toFixed(4)) });
  }
  series.setData(points);
}

function renderSubChart(data) {
  const closes = data.map(c => c.close);
  const mode = state.subMode;

  if (mode === 'volume') {
    state.subChart.removeSeries(state.subSeries);
    state.subSeries = state.subChart.addHistogramSeries({
      color: '#3b82f6', priceFormat: { type: 'volume' }
    });
    const vol = data.map(c => ({
      time: c.time,
      value: c.volume || 0,
      color: c.close >= c.open ? 'rgba(16,185,129,.6)' : 'rgba(239,68,68,.6)'
    }));
    state.subSeries.setData(vol);
    return;
  }

  if (mode === 'rsi') {
    state.subChart.removeSeries(state.subSeries);
    state.subSeries = state.subChart.addLineSeries({ color: '#8b5cf6', lineWidth: 1.5, title: 'RSI' });
    const rsiData = [];
    const period = 14;
    for (let i = period + 1; i < data.length; i++) {
      const slice = closes.slice(i - period - 1, i);
      let gains = 0, losses = 0;
      for (let j = 1; j < slice.length; j++) {
        const d = slice[j] - slice[j - 1];
        if (d > 0) gains += d; else losses -= d;
      }
      const avgG = gains / period, avgL = losses / period;
      const rsi = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
      rsiData.push({ time: data[i].time, value: parseFloat(rsi.toFixed(2)) });
    }
    state.subSeries.setData(rsiData);
    // overbought/oversold lines
    return;
  }

  if (mode === 'macd') {
    state.subChart.removeSeries(state.subSeries);
    state.subSeries = state.subChart.addHistogramSeries({ color: '#3b82f6', title: 'MACD Hist' });
    const macdData = computeMACDData(data);
    state.subSeries.setData(macdData.histogram);
  }
}

function computeMACDData(data) {
  const closes = data.map(c => c.close);
  const ema = (arr, p) => {
    const k = 2 / (p + 1);
    let e = arr.slice(0, p).reduce((a, b) => a + b, 0) / p;
    return arr.slice(p).map(v => { e = v * k + e * (1 - k); return e; });
  };
  const fast = ema(closes, 12);
  const slow = ema(closes, 26);
  const offset = 26 - 12;
  const macdLine = fast.slice(offset).map((v, i) => v - slow[i]);
  const signalLine = ema(macdLine, 9);
  const histogram = macdLine.slice(9).map((v, i) => ({
    time: data[26 + 9 + i].time,
    value: parseFloat((v - signalLine[i]).toFixed(4)),
    color: (v - signalLine[i]) >= 0 ? 'rgba(16,185,129,.7)' : 'rgba(239,68,68,.7)'
  }));
  return { histogram };
}

function updatePriceBar(data) {
  const last = data[data.length - 1];
  const prev = data[data.length - 2];
  if (!last) return;
  const change = last.close - prev.close;
  const pct    = (change / prev.close) * 100;
  document.getElementById('currentPrice').textContent = `$${last.close.toFixed(2)}`;
  const changeEl = document.getElementById('priceChange');
  changeEl.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)} (${pct.toFixed(2)}%)`;
  changeEl.className = `price-change ${change >= 0 ? 'up' : 'down'}`;
  document.getElementById('priceMeta').textContent = new Date(last.time * 1000).toLocaleDateString();
}

// ═══════════════════════════════════════════════════════════
//  ANALYSIS
// ═══════════════════════════════════════════════════════════
async function runAnalysis() {
  if (!state.ohlcData.length) {
    showToast('Fetch chart data first', 'info');
    return;
  }

  const btn = document.getElementById('analyzeBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Analyzing…';

  try {
    const res  = await fetch(`${API}/api/analyze-chart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ohlcData: state.ohlcData, symbol: state.symbol })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);

    state.analysis = json.analysis;
    renderAnalysis(json.analysis);
    showToast('Analysis complete!', 'success');
  } catch (err) {
    showToast(`Analysis error: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '⚡ Run Analysis';
  }
}

function renderAnalysis(a) {
  const { indicators, patterns, prediction } = a;

  // Signal card
  const badge = document.getElementById('signalBadge');
  badge.textContent = prediction.signal;
  badge.className   = `signal-badge ${prediction.signal}`;
  document.getElementById('signalConfidence').textContent = `Confidence: ${prediction.confidence}%`;

  // Indicators
  const fmt = v => v != null ? (typeof v === 'number' ? v.toFixed(2) : v) : '—';
  document.getElementById('rsiValue').textContent   = fmt(indicators.rsi);
  document.getElementById('macdValue').textContent  = indicators.macd ? `${fmt(indicators.macd.macd)} (${indicators.macd.crossover})` : '—';
  document.getElementById('ema20Value').textContent  = fmt(indicators.ema20);
  document.getElementById('ema50Value').textContent  = fmt(indicators.ema50);
  document.getElementById('ema200Value').textContent = fmt(indicators.ema200);
  document.getElementById('atrValue').textContent    = fmt(indicators.atr);

  // Color RSI
  const rsiEl = document.getElementById('rsiValue');
  if (indicators.rsi < 30)      rsiEl.style.color = 'var(--bullish)';
  else if (indicators.rsi > 70) rsiEl.style.color = 'var(--bearish)';
  else                           rsiEl.style.color = '';

  // S/R levels
  const res = indicators.resistance || [];
  const sup = indicators.support    || [];
  document.getElementById('resistanceLevels').innerHTML = res.length
    ? res.map(v => `<div>$${v.toFixed(2)}</div>`).join('') : '—';
  document.getElementById('supportLevels').innerHTML = sup.length
    ? sup.map(v => `<div>$${v.toFixed(2)}</div>`).join('') : '—';

  // Add price lines on chart
  res.forEach(level => {
    state.candleSeries.createPriceLine({ price: level, color: '#ef4444', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'R' });
  });
  sup.forEach(level => {
    state.candleSeries.createPriceLine({ price: level, color: '#10b981', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'S' });
  });

  // Risk metrics
  document.getElementById('stopLoss').textContent   = prediction.stopLoss   ? `$${prediction.stopLoss.toFixed(2)}`   : '—';
  document.getElementById('takeProfit').textContent = prediction.takeProfit  ? `$${prediction.takeProfit.toFixed(2)}` : '—';
  document.getElementById('riskReward').textContent = prediction.riskReward  ? `${prediction.riskReward}:1`          : '—';
  document.getElementById('riskScore').textContent  = prediction.riskScore != null ? `${prediction.riskScore}/10`  : '—';

  // Patterns
  const pEl = document.getElementById('patternsPanel');
  pEl.innerHTML = patterns.length
    ? patterns.map(p => `<span class="pattern-tag">${p}</span>`).join(' ')
    : '<span style="color:var(--text-muted)">None detected</span>';

  // Reasons
  const rEl = document.getElementById('reasonsPanel');
  const buyR  = (prediction.reasons?.buy  || []).map(r => `<div class="reason-item buy">▲ ${r}</div>`);
  const sellR = (prediction.reasons?.sell || []).map(r => `<div class="reason-item sell">▼ ${r}</div>`);
  rEl.innerHTML = [...buyR, ...sellR].join('') || '—';

  // Buy/sell markers on chart
  if (prediction.signal !== 'HOLD') {
    const lastCandle = state.ohlcData[state.ohlcData.length - 1];
    const markers = [{
      time:     lastCandle.time,
      position: prediction.signal === 'BUY' ? 'belowBar' : 'aboveBar',
      color:    prediction.signal === 'BUY' ? '#10b981' : '#ef4444',
      shape:    prediction.signal === 'BUY' ? 'arrowUp' : 'arrowDown',
      text:     prediction.signal
    }];
    state.candleSeries.setMarkers(markers);
  }
}

// ═══════════════════════════════════════════════════════════
//  LIVE FEED
// ═══════════════════════════════════════════════════════════
function toggleLiveFeed() {
  if (state.liveActive) {
    stopLiveFeed();
  } else {
    startLiveFeed();
  }
}

function startLiveFeed() {
  const symbol = document.getElementById('liveSymbol').value.trim().toUpperCase();
  const interval = document.getElementById('liveInterval').value;
  if (!symbol) return;

  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl    = `${protocol}//${location.host}/ws`;
  state.ws       = new WebSocket(wsUrl);

  state.ws.onopen = () => {
    state.ws.send(JSON.stringify({ type: 'subscribe', symbol, interval }));
    state.liveActive = true;
    document.getElementById('liveDot').classList.add('active');
    document.getElementById('liveStatus').textContent = `Live: ${symbol} @ ${interval}`;
    document.getElementById('liveToggle').textContent = 'Stop Live';
  };

  state.ws.onmessage = (evt) => {
    const msg = JSON.parse(evt.data);
    if (msg.type === 'live_update') {
      addFeedItem(msg);
    }
  };

  state.ws.onerror = () => showToast('WebSocket error — using polling fallback', 'error');
  state.ws.onclose = () => {
    state.liveActive = false;
    document.getElementById('liveDot').classList.remove('active');
    document.getElementById('liveStatus').textContent = 'Live Feed Inactive';
    document.getElementById('liveToggle').textContent = 'Start Live';
  };
}

function stopLiveFeed() {
  if (state.ws) { state.ws.close(); state.ws = null; }
}

function addFeedItem(msg) {
  const list = document.getElementById('liveFeedList');
  const price = msg.latestCandle?.close || '—';
  const sig   = msg.prediction?.signal || 'HOLD';

  const item = document.createElement('div');
  item.className = 'feed-item';
  item.innerHTML = `
    <span class="feed-symbol">${msg.symbol}</span>
    <span class="feed-price">$${typeof price === 'number' ? price.toFixed(2) : price}</span>
    <span class="feed-signal ${sig}">${sig}</span>
    <span style="color:var(--text-muted);font-size:10px">${new Date().toLocaleTimeString()}</span>
  `;
  list.prepend(item);
  if (list.children.length > 20) list.lastChild.remove();
}

// ═══════════════════════════════════════════════════════════
//  IMAGE UPLOAD
// ═══════════════════════════════════════════════════════════
function setupUpload() {
  const zone  = document.getElementById('uploadZone');
  const input = document.getElementById('fileInput');

  zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) uploadChart(e.dataTransfer.files[0]);
  });
  input.addEventListener('change', () => { if (input.files[0]) uploadChart(input.files[0]); });
}

async function uploadChart(file) {
  const form = new FormData();
  form.append('chart', file);
  showLoading(true);
  try {
    const res  = await fetch(`${API}/api/upload-chart`, { method: 'POST', body: form });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    state.ohlcData = json.ohlcData;
    renderCandles(json.ohlcData);
    updatePriceBar(json.ohlcData);
    showToast(`Image parsed: ${json.ohlcData.length} candles extracted`, 'success');
  } catch (err) {
    showToast(`Upload error: ${err.message}`, 'error');
  } finally {
    showLoading(false);
  }
}

// ═══════════════════════════════════════════════════════════
//  UI HELPERS
// ═══════════════════════════════════════════════════════════
function showLoading(show) {
  document.getElementById('chartLoading').classList.toggle('hidden', !show);
}

function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function generateDemoData(n = 120) {
  const data = [];
  let p = 175, t = Math.floor(Date.now() / 1000) - n * 86400;
  for (let i = 0; i < n; i++) {
    const d = (Math.random() - 0.48) * 3;
    const o = parseFloat(p.toFixed(2));
    const c = parseFloat((p + d).toFixed(2));
    data.push({
      time: t, open: o,
      high: parseFloat((Math.max(o, c) + Math.random() * 2).toFixed(2)),
      low:  parseFloat((Math.min(o, c) - Math.random() * 2).toFixed(2)),
      close: c, volume: Math.floor(Math.random() * 5e6)
    });
    p = c; t += 86400;
  }
  return data;
}

function toggleTheme() {
  const html  = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  document.getElementById('themeToggle').textContent = isDark ? '🌙' : '☀️';
  // Rebuild charts with new colors
  document.getElementById('mainChart').innerHTML = '';
  document.getElementById('subChart').innerHTML  = '';
  initCharts();
  if (state.ohlcData.length) {
    renderCandles(state.ohlcData);
  }
}

// ═══════════════════════════════════════════════════════════
//  EVENT BINDINGS
// ═══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  initCharts();
  setupUpload();

  document.getElementById('fetchBtn').addEventListener('click', fetchAndRender);
  document.getElementById('analyzeBtn').addEventListener('click', runAnalysis);
  document.getElementById('liveToggle').addEventListener('click', toggleLiveFeed);
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);

  document.getElementById('symbolInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') fetchAndRender();
  });

  // Range buttons
  document.querySelectorAll('.range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.range = btn.dataset.range;
      if (state.ohlcData.length) fetchAndRender();
    });
  });

  // Subchart tabs
  document.querySelectorAll('.subchart-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.subchart-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.subMode = tab.dataset.sub;
      if (state.ohlcData.length) renderSubChart(state.ohlcData);
    });
  });

  // Indicator toggles
  ['toggleEMA20', 'toggleEMA50', 'toggleEMA200'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
      if (state.ohlcData.length) renderCandles(state.ohlcData);
    });
  });

  // Nav tabs (placeholder)
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });

  // Load demo data on startup
  const demo = generateDemoData();
  state.ohlcData = demo;
  renderCandles(demo);
  updatePriceBar(demo);
  showLoading(false);
  showToast('Demo data loaded — click "Fetch Chart" for real data', 'info');
});
