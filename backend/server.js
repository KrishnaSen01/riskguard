

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }
});

app.set('io', io);

const transactionRoutes = require('./routes/transactionRoutes');
const riskRoutes = require('./routes/riskRoutes');
const alertRoutes = require('./routes/alertRoutes');
const store = require('./store');
const calculateRisk = require('./riskEngine');
const { callMLService } = require('./controllers/transactionController');

app.use('/api/transaction', transactionRoutes);
app.use('/api/risk', riskRoutes);
app.use('/api/alerts', alertRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), ts: Date.now() });
});

io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);

  socket.emit('stats_update', store.getStats());

  socket.on('new_txn', async (txn) => {
    if (!txn || !txn.user_id || txn.amount === undefined) {
      socket.emit('error', { message: 'Invalid transaction payload' });
      return;
    }

    const userProfile = store.getUser(txn.user_id);
    const risk = calculateRisk(txn, userProfile);

    // ML Fraud Prediction
    const mlResult = await callMLService({ ...txn, timestamp: txn.timestamp || Date.now() });

    let finalScore = risk.score;
    if (mlResult && mlResult.fraud && mlResult.confidence === 'HIGH') {
      finalScore = Math.min(100, Math.round(risk.score * 0.5 + mlResult.ml_score * 0.5));
    } else if (mlResult && mlResult.fraud && mlResult.confidence === 'MEDIUM') {
      finalScore = Math.min(100, Math.round(risk.score * 0.7 + mlResult.ml_score * 0.3));
    }

    const enriched = {
      txn_id: `ws-${Date.now()}`,
      ...txn,
      timestamp: txn.timestamp || Date.now(),
      receivedAt: Date.now(),
      risk: {
        ...risk,
        score: finalScore,
        level: finalScore >= 70 ? 'HIGH' : finalScore >= 40 ? 'MEDIUM' : 'LOW',
      },
      ml_fraud: mlResult,
      flagged: finalScore >= 70,
    };

    store.addTransaction(enriched);
    store.updateUser(txn.user_id, txn, enriched.risk);

    if (enriched.flagged) {
      store.addAlert(enriched);
      io.emit('new_alert', enriched);
    }

    io.emit('risk_update', enriched);
    io.emit('stats_update', store.getStats());
  });

  socket.on('disconnect', () => {
    console.log(`[WS] Client disconnected: ${socket.id}`);
  });
});

setInterval(() => {
  io.emit('stats_update', store.getStats());
}, 5000);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n🚀 Risk Detection Server running on port ${PORT}`);
  console.log(`   REST:      http://localhost:${PORT}/api`);
  console.log(`   WebSocket: ws://localhost:${PORT}`);
  console.log(`   Health:    http://localhost:${PORT}/health\n`);

  setTimeout(() => {
    const { startSimulator } = require('./simulator');
    startSimulator();
  }, 1000);
});