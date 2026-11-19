import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export const COMPONENTS = ['Fuerza', 'Core', 'Movilidad'] as const;
export const exerciseCategoryLabel = (component: string) =>
  component === 'Pliometría' ? 'Saltos y aterrizajes' : component;

export const LEVELS = ['Inicial', 'Intermedio', 'Avanzado'] as const;
export const ILLUSTRATIONS = [
  ['plancha', 'Plancha frontal'],
  ['lateral', 'Plancha lateral'],
  ['zancada', 'Zancadas caminando'],
  ['sentadilla', 'Sentadilla goblet'],
  ['remo', 'Remo con banda'],
  ['press-pecho', 'Press de pecho con mancuernas'],
  ['peso-rumano', 'Peso muerto rumano con mancuernas'],
  ['talones', 'Elevación de talones de pie'],
  ['escalon', 'Subida a escalón'],
  ['apertura-banda', 'Apertura horizontal con banda'],
  ['curl-banda', 'Curl de bíceps con banda'],
  ['press-banda', 'Press de hombros con banda'],
  ['rotacion-banda', 'Rotación externa con banda'],
  ['sentadilla-libre', 'Sentadilla con peso corporal'],
  ['prensa', 'Prensa de piernas'],
  ['extension-rodilla', 'Extensión de cuádriceps en máquina'],
  ['curl-femoral', 'Curl femoral sentado en máquina'],
  ['flexiones', 'Flexiones de brazos'],
  ['banca-barra', 'Press de banca con barra'],
  ['remo-mancuerna', 'Remo con mancuerna a un brazo'],
  ['remo-polea', 'Remo sentado en polea'],
  ['jalon', 'Jalón al pecho'],
  ['press-militar', 'Press militar con mancuernas'],
  ['elevacion-lateral', 'Elevaciones laterales con mancuernas'],
  ['curl-mancuerna', 'Curl de bíceps con mancuernas'],
  ['triceps-polea', 'Extensión de tríceps en polea'],
  ['abdominal-corto', 'Abdominal corto'],
  ['dead-bug', 'Dead bug alternado'],
  ['tobillo-pared', 'Movilidad de tobillo frente a pared'],
].map(([key, label]) => ({ path: `/exercises/${key}.svg`, label }));

export interface ExerciseDetails {
  name: string;
  component: string;
  description: string | null;
  dosage: string | null;
  zone?: string | null;
  mediaUrl: string | null;
  objective?: string | null;
  level?: string | null;
  equipment?: string | null;
  instructions?: string | null;
  mistakes?: string | null;
  precautions?: string | null;
  illustration?: string | null;
}

export interface Exercise extends ExerciseDetails {
  id: string;
  isBase?: boolean;
  assigned?: number;
  inProgram?: boolean;
}
export interface Assignment {
  id: string;
  dosage: string | null;
  note: string | null;
  createdAt: string;
  assignedBy: string | null;
  exercise: Exercise;
}
export type ExerciseInput = Omit<ExerciseDetails, 'mediaUrl'>;

export const normalizeExerciseSearch = (value: string) =>
  value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function matchesExerciseSearch(exercise: ExerciseDetails, normalizedQuery: string) {
  return [exercise.name, exercise.equipment ?? ''].some(
    value => normalizeExerciseSearch(value).includes(normalizedQuery)
  );
}

export function exerciseGroups<T>(items: T[], componentOf: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const category = componentOf(item);
    const group = groups.get(category);
    if (group) group.push(item);
    else groups.set(category, [item]);
  }
  return [...new Set([...COMPONENTS, ...groups.keys()])]
    .flatMap(c => groups.has(c) ? [{ c, items: groups.get(c)! }] : []);
}

@Injectable({ providedIn: 'root' })
export class ExerciseApi {
  private http = inject(HttpClient);

  list() { return this.http.get<Exercise[]>('/api/exercises'); }
  create(b: ExerciseInput) { return this.http.post<Exercise>('/api/exercises', b); }
  update(id: string, b: ExerciseInput) { return this.http.patch<Exercise>(`/api/exercises/${id}`, b); }
  remove(id: string) { return this.http.delete<{ archived: boolean }>(`/api/exercises/${id}`); }
  assign(b: { athleteId: string; exerciseId: string; dosage: string | null; note: string | null }) {
    return this.http.post<Assignment>('/api/exercises/assignments', b);
  }
  unassign(id: string) { return this.http.delete(`/api/exercises/assignments/${id}`); }
  forAthlete(athleteId: string) { return this.http.get<Assignment[]>(`/api/exercises/athlete/${athleteId}`); }
  mine() { return this.http.get<Assignment[]>('/api/exercises/mine'); }
}