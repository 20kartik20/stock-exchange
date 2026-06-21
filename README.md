# StockAI — Technical Analysis Platform

A professional web-based stock analysis platform with real-time charts, technical indicators, pattern detection, and buy/sell signal generation.

---

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- MongoDB (optional — app runs without it)
- API keys (optional — demo data loads on startup)

### Install & Run

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env and add your API keys (optional)

# 3. Create uploads folder
mkdir -p public/uploads

# 4. Start the server
npm start
# or for development with auto-reload:
npm run dev

# 5. Open browser
open http://localhost:3000
```

---

## 📦 Project Structure

```
stock-analysis/
├── backend/
│   ├── server.js               ← Express + WebSocket server
│   ├── config/
│   │   └── models.js           ← MongoDB schema
│   ├── modules/
│   │   ├── indicatorEngine.js  ← RSI, MACD, EMA, ATR, S/R
│   │   ├── patternEngine.js    ← Pattern detection
│   │   ├── predictionEngine.js ← Buy/Sell logic
│   │   ├── chartParser.js      ← Image → OHLC extraction
│   │   ├── dataFetcher.js      ← Yahoo / AlphaVantage / Finnhub
│   │   └── liveFeedService.js  ← WebSocket live updates
│   └── routes/
│       ├── chartRoutes.js      ← /upload-chart, /fetch-chart
│       ├── analysisRoutes.js   ← /analyze-chart
│       └── liveRoutes.js       ← /live-snapshot
├── frontend/
│   ├── index.html              ← Main UI
│   ├── css/style.css           ← Dark/light theme styles
│   └── js/app.js               ← Chart rendering + API calls
├── public/uploads/             ← Uploaded chart images
├── .env.example                ← Environment variables template
└── package.json
```

---

## 🔑 API Keys (Optional)

Add to `.env`:

| Key | Source |
|-----|--------|
| `ALPHA_VANTAGE_KEY` | https://www.alphavantage.co/support/#api-key |
| `FINNHUB_KEY` | https://finnhub.io |

Yahoo Finance works without a key.

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/fetch-chart?symbol=AAPL&interval=1d&range=6mo` | Fetch OHLC data |
| POST | `/api/upload-chart` | Upload chart image |
| POST | `/api/analyze-chart` | Run full analysis |
| GET | `/api/live-snapshot?symbol=AAPL` | Single live snapshot |
| WS | `ws://localhost:3000/ws` | Live feed WebSocket |

---

## 📊 Features

### Analysis Engine
- **RSI** (14-period) with overbought/oversold detection
- **MACD** (12/26/9) with crossover signals
- **EMA** (20, 50, 200) trend analysis
- **ATR** (14) volatility measurement
- **Support & Resistance** via pivot points

### Pattern Detection
- Double Top / Double Bottom
- Head & Shoulders / Inverse H&S
- Ascending / Descending / Symmetrical Triangle
- Bull Flag / Bear Flag

### Signal Logic
- **BUY**: RSI < 30, bullish MACD crossover, price near support, high volume on green candles
- **SELL**: RSI > 70, bearish MACD crossover, price near resistance, high volume on red candles
- Risk score, stop-loss, take-profit, risk:reward ratio

### Live Feed
- WebSocket real-time updates (5s / 10s / 30s / 1m)
- Live indicator recalculation
- Push buy/sell signals

### UI
- TradingView-like dark/light theme
- Candlestick chart with overlays (EMA lines, S/R levels, buy/sell markers)
- RSI / MACD / Volume sub-charts
- Drag-and-drop chart image upload

---

## 🛠 Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+), Lightweight Charts
- **Backend**: Node.js, Express, WebSocket (ws)
- **Database**: MongoDB + Mongoose
- **APIs**: Yahoo Finance, AlphaVantage, Finnhub
- **Image parsing**: Jimp

---

## ⚠️ Notes

- Demo data loads automatically on startup — no API key needed to explore
- Chart image parsing is heuristic-based (pixel color analysis); for production use a CNN or vision API
- MongoDB is optional — the app fully functions without it (no history persistence)
