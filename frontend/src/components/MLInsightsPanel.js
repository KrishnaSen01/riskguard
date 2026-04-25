
import React, { useMemo } from 'react';

const TYPE_COLORS = {
  TRANSFER:  { bar: 'bg-red-500',      text: 'text-red-400',      bg: 'bg-red-500/10'    },
  CASH_OUT:  { bar: 'bg-orange-500',   text: 'text-orange-400',   bg: 'bg-orange-500/10' },
  PAYMENT:   { bar: 'bg-blue-500',     text: 'text-blue-400',     bg: 'bg-blue-500/10'   },
  CASH_IN:   { bar: 'bg-emerald-500',  text: 'text-emerald-400',  bg: 'bg-emerald-500/10'},
  DEBIT:     { bar: 'bg-purple-500',   text: 'text-purple-400',   bg: 'bg-purple-500/10' },
};

const FEATURE_NAMES = [
  { key: 'step',           label: 'Time Step'        },
  { key: 'type',           label: 'Txn Type'         },
  { key: 'amount',         label: 'Amount'            },
  { key: 'oldbalanceOrg',  label: 'Sender Old Bal'   },
  { key: 'newbalanceOrig', label: 'Sender New Bal'   },
  { key: 'oldbalanceDest', label: 'Receiver Old Bal' },
  { key: 'newbalanceDest', label: 'Receiver New Bal' },
  { key: 'isFlaggedFraud', label: 'Bank Flag'        },
];

export default function MLInsightsPanel({ transactions = [] }) {
  // ── Derived stats ────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const mlTxns = transactions.filter((t) => t.ml_fraud !== null && t.ml_fraud !== undefined);
    const fraudCount   = mlTxns.filter((t) => t.ml_fraud?.fraud).length;
    const legitCount   = mlTxns.length - fraudCount;
    const avgProb      = mlTxns.length > 0
      ? Math.round(mlTxns.reduce((s, t) => s + (t.ml_fraud?.probability || 0), 0) / mlTxns.length * 100)
      : 0;

    // Fraud by transaction type
    const byType = {};
    mlTxns.forEach((t) => {
      const tp = t.type || 'UNKNOWN';
      if (!byType[tp]) byType[tp] = { total: 0, fraud: 0 };
      byType[tp].total++;
      if (t.ml_fraud?.fraud) byType[tp].fraud++;
    });

    // High-confidence fraud
    const highConfFraud = mlTxns.filter(
      (t) => t.ml_fraud?.fraud && t.ml_fraud?.confidence === 'HIGH'
    ).length;

    // Recent fraud probability scores (last 15 txns with ML)
    const recentProbs = mlTxns
      .slice(0, 15)
      .map((t) => ({ prob: t.ml_fraud?.probability || 0, fraud: t.ml_fraud?.fraud }))
      .reverse();

    return { mlTxns, fraudCount, legitCount, avgProb, byType, highConfFraud, recentProbs };
  }, [transactions]);

  const mlAvailable = stats.mlTxns.length > 0;

  return (
    <div className="glass rounded-2xl border border-slate-700/50 p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
            <svg className="w-4 h-4 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
            </svg>
          </div>
          <h2 className="text-sm font-bold text-slate-200">ML Fraud Insights</h2>
        </div>
        <span className="text-[10px] bg-violet-500/10 border border-violet-500/20 text-violet-400 px-2 py-0.5 rounded-full font-bold">
          XGBoost
        </span>
      </div>

      {!mlAvailable ? (
        <div className="flex flex-col items-center justify-center py-8 text-slate-600">
          <svg className="w-10 h-10 mb-2 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
          </svg>
          <p className="text-xs">Waiting for ML predictions…</p>
          <p className="text-[10px] mt-1 text-slate-700">Make sure ML service is running on :5001</p>
        </div>
      ) : (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-3 text-center">
              <p className="text-xl font-black text-red-400">{stats.fraudCount}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Fraud Detected</p>
            </div>
            <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-3 text-center">
              <p className="text-xl font-black text-emerald-400">{stats.legitCount}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Legitimate</p>
            </div>
            <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-3 text-center">
              <p className="text-xl font-black text-orange-400">{stats.highConfFraud}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">High Conf.</p>
            </div>
          </div>

          {/* Avg Fraud Probability Bar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-slate-400 font-semibold">Avg Fraud Probability</span>
              <span className={`text-[11px] font-black ${stats.avgProb >= 50 ? 'text-red-400' : stats.avgProb >= 25 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {stats.avgProb}%
              </span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  stats.avgProb >= 50 ? 'bg-gradient-to-r from-orange-500 to-red-500'
                  : stats.avgProb >= 25 ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-500'
                }`}
                style={{ width: `${stats.avgProb}%` }}
              />
            </div>
          </div>

          {/* Fraud Rate by Transaction Type */}
          {Object.keys(stats.byType).length > 0 && (
            <div>
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider mb-2">
                Fraud Rate by Type
              </p>
              <div className="space-y-2">
                {Object.entries(stats.byType).map(([type, { total, fraud }]) => {
                  const rate = total > 0 ? Math.round((fraud / total) * 100) : 0;
                  const colors = TYPE_COLORS[type] || { bar: 'bg-slate-500', text: 'text-slate-400', bg: 'bg-slate-800' };
                  return (
                    <div key={type} className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold w-20 flex-shrink-0 px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                        {type}
                      </span>
                      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${colors.bar} rounded-full transition-all duration-500`}
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 w-10 text-right">
                        {fraud}/{total}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Live Probability Sparkline */}
          {stats.recentProbs.length > 0 && (
            <div>
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider mb-2">
                Recent Fraud Probability
              </p>
              <div className="flex items-end gap-1 h-12">
                {stats.recentProbs.map((item, i) => {
                  const h = Math.max(4, Math.round(item.prob * 48));
                  return (
                    <div
                      key={i}
                      className={`flex-1 rounded-sm transition-all duration-300 ${
                        item.fraud ? 'bg-red-500' : 'bg-emerald-500/60'
                      }`}
                      style={{ height: `${h}px` }}
                      title={`${Math.round(item.prob * 100)}%`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[9px] text-slate-600">Older</span>
                <span className="text-[9px] text-slate-600">Latest</span>
              </div>
            </div>
          )}

          {/* Model Info */}
          <div className="pt-3 border-t border-slate-700/30">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
              <p className="text-[10px] text-slate-500">
                PaySim XGBoost · {stats.mlTxns.length} predictions made
              </p>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {FEATURE_NAMES.map(({ key, label }) => (
                <span key={key} className="text-[9px] bg-slate-800/80 border border-slate-700/40 text-slate-500 px-1.5 py-0.5 rounded">
                  {label}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
