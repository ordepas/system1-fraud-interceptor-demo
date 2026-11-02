# Eval del demo de interceptación de fraude

Mide si la **aplicación** decide bien, no si el modelo es bueno. Son 60 casos sintéticos con la decisión esperada fijada antes de correr nada, pasados por los dos sistemas del demo.

## Las seis piezas

1. **Spec y rúbrica** — qué debe hacer la app y con qué criterio se juzga.
2. **Golden set** — 60 casos versionados: 20 legítimos, 20 fraudes, 20 ambiguos.
3. **Runner** — corre cada caso, guarda salida, traza y latencia.
4. **Graders** — comparación por código contra la etiqueta; el juez LLM no participa de esta evaluación.
5. **Metrics** — acierto por clase, latencia p50/p95, tokens y dispersión.
6. **Gate** — candidato contra baseline sobre la misma versión del dataset, con umbral por métrica.

## Cómo correrlo

Con el demo levantado en `http://127.0.0.1:3000`:

```bash
cd eval
GEMINI_EVAL_KEY=... JEV_API_KEY=... node eval_demo.mjs --n 60
```

Escribe `results.csv` y un resumen en consola. Sin `--url` apunta a `127.0.0.1:3000`.

## Resultado (2026-10-31)

| | Jev | Gemini |
|---|---|---|
| Acierto global | 91,7% (55/60) | 81,5% (44/54) |
| Casos claros | 100% | 100% |
| Zona gris | 15/20 | 7/17 |
| Latencia mediana | 260 ms | 2,7 s |
| Tokens por caso | — | 760 |

Toda la diferencia salió de los 20 casos ambiguos. Gemini dejó 6 casos sin respuesta (contingencia del demo), por eso su base es 54.

## Límites

- Datos sintéticos y etiquetas puestas por mí: mide acuerdo con mi criterio, no con el mundo.
- Compara dos sistemas bajo la misma vara y detecta regresiones. No prueba que funcione en producción.
- Con 60 casos la señal es direccional, no una significancia estadística.
