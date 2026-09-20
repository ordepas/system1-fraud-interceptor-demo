import { Transaction, System1Result } from '../types';

const MOCK_USERS = [
  { name: 'Elena Rostova', ip: '194.28.112.4', loc: 'New York, US', device: 'iPhone 16 Pro (iOS 18)', card: '4129' },
  { name: 'Carlos Mendoza', ip: '181.44.20.89', loc: 'Miami, US', device: 'Samsung Galaxy S24 (Android 14)', card: '8831' },
  { name: 'Alice Chen', ip: '72.14.201.12', loc: 'San Francisco, US', device: 'MacBook Pro M3 (macOS 15)', card: '6204' },
  { name: 'David Miller', ip: '82.165.197.1', loc: 'Chicago, US', device: 'ThinkPad X1 (Windows 11)', card: '1095' },
  { name: 'Sofia Takahashi', ip: '133.242.18.5', loc: 'Seattle, US', device: 'Google Pixel 9 Pro (Android 15)', card: '5532' },
  { name: 'Mateo Valdés', ip: '186.104.9.44', loc: 'Austin, US', device: 'iPad Pro M4 (iPadOS 18)', card: '9921' },
];

const NORMAL_MERCHANTS = [
  'Whole Foods Market',
  'Uber Technologies',
  'AWS Cloud Services',
  'Apple Store Fifth Ave',
  'Spotify Premium',
  'Steam Digital Games',
  'Amazon Prime Store',
  'Blue Bottle Coffee Roasters',
  'Netflix Streaming',
  'Target Superstore',
];

const ANOMALY_MERCHANTS = [
  'Binance Crypto P2P Desk',
  'FastCash Global Remittance',
  'Luxury Watch Outlet Dubai',
  'Offshore Digital Gift Cards',
  'Anonymous Bulletproof VPS',
  'DarkGate High-Risk Transfer',
];

const NORMAL_CONTEXTS = [
  'Transacción recurrente desde IP residencial autorizada. Coincide con el patrón de consumo histórico.',
  'Pago con autenticación biométrica FaceID y tarjeta con chip en terminal habitual de punto de venta.',
  'Suscripción mensual recurrente sin alteraciones de dispositivo ni red en los últimos 180 días.',
  'Compra online con verificación 3D Secure confirmada en dispositivo móvil registrado.',
  'Gasto habitual en horario diurno dentro de los límites y categorías frecuentes del titular.',
];

const ANOMALY_SCENARIOS = [
  {
    type: 'GEO_VELOCITY' as const,
    merchant: 'Offshore Digital Gift Cards',
    context: '⚠️ Salto de geolocalización repentino: IP de salida detectada en San Petersburgo (Proxy/VPN) 12 minutos después de una compra física en Nueva York. Importe 450% sobre la media mensual.',
    amountRange: [1250, 3900],
  },
  {
    type: 'CRYPTO_BURST' as const,
    merchant: 'Binance Crypto P2P Desk',
    context: '⚠️ Ráfaga transaccional de alta velocidad: 4º intento consecutivo en < 90 segundos hacia exchange no regulado tras cambio reciente de contraseña y correo.',
    amountRange: [2600, 5200],
  },
  {
    type: 'CARD_NOT_PRESENT' as const,
    merchant: 'Luxury Watch Outlet Dubai',
    context: '⚠️ Operación Card-Not-Present a las 03:42 AM hora local. 3 intentos fallidos previos con código CVV erróneo en pasarela de alto riesgo.',
    amountRange: [1950, 4700],
  },
  {
    type: 'ACCOUNT_TAKEOVER' as const,
    merchant: 'FastCash Global Remittance',
    context: '⚠️ Señales de Account Takeover (ATO): Nuevo dispositivo no reconocido (Linux User-Agent) ordenando transferencia total de fondos hacia cuenta no verificada.',
    amountRange: [3200, 5800],
  },
];

let globalTxCounter = 1000;

export function generateTransaction(forceAnomaly: boolean = false): Transaction {
  const isAnomaly = forceAnomaly || Math.random() > 0.82;
  const userObj = MOCK_USERS[Math.floor(Math.random() * MOCK_USERS.length)];
  globalTxCounter += 1;

  const now = new Date();
  const timestamp = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  if (isAnomaly) {
    const scenario = ANOMALY_SCENARIOS[Math.floor(Math.random() * ANOMALY_SCENARIOS.length)];
    const amount = Number((Math.random() * (scenario.amountRange[1] - scenario.amountRange[0]) + scenario.amountRange[0]).toFixed(2));
    
    return {
      id: `tx_${globalTxCounter}`,
      timestamp,
      user: userObj.name,
      merchant: scenario.merchant,
      amount,
      amountFormatted: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount),
      context: scenario.context,
      isAnomaly: true,
      anomalyType: scenario.type,
      status: 'PENDING',
      ip: scenario.type === 'GEO_VELOCITY' ? '185.220.101.5 (Tor Exit)' : userObj.ip,
      location: scenario.type === 'GEO_VELOCITY' ? 'San Petersburgo, RU (VPN)' : userObj.loc,
      device: scenario.type === 'ACCOUNT_TAKEOVER' ? 'Generic Linux x86_64 (Unknown)' : userObj.device,
      cardLast4: userObj.card,
      velocityLastHour: Math.floor(Math.random() * 5) + 6,
    };
  } else {
    const merchant = NORMAL_MERCHANTS[Math.floor(Math.random() * NORMAL_MERCHANTS.length)];
    const context = NORMAL_CONTEXTS[Math.floor(Math.random() * NORMAL_CONTEXTS.length)];
    const amount = Number((Math.random() * 185 + 12).toFixed(2));
    
    return {
      id: `tx_${globalTxCounter}`,
      timestamp,
      user: userObj.name,
      merchant,
      amount,
      amountFormatted: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount),
      context,
      isAnomaly: false,
      anomalyType: 'NORMAL',
      status: 'PENDING',
      ip: userObj.ip,
      location: userObj.loc,
      device: userObj.device,
      cardLast4: userObj.card,
      velocityLastHour: Math.floor(Math.random() * 2) + 1,
    };
  }
}

