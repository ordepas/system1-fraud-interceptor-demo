# System 1 Fraud Interceptor (demo)

Demo de un **interceptor de fraude simulado** que compara, en paralelo y sobre **transacciones sintéticas**, dos formas de decidir:

- **Sistema 1: Jev (TypeSafe AI).** Modelo rápido que responde con valores tipados (una opción, una probabilidad), sin generar texto.
- **Sistema 2: Gemini 3.1 Flash Lite.** LLM que razona, decide y redacta un informe.

La idea viene de Kahneman (*Pensar rápido, pensar despacio*): un modelo rápido para la decisión inmediata y uno deliberativo que la audita cuando hace falta.

> **Es una demo de experimentación personal, no un benchmark.** Los resultados dependen de la carga del momento, del modelo y de los prompts usados.

## Arquitectura

```
                Transacción sintética
                         │
          ┌──────────────┴──────────────┐
          ▼                             ▼
  Sistema 1: Jev (TypeSafe)     Sistema 2: Gemini
  - Decisión tipada             - Decisión + informe
  - Confianza y prob. de fraude - Razonamiento en texto
  - Sin texto generado          - Más lento, más costoso
          └──────────────┬──────────────┘
                         ▼
        Comparación: decisión, latencia, tokens
                 + registro de auditoría
```

**Jev** recibe la transacción y responde con:
- `decision`: `APROBAR_DIRECTO`, `SOLICITAR_2FA` o `BLOQUEO_PREVENTIVO`, con su confianza y la probabilidad de cada opción.
- `is_fraud` (tipo `noul`): probabilidad de fraude entre 0 y 1.

**Gemini** entrega su decisión, un informe en lenguaje natural y el uso de tokens. Si se alcanza el límite de cuota (HTTP 429), un circuit breaker activa un modo de contingencia **simulado**, indicado con la etiqueta "MODO SIMULADO" y excluido de las comparaciones.

## Datos

Todos los datos son **sintéticos**. Los nombres, comercios y montos son inventados y no corresponden a personas ni transacciones reales.

## Aviso sobre Jev

Jev es un modelo de **acceso anticipado** de [TypeSafe AI](https://typesafe.ai). Necesitas tu propia clave de API, que puedes solicitar allí. Las cifras de velocidad y costo de TypeSafe son del proveedor y provienen de sus propias pruebas. Consulta su [documentación](https://docs.typesafe.ai/introduction/quickstart).

## Cómo ejecutarlo

Requisitos: Node.js 20 o superior.

```bash
git clone https://github.com/ordepas/system1-fraud-interceptor-demo.git
cd system1-fraud-interceptor-demo
npm install
cp .env.example .env    # completa tus propias claves
npm run dev
```

La aplicación queda disponible en `http://localhost:3000`.

### Variables de entorno

| Variable | Descripción |
|---|---|
| `GEMINI_API_KEY` | Clave de Google AI Studio para Gemini |
| `JEV_API_URL` | Endpoint de TypeSafe: `https://api.typesafe.ai/v1/systemone` |
| `JEV_API_KEY` | Tu clave de API de TypeSafe |

También puedes ingresar las claves desde el panel de **Configuración** de la app; en ese caso se guardan en el `localStorage` de tu navegador.

**Nunca subas tus claves al repositorio.** `.env` está en `.gitignore`.

## Advertencias de uso

- **Solo para ejecución local o entornos de prueba.** El backend acepta la URL y la clave de Jev desde el navegador y no tiene límite de tasa. **No lo expongas públicamente con tus claves del servidor**: cualquier visitante podría generar consumo con tu cuenta.
- Cada evaluación consume tokens en ambos modelos. Usa claves con límites de gasto.
- Es una simulación: no está pensada para producción ni para decisiones reales de fraude.

## Limitaciones conocidas

- Los tiempos de Gemini varían mucho entre llamadas (de unos segundos a más de 30 s), por lo que la relación de velocidad frente a Jev también varía.
- El subtítulo de la cabecera es texto fijo.

## Stack

React 19, TypeScript, Tailwind CSS 4, Vite, Express, tsx, `@google/genai`.

## Licencia

MIT. Ver [LICENSE](LICENSE).

---

## English summary

A simulated fraud-interceptor demo that runs a System 1 model (Jev by TypeSafe AI, early access) and an LLM (Gemini 3.1 Flash Lite) in parallel on **synthetic transactions**, comparing latency, token usage and decisions. Personal experiment, **not a benchmark**. Run it locally with your own API keys (see `.env.example`); do not expose it publicly with server-side keys.
