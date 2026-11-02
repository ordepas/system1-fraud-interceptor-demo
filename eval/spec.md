# Spec y rúbrica

La app recibe una transacción con su contexto y debe devolver **una** de tres decisiones. No hay decisión "correcta" en abstracto: la etiqueta se fija antes de correr nada, y el eval mide acuerdo con esa etiqueta.

## Las tres decisiones

| salida | cuándo | costo del error |
|---|---|---|
| `APROBAR_DIRECTO` | la operación encaja con el patrón del titular y no hay señales que exijan fricción | un fraude aprobado se pierde |
| `SOLICITAR_2FA` | hay señales de riesgo real pero la evidencia no alcanza para bloquear | fricción innecesaria para un cliente legítimo |
| `BLOQUEO_PREVENTIVO` | el patrón es concluyente: dispositivo desconocido, geopatrón imposible, ráfaga o comercio de riesgo | cliente legítimo bloqueado y disputa |

## Rúbrica de clasificación (para el juez)

El juez recibe la transacción, aplica esta regla en orden y devuelve la primera que se cumple:

1. **Bloquear** si hay dos o más señales altas juntas: dispositivo nuevo, CVV fallidos, geopatrón imposible, ráfaga anómala, comercio de riesgo.
2. **2FA** si hay una señal alta o dos medias y ninguna conclusiva.
3. **Aprobar** si hay cero señales, o si la anomalía está explicada por el contexto (viaje declarado, compra planificada, dispositivo registrado).

El juez nunca cambia la etiqueta del golden set: la rúbrica sirve para evaluar el razonamiento, no para reescribir la vara.

## Criterio de mejora (el umbral del gate)

Un cambio es aceptable si:

- el acierto global no baja más de 2 puntos contra el baseline,
- el p95 de latencia no supera 800 ms en el sistema rápido,
- y el acierto por clase no se derrumba en la zona gris, que es donde vive la diferencia.

Estos valores son de arranque, no una verdad. Se escriben antes de correr y se ajustan cuando el set crezca.