export function evaluateSystem1(tx: Transaction): System1Result {
  // Ultra-fast deterministic/heuristic response simulation (35ms - 90ms)
  const latencyMs = Math.floor(Math.random() * 55) + 38;

  if (tx.isAnomaly) {
    const isCritical = tx.amount > 2000 || tx.anomalyType === 'ACCOUNT_TAKEOVER' || tx.anomalyType === 'GEO_VELOCITY';
    const choice = isCritical ? 'BLOQUEO_PREVENTIVO' : 'SOLICITAR_2FA';
    const riskLevel = isCritical ? 'CRÍTICO' : 'ALTO';
    const nullFraudProbability = Math.floor(Math.random() * 12) + (isCritical ? 88 : 74);

    return {
      latencyMs,
      choice,
      riskLevel,
      nullFraudProbability,
      tokensCost: 0,
      timestamp: new Date().toLocaleTimeString(),
    };
  } else {
    const nullFraudProbability = Math.floor(Math.random() * 6); // 0-5%

    return {
      latencyMs,
      choice: 'APROBAR_DIRECTO',
      riskLevel: 'BAJO',
      nullFraudProbability,
      tokensCost: 0,
      timestamp: new Date().toLocaleTimeString(),
    };
  }
}

export function generateSystem2Reasoning(tx: Transaction): {
  steps: string[];
  fullText: string;
  recommendation: 'BLOQUEO_PREVENTIVO' | 'SOLICITAR_2FA' | 'APROBAR_DIRECTO';
  confidenceScore: number;
} {
  if (tx.isAnomaly) {
    const isBlock = tx.amount > 2000 || tx.anomalyType === 'ACCOUNT_TAKEOVER' || tx.anomalyType === 'GEO_VELOCITY';
    const rec = isBlock ? 'BLOQUEO_PREVENTIVO' : 'SOLICITAR_2FA';
    const confidence = isBlock ? 96 : 89;

    const fullText = `[SISTEMA 2 / RAZONAMIENTO DELIBERADO]
Evaluando transacción ${tx.id} para el usuario ${tx.user}.

1. EXAMEN DEL CONTEXTO:
Observo en telemetría: "${tx.context}".
El importe de ${tx.amountFormatted} en el comercio "${tx.merchant}" representa una desviación crítica respecto al perfil habitual de consumo (media histórica < $90.00 USD).

2. ANÁLISIS DE VECTORES DE RIESGO:
• Dispositivo: ${tx.device}
• Origen de Red: ${tx.ip} (${tx.location})
• Velocidad transaccional: ${tx.velocityLastHour} operaciones en la última hora.
${tx.anomalyType === 'GEO_VELOCITY' ? '• Incoherencia espacio-temporal: Distancia física imposible de recorrer sin teletransportación entre sesiones previas y actuales.' : ''}
${tx.anomalyType === 'ACCOUNT_TAKEOVER' ? '• Alerta ATO: Huella de navegador anómala y modificación reciente de credenciales de seguridad.' : ''}

3. CONCLUSIÓN Y DECISIÓN OPERATIVA:
El nivel de riesgo se clasifica formalmente como CRÍTICO (${confidence}% de confianza de fraude activo).
Acción obligatoria inmediata recomendada: ${rec}.
Se instruye retención cautelar de fondos y notificación de verificación por canal seguro alternativo out-of-band.`;

    const steps = [
      'Extracción de metadatos de sesión y contexto del usuario.',
      'Cálculo de vector de desviación de importe contra histórico.',
      'Correlación geográfica y detección de evasión de red (VPN/Proxy).',
      'Síntesis deliberada y recomendación de acción de contingencia.',
    ];

    return { steps, fullText, recommendation: rec, confidenceScore: confidence };
  } else {
    const fullText = `[SISTEMA 2 / RAZONAMIENTO DELIBERADO]
Evaluando transacción ${tx.id} para el usuario ${tx.user}.

1. EXAMEN DEL CONTEXTO:
Petición legítima por importe de ${tx.amountFormatted} en "${tx.merchant}".
Contexto verificado: "${tx.context}".

2. ANÁLISIS DE INTEGRIDAD:
• Dispositivo conocido y consistente: ${tx.device}
• Geocercanía IP válida: ${tx.location} (${tx.ip})
• Frecuencia dentro del rango seguro: ${tx.velocityLastHour} op/hora.
• Cero indicadores de compromiso o suplantación de identidad.

3. CONCLUSIÓN Y DICTAMEN:
La operación exhibe coherencia total con las directivas de riesgo bajo.
Acción recomendada: APROBAR_DIRECTO.
No se requieren intervenciones secundarias ni desafío 2FA.`;

    const steps = [
      'Verificación de firma criptográfica y token de dispositivo.',
      'Validación de límites de importe y categoría de comercio.',
      'Confirmación de ausencia de alertas en listas negras o proxies.',
      'Aprobación directa sin fricción para el usuario final.',
    ];

    return { steps, fullText, recommendation: 'APROBAR_DIRECTO', confidenceScore: 99 };
  }
}
