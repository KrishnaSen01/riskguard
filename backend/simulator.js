

const http = require('http');

const USERS = ['U1', 'U2', 'U3', 'U4', 'U5'];

const DEVICES = {
  U1: ['D-iPhone-14', 'D-MacBook-Safari'],
  U2: ['D-Pixel-7', 'D-Chrome-Win'],
  U3: ['D-Samsung-S23'],
  U4: ['D-Firefox-Mac'],
  U5: ['D-iPad-Pro'],
};

const LOCATIONS = {
  U1: ['New York', 'Boston'],
  U2: ['Chicago', 'Detroit'],
  U3: ['Los Angeles'],
  U4: ['San Francisco', 'Oakland'],
  U5: ['Seattle'],
};

// PaySim transaction types
const TXN_TYPES = ['PAYMENT', 'TRANSFER', 'CASH_OUT', 'CASH_IN', 'DEBIT'];

/**
 * Generate realistic balance fields for PaySim feature vector.
 * @param {number} amount
 * @param {boolean} isFraud - whether to simulate fraud pattern (balance drained)
 */
function makeBalances(amount, isFraud = false) {
  const oldbalanceOrg  = isFraud
    ? amount * (0.5 + Math.random())
    : amount * (2 + Math.random() * 8);
  const newbalanceOrig = isFraud ? 0 : Math.max(0, oldbalanceOrg - amount);
  const oldbalanceDest = Math.random() * 50000;
  const newbalanceDest = isFraud ? oldbalanceDest : oldbalanceDest + amount;
  return { oldbalanceOrg, newbalanceOrig, oldbalanceDest, newbalanceDest };
}

const SCENARIOS = [
  // 0 — Normal low-value payment
  () => {
    const uid = USERS[Math.floor(Math.random() * USERS.length)];
    const amount = Math.floor(Math.random() * 500) + 20;
    return {
      user_id: uid,
      amount,
      type: 'PAYMENT',
      device_id: DEVICES[uid][0],
      location: LOCATIONS[uid][0],
      failedCount: 0,
      isFlaggedFraud: 0,
      ...makeBalances(amount, false),
    };
  },

  // 1 — Normal cash-in
  () => {
    const uid = USERS[Math.floor(Math.random() * USERS.length)];
    const amount = Math.floor(Math.random() * 800) + 100;
    return {
      user_id: uid,
      amount,
      type: 'CASH_IN',
      device_id: DEVICES[uid][0],
      location: LOCATIONS[uid][0],
      failedCount: 0,
      isFlaggedFraud: 0,
      ...makeBalances(amount, false),
    };
  },

  // 2 — Large transfer (suspicious)
  () => {
    const amount = Math.floor(Math.random() * 40000) + 15000;
    return {
      user_id: USERS[Math.floor(Math.random() * USERS.length)],
      amount,
      type: 'TRANSFER',
      device_id: 'D-Pixel-7',
      location: 'Chicago',
      failedCount: 0,
      isFlaggedFraud: 0,
      ...makeBalances(amount, false),
    };
  },

  // 3 — Unknown device (anomalous)
  () => {
    const uid = USERS[Math.floor(Math.random() * USERS.length)];
    const amount = Math.floor(Math.random() * 1000) + 200;
    return {
      user_id: uid,
      amount,
      type: 'DEBIT',
      device_id: 'D-Unknown-' + Math.floor(Math.random() * 99),
      location: LOCATIONS[uid][0],
      failedCount: 0,
      isFlaggedFraud: 0,
      ...makeBalances(amount, false),
    };
  },

  // 4 — Risky location cash-out
  () => {
    const uid = USERS[Math.floor(Math.random() * USERS.length)];
    const amount = Math.floor(Math.random() * 2000) + 500;
    return {
      user_id: uid,
      amount,
      type: 'CASH_OUT',
      device_id: DEVICES[uid][0],
      location: ['Dubai', 'Moscow', 'Singapore', 'Frankfurt'][Math.floor(Math.random() * 4)],
      failedCount: 0,
      isFlaggedFraud: 0,
      ...makeBalances(amount, false),
    };
  },

  // 5 — Multiple failed attempts
  () => {
    const uid = USERS[Math.floor(Math.random() * USERS.length)];
    const amount = Math.floor(Math.random() * 500) + 50;
    return {
      user_id: uid,
      amount,
      type: 'PAYMENT',
      device_id: DEVICES[uid][0],
      location: LOCATIONS[uid][0],
      failedCount: Math.floor(Math.random() * 5) + 2,
      isFlaggedFraud: 0,
      ...makeBalances(amount, false),
    };
  },

  // 6 — HIGH FRAUD: VPN + large TRANSFER + drained balance
  () => {
    const amount = Math.floor(Math.random() * 30000) + 20000;
    return {
      user_id: USERS[Math.floor(Math.random() * USERS.length)],
      amount,
      type: 'TRANSFER',
      device_id: 'D-VPN-Masked',
      location: 'Unknown',
      failedCount: Math.floor(Math.random() * 8) + 5,
      isFlaggedFraud: 1,
      ...makeBalances(amount, true),
    };
  },

  // 7 — HIGH FRAUD: Tor Browser CASH_OUT
  () => {
    const amount = Math.floor(Math.random() * 5000) + 500;
    return {
      user_id: USERS[Math.floor(Math.random() * USERS.length)],
      amount,
      type: 'CASH_OUT',
      device_id: 'D-Tor-Browser',
      location: 'Unknown',
      failedCount: 0,
      isFlaggedFraud: 1,
      ...makeBalances(amount, true),
    };
  },
];

