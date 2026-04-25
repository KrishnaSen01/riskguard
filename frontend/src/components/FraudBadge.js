
import React from 'react';

/**
 * FraudBadge — displays ML XGBoost fraud prediction result.
 * Props:
 *   mlFraud: { fraud, probability, confidence, ml_score } | null
 *   compact: boolean (smaller version for cards)
 */
export default function FraudBadge({ mlFraud, compact = false }) {
  if (!mlFraud) {
    return compact ? null : (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold
        bg-slate-800/80 border border-slate-700/60 text-slate-500">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
        ML: N/A
      </span>
    );
  }

  const { fraud, probability, confidence, ml_score } = mlFraud;
  const pct = Math.round((probability || 0) * 100);

  if (fraud) {
    // ── FRAUD DETECTED ────────────────────────────────────────────────────
    const intensityClass =
      confidence === 'HIGH'
        ? 'bg-red-500/15 border-red-500/40 text-red-300 shadow-red-900/20'
        : 'bg-orange-500/15 border-orange-500/30 text-orange-300';

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold border shadow-sm
          ${compact ? 'text-[9px]' : 'text-[11px]'} ${intensityClass}`}
      >
        <svg
          className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
        </svg>
        🤖 FRAUD · {pct}%
        {!compact && confidence === 'HIGH' && (
          <span className="ml-0.5 text-[9px] bg-red-500/20 px-1.5 py-0.5 rounded-full">HIGH</span>
        )}
      </span>
    );
  }

  // ── LEGITIMATE ─────────────────────────────────────────────────────────
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold border
        bg-emerald-500/10 border-emerald-500/20 text-emerald-400
        ${compact ? 'text-[9px]' : 'text-[11px]'}`}
    >
      <svg
        className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      🤖 LEGIT · {pct}%
    </span>
  );
}
