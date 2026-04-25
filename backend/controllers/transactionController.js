

const { v4: uuidv4 } = require('uuid');
const http = require('http');
const https = require('https');
const calculateRisk = require('../riskEngine');
const store = require('../store');

const ALERT_THRESHOLD = 70;
const ML_SERVICE_HOST = process.env.ML_HOST || 'localhost';
const isLocal = ML_SERVICE_HOST === 'localhost' || ML_SERVICE_HOST === '127.0.0.1';
const ML_SERVICE_PORT = process.env.ML_PORT || (isLocal ? 5001 : 443);
const ML_SERVICE_PROTOCOL = process.env.ML_PROTOCOL || (isLocal ? 'http' : 'https');

/**
 * Call the Python ML microservice for XGBoost fraud prediction.
 * Returns { fraud, probability, confidence, ml_score } or null on failure.
 */
function callMLService(txn) {
  return new Promise((resolve) => {
    const step = new Date(txn.timestamp || Date.now()).getHours() || 1;
    const payload = JSON.stringify({
      step,
      type:            txn.type || 'PAYMENT',
      amount:          txn.amount || 0,
      oldbalanceOrg:   txn.oldbalanceOrg   ?? (txn.amount * (2 + Math.random() * 8)),
      newbalanceOrig:  txn.newbalanceOrig  ?? Math.max(0, (txn.oldbalanceOrg || txn.amount * 5) - txn.amount),
      oldbalanceDest:  txn.oldbalanceDest  ?? (Math.random() * 10000),
      newbalanceDest:  txn.newbalanceDest  ?? (txn.oldbalanceDest || 0) + txn.amount,
      isFlaggedFraud:  txn.isFlaggedFraud  || 0,
    });

    const options = {
      hostname: ML_SERVICE_HOST,
      port:     ML_SERVICE_PORT,
      path:     '/predict',
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const client = ML_SERVICE_PROTOCOL === 'https' ? https : http;
    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (_) {
          resolve(null);
        }
      });
    });

    req.on('error', (e) => { console.error('[ML] Error:', e.message); resolve(null); });
    req.setTimeout(5000, () => { console.error('[ML] Timeout'); req.destroy(); resolve(null); });
    req.write(payload);
    req.end();
  });
}

async function processTransaction(req, res) {
  try {
    const txn = {
      txn_id:    uuidv4(),
      ...req.body,
      receivedAt: Date.now(),
    };

    const userProfile = store.getUser(txn.user_id);
    const risk        = calculateRisk(txn, userProfile);

    // ── ML Fraud Prediction ────────────────────────────────────────────────
    const mlResult = await callMLService(txn);

    // Boost rule score if ML model is confident about fraud
    let finalScore = risk.score;
    if (mlResult && mlResult.fraud && mlResult.confidence === 'HIGH') {
      finalScore = Math.min(100, Math.round(risk.score * 0.5 + mlResult.ml_score * 0.5));
    } else if (mlResult && mlResult.fraud && mlResult.confidence === 'MEDIUM') {
      finalScore = Math.min(100, Math.round(risk.score * 0.7 + mlResult.ml_score * 0.3));
    }

    const enriched = {
      ...txn,
      risk: {
        ...risk,
        score: finalScore,
        level: finalScore >= 70 ? 'HIGH' : finalScore >= 40 ? 'MEDIUM' : 'LOW',
      },
      ml_fraud:  mlResult,
      flagged:   finalScore >= ALERT_THRESHOLD,
    };

    store.addTransaction(enriched);
    store.updateUser(txn.user_id, txn, enriched.risk);

    if (enriched.flagged) {
      store.addAlert(enriched);
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('risk_update', enriched);
      if (enriched.flagged) io.emit('new_alert', enriched);
    }

    return res.status(201).json({ success: true, data: enriched });
  } catch (err) {
    console.error('[TransactionController] Error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

module.exports = { processTransaction, callMLService };
