# Eval del demo de interceptación de fraude

Mide si la **aplicación** decide bien, no si el modelo es bueno. Sesenta casos sintéticos con la decisión esperada fijada antes de correr nada, pasados por los dos sistemas del demo.

## Las seis piezas y dónde viven

| pieza | archivo |
|---|---|
| 00 Spec y rúbrica | `spec.md` |
| 01 Golden set | `golden_set.json` (60 casos versionados) |
| 02 Runner | `eval_demo.mjs` |
| 03 Grader | `grader.mjs` (código) y `judge.mjs` (juez LLM con la rúbrica) |
| 04 Metrics | `metrics.mjs` → `metrics.json` |
| 05 Gate | `gate.mjs` → baseline vs candidato |

## Flujo

```bash
node eval_demo.mjs --dump-set              # materializa golden_set.json (sin APIs)
node eval_demo.mjs --n 60                  # corre los 60 casos → results.csv
node grader.mjs                            # puntúa contra el set → scored.json
node judge.mjs --sample 30                 # juez LLM con la rúbrica → judged.json (opcional)
node metrics.mjs                           # agrega todo → metrics.json
cp metrics.json baseline.json              # primera corrida: queda como referencia
node gate.mjs --system jev                 # compara contra baseline; exit 1 si falla
```

Para correr contra el demo hace falta levantarlo en `127.0.0.1:3000` y tener las claves del `.env.example`. `--dump-set`, `grader`, `metrics` y `gate` no llaman a ningún modelo.

## Reglas del gate

| regla | umbral de arranque |
|---|---|
| acierto global | ≥ 85% |
| p95 de latencia | ≤ 800 ms |
| caída contra baseline | ≤ 2 puntos |
| acuerdo del juez (si corre) | ≥ 70% |
| kappa del juez (si corre) | ≥ 0,4 |

El juez LLM necesita `GEMINI_API_KEY` con cuota activa. Si no responde, el script no escribe nada y sale con error: no se inventa un resultado.

Son configurables: `node gate.mjs --min-accuracy 90 --max-p95 500 --max-drop 1`.

## Resultado de la corrida de referencia

| | Jev | Gemini |
|---|---|---|
| Acierto global | 91,7% (55/60) | 81,5% (44/54) |
| Casos claros | 100% | 100% |
| Zona gris | 15/20 | 7/17 |
| Latencia p50 / p95 | 260 / 329 ms | 2653 / 11078 ms |
| Tokens | — | 45.527 en total (~760 por caso) |

Dispersión de la probabilidad de fraude de Jev: 3,1 puntos en legítimos, 4,4 en fraudes y 15,1 en ambiguos.

**Juez LLM** (`judge.mjs`, muestra estratificada de 30: 10 por clase): 93,1% de acuerdo con las etiquetas (27/29 con respuesta) y kappa de Cohen 0,896. Un caso quedó sin respuesta por límite de cuota. Sus dos desacuerdos están en la zona gris: aprobó dos casos que la rúbrica manda a 2FA.

Gemini dejó 6 casos sin respuesta (contingencia del demo), por eso su base es 54 y no 60.

## Límites

- Datos sintéticos y etiquetas puestas por mí: mide acuerdo con mi criterio, no con el mundo.
- Compara dos sistemas bajo la misma vara y detecta regresiones. No prueba que funcione en producción.
- Con 60 casos la señal es direccional, no una significancia estadística.
