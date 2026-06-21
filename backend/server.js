require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const rateLimit = require('express-rate-limit');

const chartRoutes = require('./routes/chartRoutes');
const analysisRoutes = require('./routes/analysisRoutes');
const liveRoutes = require('./routes/liveRoutes');
const LiveFeedService = require('./modules/liveFeedService');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/', limiter);

// MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/stock_analysis')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.log('⚠️  MongoDB not connected (running without DB):', err.message));

// Routes
app.use('/api', chartRoutes);
app.use('/api', analysisRoutes);
app.use('/api', liveRoutes);

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// WebSocket handling
const liveFeedService = new LiveFeedService(wss);

wss.on('connection', (ws) => {
  console.log('🔌 Client connected via WebSocket');
  ws.send(JSON.stringify({ type: 'connected', message: 'Live feed connected' }));

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'subscribe' && msg.symbol) {
        liveFeedService.subscribe(ws, msg.symbol, msg.interval || '5s');
      } else if (msg.type === 'unsubscribe') {
        liveFeedService.unsubscribe(ws);
      }
    } catch (e) {
      console.error('WS message error:', e.message);
    }
  });

  ws.on('close', () => {
    liveFeedService.unsubscribe(ws);
    console.log('🔌 Client disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Stock Analysis Platform running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket server running on ws://localhost:${PORT}/ws`);
});