const SCENARIO_POOL = [
  0, 0, 0, 0,   // 4x normal
  1, 1, 1,      // 3x normal cash-in
  2, 2,         // 2x large transfer
  3,            // unknown device
  4,            // risky location
  5,            // failed attempts
  6,            // VPN fraud
  7,            // Tor fraud
];

function postTransaction(payload) {
  const body = JSON.stringify(payload);

  const options = {
    hostname: 'localhost',
    port: process.env.PORT || 5000,
    path: '/api/transaction',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => (data += chunk));
    res.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        const { txn_id, user_id, risk, ml_fraud } = parsed.data || {};
        if (txn_id) {
          const flag    = risk.score >= 70 ? ' 🚨 FLAGGED' : '';
          const mlFlag  = ml_fraud?.fraud ? ` 🤖 ML:FRAUD(${ml_fraud.confidence})` : '';
          console.log(
            `[SIM] ${user_id} | ₹${payload.amount} | ${payload.type} | Risk: ${risk.score} (${risk.level})${flag}${mlFlag}`
          );
        }
      } catch (_) {}
    });
  });

  req.on('error', (err) => {
    if (err.code !== 'ECONNREFUSED') {
      console.error('[SIM] Error:', err.message);
    }
  });

  req.write(body);
  req.end();
}

function fireBurst() {
  const uid = USERS[Math.floor(Math.random() * USERS.length)];
  for (let i = 0; i < 4; i++) {
    const amount = Math.floor(Math.random() * 300) + 100;
    setTimeout(() => {
      postTransaction({
        user_id: uid,
        amount,
        type: 'PAYMENT',
        device_id: DEVICES[uid][0],
        location: LOCATIONS[uid][0],
        failedCount: 0,
        isFlaggedFraud: 0,
        timestamp: Date.now(),
        ...makeBalances(amount, false),
      });
    }, i * 300);
  }
}

function startSimulator() {
  console.log('[SIM] Transaction simulator started — firing every 2s');

  let tick = 0;

  setInterval(() => {
    tick++;

    if (tick % 15 === 0) {
      console.log('[SIM] 🔥 Firing velocity burst...');
      fireBurst();
      return;
    }

    const idx = SCENARIO_POOL[Math.floor(Math.random() * SCENARIO_POOL.length)];
    const payload = SCENARIOS[idx]();
    payload.timestamp = Date.now();

    postTransaction(payload);
  }, 2000);
}

module.exports = { startSimulator };
