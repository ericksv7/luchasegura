import type { Exercise } from "@prisma/client";

export function presentExercise(exercise: Exercise) {
  const {
    id, name, component, description, dosage, zone, mediaUrl, isBase, objective,
    level, equipment, instructions, mistakes, precautions, illustration,
  } = exercise;
  return {
    id, name, component, description, dosage, zone, mediaUrl, isBase, objective,
    level, equipment, instructions, mistakes, precautions, illustration,
  };
}
