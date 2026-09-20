# Antifraude Cognitivo: Arquitectura Dual (Jev AI & Google Gemini)

Sistema de detección y auditoría de fraude financiero en tiempo real basado en la teoría del **Pensamiento Rápido y Lento** (*Thinking, Fast and Slow* de Daniel Kahneman). Combina un motor reactivo de ultra baja latencia con un modelo deliberativo de razonamiento profundo.

---

## 🏛️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                 Transacción Financiera                      │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
       (Ruta Rápida: <200ms)          (Ruta Deliberada: 2-7s)
               ▼                               ▼
  ┌─────────────────────────┐     ┌─────────────────────────┐
  │   SISTEMA 1: Jev AI     │     │ SISTEMA 2: Google Gemini│
  │   - Modelo reactivo     │     │ - Modelo deliberativo   │
  │   - Inferencia sub-seg  │     │ - Análisis contextual   │
  │   - Decisión directa    │     │ - Auditoría y riesgo    │
  └────────────┬────────────┘     └────────────┬────────────┘
               │                               │
               └───────────────┬───────────────┘
                               ▼
            ┌────────────────────────────────────┐
            │       Motor de Arbitraje           │
            │  - Comparativa de decisiones       │
            │  - Registro de auditoría           │
            │  - Métricas de latencia y tokens   │
            └────────────────────────────────────┘
```

### 1. Sistema 1: Motor Reactivo (Jev AI)
- **Objetivo**: Evaluar transacciones en tiempo real (<200 ms).
- **Entradas**: Telemetría de transacción, monto, ubicación, dispositivo, velocidad e IP.
- **Salidas**: 
  - `choice`: `APROBAR_DIRECTO`, `SOLICITAR_2FA`, `BLOQUEO_PREVENTIVO`.
  - `confidence`: Nivel de certidumbre del modelo.
  - `noul`: Probabilidad estimada de fraude.

### 2. Sistema 2: Razonamiento Deliberado (Google Gemini)
- **Objetivo**: Proporcionar auditoría forense, análisis de vectores de ataque y explicación en lenguaje natural.
- **Modelos soportados**: `gemini-3.1-flash-lite`, `gemini-3.8-flash`.
- **Resiliencia**: Incluye Circuit Breaker automático en caso de límites de cuota (HTTP 429).

---

## 🚀 Inicio Rápido

### Prerrequisitos
- Node.js 18+ instalado.
- Clave de API de Google Gemini (opcional si se utiliza la clave de entorno).

### Instalación

```bash
# 1. Clonar el repositorio
git clone <URL_DE_TU_REPOSITORIO>
cd <DIRECTORIO>

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno (opcional)
cp .env.example .env

# 4. Iniciar en modo desarrollo
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`.

---

## ⚙️ Variables de Entorno

Puedes configurar un archivo `.env`:

```env
GEMINI_API_KEY=tu_clave_de_gemini_aqui
```

*Nota: También puedes ingresar tus claves de Gemini y de la API de Jev directamente desde la interfaz web en el panel de **Configuración**.*

---

## 🛠️ Stack Tecnológico

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons, Canvas Confetti.
- **Backend / Proxy**: Express, tsx, esbuild, @google/genai SDK.
- **Herramientas de Build**: Vite.

---

## 📄 Licencia

MIT
