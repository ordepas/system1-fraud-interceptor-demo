import React from 'react';
import {
  Transaction,
  System1Result,
  System2Result,
  ApiConfig,
} from '../types';
import {
  Zap,
  Brain,
  ShieldAlert,
  ArrowLeft,
  Cpu,
  Coins,
  Scale,
  Sparkles,
  AlertOctagon,
  CheckCircle,
  FileText,
  MapPin,
  CreditCard,
  Radio,
  Clock,
  ArrowRight,
} from 'lucide-react';

interface InspectionDashboardProps {
  transaction: Transaction | null;
  sys1: System1Result | null;
  sys2: System2Result | null;
  isSys1Loading: boolean;
  isSys2Loading: boolean;
  onBackToFeed?: () => void;
  apiConfig: ApiConfig;
}

export const InspectionDashboard: React.FC<InspectionDashboardProps> = ({
  transaction,
  sys1,
  sys2,
  isSys1Loading,
  isSys2Loading,
  onBackToFeed,
  apiConfig,
}) => {
  if (!transaction) {
    return (
      <section
        id="empty-inspection-state"
        className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-400 bg-[#090b0e]"
      >
        <div className="w-14 h-14 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3 text-zinc-400">
          <Radio className="w-6 h-6 animate-pulse" />
        </div>
        <h3 className="text-sm font-medium text-zinc-200 mb-1">
          Sin transacción seleccionada
        </h3>
        <p className="text-xs text-zinc-400 max-w-sm">
          Selecciona una operación del flujo o pulsa en <strong className="text-zinc-200">"Fraude USD"</strong> para evaluar concurrentemente el Sistema 1 (Jev) frente al Sistema 2 (Gemini).
        </p>
      </section>
    );
  }

  // Check if System 2 is running in contingency or simulation mode
  const isSys2Simulated =
    sys2?.source === 'gemini-contingencia' ||
    sys2?.source === 'simulated' ||
    sys2?.isContingency === true;

  // System 2 completion check (shows '—' while evaluating or synthesizing)
  const isSys2Finished = !isSys2Loading && sys2?.status === 'completed';

  // Calculate real-time speedup ratio (excluded if S2 is simulated)
  const speedRatio =
    !isSys2Simulated && sys1 && sys2 && sys1.latencyMs > 0 && sys2.latencyMs > 0
      ? (sys2.latencyMs / sys1.latencyMs).toFixed(1)
      : null;

  // Consensus calculation
  const hasConsensus =
    sys1 &&
    sys2 &&
    !isSys1Loading &&
    !isSys2Loading &&
    sys1.choice === sys2.recommendation;

  return (
    <section
      id="inspection-dashboard"
      className="flex-1 flex flex-col bg-[#090b0e] overflow-y-auto h-full"
    >
      {/* Top Header Strip */}
      <div className="p-3.5 lg:px-6 lg:py-4 border-b border-zinc-800 bg-[#0c0f17] sticky top-0 z-20 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {onBackToFeed && (
            <button
              onClick={onBackToFeed}
              aria-label="Volver a la lista de transacciones"
              className="md:hidden p-2 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-200 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs sm:text-sm font-mono font-bold text-zinc-200 bg-zinc-900 px-2.5 py-1 rounded border border-zinc-700/80">
                {transaction.id}
              </span>
              <span className="text-base sm:text-lg font-mono font-extrabold text-white tracking-tight">
                {transaction.amountFormatted}
              </span>
              <span className="text-xs sm:text-sm text-zinc-300 font-medium hidden sm:inline">
                ({transaction.user} · {transaction.merchant})
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-xs sm:text-sm font-mono text-zinc-400 hidden sm:inline">
            {transaction.timestamp}
          </span>
          <span
            className={`text-xs sm:text-sm font-bold px-3 py-1 rounded-md border tracking-wide ${
              transaction.isAnomaly
                ? 'bg-rose-950/70 border-rose-600/70 text-rose-200 shadow-sm'
                : 'bg-emerald-950/70 border-emerald-600/70 text-emerald-200 shadow-sm'
            }`}
          >
            {transaction.isAnomaly ? 'ALERTA DE ANOMALÍA' : 'TRANSACCIÓN NORMAL'}
          </span>
        </div>
      </div>

      <div className="p-4 lg:p-6 space-y-4 max-w-7xl w-full mx-auto">
        {/* Transaction Telemetry Context Strip */}
        <div
          id="input-telemetry-card"
          className="p-4 rounded-xl bg-[#0f131d] border border-zinc-800 shadow-sm"
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <div className="bg-zinc-900/90 p-3 rounded-lg border border-zinc-800/80">
              <span className="text-xs uppercase font-semibold text-zinc-400 block font-sans tracking-wide">
                Titular
              </span>
              <span className="text-sm sm:text-base text-zinc-100 truncate block font-bold mt-0.5">
                {transaction.user}
              </span>
            </div>
            <div className="bg-zinc-900/90 p-3 rounded-lg border border-zinc-800/80">
              <span className="text-xs uppercase font-semibold text-zinc-400 block font-sans tracking-wide">
                Monto USD
              </span>
              <span className="text-sm sm:text-base text-white truncate block font-mono font-extrabold mt-0.5">
                {transaction.amountFormatted}
              </span>
            </div>
            <div className="bg-zinc-900/90 p-3 rounded-lg border border-zinc-800/80">
              <span className="text-xs uppercase font-semibold text-zinc-400 block font-sans tracking-wide">
                Comercio
              </span>
              <span className="text-sm sm:text-base text-zinc-100 truncate block font-semibold mt-0.5">
                {transaction.merchant}
              </span>
            </div>
            <div className="bg-zinc-900/90 p-3 rounded-lg border border-zinc-800/80">
              <span className="text-xs uppercase font-semibold text-zinc-400 block font-sans tracking-wide">
                Velocidad Reciente
              </span>
              <span className="text-sm sm:text-base text-amber-300 truncate block font-mono font-extrabold mt-0.5">
                {transaction.velocityLastHour} ops / hora
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 mb-2.5 text-xs sm:text-sm text-zinc-300 font-sans">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-200 font-medium">
              <MapPin className="w-3.5 h-3.5 text-sky-400" />
              {transaction.location} · {transaction.ip}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-200 font-medium">
              <CreditCard className="w-3.5 h-3.5 text-zinc-400" />
              {transaction.device}
            </span>
            {transaction.cardLast4 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 font-mono text-xs font-semibold">
                Tarjeta **** {transaction.cardLast4}
              </span>
            )}
          </div>

          <div className="p-3 rounded-lg bg-black/50 border border-zinc-800/90 text-xs sm:text-sm text-zinc-200 leading-relaxed font-sans">
            {transaction.context}
          </div>
        </div>

        {/* ================================================================= */}
        {/* CENTERPIECE: COMPARATIVE BENCHMARK (SYSTEM 1 vs SYSTEM 2)        */}
        {/* ================================================================= */}
        <div
          id="comparative-benchmark-header"
          className="p-4 sm:p-5 rounded-xl bg-[#0f131d] border border-zinc-800 shadow-md relative overflow-hidden"
        >
          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-zinc-800">
            <div className="flex items-center gap-2.5">
              <Scale className="w-5 h-5 text-sky-400 shrink-0" />
              <h3 className="text-sm sm:text-base font-bold text-zinc-100 uppercase tracking-wide">
                Comparativa de Arquitectura Dual (Kahneman S1 vs S2)
              </h3>
            </div>

            {/* Speedup and consensus pill */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {speedRatio && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-sky-950/80 border border-sky-500/60 text-sky-200 text-xs sm:text-sm font-mono font-extrabold shadow-sm">
                  <Zap className="w-3.5 h-3.5 text-sky-400 fill-sky-400" />
                  S1 es {speedRatio}x más veloz
                </span>
              )}

              {hasConsensus ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-950/80 border border-emerald-600/60 text-emerald-200 text-xs sm:text-sm font-bold shadow-sm">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  Consenso unánime ({sys1?.choice})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-750 text-zinc-300 text-xs sm:text-sm font-mono font-medium">
                  {isSys1Loading || isSys2Loading ? 'Evaluando...' : 'Deliberación completada'}
                </span>
              )}
            </div>
          </div>

          {/* Three comparison metrics cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-3.5">
            {/* Metric 1: Latency & Speed */}
            <div className="p-3.5 rounded-lg bg-zinc-900/90 border border-zinc-800 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs uppercase font-bold text-zinc-300 flex items-center gap-1.5 tracking-wide">
                  <Cpu className="w-4 h-4 text-sky-400" /> Latencia de Decisión
                </span>
                <span className="text-xs font-mono text-zinc-400">Δ Tiempo</span>
              </div>
              <div className="flex items-center justify-between font-mono mt-1">
                <div className="text-left">
                  <span className="text-xs text-zinc-400 block font-sans">S1 (Jev)</span>
                  <span className="text-base sm:text-xl font-mono font-extrabold text-sky-400">
                    {isSys1Loading ? '...' : `${sys1?.latencyMs ?? '--'} ms`}
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-500" />
                <div className="text-right">
                  <span className="text-xs text-zinc-400 block font-sans">S2 (Gemini)</span>
                  {isSys2Simulated ? (
                    <span className="text-xs sm:text-sm font-sans font-semibold text-zinc-400 block">
                      Excluido (Simulado)
                    </span>
                  ) : (
                    <span className="text-base sm:text-xl font-mono font-extrabold text-amber-400">
                      {isSys2Loading ? '...' : `${sys2?.latencyMs ?? '--'} ms`}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Metric 2: Compute & Tokens */}
            <div className="p-3.5 rounded-lg bg-zinc-900/90 border border-zinc-800 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs uppercase font-bold text-zinc-300 flex items-center gap-1.5 tracking-wide">
                  <Coins className="w-4 h-4 text-amber-400" /> Cómputo & Tokens
                </span>
                <span className="text-xs font-mono text-zinc-400">Tokens</span>
              </div>
              <div className="space-y-1.5 font-mono text-xs mt-1">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 font-sans">S1 (Jev):</span>
                  <span className="text-sky-400 font-semibold">
                    {isSys1Loading
                      ? '—'
                      : `${sys1?.tokensIn != null ? sys1.tokensIn : 'n/d'} in · sin texto generado`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 font-sans">S2 (Gemini):</span>
                  <span className="text-amber-400 font-semibold">
                    {!isSys2Finished ? (
                      '—'
                    ) : (
                      <>
                        {sys2?.tokensIn != null ? sys2.tokensIn : 'n/d'} in ·{' '}
                        {sys2?.tokensOut != null ? sys2.tokensOut : 'n/d'} out
                        {sys2?.tokensIn != null && sys2?.tokensOut != null && (
                          <span className="ml-1.5 text-amber-300 font-normal">
                            (Total: {sys2.tokensIn + sys2.tokensOut})
                          </span>
                        )}
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Metric 3: Architectural Target */}
            <div className="p-3.5 rounded-lg bg-zinc-900/90 border border-zinc-800 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs uppercase font-bold text-zinc-300 flex items-center gap-1.5 tracking-wide">
                  <FileText className="w-4 h-4 text-emerald-400" /> Paradigma Operativo
                </span>
                <span className="text-xs font-mono text-zinc-400">Propósito</span>
              </div>
              <div className="flex items-center justify-between text-xs sm:text-sm mt-1.5 font-sans">
                <span className="text-sky-300 font-bold font-mono">
                  {isSys1Loading ? '...' : sys1?.latencyMs != null ? `${sys1.latencyMs} ms` : 'n/d'}
                </span>
                <span className="text-zinc-500 font-mono">vs</span>
                <span className="text-amber-300 font-bold">Auditoría / CoT</span>
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* DUAL PANELS: SYSTEM 1 (JEV) vs SYSTEM 2 (GEMINI)                  */}
        {/* ================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* SYSTEM 1 PANEL */}
          <div
            id="system1-panel"
            className="rounded-xl bg-[#0f131d] border border-zinc-800 flex flex-col overflow-hidden shadow-sm"
          >
            {/* Header */}
            <div className="p-3.5 sm:p-4 border-b border-zinc-800 bg-zinc-900/80 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-sky-950/80 border border-sky-700/60 text-sky-400">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm sm:text-base font-bold text-zinc-100">
                      Sistema 1: Jev (TypeSafe AI)
                    </h4>
                    <span className="text-[10px] sm:text-xs font-mono px-1.5 py-0.5 rounded bg-sky-950/60 text-sky-300 border border-sky-700/50 font-bold">
                      {sys1?.source === 'jev-live-api' ? 'API Real' : 'Local'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                    Latencia medida: {isSys1Loading ? 'Calculando...' : sys1?.latencyMs != null ? `${sys1.latencyMs} ms` : 'n/d'}
                  </p>
                </div>
              </div>

              <div className="text-right font-mono">
                <span className="text-sm sm:text-base font-extrabold text-sky-400 block">
                  {isSys1Loading ? 'Calculando...' : `${sys1?.latencyMs ?? '--'} ms`}
                </span>
                <span className="text-xs text-zinc-400 block">
                  {isSys1Loading
                    ? '--'
                    : sys1?.tokensIn != null
                    ? `${sys1.tokensIn} tokens in`
                    : 'n/d'}
                </span>
              </div>
            </div>

            {/* S1 Content */}
            <div className="p-4 flex-1 flex flex-col gap-3.5 bg-black/20">
              {/* Decision / Choice */}
              <div className="p-3 rounded-lg bg-zinc-900/90 border border-zinc-800">
                <span className="text-xs text-zinc-400 uppercase tracking-wider font-semibold block mb-1.5">
                  1. Acción Inmediata de Pasarela (Choice)
                </span>
                {isSys1Loading ? (
                  <div className="h-7 w-32 bg-zinc-800 animate-pulse rounded" />
                ) : (
                  <div
                    className={`text-sm sm:text-base font-mono font-extrabold px-3 py-1.5 rounded-md inline-flex items-center gap-2 ${
                      sys1?.choice === 'BLOQUEO_PREVENTIVO'
                        ? 'text-rose-200 bg-rose-950/70 border border-rose-700/60'
                        : sys1?.choice === 'SOLICITAR_2FA'
                        ? 'text-amber-200 bg-amber-950/70 border border-amber-700/60'
                        : 'text-emerald-200 bg-emerald-950/70 border border-emerald-700/60'
                    }`}
                  >
                    {sys1?.choice === 'BLOQUEO_PREVENTIVO' && <AlertOctagon className="w-4 h-4" />}
                    {sys1?.choice === 'SOLICITAR_2FA' && <ShieldAlert className="w-4 h-4" />}
                    {sys1?.choice === 'APROBAR_DIRECTO' && <CheckCircle className="w-4 h-4" />}
                    {sys1?.choice ?? 'PENDIENTE'}
                  </div>
                )}
              </div>

              {/* 2. Decision Confidence & Probabilities */}
              <div className="p-3 rounded-lg bg-zinc-900/90 border border-zinc-800">
                <div className="flex justify-between items-center mb-1.5 text-xs">
                  <span className="text-zinc-300 uppercase tracking-wider font-semibold">
                    2. Confianza de la decisión
                  </span>
                  <span className="font-mono text-zinc-100 font-bold text-sm">
                    {isSys1Loading ? (
                      '--'
                    ) : sys1?.decisionConfidence == null ? (
                      <span className="text-zinc-400 font-sans font-medium text-xs sm:text-sm">
                        No disponible
                      </span>
                    ) : (
                      `${Math.round(
                        sys1.decisionConfidence <= 1
                          ? sys1.decisionConfidence * 100
                          : sys1.decisionConfidence
                      )}%`
                    )}
                  </span>
                </div>

                {!isSys1Loading && sys1?.decisionConfidence != null && (
                  <>
                    <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden mt-1.5">
                      <div
                        className={`h-full transition-all duration-300 rounded-full ${
                          sys1.choice === 'BLOQUEO_PREVENTIVO'
                            ? 'bg-rose-500'
                            : sys1.choice === 'SOLICITAR_2FA'
                            ? 'bg-amber-500'
                            : sys1.choice === 'APROBAR_DIRECTO'
                            ? 'bg-emerald-500'
                            : 'bg-sky-500'
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(
                              0,
                              sys1.decisionConfidence <= 1
                                ? sys1.decisionConfidence * 100
                                : sys1.decisionConfidence
                            )
                          )}%`,
                        }}
                      />
                    </div>

                    {sys1?.decisionProbabilities && (
                      <div className="mt-2.5 pt-2 border-t border-zinc-800/80 grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-xs font-mono">
                        {(
                          [
                            'APROBAR_DIRECTO',
                            'SOLICITAR_2FA',
                            'BLOQUEO_PREVENTIVO',
                          ] as const
                        ).map((opt) => {
                          const val = sys1.decisionProbabilities?.[opt];
                          const pct =
                            typeof val === 'number'
                              ? `${Math.round(val <= 1 ? val * 100 : val)}%`
                              : 'n/d';
                          const isSelected = sys1?.choice === opt;

                          let cardClasses = 'bg-zinc-950/60 border-zinc-800/60';
                          let labelClasses = 'text-zinc-400';
                          let valueClasses = 'text-zinc-200';

                          if (isSelected) {
                            if (opt === 'APROBAR_DIRECTO') {
                              cardClasses = 'bg-emerald-950/70 border-emerald-700/60';
                              labelClasses = 'text-emerald-300';
                              valueClasses = 'text-emerald-200';
                            } else if (opt === 'SOLICITAR_2FA') {
                              cardClasses = 'bg-amber-950/70 border-amber-700/60';
                              labelClasses = 'text-amber-300';
                              valueClasses = 'text-amber-200';
                            } else if (opt === 'BLOQUEO_PREVENTIVO') {
                              cardClasses = 'bg-rose-950/70 border-rose-700/60';
                              labelClasses = 'text-rose-300';
                              valueClasses = 'text-rose-200';
                            }
                          }

                          return (
                            <div
                              key={opt}
                              className={`flex items-center justify-between sm:flex-col sm:items-start p-1.5 rounded border ${cardClasses}`}
                            >
                              <span
                                className={`text-[10px] font-sans truncate max-w-full ${labelClasses}`}
                                title={opt}
                              >
                                {opt}
                              </span>
                              <span className={`font-bold ${valueClasses}`}>{pct}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* 3. Null / Fraud Probability Flag */}
              <div className="p-3 rounded-lg bg-zinc-900/90 border border-zinc-800 flex justify-between items-center">
                <div>
                  <span className="text-xs text-zinc-300 uppercase tracking-wider font-semibold block">
                    3. Probabilidad de fraude (Noul)
                  </span>
                  <span className="text-xs text-zinc-400">
                    Probabilidad devuelta por Jev (Noul)
                  </span>
                </div>
                {isSys1Loading ? (
                  <span className="text-sm font-mono text-zinc-400">--</span>
                ) : sys1?.nullFraudProbability == null ? (
                  <span className="text-xs sm:text-sm font-sans text-zinc-400">
                    No disponible
                  </span>
                ) : (
                  <span
                    className={`text-sm sm:text-base font-mono font-extrabold px-3 py-1 rounded-md ${
                      sys1.nullFraudProbability > 70
                        ? 'text-rose-200 bg-rose-950/60 border border-rose-700/60'
                        : 'text-emerald-200 bg-emerald-950/60 border border-emerald-700/60'
                    }`}
                  >
                    {sys1.nullFraudProbability}%
                  </span>
                )}
              </div>


            </div>
          </div>

          {/* SYSTEM 2 PANEL */}
          <div
            id="system2-panel"
            className="rounded-xl bg-[#0f131d] border border-zinc-800 flex flex-col overflow-hidden shadow-sm"
          >
            {/* Header */}
            <div className="p-3.5 sm:p-4 border-b border-zinc-800 bg-zinc-900/80 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-amber-950/80 border border-amber-700/60 text-amber-400">
                  <Brain className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm sm:text-base font-bold text-zinc-100">
                      Sistema 2: LLM Razonamiento Profundo
                    </h4>
                    <span className="text-[10px] sm:text-xs font-mono px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-700/50 font-bold">
                      {sys2?.source === 'gemini-contingencia'
                        ? 'Gemini (Contingencia)'
                        : sys2?.source === 'gemini-3.1-flash-lite'
                        ? 'Gemini 3.1 Flash Lite'
                        : sys2?.source === 'gemini-3.8-flash'
                        ? 'Gemini 3.8 Flash'
                        : sys2?.model || 'Gemini AI'}
                    </span>
                    {isSys2Simulated && (
                      <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded bg-rose-950/90 border border-rose-600 text-rose-200">
                        MODO SIMULADO: no es una llamada real
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Cadena de pensamiento explicable y síntesis regulatoria
                  </p>
                </div>
              </div>

              <div className="text-right font-mono">
                <span className="text-sm sm:text-base font-extrabold text-amber-400 flex items-center justify-end gap-1.5">
                  {sys2?.status === 'streaming' && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  )}
                  {isSys2Loading ? 'Sintetizando...' : `${sys2?.latencyMs ?? '--'} ms`}
                </span>
                <span className="text-xs text-zinc-400 block">
                  {isSys2Finished && sys2?.tokensOut != null ? `${sys2.tokensOut} tokens out` : '—'}
                </span>
              </div>
            </div>

            {/* S2 Content: Terminal / Reasoning stream (Fixed height with smooth internal scroll) */}
            <div className="p-4 flex-1 flex flex-col bg-black/40">
              <div
                id="sys2-stream-container"
                tabIndex={0}
                aria-label="Texto de razonamiento generado por Sistema 2"
                className="h-[250px] max-h-[250px] overflow-y-auto overscroll-contain p-3.5 rounded-lg bg-[#07080b] border border-zinc-800/90 font-mono text-xs sm:text-[13px] text-zinc-100 leading-relaxed whitespace-pre-wrap select-text focus:outline-none focus:ring-1 focus:ring-amber-500/40"
              >
                {sys2?.reasoningText ? (
                  <div className={sys2.status === 'streaming' ? 'typing-cursor' : ''}>
                    {sys2.reasoningText}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-zinc-400 text-xs sm:text-sm italic">
                    {isSys2Loading ? (
                      <span className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
                        Iniciando generación de cadena de pensamiento...
                      </span>
                    ) : (
                      'Esperando telemetría para comenzar el razonamiento...'
                    )}
                  </div>
                )}
              </div>

              {/* S2 Telemetry Metadata */}
              <div className="mt-3 pt-2.5 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm font-mono text-zinc-300">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400 font-sans">Latencia medida:</span>
                  <span className="text-amber-300 font-bold font-mono">
                    {isSys2Loading ? '...' : sys2?.latencyMs != null ? `${sys2.latencyMs} ms` : 'n/d'}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span>
                    Tokens:{' '}
                    {!isSys2Finished
                      ? '—'
                      : `${sys2?.tokensIn != null ? sys2.tokensIn : 'n/d'} in · ${
                          sys2?.tokensOut != null ? sys2.tokensOut : 'n/d'
                        } out`}
                  </span>
                  {isSys2Finished && sys2?.tokensIn != null && sys2?.tokensOut != null && (
                    <>
                      <span className="text-zinc-600">·</span>
                      <span className="text-zinc-400">
                        Total procesado:{' '}
                        <strong className="text-zinc-200 font-bold font-mono">
                          {sys2.tokensIn + sys2.tokensOut} tokens
                        </strong>
                      </span>
                    </>
                  )}
                  <span className="text-zinc-600">|</span>
                  <span className="text-zinc-300 font-sans">
                    Modelo: <strong className="font-mono text-zinc-100">{sys2?.model || sys2?.source || 'Gemini'}</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* EXECUTIVE RATIONALE SUMMARY                                       */}
        {/* ================================================================= */}
        <div
          id="architectural-framework-summary"
          className="p-4 rounded-xl bg-[#0f131d] border border-zinc-800"
        >
          <div className="text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-200 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-zinc-400" />
            <span>¿Por qué las Fintech necesitan ambos sistemas?</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-zinc-300 text-xs sm:text-sm leading-relaxed">
            <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
              <strong className="text-zinc-100 block mb-1 text-sm">1. Fricción Cero en Checkout</strong>
              El Sistema 1 decide en milisegundos para no perjudicar la conversión en pasarela. Esperar 2–3 segundos a un LLM en cada cobro causaría abandono masivo.
            </div>

            <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
              <strong className="text-zinc-100 block mb-1 text-sm">2. Economía de Escala</strong>
              El Sistema 1 procesa millones de transacciones con coste marginal cero. El Sistema 2 se activa asíncronamente en anomalías o auditorías.
            </div>

            <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
              <strong className="text-zinc-100 block mb-1 text-sm">3. Justificación Legal & Forense</strong>
              El Sistema 2 genera el informe en lenguaje natural necesario para cumplir con normativas de fraude y disputas de contracargos bancarios.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
