import { useState, useEffect, useRef, useCallback } from 'react';
import { Transaction, System1Result, System2Result, ApiConfig, RiskLevel } from './types';
import {
  generateTransaction,
  evaluateSystem1,
  generateSystem2Reasoning,
} from './data/mockData';
import { Header } from './components/Header';
import { TransactionFeed } from './components/TransactionFeed';
import { InspectionDashboard } from './components/InspectionDashboard';
import { SettingsModal } from './components/SettingsModal';

const DEFAULT_CONFIG: ApiConfig = {
  useRealGemini: true,
  customGeminiKey: '',
  useRealJev: false,
  jevUrl: '',
  jevApiKey: '',
  jevAuthType: 'Bearer',
  geminiServerAvailable: true,
};

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [isFeedActive, setIsFeedActive] = useState<boolean>(true);
  const [mobileView, setMobileView] = useState<'feed' | 'inspection'>('feed');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // API Config loaded from localStorage
  const [apiConfig, setApiConfig] = useState<ApiConfig>(() => {
    try {
      const saved = localStorage.getItem('fintech_risk_api_config');
      if (saved) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('No se pudo cargar la configuración previa:', e);
    }
    return DEFAULT_CONFIG;
  });

  // Resizable Feed Width (with localStorage persistence)
  const [feedWidth, setFeedWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('fintech_risk_feed_width');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (parsed >= 240 && parsed <= 720) return parsed;
      }
    } catch (e) {
      console.warn('No se pudo cargar el ancho del feed:', e);
    }
    return 380;
  });
  const [isResizing, setIsResizing] = useState<boolean>(false);

  const startResizing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const maxAllowed = Math.max(320, Math.min(window.innerWidth - 380, 720));
      const newWidth = Math.min(Math.max(e.clientX, 250), maxAllowed);
      setFeedWidth(newWidth);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const maxAllowed = Math.max(320, Math.min(window.innerWidth - 320, 720));
        const newWidth = Math.min(Math.max(e.touches[0].clientX, 250), maxAllowed);
        setFeedWidth(newWidth);
      }
    };

    const stopResizing = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopResizing);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', stopResizing);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopResizing);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', stopResizing);
    };
  }, [isResizing]);

  // Save feedWidth to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('fintech_risk_feed_width', feedWidth.toString());
    } catch (e) {}
  }, [feedWidth]);

  // Inspection states
  const [sys1Result, setSys1Result] = useState<System1Result | null>(null);
  const [sys2Result, setSys2Result] = useState<System2Result | null>(null);
  const [isSys1Loading, setIsSys1Loading] = useState<boolean>(false);
  const [isSys2Loading, setIsSys2Loading] = useState<boolean>(false);

  // References for cancellation and race-condition prevention
  const inspectionSeqRef = useRef<number>(0);
  const sys1TimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sys2InitialTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sys2TypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const feedIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Save config changes to localStorage
  const handleSaveConfig = (newConfig: ApiConfig) => {
    setApiConfig(newConfig);
    try {
      localStorage.setItem('fintech_risk_api_config', JSON.stringify(newConfig));
    } catch (e) {
      console.error('Error guardando configuración:', e);
    }

    // Re-evaluate currently selected transaction if one is active
    if (selectedTxId) {
      handleSelectTransaction(selectedTxId);
    }
  };

  // Clear all pending execution timers
  const clearAllTimers = useCallback(() => {
    if (sys1TimeoutRef.current) {
      clearTimeout(sys1TimeoutRef.current);
      sys1TimeoutRef.current = null;
    }
    if (sys2InitialTimeoutRef.current) {
      clearTimeout(sys2InitialTimeoutRef.current);
      sys2InitialTimeoutRef.current = null;
    }
    if (sys2TypingTimeoutRef.current) {
      clearTimeout(sys2TypingTimeoutRef.current);
      sys2TypingTimeoutRef.current = null;
    }
  }, []);

  // System 1 trigger (Jev Real API or Simulation)
  const triggerSystem1 = useCallback(
    async (tx: Transaction, seq: number) => {
      setIsSys1Loading(true);
      setSys1Result(null);

      let fallbackReason = 'Algoritmo Heurístico Local (Sin endpoint Jev configurado)';

      // If user enabled real Jev API and entered URL
      if (apiConfig.useRealJev && apiConfig.jevUrl) {
        try {
          const res = await fetch('/api/evaluate/jev', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transaction: tx,
              jevUrl: apiConfig.jevUrl,
              jevApiKey: apiConfig.jevApiKey,
              authHeaderType: apiConfig.jevAuthType,
            }),
          });

          if (inspectionSeqRef.current !== seq) return;

          const data = await res.json();
          if (res.ok && data.success) {
            const fraudProbability = typeof data.nullFraudProbability === 'number' ? data.nullFraudProbability : null;
            const derivedRiskLevel: RiskLevel =
              fraudProbability !== null
                ? fraudProbability >= 80
                  ? 'CRÍTICO'
                  : fraudProbability >= 50
                  ? 'ALTO'
                  : fraudProbability >= 20
                  ? 'MODERADO'
                  : 'BAJO'
                : data.choice === 'BLOQUEO_PREVENTIVO'
                ? 'CRÍTICO'
                : data.choice === 'SOLICITAR_2FA'
                ? 'ALTO'
                : 'BAJO';

            const result: System1Result = {
              latencyMs: data.latencyMs,
              choice: data.choice || 'APROBAR_DIRECTO',
              riskLevel: derivedRiskLevel,
              decisionConfidence: data.decisionConfidence ?? null,
              decisionProbabilities: data.decisionProbabilities ?? null,
              nullFraudProbability: fraudProbability,
              tokensIn: typeof data.tokensIn === 'number' ? data.tokensIn : null,
              timestamp: new Date().toLocaleTimeString(),
              source: 'jev-live-api',
              sourceDetails: apiConfig.jevUrl || 'Endpoint Jev conectado',
              jevRaw: data.jevRaw,
            };
            setSys1Result(result);
            setIsSys1Loading(false);

            setTransactions((prev) =>
              prev.map((item) =>
                item.id === tx.id ? { ...item, status: result.choice } : item
              )
            );
            return;
          } else {
            console.warn('Jev API retornó error, recurriendo a simulación:', data.error);
            fallbackReason = `Respuesta Jev: ${data.error || 'Error de conexión'}. Respaldo local activo.`;
          }
        } catch (err: any) {
          console.error('Error llamando a Jev API:', err);
          fallbackReason = `Error de red con Jev: ${err.message}. Respaldo local activo.`;
        }
      }

      // Fallback or default Simulation
      let fallbackDetails = 'Algoritmo Heurístico Local (Sin endpoint Jev configurado)';
      if (apiConfig.useRealJev && apiConfig.jevUrl) {
        fallbackDetails = fallbackReason;
      }
      const latency = Math.floor(Math.random() * 50) + 38;
      sys1TimeoutRef.current = setTimeout(() => {
        if (inspectionSeqRef.current !== seq) return;

        const result = evaluateSystem1(tx);
        result.latencyMs = latency;
        result.source = 'simulated';
        result.sourceDetails = fallbackDetails;
        setSys1Result(result);
        setIsSys1Loading(false);

        setTransactions((prev) =>
          prev.map((item) =>
            item.id === tx.id ? { ...item, status: result.choice } : item
          )
        );
      }, latency);
    },
    [apiConfig]
  );

  // System 2 trigger (Real Gemini API or Simulation)
  const triggerSystem2 = useCallback(
    async (tx: Transaction, seq: number) => {
      setIsSys2Loading(true);

      // 1. If real Gemini API is enabled
      if (apiConfig.useRealGemini) {
        const sys2CallStartTime = performance.now();
        setSys2Result({
          latencyMs: 0,
          ttftMs: 350,
          tokensOut: 0,
          tokensIn: 130,
          reasoningText: '',
          status: 'analyzing',
          recommendation: 'APROBAR_DIRECTO',
          confidenceScore: 95,
          chainOfThoughtSteps: ['Consultando Gemini 3.8 Flash...'],
        });

        try {
          const res = await fetch('/api/evaluate/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transaction: tx,
              customApiKey: apiConfig.customGeminiKey || undefined,
            }),
          });

          if (inspectionSeqRef.current !== seq) return;

          const data = await res.json();

          if (res.ok && data.success) {
            const fullText: string = data.reasoningText;
            let charIndex = 0;
            const ttftMs = Math.round(performance.now() - sys2CallStartTime);

            // Stream chunks smoothly into the view
            const streamChunk = () => {
              if (inspectionSeqRef.current !== seq) return;

              if (charIndex < fullText.length) {
                const step = Math.min(
                  Math.floor(Math.random() * 8) + 4,
                  fullText.length - charIndex
                );
                charIndex += step;

                setSys2Result((prev) =>
                  prev
                    ? {
                        ...prev,
                        reasoningText: fullText.slice(0, charIndex),
                        tokensOut: Math.floor(charIndex / 3.8),
                        status: 'streaming',
                        latencyMs: Math.round(performance.now() - sys2CallStartTime),
                      }
                    : null
                );

                sys2TypingTimeoutRef.current = setTimeout(
                  streamChunk,
                  Math.floor(Math.random() * 18) + 8
                );
              } else {
                const totalElapsedMs = Math.round(performance.now() - sys2CallStartTime);
                const measuredLatency = Math.max(data.latencyMs, totalElapsedMs);
                setSys2Result({
                  latencyMs: measuredLatency,
                  tokensOut: data.tokensOut,
                  tokensIn: data.tokensIn,
                  reasoningText: fullText,
                  status: 'completed',
                  recommendation: data.recommendation,
                  model: data.source || 'gemini-3.8-flash',
                  chainOfThoughtSteps: [
                    'Evaluación de contexto y riesgo',
                    'Análisis multivariado de telemetría',
                    'Dictamen deliberado Gemini',
                  ],
                  source: data.source || 'gemini-3.8-flash',
                  isContingency: Boolean(data.isContingency),
                  sourceDetails: data.isContingency
                    ? 'Motor Deliberado Gemini (Contingencia por cuota 429)'
                    : `API Oficial de Google Gemini (${data.source || 'gemini-3.8-flash'})`,
                });
                setIsSys2Loading(false);
              }
            };

            setIsSys2Loading(false);
            streamChunk();
            return;
          } else {
            console.warn('Gemini API retornó error, cambiando a simulación:', data.error);
          }
        } catch (err) {
          console.error('Error conectando con Gemini API:', err);
        }
      }

      // 2. Simulation Mode
      const reasoningData = generateSystem2Reasoning(tx);
      const fullText = reasoningData.fullText;
      const estimatedTokens = Math.floor(fullText.length / 3.8);

      setSys2Result({
        latencyMs: 0,
        ttftMs: Math.floor(Math.random() * 150) + 350,
        tokensOut: 0,
        tokensIn: 128,
        reasoningText: '',
        status: 'analyzing',
        recommendation: reasoningData.recommendation,
        confidenceScore: reasoningData.confidenceScore,
        chainOfThoughtSteps: reasoningData.steps,
        source: 'simulated',
        sourceDetails: 'Simulador Sintético Local',
      });

      const initialDelay = Math.floor(Math.random() * 200) + 350;

      sys2InitialTimeoutRef.current = setTimeout(() => {
        if (inspectionSeqRef.current !== seq) return;

        setIsSys2Loading(false);
        let charIndex = 0;
        const startTime = performance.now();

        const streamChunk = () => {
          if (inspectionSeqRef.current !== seq) return;

          if (charIndex < fullText.length) {
            const step = Math.min(
              Math.floor(Math.random() * 5) + 3,
              fullText.length - charIndex
            );
            charIndex += step;

            const currentText = fullText.slice(0, charIndex);
            const currentTokens = Math.floor(charIndex / 3.8);

            setSys2Result((prev) =>
              prev
                ? {
                    ...prev,
                    reasoningText: currentText,
                    tokensOut: currentTokens,
                    status: 'streaming',
                  }
                : null
            );

            const typingDelay = Math.floor(Math.random() * 22) + 12;
            sys2TypingTimeoutRef.current = setTimeout(streamChunk, typingDelay);
          } else {
            const totalDuration = Math.round(
              performance.now() - startTime + initialDelay
            );

            setSys2Result((prev) =>
              prev
                ? {
                    ...prev,
                    reasoningText: fullText,
                    tokensOut: estimatedTokens,
                    latencyMs: totalDuration,
                    status: 'completed',
                    source: 'simulated',
                    sourceDetails: 'Simulador Sintético Local',
                  }
                : null
            );
          }
        };

        streamChunk();
      }, initialDelay);
    },
    [apiConfig]
  );

  // Select transaction
  const handleSelectTransaction = useCallback(
    (id: string) => {
      clearAllTimers();
      const nextSeq = inspectionSeqRef.current + 1;
      inspectionSeqRef.current = nextSeq;

      setSelectedTxId(id);
      setMobileView('inspection');

      const tx = transactions.find((t) => t.id === id);
      if (tx) {
        triggerSystem1(tx, nextSeq);
        triggerSystem2(tx, nextSeq);
      }
    },
    [transactions, clearAllTimers, triggerSystem1, triggerSystem2]
  );

  // Add new transaction
  const handleAddTransaction = useCallback(
    (forceAnomaly: boolean = false) => {
      const newTx = generateTransaction(forceAnomaly);

      setTransactions((prev) => {
        const next = [newTx, ...prev];
        if (next.length > 60) return next.slice(0, 60);
        return next;
      });

      if (forceAnomaly) {
        setTimeout(() => {
          handleSelectTransaction(newTx.id);
        }, 10);
      }
    },
    [handleSelectTransaction]
  );

  // Interval feed generator
  useEffect(() => {
    if (isFeedActive) {
      feedIntervalRef.current = setInterval(() => {
        handleAddTransaction(false);
      }, 3500);
    } else if (feedIntervalRef.current) {
      clearInterval(feedIntervalRef.current);
      feedIntervalRef.current = null;
    }

    return () => {
      if (feedIntervalRef.current) {
        clearInterval(feedIntervalRef.current);
        feedIntervalRef.current = null;
      }
    };
  }, [isFeedActive, handleAddTransaction]);

  // Initial mount
  useEffect(() => {
    const initialTxs: Transaction[] = [];
    for (let i = 0; i < 4; i++) {
      initialTxs.push(generateTransaction(i === 2));
    }
    setTransactions(initialTxs);

    const firstId = initialTxs[0].id;
    setSelectedTxId(firstId);

    const initialSeq = 1;
    inspectionSeqRef.current = initialSeq;
    triggerSystem1(initialTxs[0], initialSeq);
    triggerSystem2(initialTxs[0], initialSeq);

    return () => {
      clearAllTimers();
    };
  }, []);

  const currentTransaction =
    transactions.find((tx) => tx.id === selectedTxId) || null;

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#0a0c10] text-[#ededed]">
      {/* Header */}
      <Header
        isFeedActive={isFeedActive}
        onToggleFeed={() => setIsFeedActive((prev) => !prev)}
        onSimulateFraud={() => handleAddTransaction(true)}
        onSimulateNormal={() => handleAddTransaction(false)}
        onReset={() => {
          clearAllTimers();
          const seed = [generateTransaction(false)];
          setTransactions(seed);
          handleSelectTransaction(seed[0].id);
        }}
        totalTransactions={transactions.length}
        apiConfig={apiConfig}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Split View */}
      <main
        className={`flex-1 flex overflow-hidden relative ${
          isResizing ? 'select-none cursor-col-resize' : ''
        }`}
      >
        {/* Left Sidebar: Transaction Feed with dynamic width */}
        <div
          id="feed-column"
          className={`${
            mobileView === 'inspection' ? 'hidden md:flex' : 'flex'
          } h-full shrink-0 w-full md:w-[var(--feed-width)] overflow-hidden`}
          style={{ '--feed-width': `${feedWidth}px` } as React.CSSProperties}
        >
          <TransactionFeed
            transactions={transactions}
            selectedTxId={selectedTxId}
            onSelectTransaction={handleSelectTransaction}
            feedWidth={feedWidth}
            onSetFeedWidth={setFeedWidth}
          />
        </div>

        {/* Draggable Resizer Handle (Divider) */}
        <div
          id="feed-resizer-handle"
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={feedWidth}
          aria-valuemin={250}
          aria-valuemax={720}
          aria-label="Ajustar ancho del flujo transaccional"
          onMouseDown={startResizing}
          onTouchStart={startResizing}
          onDoubleClick={() => setFeedWidth(380)}
          title="Arrastra para cambiar el tamaño a tu gusto (Doble clic para restablecer a 380px)"
          className={`hidden md:flex flex-col items-center justify-center w-2.5 hover:w-3 bg-[#0a0d13] hover:bg-sky-500/20 active:bg-sky-500/40 border-r border-zinc-800 cursor-col-resize select-none transition-all group shrink-0 relative z-30 ${
            isResizing ? 'bg-sky-500/30 !w-3' : ''
          }`}
        >
          <div
            className={`h-12 w-1 rounded-full transition-colors ${
              isResizing ? 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]' : 'bg-zinc-700 group-hover:bg-sky-400'
            }`}
          />
          {/* Active drag floating badge */}
          {isResizing && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-md bg-zinc-900 border border-sky-500 text-sky-200 text-xs font-mono font-bold shadow-2xl pointer-events-none z-50 whitespace-nowrap">
              {feedWidth}px
            </div>
          )}
        </div>

        {/* Right Section: Inspection Dashboard */}
        <div
          className={`${
            mobileView === 'feed' ? 'hidden md:flex' : 'flex'
          } flex-1 h-full overflow-hidden min-w-0`}
        >
          <InspectionDashboard
            transaction={currentTransaction}
            sys1={sys1Result}
            sys2={sys2Result}
            isSys1Loading={isSys1Loading}
            isSys2Loading={isSys2Loading}
            onBackToFeed={() => setMobileView('feed')}
            apiConfig={apiConfig}
          />
        </div>
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={apiConfig}
        onSaveConfig={handleSaveConfig}
      />
    </div>
  );
}
