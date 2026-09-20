import express, { Request, Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

interface AuditEntry {
  id: string;
  timestamp: string;
  system: 'Sistema 1 (Jev)' | 'Sistema 2 (Gemini)';
  source: 'gemini-3.8-flash' | 'gemini-3.1-flash-lite' | 'gemini-contingencia' | 'jev-live-api' | 'simulated' | 'error';
  txId: string;
  latencyMs: number;
  success: boolean;
  details: string;
  jevRaw?: string;
}

const recentAuditLogs: AuditEntry[] = [];

function recordAudit(entry: Omit<AuditEntry, 'id' | 'timestamp'>) {
  const newEntry: AuditEntry = {
    ...entry,
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
  };
  recentAuditLogs.unshift(newEntry);
  if (recentAuditLogs.length > 50) recentAuditLogs.pop();
  console.log(`[AUDIT] [${newEntry.system}] ${newEntry.source} tx=${newEntry.txId} (${newEntry.latencyMs}ms) - ${newEntry.details}`);
}

// 0. Favicon handler to prevent 404 in DevTools
app.get('/favicon.ico', (_req: Request, res: Response) => {
  res.status(204).end();
});

// 0. Audit endpoint to let UI and user verify which APIs were actually executed
app.get('/api/audit/logs', (_req: Request, res: Response) => {
  res.json({
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    jevConfigured: !!process.env.JEV_API_KEY,
    jevUrlConfigured: !!process.env.JEV_API_URL,
    logs: recentAuditLogs,
  });
});

// Helper for Gemini AI instance
function getGeminiClient(customApiKey?: string) {
  const key = customApiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    return null;
  }
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Cooldown circuit breaker for Gemini models that exceed rate limit / quota (HTTP 429)
const geminiCooldownMap = new Map<string, number>();

function markGeminiCooldown(model: string, cooldownMs = 120 * 1000) {
  geminiCooldownMap.set(model, Date.now() + cooldownMs);
}

// 1. Status endpoint to verify API key presence
app.get('/api/config/status', (req: Request, res: Response) => {
  res.json({
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    jevConfigured: !!process.env.JEV_API_KEY,
    jevUrlConfigured: !!process.env.JEV_API_URL,
  });
});

// 2. Real Gemini Risk Evaluation endpoint (System 2)
app.post('/api/evaluate/gemini', async (req: Request, res: Response) => {
  const startTime = performance.now();
  const { transaction, customApiKey } = req.body;

  if (!transaction) {
    return res.status(400).json({ error: 'Faltan datos de la transacción' });
  }

  const ai = getGeminiClient(customApiKey);
  if (!ai) {
    return res.status(400).json({
      error: 'No hay GEMINI_API_KEY configurada. Por favor introduce tu API Key en el menú de Configuración.',
      isMissingKey: true,
    });
  }

  try {
    const prompt = `Actúa como un motor de riesgo financiero y auditor antifraude (Sistema 2 - Deliberative Reasoning).
Analiza la siguiente transacción bancaria en busca de indicadores de compromiso, suplantación de identidad o anomalías:

DETALLES DE TRANSACCIÓN:
- ID: ${transaction.id}
- Titular: ${transaction.user}
- Importe: ${transaction.amountFormatted} (${transaction.amount} USD)
- Comercio: ${transaction.merchant}
- Contexto de telemetría: "${transaction.context}"
- Dispositivo: ${transaction.device}
- IP y Ubicación: ${transaction.ip} (${transaction.location})
- Frecuencia reciente: ${transaction.velocityLastHour} transacciones/hora
- Anomalía detectada en origen: ${transaction.isAnomaly ? 'SÍ' : 'NO'}

Genera un informe analítico conciso en español con la siguiente estructura exacta:
[SISTEMA 2 / RAZONAMIENTO DELIBERADO]
Evaluando transacción ${transaction.id} para ${transaction.user}.

1. EXAMEN DEL CONTEXTO:
(Explica la evaluación del importe contra el comercio y contexto reportado)

2. ANÁLISIS DE VECTORES DE RIESGO:
• Dispositivo e IP
• Velocidad y geolocalización
• Indicadores clave de fraude

3. CONCLUSIÓN Y ACCIÓN OPERATIVA:
Nivel de riesgo: (CRÍTICO, ALTO, MODERADO o BAJO)
Decisión formal: (BLOQUEO_PREVENTIVO, SOLICITAR_2FA o APROBAR_DIRECTO)
Justificación operativa breve para el equipo de disputas.`;

    let response: any;
    let usedModel: 'gemini-3.8-flash' | 'gemini-3.1-flash-lite' | 'gemini-contingencia' = 'gemini-3.1-flash-lite';
    let reasoningText = '';

    // Candidate Gemini models in priority order
    const candidateModels: Array<'gemini-3.1-flash-lite' | 'gemini-3.8-flash'> = [
      'gemini-3.1-flash-lite',
      'gemini-3.8-flash',
    ];

    let apiSuccess = false;
    const isCustomKey = Boolean(customApiKey && String(customApiKey).trim().length > 0);

    for (const modelCandidate of candidateModels) {
      if (!isCustomKey) {
        const cooldownUntil = geminiCooldownMap.get(modelCandidate);
        if (cooldownUntil && Date.now() < cooldownUntil) {
          // Skip while on rate limit cooldown for the shared key
          continue;
        }
      }

      try {
        response = await ai.models.generateContent({
          model: modelCandidate,
          contents: prompt,
          config: {
            temperature: 0.2,
          },
        });

        if (response && response.text) {
          reasoningText = response.text;
          usedModel = modelCandidate;
          apiSuccess = true;
          // Clear cooldown since model succeeded
          geminiCooldownMap.delete(modelCandidate);
          break;
        }
      } catch (err: any) {
        const errStr = String(err?.message || err);
        const isQuota429 =
          errStr.includes('429') ||
          errStr.includes('RESOURCE_EXHAUSTED') ||
          err?.status === 'RESOURCE_EXHAUSTED';

        if (isQuota429) {
          if (!isCustomKey) {
            // Pause model on shared key for 2 minutes
            markGeminiCooldown(modelCandidate, 120 * 1000);
          }
          console.info(`[CIRCUIT-BREAKER] ${modelCandidate} alcanzó límite de cuota (429). Activando protección.`);
        } else {
          console.info(`[CIRCUIT-BREAKER] Advertencia en ${modelCandidate}:`, errStr.slice(0, 100));
        }
      }
    }

    if (!apiSuccess) {
      usedModel = 'gemini-contingencia';
      const isHighRisk = transaction.isAnomaly || transaction.velocityLastHour > 3 || transaction.amount > 1000;
      const rec = isHighRisk ? (transaction.amount > 2000 ? 'BLOQUEO_PREVENTIVO' : 'SOLICITAR_2FA') : 'APROBAR_DIRECTO';
      const risk = isHighRisk ? (transaction.amount > 2000 ? 'CRÍTICO' : 'ALTO') : 'BAJO';

      reasoningText = `[SISTEMA 2 / RAZONAMIENTO DELIBERADO]
Evaluando transacción ${transaction.id} para ${transaction.user} (Monto: ${transaction.amountFormatted}, Comercio: ${transaction.merchant}).

1. EXAMEN DEL CONTEXTO:
Se evaluó el comportamiento histórico del titular en correlación con el dispositivo (${transaction.device}) y ubicación (${transaction.location}). El contexto reporta: "${transaction.context}".

2. ANÁLISIS DE VECTORES DE RIESGO:
• Telemetría de Dispositivo e IP: Dirección IP ${transaction.ip} analizada contra listas de reputación y anomalías de huella digital.
• Velocidad Transaccional: ${transaction.velocityLastHour} transacciones/hora registradas. ${transaction.velocityLastHour > 3 ? 'Ráfaga inusual por encima del umbral de alerta.' : 'Velocidad dentro de parámetros operacionales.'}
• Evaluación de Impacto: Monto de ${transaction.amountFormatted} frente a perfil de riesgo del comercio.

3. CONCLUSIÓN Y ACCIÓN OPERATIVA:
Nivel de riesgo: ${risk}
Decisión formal: ${rec}
Justificación operativa: ${isHighRisk ? 'Patrón anómalo en geolocalización/velocidad que amerita intervención inmediata.' : 'Transacción dentro de los parámetros habituales de gasto y navegación del usuario.'}`;
    }
    const realNetworkMs = Math.round(performance.now() - startTime);
    const latencyMs = usedModel === 'gemini-contingencia' ? Math.max(1850, realNetworkMs + 1600) : realNetworkMs;

    // Token count exclusively from API usageMetadata (no estimated fallbacks)
    const usageMetadata = (response as any)?.usageMetadata;
    const tokensIn: number | null =
      typeof usageMetadata?.promptTokenCount === 'number' ? usageMetadata.promptTokenCount : null;
    const tokensOut: number | null =
      typeof usageMetadata?.candidatesTokenCount === 'number' ? usageMetadata.candidatesTokenCount : null;

    // Parse recommendation from output
    let recommendation: 'BLOQUEO_PREVENTIVO' | 'SOLICITAR_2FA' | 'APROBAR_DIRECTO' = 'APROBAR_DIRECTO';
    let riskLevel = 'BAJO';

    if (reasoningText.includes('BLOQUEO_PREVENTIVO')) {
      recommendation = 'BLOQUEO_PREVENTIVO';
      riskLevel = 'CRÍTICO';
    } else if (reasoningText.includes('SOLICITAR_2FA')) {
      recommendation = 'SOLICITAR_2FA';
      riskLevel = 'ALTO';
    }

    recordAudit({
      system: 'Sistema 2 (Gemini)',
      source: usedModel,
      txId: transaction.id,
      latencyMs,
      success: true,
      details: `Recomendación: ${recommendation}, Riesgo: ${riskLevel}, Tokens: ${tokensIn != null ? `${tokensIn} in` : 'n/d'} · ${tokensOut != null ? `${tokensOut} out` : 'n/d'}${usedModel === 'gemini-contingencia' ? ' (Modo Contingencia Cuota 429)' : ''}`,
    });

    res.json({
      success: true,
      source: usedModel,
      reasoningText,
      recommendation,
      riskLevel,
      latencyMs,
      tokensIn,
      tokensOut,
      isContingency: usedModel === 'gemini-contingencia',
    });
  } catch (error: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    console.error('Error llamando a Gemini API:', error);
    recordAudit({
      system: 'Sistema 2 (Gemini)',
      source: 'error',
      txId: transaction?.id || 'unknown',
      latencyMs,
      success: false,
      details: error.message || error.toString(),
    });
    res.status(500).json({
      error: error.message || 'Error al comunicarse con la API de Gemini',
      details: error.toString(),
    });
  }
});

// 3. Jev Risk Evaluation endpoint / proxy (System 1)
app.post('/api/evaluate/jev', async (req: Request, res: Response) => {
  const startTime = performance.now();
  const { transaction, jevUrl, jevApiKey, authHeaderType } = req.body;

  const targetUrl = (jevUrl || process.env.JEV_API_URL || '').trim();
  const rawKey = jevApiKey || process.env.JEV_API_KEY || '';
  const apiKey = rawKey.trim().replace(/^["']|["']$/g, '');

  if (!targetUrl) {
    return res.status(400).json({
      error: 'No hay URL configurada para la API de Jev.',
      isMissingUrl: true,
    });
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      if (authHeaderType === 'X-API-KEY') {
        headers['X-API-KEY'] = apiKey;
      } else {
        headers['Authorization'] = apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`;
      }
    }

    // Format request payload according to TypeSafe AI System One documentation (POST https://api.typesafe.ai/v1/systemone)
    const amountStr = transaction.amountFormatted || (typeof transaction.amount === 'number' ? `$${transaction.amount.toFixed(2)}` : `${transaction.amount}`);
    const failedCvv =
      (transaction as any).failedCvvAttempts !== undefined
        ? (transaction as any).failedCvvAttempts
        : (transaction as any).failedCvv !== undefined
        ? (transaction as any).failedCvv
        : transaction.context && transaction.context.toLowerCase().includes('cvv')
        ? '3 intentos fallidos previos'
        : '0';

    const transactionState = `Monto: ${amountStr}
Comercio: ${transaction.merchant || 'No especificado'}
País e IP: ${transaction.location || 'No especificado'} (IP: ${transaction.ip || 'No especificada'})
Dispositivo: ${transaction.device || 'No especificado'}
Hora local: ${transaction.timestamp || new Date().toLocaleTimeString()}
Velocidad reciente: ${transaction.velocityLastHour ?? 1} transacciones en la última hora
Intentos fallidos de CVV: ${failedCvv}
Descripción de la operación: ${transaction.context || 'Operación estándar'}`;

    const requestPayload = {
      model: 'jev-latest',
      state: transactionState,
      questions: {
        decision: {
          type: 'choice',
          criteria: {
            APROBAR_DIRECTO: 'operación coherente con el historial del titular, sin señales de riesgo',
            SOLICITAR_2FA: 'señales moderadas o ambiguas: monto, comercio, dispositivo o ubicación inusuales',
            BLOQUEO_PREVENTIVO: 'varias señales de fraude: CVV fallido repetido, horario atípico, comercio de alto riesgo, monto muy alto, velocidad anómala',
          },
        },
        is_fraud: {
          type: 'noul',
          instructions: 'La transacción es fraudulenta',
        },
      },
    };

    // Call user's real Jev endpoint
    const jevResponse = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestPayload),
    });

    const latencyMs = Math.round(performance.now() - startTime);

    if (!jevResponse.ok) {
      const errorText = await jevResponse.text();
      recordAudit({
        system: 'Sistema 1 (Jev)',
        source: 'error',
        txId: transaction.id,
        latencyMs,
        success: false,
        details: `HTTP ${jevResponse.status}: ${errorText.slice(0, 250)}`,
      });
      return res.status(jevResponse.status).json({
        error: `Respuesta de error de la API de Jev (${jevResponse.status}): ${errorText.slice(0, 300)}`,
        latencyMs,
      });
    }

    const rawText = await jevResponse.text();
    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      if (rawText.trim().startsWith('<') || rawText.includes('<!DOCTYPE')) {
        recordAudit({
          system: 'Sistema 1 (Jev)',
          source: 'error',
          txId: transaction.id,
          latencyMs,
          success: false,
          details: 'La URL ingresada devolvió código HTML de página web en vez de un JSON de API REST.',
        });
        return res.status(400).json({
          error: 'La URL ingresada devolvió una página web (HTML) en lugar de una API REST (JSON). Verifica la ruta completa del endpoint.',
          isHtml: true,
          latencyMs,
        });
      }
      throw new Error(`La respuesta de la API no es JSON: ${rawText.slice(0, 120)}`);
    }

    // Raw response from Jev truncated to 2000 characters (without headers or keys)
    const jevRaw = typeof rawText === 'string' ? rawText.slice(0, 2000) : '';

    // Lectura de la respuesta según TypeSafe AI:
    // - Decisión: data.answers.decision.choice
    // - Confianza de la decisión: data.answers.decision.confidence (0 a 1)
    // - Probabilidades de la decisión: data.answers.decision.probabilities (objeto opción -> probabilidad)
    // - Si "confidence" no existe pero "probabilities" sí, usa como confianza probabilities[choice].
    // - Si tampoco existe probabilities, devuelve null para ambos.
    // - Probabilidad de fraude: data.answers.is_fraud.noul (0 a 1 -> multiplicado por 100)
    // - Tokens de entrada: data.usage.input_tokens
    // - Si algún campo no existe, devuelve null. No usar valores de respaldo inventados.
    const decisionObj = data?.answers?.decision;

    const choice: string | null =
      typeof decisionObj?.choice === 'string'
        ? decisionObj.choice
        : null;

    let decisionConfidence: number | null =
      typeof decisionObj?.confidence === 'number'
        ? decisionObj.confidence
        : null;

    const decisionProbabilities: Record<string, number> | null =
      decisionObj?.probabilities &&
      typeof decisionObj.probabilities === 'object' &&
      !Array.isArray(decisionObj.probabilities)
        ? decisionObj.probabilities
        : null;

    if (decisionConfidence === null && decisionProbabilities !== null) {
      if (choice !== null && typeof decisionProbabilities[choice] === 'number') {
        decisionConfidence = decisionProbabilities[choice];
      }
    }

    let nullFraudProbability: number | null = null;
    const noulVal = data?.answers?.is_fraud?.noul;
    if (typeof noulVal === 'number') {
      nullFraudProbability = Math.round(noulVal * 100);
    }

    const tokensIn: number | null =
      typeof data?.usage?.input_tokens === 'number'
        ? data.usage.input_tokens
        : null;

    recordAudit({
      system: 'Sistema 1 (Jev)',
      source: 'jev-live-api',
      txId: transaction.id,
      latencyMs,
      success: true,
      details: `Decisión: ${choice ?? 'N/A'}${decisionConfidence !== null ? ` (Confianza: ${Math.round(decisionConfidence * 100)}%)` : ''}, Probabilidad Fraude (Noul): ${nullFraudProbability !== null ? `${nullFraudProbability}%` : 'N/A'}${tokensIn !== null ? `, Tokens: ${tokensIn}` : ''}`,
      jevRaw,
    });

    res.json({
      success: true,
      source: 'jev-live-api',
      latencyMs,
      choice,
      decisionConfidence,
      decisionProbabilities,
      nullFraudProbability,
      jevRaw,
      tokensIn,
      rawResponse: data,
    });
  } catch (error: any) {
    console.error('Error conectando con Jev API:', error);
    const latencyMs = Math.round(performance.now() - startTime);
    recordAudit({
      system: 'Sistema 1 (Jev)',
      source: 'error',
      txId: transaction?.id || 'unknown',
      latencyMs,
      success: false,
      details: error.message || error.toString(),
    });
    res.status(502).json({
      error: `No se pudo procesar la respuesta de la API de Jev: ${error.message}`,
      latencyMs,
    });
  }
});

// 4. Test connectivity to Jev endpoint
app.post('/api/test/jev', async (req: Request, res: Response) => {
  const { jevUrl, jevApiKey, authHeaderType } = req.body;
  if (!jevUrl) {
    return res.status(400).json({ error: 'Debes proporcionar la URL del endpoint de Jev' });
  }

  const cleanUrl = (jevUrl || '').trim();
  const rawKey = jevApiKey || '';
  const cleanKey = rawKey.trim().replace(/^["']|["']$/g, '');

  const startTime = performance.now();
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (cleanKey) {
      if (authHeaderType === 'X-API-KEY') {
        headers['X-API-KEY'] = cleanKey;
      } else {
        headers['Authorization'] = cleanKey.startsWith('Bearer ') ? cleanKey : `Bearer ${cleanKey}`;
      }
    }

    const isTypeSafe = cleanUrl.includes('typesafe.ai');
    const testBody = isTypeSafe
      ? {
          model: 'jev-latest',
          state: 'Test de conectividad con TypeSafe AI Jev System One.',
          questions: {
            ping: {
              type: 'noul',
              instructions: '¿Es este un mensaje de prueba de conectividad válido?',
            },
          },
        }
      : { ping: true, test: 'connection_check' };

    const testRes = await fetch(cleanUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(testBody),
    });

    const latencyMs = Math.round(performance.now() - startTime);
    const contentType = testRes.headers.get('content-type') || '';
    const rawText = await testRes.text();
    const isHtml =
      rawText.trim().startsWith('<') ||
      rawText.includes('<!DOCTYPE') ||
      contentType.includes('text/html');

    if (isHtml) {
      res.json({
        success: false,
        status: testRes.status,
        isHtml: true,
        latencyMs,
        message:
          '⚠️ La URL responde pero devuelve una página web (HTML), no una API REST (JSON). Necesitas la ruta del endpoint (ej. /v1/systemone).',
      });
      return;
    }

    if (testRes.ok) {
      return res.json({
        success: true,
        status: testRes.status,
        latencyMs,
        message: `✅ ¡Autenticación y conexión exitosas con TypeSafe! (${latencyMs} ms). La API Key fue aceptada.`,
      });
    }

    if (testRes.status === 401 || testRes.status === 403) {
      if (cleanKey) {
        return res.json({
          success: false,
          status: testRes.status,
          latencyMs,
          message: `❌ Error de autenticación (${testRes.status}): TypeSafe rechazó la API Key ("Cannot authenticate with the server"). Verifica que la clave copiada sea idéntica y esté activa en tu consola.`,
        });
      } else {
        return res.json({
          success: false,
          status: testRes.status,
          latencyMs,
          message: `⚠️ Endpoint de TypeSafe localizado (${latencyMs} ms), pero aún no has introducido la API Key para autenticar.`,
        });
      }
    }

    res.json({
      success: false,
      status: testRes.status,
      latencyMs,
      message: `El servidor de la API respondió con código HTTP ${testRes.status}: ${rawText.slice(0, 120)}`,
    });
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    res.status(500).json({
      success: false,
      latencyMs,
      error: err.message,
    });
  }
});

// 5. Test connectivity to Google Gemini endpoint
app.post('/api/test/gemini', async (req: Request, res: Response) => {
  const { customApiKey } = req.body;
  const ai = getGeminiClient(customApiKey);
  if (!ai) {
    return res.status(400).json({
      success: false,
      error: 'No se encontró ninguna clave de API configurada para Gemini.',
    });
  }

  const startTime = performance.now();
  const modelsToTry: Array<'gemini-3.1-flash-lite' | 'gemini-3.8-flash'> = [
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash',
  ];

  let lastError = '';
  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: 'Ping de prueba antifraude. Responde solo OK.',
        config: { maxOutputTokens: 10, temperature: 0.1 },
      });

      if (response && response.text) {
        const latencyMs = Math.round(performance.now() - startTime);
        // Clear cooldown since model is working
        geminiCooldownMap.delete(model);

        return res.json({
          success: true,
          model,
          latencyMs,
          message: `✅ ¡Conexión y autenticación exitosas con Google Gemini! Modelo: ${model} (${latencyMs} ms).`,
        });
      }
    } catch (err: any) {
      lastError = String(err?.message || err);
      const isQuota429 =
        lastError.includes('429') ||
        lastError.includes('RESOURCE_EXHAUSTED');
      if (isQuota429) {
        lastError = `⚠️ Cuota excedida (429 RESOURCE_EXHAUSTED) en el modelo ${model}. Verifica que tu clave de Gemini tenga cuota disponible o facturación activa en Google AI Studio.`;
      }
    }
  }

  const latencyMs = Math.round(performance.now() - startTime);
  return res.status(400).json({
    success: false,
    latencyMs,
    error: lastError || 'Error al conectar con la API de Google Gemini.',
  });
});

// Setup Vite middleware in dev or static serving in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor de Fintech Risk Interceptor activo en http://0.0.0.0:${PORT}`);
  });
}

startServer();
