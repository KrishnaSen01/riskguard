

import React, { useEffect, useState, useCallback } from 'react';
import socket, { BACKEND_URL } from './socket';

import Header          from './components/Header';
import StatCard        from './components/StatCard';
import TransactionFeed from './components/TransactionFeed';
import AlertsPanel     from './components/AlertsPanel';
import RiskGauge       from './components/RiskGauge';
import ActivityChart   from './components/ActivityChart';
import MLInsightsPanel from './components/MLInsightsPanel';

const Icons = {
  Zap: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  AlertTriangle: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  Users: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  TrendingUp: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
  Shield: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
};

export default function App() {
  const [connected, setConnected]       = useState(socket.connected);
  const [transactions, setTransactions] = useState([]);
  const [alerts, setAlerts]             = useState([]);
  const [stats, setStats]               = useState({});
  const [latestScore, setLatestScore]   = useState(0);
  const [mlFraudCount, setMlFraudCount] = useState(0);

  useEffect(() => {
    setConnected(socket.connected);
    socket.on('connect',    () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('risk_update', (txn) => {
      setTransactions((prev) => {
        const updated = [txn, ...prev];
        return updated.slice(0, 100);
      });
      setLatestScore(txn.risk?.score ?? 0);

      // Track ML fraud detections
      if (txn.ml_fraud?.fraud) {
        setMlFraudCount((c) => c + 1);
      }
    });

    socket.on('new_alert', (txn) => {
      setAlerts((prev) => [txn, ...prev].slice(0, 50));
    });

    socket.on('stats_update', (s) => {
      setStats(s);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('risk_update');
      socket.off('new_alert');
      socket.off('stats_update');
    };
  }, []);

  const handleSimulate = useCallback(() => {
    const users    = ['U1', 'U2', 'U3', 'U4', 'U5'];
    const devices  = ['D-iPhone-14', 'D-Unknown-99', 'D-VPN-Masked', 'D-MacBook-Pro', 'D-Tor-Browser'];
    const locs     = ['New York', 'Unknown', 'Moscow', 'Chicago', 'Singapore'];
    const types    = ['PAYMENT', 'TRANSFER', 'CASH_OUT', 'CASH_IN', 'DEBIT'];

    const amount = Math.floor(Math.random() * 50000) + 50;
    const isFraud = Math.random() > 0.6;

    const txn = {
      user_id:         users[Math.floor(Math.random() * users.length)],
      amount,
      type:            types[Math.floor(Math.random() * types.length)],
      device_id:       devices[Math.floor(Math.random() * devices.length)],
      location:        locs[Math.floor(Math.random() * locs.length)],
      failedCount:     Math.random() > 0.7 ? Math.floor(Math.random() * 8) : 0,
      isFlaggedFraud:  isFraud ? 1 : 0,
      oldbalanceOrg:   isFraud ? amount * 0.8 : amount * 5,
      newbalanceOrig:  isFraud ? 0 : amount * 4,
      oldbalanceDest:  Math.random() * 30000,
      newbalanceDest:  isFraud ? Math.random() * 30000 : Math.random() * 30000 + amount,
      timestamp:       Date.now(),
    };

    socket.emit('new_txn', txn);
  }, []);

  const handleDismiss = useCallback((txnId) => {
    setAlerts((prev) => prev.filter((a) => a.txn_id !== txnId));
    fetch(`${BACKEND_URL}/api/alerts/${txnId}/dismiss`, { method: 'POST' })
      .catch(() => {});
  }, []);

  const highRiskPct = stats.total
    ? Math.round((stats.highRisk / stats.total) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-100 p-4 md:p-6 selection:bg-indigo-500/30">
      {/* Ambient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/8 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-40 w-80 h-80 bg-indigo-600/6 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 left-1/3 w-72 h-72 bg-rose-600/5 rounded-full blur-3xl" />
        <div className="absolute top-1/3 left-1/2 w-96 h-96 bg-violet-600/4 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto space-y-5">

        {/* Header */}
        <Header connected={connected} stats={stats} />

        {/* Stat Cards — now 5 cards with ML Fraud count */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard
            label="Total Transactions"
            value={stats.total ?? 0}
            sub="all time"
            icon={Icons.Zap}
            color="blue"
            glow
          />
          <StatCard
            label="High Risk"
            value={stats.highRisk ?? 0}
            sub={`${highRiskPct}% of total`}
            icon={Icons.AlertTriangle}
            color="rose"
            glow
          />
          <StatCard
            label="ML Fraud Detected"
            value={mlFraudCount}
            sub="XGBoost model"
            icon={Icons.Shield}
            color="violet"
            glow
          />
          <StatCard
            label="Users Monitored"
            value={stats.usersMonitored ?? 0}
            sub="active profiles"
            icon={Icons.Users}
            color="indigo"
            glow
          />
          <StatCard
            label="Avg Risk Score"
            value={stats.avgScore ?? 0}
            sub="rolling average"
            icon={Icons.TrendingUp}
            color={stats.avgScore >= 70 ? 'rose' : stats.avgScore >= 40 ? 'amber' : 'emerald'}
            glow
          />
        </div>

        {/* Second row: Risk Gauge + Activity Chart */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Risk Gauge */}
          <div className="glass rounded-2xl border border-slate-700/50 p-5 flex flex-col items-center justify-between gap-3">
            <div className="w-full flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-200">Live Risk Gauge</h2>
              <span className="text-[10px] text-slate-500 bg-slate-800/60 border border-slate-700/50 px-2 py-0.5 rounded-full">
                Latest transaction
              </span>
            </div>
            <RiskGauge score={latestScore} />

            {/* Risk breakdown bars */}
            <div className="w-full space-y-1.5 mt-4 pt-4 border-t border-slate-700/30">
              {[
                { label: 'High', cnt: stats.highRisk ?? 0, color: 'bg-rose-500'    },
                { label: 'Med',  cnt: stats.medRisk  ?? 0, color: 'bg-amber-500'   },
                { label: 'Low',  cnt: stats.lowRisk  ?? 0, color: 'bg-emerald-500' },
              ].map(({ label, cnt, color }) => {
                const pct = stats.total ? (cnt / stats.total) * 100 : 0;
                return (
                  <div key={label} className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 w-6">{label}</span>
                    <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-400 w-6 text-right">{cnt}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Activity Chart + quick stats */}
          <div className="md:col-span-2">
            <ActivityChart transactions={transactions} />
            <div className="grid grid-cols-3 gap-3 mt-4">
              {[
                { label: 'Medium Risk',   value: stats.medRisk ?? 0,  color: 'text-amber-400'   },
                { label: 'Low Risk',      value: stats.lowRisk  ?? 0, color: 'text-emerald-400' },
                { label: 'Active Alerts', value: alerts.length,        color: 'text-rose-400'    },
              ].map(({ label, value, color }) => (
                <div key={label} className="glass rounded-xl border border-slate-700/50 p-3 text-center">
                  <p className={`text-xl font-black ${color}`}>{value}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main content row: Transaction Feed + ML Panel + Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Transaction Feed — takes 2 cols */}
          <div className="lg:col-span-2">
            <TransactionFeed
              transactions={transactions}
              onSimulate={handleSimulate}
            />
          </div>

          {/* ML Insights Panel */}
          <div>
            <MLInsightsPanel transactions={transactions} />
          </div>

          {/* Alerts Panel */}
          <div>
            <AlertsPanel alerts={alerts} onDismiss={handleDismiss} />
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center text-[11px] text-slate-600 py-4">
          RiskGuard · Real-Time Fintech Risk Detection · XGBoost ML + Rule Engine · WebSocket + REST API
        </footer>

      </div>
    </div>
  );
}