import React, { useState, useMemo } from 'react';
import { Transaction, TransactionStatus } from '../types';
import { Search, AlertTriangle, CheckCircle2, Lock, ShieldAlert, Clock } from 'lucide-react';

interface TransactionFeedProps {
  transactions: Transaction[];
  selectedTxId: string | null;
  onSelectTransaction: (id: string) => void;
  feedWidth?: number;
  onSetFeedWidth?: (width: number) => void;
}

export const TransactionFeed: React.FC<TransactionFeedProps> = ({
  transactions,
  selectedTxId,
  onSelectTransaction,
  feedWidth,
  onSetFeedWidth,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | TransactionStatus>('ALL');

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const matchesSearch =
        tx.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.merchant.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.id.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'ALL' || tx.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [transactions, searchTerm, statusFilter]);

  const getStatusBadge = (status: TransactionStatus) => {
    switch (status) {
      case 'BLOQUEO_PREVENTIVO':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-rose-200 bg-rose-950/80 border border-rose-700 px-2 py-0.5 rounded">
            <Lock className="w-3 h-3" />
            Bloqueado
          </span>
        );
      case 'SOLICITAR_2FA':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-amber-200 bg-amber-950/80 border border-amber-700 px-2 py-0.5 rounded">
            <ShieldAlert className="w-3 h-3" />
            2FA
          </span>
        );
      case 'APROBAR_DIRECTO':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-emerald-200 bg-emerald-950/80 border border-emerald-700 px-2 py-0.5 rounded">
            <CheckCircle2 className="w-3 h-3" />
            Aprobado
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-mono text-zinc-400 bg-zinc-900 border border-zinc-700 px-2 py-0.5 rounded">
            <Clock className="w-3 h-3 animate-spin" />
            En curso
          </span>
        );
    }
  };

  return (
    <aside
      id="tx-feed-panel"
      className="w-full h-full border-r border-zinc-800 flex flex-col bg-[#0c0f17] overflow-hidden"
    >
      {/* Panel Controls */}
      <div className="p-3.5 border-b border-zinc-800 bg-zinc-950/80 space-y-2.5">
        <div className="flex justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
              Flujo Transaccional
            </h2>
            <span
              id="tx-counter-badge"
              className="text-xs font-mono bg-zinc-900 text-zinc-200 border border-zinc-700 px-2 py-0.5 rounded font-bold"
            >
              {filteredTransactions.length}/{transactions.length}
            </span>
          </div>

          {/* Width Presets & Currency */}
          <div className="flex items-center gap-1.5">
            {onSetFeedWidth && (
              <div className="hidden sm:flex items-center gap-1 mr-1" title="Ajustar tamaño del panel">
                {[
                  { label: 'S', width: 280, title: 'Compacto (280px)' },
                  { label: 'M', width: 380, title: 'Estándar (380px)' },
                  { label: 'L', width: 480, title: 'Amplio (480px)' },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => onSetFeedWidth(preset.width)}
                    title={preset.title}
                    aria-label={preset.title}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
                      feedWidth && Math.abs(feedWidth - preset.width) < 25
                        ? 'bg-sky-500/25 border border-sky-500/60 text-sky-200'
                        : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}
            <span className="text-xs font-mono font-medium text-zinc-400">USD</span>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            id="tx-search-input"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por usuario o comercio..."
            aria-label="Buscar transacciones"
            className="w-full bg-zinc-900/90 text-xs sm:text-sm text-zinc-100 placeholder-zinc-400 rounded-md pl-8 pr-3 py-1.5 border border-zinc-700 focus:outline-none focus:border-zinc-500 transition-colors"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs no-scrollbar">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-colors ${
              statusFilter === 'ALL'
                ? 'bg-zinc-800 text-zinc-100 font-bold border border-zinc-600'
                : 'bg-zinc-900/70 text-zinc-400 hover:text-zinc-200 border border-transparent'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setStatusFilter('BLOQUEO_PREVENTIVO')}
            className={`px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-colors ${
              statusFilter === 'BLOQUEO_PREVENTIVO'
                ? 'bg-rose-950/80 text-rose-200 border border-rose-700 font-bold'
                : 'bg-zinc-900/70 text-zinc-400 hover:text-zinc-200 border border-transparent'
            }`}
          >
            Bloqueadas
          </button>
          <button
            onClick={() => setStatusFilter('SOLICITAR_2FA')}
            className={`px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-colors ${
              statusFilter === 'SOLICITAR_2FA'
                ? 'bg-amber-950/80 text-amber-200 border border-amber-700 font-bold'
                : 'bg-zinc-900/70 text-zinc-400 hover:text-zinc-200 border border-transparent'
            }`}
          >
            2FA
          </button>
          <button
            onClick={() => setStatusFilter('APROBAR_DIRECTO')}
            className={`px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-colors ${
              statusFilter === 'APROBAR_DIRECTO'
                ? 'bg-emerald-950/80 text-emerald-200 border border-emerald-700 font-bold'
                : 'bg-zinc-900/70 text-zinc-400 hover:text-zinc-200 border border-transparent'
            }`}
          >
            Aprobadas
          </button>
        </div>
      </div>

      {/* Feed List Items */}
      <div
        id="feed-container"
        className="flex-1 overflow-y-auto p-2.5 space-y-2 select-none"
        role="feed"
        aria-busy={false}
      >
        {filteredTransactions.length === 0 ? (
          <div className="py-12 text-center text-zinc-400 text-xs flex flex-col items-center">
            <AlertTriangle className="w-5 h-5 mb-2 opacity-50 text-amber-400" />
            <p>No hay transacciones registradas.</p>
          </div>
        ) : (
          filteredTransactions.map((tx) => {
            const isSelected = tx.id === selectedTxId;

            let cardClasses = 'border-zinc-800 bg-zinc-950/60 hover:bg-zinc-900/90 hover:border-zinc-700';

            if (isSelected) {
              cardClasses = 'border-sky-500 bg-sky-950/30 ring-1 ring-sky-500/50';
            }

            return (
              <div
                key={tx.id}
                id={`tx-item-${tx.id}`}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                onClick={() => onSelectTransaction(tx.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectTransaction(tx.id);
                  }
                }}
                className={`p-3 rounded-xl border ${cardClasses} cursor-pointer transition-colors flex flex-col gap-1.5 focus:outline-none`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-2 truncate">
                    {tx.isAnomaly && (
                      <span
                        title="Indicador de anomalía"
                        className="w-2 h-2 rounded-full bg-rose-500 shrink-0"
                      />
                    )}
                    <span className="text-sm font-bold text-zinc-100 truncate">
                      {tx.user}
                    </span>
                  </div>
                  <span className="text-sm sm:text-base font-mono font-extrabold text-white shrink-0">
                    {tx.amountFormatted}
                  </span>
                </div>

                <div className="text-xs text-zinc-300 truncate flex items-center gap-1">
                  <span className="text-zinc-400">En:</span>
                  <span className="truncate text-zinc-200 font-medium">{tx.merchant}</span>
                </div>

                <div className="flex justify-between items-center pt-1.5 mt-0.5 border-t border-zinc-800 text-xs">
                  <span className="font-mono text-zinc-400">{tx.timestamp}</span>
                  {getStatusBadge(tx.status)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
