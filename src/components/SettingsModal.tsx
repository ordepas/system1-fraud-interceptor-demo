import React, { useState } from 'react';
import { ApiConfig } from '../types';
import {
  X,
  Key,
  Globe,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Radio,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ApiConfig;
  onSaveConfig: (newConfig: ApiConfig) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}) => {
  const [formData, setFormData] = useState<ApiConfig>({ ...config });
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showJevKey, setShowJevKey] = useState(false);
  const [testingGemini, setTestingGemini] = useState(false);
  const [geminiTestResult, setGeminiTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [testingJev, setTestingJev] = useState(false);
  const [jevTestResult, setJevTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleTestGeminiConnection = async () => {
    setTestingGemini(true);
    setGeminiTestResult(null);

    try {
      const res = await fetch('/api/test/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customApiKey: formData.customGeminiKey?.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setGeminiTestResult({
          success: true,
          message: data.message || `Conexión verificada con Google Gemini (${data.latencyMs} ms).`,
        });
        // Automatically enable useRealGemini if test succeeded
        setFormData((prev) => ({ ...prev, useRealGemini: true }));
      } else {
        setGeminiTestResult({
          success: false,
          message:
            data.error ||
            data.message ||
            `Error al responder (${data.status || res.status}).`,
        });
      }
    } catch (err: any) {
      setGeminiTestResult({
        success: false,
        message: `Error de red: ${err.message}`,
      });
    } finally {
      setTestingGemini(false);
    }
  };

  const handleTestJevConnection = async () => {
    if (!formData.jevUrl) {
      setJevTestResult({
        success: false,
        message: 'Por favor ingresa la URL del endpoint de Jev primero.',
      });
      return;
    }

    setTestingJev(true);
    setJevTestResult(null);

    try {
      const res = await fetch('/api/test/jev', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jevUrl: formData.jevUrl,
          jevApiKey: formData.jevApiKey,
          authHeaderType: formData.jevAuthType,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setJevTestResult({
          success: true,
          message: data.message || `Conexión verificada con Jev (${data.latencyMs} ms).`,
        });
      } else {
        setJevTestResult({
          success: false,
          message:
            data.error ||
            data.message ||
            `Error al responder (${data.status || res.status}).`,
        });
      }
    } catch (err: any) {
      setJevTestResult({
        success: false,
        message: `Error de red: ${err.message}`,
      });
    } finally {
      setTestingJev(false);
    }
  };

  const handleSave = () => {
    const updated = {
      ...formData,
      useRealGemini: formData.customGeminiKey?.trim() ? true : formData.useRealGemini,
      useRealJev: formData.jevUrl ? true : formData.useRealJev,
    };
    onSaveConfig(updated);
    onClose();
  };

  return (
    <div
      id="settings-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div
        id="settings-modal-content"
        className="w-full max-w-2xl bg-[#0f141c] border border-[#273247] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#21262d] bg-[#141a24] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 id="settings-modal-title" className="text-base font-bold text-white">
                Configuración de Conexiones de APIs
              </h2>
              <p className="text-xs text-gray-400">
                Alterna entre APIs reales en la nube o simulación local para ambos sistemas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar ventana de configuración"
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-6 text-xs text-gray-300">
          {/* SECTION 1: GOOGLE GEMINI (SYSTEM 2) */}
          <div className="p-4 rounded-xl bg-[#141a24]/80 border border-[#232a3b] space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">
                  Sistema 2: Google Gemini AI
                </h3>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                gemini-3.1-flash-lite / 3.8-flash
              </span>
            </div>

            <p className="text-gray-400 leading-relaxed text-[11px]">
              Al activar Gemini real, el servidor ejecutará el SDK oficial{' '}
              <code className="text-amber-300">@google/genai</code> para generar el razonamiento deliberado paso a paso en cada transacción inspeccionada.
            </p>

            {/* Mode toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#0b0e14] border border-white/5">
              <div>
                <span className="font-semibold text-gray-200 block">
                  Usar Gemini Real en Sistema 2
                </span>
                <span className="text-[11px] text-gray-500">
                  {formData.useRealGemini
                    ? 'Llamadas activas hacia Google Gemini en servidor'
                    : 'Modo simulación local (sin consumo de cuota)'}
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.useRealGemini}
                  onChange={(e) =>
                    setFormData({ ...formData, useRealGemini: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

            {/* Server key status banner */}
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-blue-400" />
              <span>
                <strong>Clave de Gemini configurada:</strong> La aplicación utiliza por defecto la variable <code className="bg-black/30 px-1 py-0.5 rounded">GEMINI_API_KEY</code> provista por el entorno.
              </span>
            </div>

            {/* Optional Custom Gemini Key override */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-gray-400 flex items-center justify-between">
                <span>Clave personalizada de Google Gemini (Opcional)</span>
                <span className="text-[10px] text-gray-500">
                  Sobrescribe la clave del servidor
                </span>
              </label>
              <div className="relative">
                <input
                  type={showGeminiKey ? 'text' : 'password'}
                  value={formData.customGeminiKey}
                  onChange={(e) =>
                    setFormData({ ...formData, customGeminiKey: e.target.value })
                  }
                  placeholder="AIzaSy..."
                  className="w-full bg-[#0b0e14] border border-[#2d3748] rounded-lg px-3 py-2 pr-10 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Gemini Test Connection Button & Feedback */}
              <div className="pt-1 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleTestGeminiConnection}
                    disabled={testingGemini}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#21262d] border border-[#30363d] text-gray-200 hover:bg-[#30363d] hover:text-white disabled:opacity-40 transition-colors flex items-center gap-1.5 shrink-0"
                  >
                    <Radio className={`w-3.5 h-3.5 text-amber-400 ${testingGemini ? 'animate-spin' : ''}`} />
                    <span>{testingGemini ? 'Probando...' : 'Probar Conexión con Gemini'}</span>
                  </button>
                  <span className="text-[10px] text-gray-500">
                    Verifica la validez y cuota disponible de la API Key
                  </span>
                </div>

                {geminiTestResult && (
                  <div
                    className={`text-[11px] font-medium p-2.5 rounded-lg border flex items-start gap-2 leading-relaxed ${
                      geminiTestResult.success
                        ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                        : 'bg-amber-500/10 border-amber-500/25 text-amber-200'
                    }`}
                  >
                    {geminiTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    )}
                    <span>{geminiTestResult.message}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 2: JEV RISK ENGINE (SYSTEM 1) */}
          <div className="p-4 rounded-xl bg-[#141a24]/80 border border-[#232a3b] space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white">
                  Sistema 1: Jev Risk Engine API
                </h3>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30 font-semibold">
                Ultra-low latency ML
              </span>
            </div>

            <p className="text-gray-400 leading-relaxed text-[11px]">
              Ingresa los datos de tu API de Jev para dirigir las solicitudes transaccionales a tu motor de reglas/ML y medir la latencia real de red.
            </p>

            {/* Mode toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#0b0e14] border border-white/5">
              <div>
                <span className="font-semibold text-gray-200 block">
                  Usar API Real de Jev en Sistema 1
                </span>
                <span className="text-[11px] text-gray-500">
                  {formData.useRealJev
                    ? 'Llamadas HTTP directas hacia el endpoint de Jev'
                    : 'Modo simulación local con latencia sintética'}
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.useRealJev}
                  onChange={(e) =>
                    setFormData({ ...formData, useRealJev: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Jev Endpoint URL */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-gray-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-blue-400" />
                  <span>URL del Endpoint de la API</span>
                </span>
                <span className="text-[10px] text-blue-400 font-mono">
                  https://api.typesafe.ai/v1/systemone
                </span>
              </label>
              <input
                type="url"
                value={formData.jevUrl}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    jevUrl: e.target.value,
                    useRealJev: e.target.value.trim() ? true : formData.useRealJev,
                  })
                }
                placeholder="https://api.typesafe.ai/v1/systemone"
                className="w-full bg-[#0b0e14] border border-[#2d3748] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 font-mono"
              />

              {/* Helpful TypeSafe location tip */}
              <div className="p-2.5 rounded-lg bg-blue-950/30 border border-blue-800/30 text-[11px] text-blue-200/90 leading-relaxed space-y-1">
                <p className="font-semibold text-blue-300 flex items-center gap-1">
                  💡 Endpoint oficial de TypeSafe Jev (System One)
                </p>
                <div className="space-y-1 text-[10.5px] text-gray-300">
                  <p>
                    Coloca exactamente: <code className="bg-black/60 px-1.5 py-0.5 rounded text-cyan-300 font-mono font-semibold">https://api.typesafe.ai/v1/systemone</code>
                  </p>
                  <p className="text-gray-400 text-[10px]">
                    Este es el endpoint documentado en el Quickstart oficial de TypeSafe para enviar consultas de decisión tipadas con el modelo Jev.
                  </p>
                </div>
              </div>
            </div>

            {/* Jev API Key & Auth Header */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-[11px] font-semibold text-gray-400 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-purple-400" />
                  <span>API Key / Token de Jev</span>
                </label>
                <div className="relative">
                  <input
                    type={showJevKey ? 'text' : 'password'}
                    value={formData.jevApiKey}
                    onChange={(e) =>
                      setFormData({ ...formData, jevApiKey: e.target.value })
                    }
                    placeholder="jev_live_sk_..."
                    className="w-full bg-[#0b0e14] border border-[#2d3748] rounded-lg px-3 py-2 pr-10 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowJevKey(!showJevKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showJevKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-gray-400 block">
                  Tipo de Autenticación
                </label>
                <select
                  value={formData.jevAuthType}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      jevAuthType: e.target.value as 'Bearer' | 'X-API-KEY',
                    })
                  }
                  className="w-full bg-[#0b0e14] border border-[#2d3748] rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="Bearer">Bearer Token</option>
                  <option value="X-API-KEY">Header X-API-KEY</option>
                </select>
              </div>
            </div>

            {/* Test Connection Button & Output */}
            <div className="pt-1 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleTestJevConnection}
                  disabled={testingJev || !formData.jevUrl}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#21262d] border border-[#30363d] text-gray-200 hover:bg-[#30363d] hover:text-white disabled:opacity-40 transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <Radio className={`w-3.5 h-3.5 text-blue-400 ${testingJev ? 'animate-spin' : ''}`} />
                  <span>{testingJev ? 'Probando...' : 'Probar Conexión con la API'}</span>
                </button>
              </div>

              {jevTestResult && (
                <div
                  className={`text-[11px] font-medium p-2.5 rounded-lg border flex items-start gap-2 leading-relaxed ${
                    jevTestResult.success
                      ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                      : 'bg-amber-500/10 border-amber-500/25 text-amber-200'
                  }`}
                >
                  {jevTestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  )}
                  <span>{jevTestResult.message}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-[#21262d] bg-[#141a24] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#21262d] text-gray-300 hover:text-white hover:bg-[#30363d] transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-[0_0_12px_rgba(59,130,246,0.3)]"
          >
            Guardar Configuración
          </button>
        </div>
      </div>
    </div>
  );
};
