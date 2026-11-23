import { PreventiveSurveyKind } from "@prisma/client";

type Option = readonly [string, string];
type Question = {
  id: string;
  label: string;
  group: string;
  options?: readonly Option[];
  type: "choice" | "count" | "text";
  required?: boolean;
  when?: string;
};

const yesNo = [["yes", "Sí"], ["no", "No"], ["unknown", "No estoy seguro"]] as const;
const frequency = [
  ["always", "En todos los entrenamientos"], ["often", "En más de la mitad"],
  ["sometimes", "En la mitad o menos, al menos una vez"], ["never", "En ninguno"],
  ["na", "No entrené / no aplica"],
] as const;
const practices = [
  ["warmup", "¿Hiciste calentamiento antes de entrenar?"],
  ["mobility", "¿Hiciste ejercicios de movilidad?"],
  ["strength", "¿Hiciste ejercicios de fortalecimiento?"],
  ["balance", "¿Hiciste ejercicios de equilibrio?"],
  ["recovery", "¿Realizaste actividades de recuperación al terminar?"],
  ["communication", "¿Avisaste cuando sentiste molestias?"],
] as const;
const coachPractices = [
  ["warmup", "¿Incluiste calentamiento antes del entrenamiento?"],
  ["mobility", "¿Incluiste ejercicios de movilidad?"],
  ["strength", "¿Incluiste ejercicios de fortalecimiento?"],
  ["communication", "¿Recordaste al grupo cómo comunicar molestias?"],
  ["followup", "¿Revisaste con el grupo las prácticas preventivas?"],
] as const;
const zones = ["Cuello", "Hombro", "Codo", "Muñeca o mano", "Zona dorsal", "Zona lumbar", "Cadera", "Rodilla", "Tobillo o pie", "Otra"];
const injuries: Question[] = [
  { id: "injury", label: "¿Tuviste alguna lesión relacionada con la lucha olímpica en este periodo?", group: "Lesiones", options: yesNo, type: "choice", required: true },
  { id: "episodes", label: "¿Cuántas lesiones recuerdas aproximadamente?", group: "Lesiones", type: "count", when: "injury" },
  { id: "zone", label: "Para la lesión más reciente, ¿qué zona estuvo afectada?", group: "Lesiones", options: zones.map(zone => [zone, zone]), type: "choice", when: "injury" },
  { id: "injuryType", label: "¿Qué tipo de lesión fue, si lo conoces?", group: "Lesiones", type: "text", when: "injury" },
  { id: "recurrence", label: "¿Ya habías tenido una lesión similar en esa zona?", group: "Lesiones", options: yesNo, type: "choice", when: "injury" },
  { id: "context", label: "¿En qué contexto ocurrió?", group: "Contexto de aparición", options: [["training", "Entrenamiento"], ["competition", "Competencia"], ["other", "Otra actividad"], ["unknown", "No recuerdo"]], type: "choice", when: "injury" },
  { id: "mechanism", label: "¿Cómo ocurrió? Describe el movimiento o situación sin identificar a otras personas.", group: "Contexto de aparición", type: "text", when: "injury" },
  { id: "care", label: "¿Recibiste atención de un profesional de salud?", group: "Consecuencias de la lesión", options: yesNo, type: "choice", when: "injury" },
  { id: "limitation", label: "¿Te limitó para realizar movimientos o actividades?", group: "Consecuencias de la lesión", options: yesNo, type: "choice", when: "injury" },
  { id: "absence", label: "¿Tuviste que interrumpir el entrenamiento?", group: "Consecuencias de la lesión", options: yesNo, type: "choice", when: "injury" },
  { id: "days", label: "¿Cuántos días dejaste de entrenar en este periodo?", group: "Consecuencias de la lesión", type: "count", when: "absence" },
];

export const proposalVersion = "preventiva-v1-borrador";
export const surveyNotice = {
  version: "encuestas-demo-v1",
  text: "Acepto participar con datos ficticios en esta demostración. Fisioterapia con atención documentada puede consultar mis envíos. Puedo retirar esta autorización desde Encuestas preventivas.",
};
export type Catalogue = ReturnType<typeof catalogueFor>;

export function catalogueFor(kind: PreventiveSurveyKind) {
  const coach = kind === "COACH";
  const questions: Question[] = coach ? [
    ...coachPractices.map(([id, label]): Question => ({
      id, label, group: "Prácticas del equipo", type: "choice", options: frequency, required: id === "warmup",
    })),
    { id: "observations", label: "Observaciones generales, sin nombres, antecedentes ni diagnósticos.", group: "Observaciones", type: "text" },
  ] : [
    ...(kind === "INITIAL" ? [{ id: "history", label: "Antes de este periodo, ¿habías tenido alguna lesión asociada a la lucha olímpica?", group: "Antecedentes históricos", options: yesNo, type: "choice" as const }] : []),
    ...injuries,
    ...practices.map(([id, label]): Question => ({
      id, label, group: "Prácticas preventivas", type: "choice",
      options: id === "communication" ? [...frequency.slice(0, -1), ["na", "No sentí molestias / no aplica"]] : frequency,
    })),
    { id: "knowledge", label: "¿Sabes qué medidas puedes realizar para prevenir lesiones al entrenar?", group: "Prácticas preventivas", type: "choice", options: yesNo },
  ];
  return { version: proposalVersion, questions };
}

export function shiftDay(day: string, days: number) {
  return new Date(Date.parse(day) + days * 86_400_000).toISOString().slice(0, 10);
}

export function windowFor(kind: PreventiveSurveyKind, start: string, today: string) {
  if (kind === "INITIAL") return today >= shiftDay(start, -7) && today < start;
  if (kind === "FINAL") return today >= shiftDay(start, 56);
  return true;
}

export function validateAnswers(catalogue: Catalogue, input: Record<string, unknown>, submit: boolean) {
  const answers: Record<string, string | number> = {};
  const invalid = Object.keys(input).filter(key => !catalogue.questions.some(question => question.id === key));
  for (const question of catalogue.questions) {
    if (question.when && answers[question.when] !== "yes") continue;
    const value = input[question.id];
    if (value === undefined || value === null || value === "") {
      if (submit && question.required) invalid.push(question.id);
      continue;
    }
    if (question.type === "choice" && typeof value === "string" && question.options?.some(([id]) => id === value)) answers[question.id] = value;
    else if (question.type === "count" && typeof value === "number" && Number.isInteger(value) && value >= (question.id === "episodes" ? 1 : 0) && value <= (question.id === "days" ? 56 : 100)) answers[question.id] = value;
    else if (question.type === "text" && typeof value === "string" && value.trim().length > 0 && value.trim().length <= 240) answers[question.id] = value.trim();
    else invalid.push(question.id);
  }
  return { answers, invalid };
}
