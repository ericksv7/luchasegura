import type { StructuredAssessment } from '../core/team-athlete-api';

export const fmsRows = [
  { label: 'Sentadilla profunda', sides: ['Puntuación'], clearing: [] },
  { label: 'Paso de obstáculo', sides: ['Izquierda', 'Derecha'], clearing: [] },
  { label: 'Zancada en línea', sides: ['Izquierda', 'Derecha'], clearing: [] },
  { label: 'Movilidad de hombros', sides: ['Izquierda', 'Derecha'], clearing: ['Descarte de hombro izquierdo', 'Descarte de hombro derecho'] },
  { label: 'Elevación activa de pierna recta', sides: ['Izquierda', 'Derecha'], clearing: [] },
  { label: 'Estabilidad de tronco en flexión', sides: ['Puntuación'], clearing: ['Descarte en extensión vertebral'] },
  { label: 'Estabilidad rotatoria', sides: ['Izquierda', 'Derecha'], clearing: ['Descarte en flexión vertebral'] },
];

export const lessRows = [
  'Flexión de rodilla al contacto', 'Flexión de cadera al contacto', 'Flexión del tronco al contacto',
  'Flexión plantar al contacto', 'Valgo de rodilla al contacto', 'Inclinación lateral del tronco',
  'Apoyo ancho', 'Apoyo estrecho', 'Rotación interna del pie', 'Rotación externa del pie',
  'Simetría del contacto', 'Desplazamiento en flexión de rodilla', 'Desplazamiento en flexión de cadera',
  'Desplazamiento en flexión del tronco', 'Desplazamiento medial de rodilla',
  'Amplitud articular durante el aterrizaje', 'Impresión global',
];

export function blankFms(): Extract<StructuredAssessment, { version: 'FMS-COOK-2014' }> {
  return { version: 'FMS-COOK-2014', patterns: fmsRows.map(row => ({
    scores: row.sides.map(() => null), clearing: row.clearing.map(() => null),
  })) };
}
export function blankLess(): Extract<StructuredAssessment, { version: 'LESS-17-MEAN3' }> {
  return { version: 'LESS-17-MEAN3', trials: Array.from({ length: 3 }, () => lessRows.map(() => null)) };
}
