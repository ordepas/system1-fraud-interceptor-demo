# Eval del demo de interceptación de fraude

Mide si la **aplicación** decide bien, no si el modelo es bueno.

Corrida de referencia: **2026-11-02**, posterior a la corrección de fugas (el id del caso y `isAnomaly` ya no viajan en el prompt).

## Las seis piezas y dónde viven

| pieza | archivo |
|---|---|
| 00 Spec y rúbrica | `spec.md` |
| 01 Golden set | `golden_set.json` — **el runner lo lee**; es la fuente de verdad |
| 02 Runner | `eval_demo.mjs` |
| 03 Graders | `grader.mjs` (código) y `judge.mjs` (juez LLM que gradúa la decisión) |
| 04 Metrics | `metrics.mjs` → `metrics.json` |
| 05 Gate | `gate.mjs` → baseline congelado vs candidato |
| ciclo | `promote.mjs` → fallo adjudicado al golden set |

## Flujo

```bash
node eval_demo.mjs --dump-set              # materializa golden_set.json v1 (sin APIs)
node eval_demo.mjs                         # ejecuta el SET (no lo regenera) → results.csv
node grader.mjs                            # puntúa contra el set → scored.json
node judge.mjs --system jev --sample 30    # juez LLM que gradúa la decisión → judged.json
node metrics.mjs                           # agrega → metrics.json
cp metrics.json baseline.json              # PRIMERA corrida: queda congelada como referencia
node gate.mjs --system jev                 # exit 1 si falla alguna regla
```

`--dump-set` se niega a pisar un set existente sin `--force`, y al regenerar conserva los casos con `source: "produccion"`. `--regenerate` ignora el set y usa el generador, solo para depurar.

## Reglas del gate

Falla cerrado: sin datos no pasa.

| regla | umbral |
|---|---|
| versión del dataset | candidato y baseline deben coincidir |
| corrida independiente | no puede ser el mismo `generated_at` |
| cobertura completa | deben estar todos los casos del set |
| acierto global | ≥ 85% |
| p95 de latencia | ≤ 800 ms (sin datos, falla) |
| caída contra baseline | ≤ 2 puntos |
| caída en la zona gris | ≤ 2 puntos |
| acuerdo del juez (si corrió) | ≥ 70% |
| kappa del juez (si corrió) | ≥ 0,4 |

## Cerrar el ciclo

```bash
# fallo nuevo de producción, con su transacción observada
node promote.mjs --from-json caso.json

# re-adjudicación de un caso existente (crea id-vN y marca el original como superseded)
node promote.mjs --id EVAL-gray-004 --decision SOLICITAR_2FA --note "revisado 2026-11-02"
```

El caso promovido se ejecuta en la siguiente corrida porque el runner lee el set. El grader omite los casos marcados como `superseded_by`. Toda promoción sube la versión y obliga a regenerar el baseline.

## Resultado de la corrida de referencia (2026-11-02)

| | Jev | Gemini |
|---|---|---|
| Acierto global | 91,7% (55/60) | 58,3% (35/60) |
| Legítimos | 100% | 75% |
| Fraudes | 100% | 100% |
| Ambiguos | 75% | 0% |
| Latencia p50 / p95 | 233 / 292 ms | 4214 / 52873 ms |
| Contingencias | — | 0 |

Juez sobre 30 casos estratificados: 93,3% de acuerdo con la etiqueta y kappa de Cohen 0,793.

Dispersión de la probabilidad de fraude de Jev: 2,8 puntos en legítimos, 4,4 en fraudes y 15 en ambiguos.

La corrida anterior, con el id del caso y `isAnomaly` dentro del prompt, daba 81,5% a Gemini. Esa diferencia era la fuga, no el modelo.

## Límites conocidos

- **12 plantillas, no 60 casos.** Cada clase tiene 4 contextos repetidos 5 veces con distinto titular. Los porcentajes por clase valen sobre 4 escenarios, no sobre 20 muestras independientes.
- **El dataset tiene correlaciones perfectas.** Todos los fraudes llevan `isAnomaly: true` y ubicación "RU"; el resto, lo contrario. El id y `isAnomaly` ya no se envían al modelo, pero **la ubicación sí**, y sola separa fraude de no fraude. El 100% en fraudes mide ese atajo, no detección. Diversificar la geografía es la primera tarea del set v2.
- **El juez no ve el razonamiento.** Gradúa la decisión contra la rúbrica. Para graduar el razonamiento habría que persistir el texto del informe.
- **No hay calibración humana independiente.** Las etiquetas del set son la referencia; no existe un holdout etiquetado por otra persona.
- Datos sintéticos y etiquetas puestas por mí: mide acuerdo con mi criterio, no con el mundo.

## Estabilidad (5 repeticiones por caso)

`results_stability.csv` y `metrics_stability.json`: 12 escenarios (4 por clase) corridos cinco veces cada uno con el mismo input.

| | Jev | Gemini |
|---|---|---|
| Casos cuya decisión cambia | **0 de 12** | **3 de 12** |
| Acierto | 91,7% | 56,1% (32/57) |

Jev decide igual las cinco veces. Gemini cambia en uno de cada cuatro escenarios: su porcentaje es un promedio de decisiones que oscilan, no una decisión estable.

Degradación: 49 llamadas respondieron a la primera, 6 necesitaron reintento y 5 nunca devolvieron respuesta del modelo (`gem_intentos` en el CSV).
