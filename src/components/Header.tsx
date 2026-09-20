import React from 'react';
import { Shield, Play, Pause, Zap, Plus, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { ApiConfig } from '../types';

interface HeaderProps {
  isFeedActive: boolean;
  onToggleFeed: () => void;
  onSimulateFraud: () => void;
  onSimulateNormal: () => void;
  onReset: () => void;
  totalTransactions: number;
  apiConfig: ApiConfig;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isFeedActive,
  onToggleFeed,
  onSimulateFraud,
  onSimulateNormal,
  onReset,
  totalTransactions,
  apiConfig,
  onOpenSettings,
}) => {
  return (
    <header
      id="app-header"
      className="h-16 shrink-0 bg-[#0c0f17] border-b border-zinc-800 flex items-center justify-between px-3 sm:px-5 lg:px-6 z-30"
    >
      {/* Brand & Concept */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-100 shadow-sm">
          <Shield className="w-5 h-5 text-sky-400" />
        </div>
        <div className="flex items-center gap-2.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm sm:text-base tracking-tight text-white">
                Fintech Risk Interceptor
              </span>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 text-xs font-mono rounded bg-zinc-850 text-zinc-200 border border-zinc-700 font-bold">
                Kahneman Architecture
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-sans hidden md:block">
              Sistema 1 (Reflejo Heurístico In-line) vs Sistema 2 (Deliberación LLM Forense)
            </p>
          </div>
        </div>
      </div>

      {/* Action Controls & APIs */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Stream Counter */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-750 text-xs font-mono text-zinc-300 font-bold">
          <span className={`w-2 h-2 rounded-full ${isFeedActive ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
          <span>{totalTransactions} ops</span>
        </div>

        {/* Toggle Feed Pause/Play */}
        <button
          id="btn-toggle-feed"
          onClick={onToggleFeed}
          aria-label={isFeedActive ? 'Pausar streaming de transacciones' : 'Reanudar streaming de transacciones'}
          className={`text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-2 ${
            isFeedActive
              ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-zinc-200'
              : 'bg-amber-950/70 hover:bg-amber-900/70 border-amber-600 text-amber-200'
          }`}
        >
          {isFeedActive ? (
            <>
              <Pause className="w-4 h-4 text-zinc-400" />
              <span className="hidden sm:inline">Pausar</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Reanudar</span>
            </>
          )}
        </button>

        {/* Normal Tx Simulator */}
        <button
          id="btn-simulate-normal"
          onClick={onSimulateNormal}
          title="Generar transacción legítima en USD"
          className="text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200 hover:bg-zinc-800 hover:text-white transition-colors hidden sm:flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4 text-zinc-400" />
          <span>Normal</span>
        </button>

        {/* Simulate Fraud Button */}
        <button
          id="btn-simulate-fraud"
          onClick={onSimulateFraud}
          aria-label="Simular intento de anomalía o fraude"
          className="text-xs sm:text-sm font-bold px-3.5 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900/80 border border-rose-600 text-rose-200 transition-colors flex items-center gap-1.5 active:scale-[0.98] shadow-sm"
        >
          <Zap className="w-4 h-4 text-rose-300 fill-rose-300/40" />
          <span>Simular Fraude USD</span>
        </button>

        {/* API Settings Modal Trigger */}
        <button
          id="btn-open-settings"
          onClick={onOpenSettings}
          title="Configurar credenciales y conexiones de Google Gemini y Jev"
          className="text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 transition-colors flex items-center gap-2"
        >
          <SlidersHorizontal className="w-4 h-4 text-zinc-400" />
          <span className="hidden md:inline">APIs</span>

          {/* Minimalist provenance dots */}
          <div className="flex items-center gap-1.5 ml-0.5">
            <span
              title={apiConfig.useRealJev ? 'Jev API Real Activo' : 'Jev Simulado'}
              className={`w-2 h-2 rounded-full ${
                apiConfig.useRealJev ? 'bg-sky-400 ring-2 ring-sky-400/20' : 'bg-zinc-600'
              }`}
            />
            <span
              title={apiConfig.useRealGemini ? 'Gemini Real Activo' : 'Gemini Simulado'}
              className={`w-2 h-2 rounded-full ${
                apiConfig.useRealGemini ? 'bg-amber-400 ring-2 ring-amber-400/20' : 'bg-zinc-600'
              }`}
            />
          </div>
        </button>

        {/* Reset button */}
        <button
          id="btn-reset-feed"
          onClick={onReset}
          title="Limpiar y reiniciar cola"
          className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
