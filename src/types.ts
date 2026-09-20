export type TransactionStatus =
  | 'PENDING'
  | 'BLOQUEO_PREVENTIVO'
  | 'SOLICITAR_2FA'
  | 'APROBAR_DIRECTO';

export type RiskLevel = 'CRÍTICO' | 'ALTO' | 'MODERADO' | 'BAJO';

export interface Transaction {
  id: string;
  timestamp: string;
  user: string;
  merchant: string;
  amount: number;
  amountFormatted: string;
  context: string;
  isAnomaly: boolean;
  anomalyType?: 'GEO_VELOCITY' | 'CRYPTO_BURST' | 'CARD_NOT_PRESENT' | 'ACCOUNT_TAKEOVER' | 'NORMAL';
  status: TransactionStatus;
  ip: string;
  location: string;
  device: string;
  cardLast4: string;
  velocityLastHour: number;
}

export interface System1Result {
  latencyMs: number;
  choice: TransactionStatus;
  riskLevel: RiskLevel;
  decisionConfidence?: number | null;
  decisionProbabilities?: Record<string, number> | null;
  nullFraudProbability: number | null; // 0 - 100% or null
  featuresEvaluated?: number;
  tokensCost?: number;
  tokensIn?: number | null;
  timestamp: string;
  source?: 'jev-live-api' | 'simulated';
  sourceDetails?: string;
  jevRaw?: string;
}

export type System2StreamingStatus = 'idle' | 'analyzing' | 'streaming' | 'completed';

export interface System2Result {
  latencyMs: number;
  ttftMs?: number;
  tokensOut?: number | null;
  tokensIn?: number | null;
  reasoningText: string;
  status: System2StreamingStatus;
  recommendation: TransactionStatus;
  confidenceScore?: number;
  model?: string;
  chainOfThoughtSteps: string[];
  source?: 'gemini-3.8-flash' | 'gemini-3.1-flash-lite' | 'gemini-contingencia' | 'simulated' | string;
  sourceDetails?: string;
  isContingency?: boolean;
}

export interface InspectionState {
  transaction: Transaction | null;
  sys1: System1Result | null;
  sys2: System2Result | null;
  isSys1Loading: boolean;
  isSys2Loading: boolean;
}

export interface ApiConfig {
  useRealGemini: boolean;
  customGeminiKey: string;
  useRealJev: boolean;
  jevUrl: string;
  jevApiKey: string;
  jevAuthType: 'Bearer' | 'X-API-KEY';
  geminiServerAvailable: boolean;
}

