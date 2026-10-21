# H · Entrenamiento para perezosos

Nombre definitivo pendiente (en español; se cambia en `src/brand.ts`). Entrenamiento guiado por evidencia: evaluar → prescribir → guiar → registrar → comparar → ajustar.

## Uso

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # pruebas de la lógica de entrenamiento y nutrición
npm run build
```

Los datos se guardan localmente en el navegador (IndexedDB). Usa **Personas → Exportar respaldo** para copiarlos o moverlos a otro dispositivo.

## Fase 1 (actual)

- Fichas de personas con evaluación inicial y de seguridad (inspirada en PAR-Q+).
- Generación de mesociclos de 6–8 semanas según días, experiencia, equipamiento (incluido TRX), prioridades, recuperación y tiempo.
- Volumen por músculo con series directas (1) e indirectas (0.5).
- Sesión guiada: calentamiento, carga recomendada, registro por serie (peso, reps, RIR, dolor, técnica), sugerencia de la siguiente serie y cronómetro de descanso.
- Doble progresión y comparación por 1RM estimado ajustado por RIR.
- Sugerencia de calorías y macros según objetivo (aumento, mantenimiento, definición).
- Registro de peso y cintura con promedio semanal.
- Énfasis opcional en tren inferior (pierna y glúteo 3 veces por semana) y adaptaciones para embarazo, posparto y menopausia.
- Ajuste del día según energía, sueño, estrés o síntomas.
- Sección Progreso: gráficas, historial y récords.
- Cierre de mesociclo con análisis de progreso, señales de fatiga, descarga opcional y siguiente mesociclo ajustado.
- Biblioteca de evidencia.

## Estructura

- `src/domain/` — lógica pura y probada (generador, progresión, nutrición, seguridad, ejercicios, evidencia).
- `src/db/` — persistencia local (Dexie).
- `src/ui/` — interfaz React.
