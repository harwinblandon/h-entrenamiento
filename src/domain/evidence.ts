import type { Confidence } from './types'

export interface EvidenceSource {
  id: string
  citation: string
  type: 'Metaanálisis' | 'Revisión sistemática' | 'Revisión narrativa' | 'Ensayo controlado' | 'Ecuación validada' | 'Instrumento validado'
  topic: string
  finding: string
  appliesTo: string
  confidence: Confidence
  limitations: string
}

/** Fecha de la última revisión de esta biblioteca. */
export const EVIDENCE_REVIEWED = '2026-10-21'

export const EVIDENCE: EvidenceSource[] = [
  {
    id: 'schoenfeld2017volume',
    citation:
      'Schoenfeld BJ, Ogborn D, Krieger JW. Dose-response relationship between weekly resistance training volume and increases in muscle mass: a systematic review and meta-analysis. J Sports Sci. 2017;35(11):1073-1082.',
    type: 'Metaanálisis',
    topic: 'Volumen semanal',
    finding: 'Más series semanales por músculo se asocian con mayor hipertrofia, con rendimientos decrecientes.',
    appliesTo: 'Rangos iniciales de series por músculo y aumentos graduales de volumen.',
    confidence: 'moderada',
    limitations: 'Pocos estudios con volúmenes muy altos; la respuesta individual varía mucho.',
  },
  {
    id: 'schoenfeld2016frequency',
    citation:
      'Schoenfeld BJ, Ogborn D, Krieger JW. Effects of resistance training frequency on measures of muscle hypertrophy: a systematic review and meta-analysis. Sports Med. 2016;46(11):1689-1697.',
    type: 'Metaanálisis',
    topic: 'Frecuencia',
    finding: 'Entrenar cada músculo al menos dos veces por semana parece favorecer la hipertrofia frente a una vez.',
    appliesTo: 'Distribución de dos estímulos semanales por músculo.',
    confidence: 'moderada',
    limitations: 'Cuando el volumen se iguala, el efecto de la frecuencia parece pequeño; sirve sobre todo para repartir volumen.',
  },
  {
    id: 'schoenfeld2021loading',
    citation:
      'Schoenfeld BJ, Grgic J, Van Every DW, Plotkin DL. Loading recommendations for muscle strength, hypertrophy, and local endurance: a re-examination of the repetition continuum. Sports. 2021;9(2):32.',
    type: 'Revisión narrativa',
    topic: 'Rangos de repeticiones',
    finding: 'La hipertrofia es similar en un amplio rango de cargas (~6–30 repeticiones) si las series se acercan al fallo.',
    appliesTo: 'Rangos de 6–10, 8–12, 10–15 y 12–20 según el ejercicio.',
    confidence: 'moderada',
    limitations: 'Las cargas muy ligeras exigen más esfuerzo percibido y pueden ser menos prácticas.',
  },
  {
    id: 'refalo2023failure',
    citation:
      'Refalo MC, Helms ER, Trexler ET, Hamilton DL, Fyfe JJ. Influence of resistance training proximity-to-failure on skeletal muscle hypertrophy: a systematic review with meta-analysis. Sports Med. 2023;53(3):649-665.',
    type: 'Metaanálisis',
    topic: 'Proximidad al fallo',
    finding: 'Entrenar al fallo no muestra una ventaja clara frente a quedarse cerca del fallo cuando el volumen es similar.',
    appliesTo: 'RIR objetivo de 1–3 y fallo solo en ejercicios seguros.',
    confidence: 'moderada',
    limitations: 'La proximidad al fallo es difícil de medir con precisión en los estudios.',
  },
  {
    id: 'zourdos2016rir',
    citation:
      'Zourdos MC, Klemp A, Dolan C, et al. Novel resistance training-specific rating of perceived exertion scale measuring repetitions in reserve. J Strength Cond Res. 2016;30(1):267-275.',
    type: 'Ensayo controlado',
    topic: 'Escala RIR',
    finding: 'La escala de repeticiones en reserva es útil y más precisa en personas con experiencia.',
    appliesTo: 'Registro de RIR después de cada serie.',
    confidence: 'moderada',
    limitations: 'Muestra pequeña; los principiantes tienden a subestimar las repeticiones que les quedan.',
  },
  {
    id: 'halperin2022rir',
    citation:
      'Halperin I, Malleron T, Har-Nir I, et al. Accuracy in predicting repetitions to task failure in resistance exercise: a scoping review and exploratory meta-analysis. Sports Med. 2022;52(2):377-390.',
    type: 'Metaanálisis',
    topic: 'Precisión del RIR',
    finding: 'Las personas suelen subestimar cuántas repeticiones les quedan; la precisión mejora cerca del fallo.',
    appliesTo: 'Semana de calibración y ajustes de la sugerencia de carga.',
    confidence: 'moderada',
    limitations: 'Estudios heterogéneos; análisis exploratorio.',
  },
  {
    id: 'schoenfeld2016rest',
    citation:
      'Schoenfeld BJ, Pope ZK, Benik FM, et al. Longer interset rest periods enhance muscle strength and hypertrophy in resistance-trained men. J Strength Cond Res. 2016;30(7):1805-1812.',
    type: 'Ensayo controlado',
    topic: 'Descanso entre series',
    finding: 'Descansos de ~3 minutos produjeron más hipertrofia que 1 minuto en hombres entrenados.',
    appliesTo: 'Descansos de 2–3 min en compuestos.',
    confidence: 'baja',
    limitations: 'Un solo ensayo, muestra pequeña, solo hombres.',
  },
  {
    id: 'mcnulty2020cycle',
    citation:
      'McNulty KL, Elliott-Sale KJ, Dolan E, et al. The effects of menstrual cycle phase on exercise performance in eumenorrheic women: a systematic review and meta-analysis. Sports Med. 2020;50(10):1813-1827.',
    type: 'Metaanálisis',
    topic: 'Ciclo menstrual',
    finding: 'El efecto de la fase del ciclo sobre el rendimiento es trivial en promedio y muy variable entre personas.',
    appliesTo: 'No modificar el entrenamiento automáticamente por fase; usar síntomas y rendimiento.',
    confidence: 'baja',
    limitations: 'Calidad metodológica de los estudios incluidos mayormente baja.',
  },
  {
    id: 'mifflin1990',
    citation:
      'Mifflin MD, St Jeor ST, Hill LA, Scott BJ, Daugherty SA, Koh YO. A new predictive equation for resting energy expenditure in healthy individuals. Am J Clin Nutr. 1990;51(2):241-247.',
    type: 'Ecuación validada',
    topic: 'Metabolismo basal',
    finding: 'Ecuación para estimar el gasto energético en reposo a partir de peso, estatura, edad y sexo.',
    appliesTo: 'Estimación inicial de calorías cuando no se conoce el porcentaje de grasa.',
    confidence: 'moderada',
    limitations: 'Error individual de ±10 % o más; no considera la composición corporal.',
  },
  {
    id: 'ainsworth2011met',
    citation:
      'Ainsworth BE, Haskell WL, Herrmann SD, et al. 2011 Compendium of Physical Activities: a second update of codes and MET values. Med Sci Sports Exerc. 2011;43(8):1575-1581.',
    type: 'Instrumento validado',
    topic: 'Gasto del cardio',
    finding: 'Asigna a cada actividad un valor MET (múltiplo del gasto en reposo) para estimar su costo energético.',
    appliesTo: 'Calorías que suma el cardio según modalidad, días y minutos.',
    confidence: 'moderada',
    limitations: 'Valores promedio; el gasto real varía con la intensidad, la técnica y la eficiencia de cada persona.',
  },
  {
    id: 'morton2018protein',
    citation:
      'Morton RW, Murphy KT, McKellar SR, et al. A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength in healthy adults. Br J Sports Med. 2018;52(6):376-384.',
    type: 'Metaanálisis',
    topic: 'Proteína',
    finding: 'Los beneficios de la proteína sobre la masa muscular se estabilizan alrededor de 1.6 g/kg/día (IC hasta ~2.2).',
    appliesTo: 'Proteína de 1.6–2.2 g/kg en aumento y mantenimiento.',
    confidence: 'alta',
    limitations: 'Principalmente con suplementos; en déficit las necesidades pueden ser mayores.',
  },
  {
    id: 'helms2014contestprep',
    citation:
      'Helms ER, Aragon AA, Fitschen PJ. Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation. J Int Soc Sports Nutr. 2014;11:20.',
    type: 'Revisión narrativa',
    topic: 'Definición',
    finding: 'En déficit, ritmos de pérdida de ~0.5–1 % del peso por semana y proteína elevada ayudan a conservar masa muscular.',
    appliesTo: 'Déficit y proteína en la fase de definición.',
    confidence: 'moderada',
    limitations: 'Basada en población de culturismo natural; extrapolación a otras poblaciones.',
  },
  {
    id: 'iraki2019offseason',
    citation:
      'Iraki J, Fitschen P, Espinar S, Helms E. Nutrition recommendations for bodybuilders in the off-season: a narrative review. Sports. 2019;7(7):154.',
    type: 'Revisión narrativa',
    topic: 'Aumento',
    finding: 'Superávit moderado y ganancias de peso lentas (~0.25–0.5 %/semana) para limitar la ganancia de grasa.',
    appliesTo: 'Superávit y ritmos de ganancia según experiencia.',
    confidence: 'moderada',
    limitations: 'Pocos ensayos directos; las recomendaciones combinan evidencia y práctica.',
  },
  {
    id: 'warburton2011parq',
    citation:
      'Warburton DER, Jamnik VK, Bredin SSD, Gledhill N. The Physical Activity Readiness Questionnaire for Everyone (PAR-Q+) and electronic Physical Activity Readiness Medical Examination (ePARmed-X+). Health Fit J Can. 2011;4(2):3-23.',
    type: 'Instrumento validado',
    topic: 'Seguridad',
    finding: 'Cuestionario de preparación para la actividad física que identifica cuándo derivar a valoración profesional.',
    appliesTo: 'Evaluación de seguridad antes de generar el plan.',
    confidence: 'alta',
    limitations: 'La app usa preguntas inspiradas en él, no el instrumento completo.',
  },
]

export function getSource(id: string): EvidenceSource | undefined {
  return EVIDENCE.find((s) => s.id === id)
}
