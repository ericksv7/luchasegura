import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DAY = 86_400_000;

// BORRADOR DE EJEMPLO: el contenido real lo define y valida el equipo de fisioterapia
const CATALOG: Record<string, [string, string, string][]> = {
  Movilidad: [
    ["Movilidad de cadera en cuadrupedia", "2 × 10 por lado", "Círculos amplios de cadera apoyado en manos y rodillas."],
    ["Rotaciones torácicas", "2 × 8 por lado", "Rotación de la espalda alta apoyado en cuadrupedia."],
    ["Círculos de hombro con banda", "2 × 12", "Movimiento controlado en ambos sentidos."],
  ],
  Estabilidad: [
    ["Plancha frontal", "3 × 30 s", "Cuerpo alineado, abdomen firme."],
    ["Plancha lateral", "3 × 20 s por lado", "Cadera elevada, hombro sobre el codo."],
    ["Puente de glúteo", "3 × 12", "Eleva la cadera y mantén un segundo arriba."],
  ],
  Fuerza: [
    ["Curl nórdico asistido", "3 × 6", "Descenso lento con apoyo de las manos."],
    ["Zancadas caminando", "3 × 10 por pierna", "Paso largo y tronco erguido."],
    ["Sentadilla goblet", "3 × 10", "Sostén una carga al pecho y baja con control."],
    ["Remo con banda", "3 × 12", "Lleva los codos atrás sin encoger los hombros."],
  ],
  Técnica: [
    ["Desplazamientos laterales en postura de lucha", "3 × 30 s", "Mantén la postura baja y los pies activos."],
    ["Entradas a piernas sin oponente", "3 × 8", "Trabajo técnico a ritmo controlado."],
    ["Caídas controladas", "3 × 6", "Practica la recepción con el cuerpo protegido."],
  ],
};

async function main() {
  let program = await prisma.program.findFirst();
  if (!program) {
    program = await prisma.program.create({
      data: { name: "Programa preventivo (borrador)", weeks: 8, sessionsPerWeek: 3 },
    });
  }

  const count = await prisma.programSession.count({ where: { programId: program.id } });
  if (count === 0) {
    const byComponent: Record<string, { id: string }[]> = {};
    for (const [component, items] of Object.entries(CATALOG)) {
      byComponent[component] = [];
      for (const [name, dosage, description] of items) {
        const ex = await prisma.exercise.create({ data: { component, name, dosage, description } });
        byComponent[component].push(ex);
      }
    }
    for (let week = 1; week <= program.weeks; week++) {
      for (let number = 1; number <= program.sessionsPerWeek; number++) {
        const picks = Object.values(byComponent).map((list) => list[(week + number) % list.length]);
        await prisma.programSession.create({
          data: {
            programId: program.id,
            week,
            number,
            minutes: 28,
            exercises: { create: picks.map((ex, position) => ({ exerciseId: ex.id, position })) },
          },
        });
      }
    }
    console.log("Programa de ejemplo creado");
  }

  // Datos de DEMOSTRACIÓN solo para la cuenta de prueba
  const demo = await prisma.athlete.findFirst({ where: { user: { email: "deportista@demo.local" } } });
  if (demo && (await prisma.injury.count({ where: { athleteId: demo.id } })) === 0) {
    const now = Date.now();
    const start = now - 24 * DAY; // semana 4 del programa
    await prisma.athlete.update({
      where: { id: demo.id },
      data: { createdAt: new Date(start), birthDate: new Date("2008-05-14"), weightKg: 65 },
    });

    const ago = (days: number) => new Date(now - days * DAY);
    await prisma.injury.createMany({
      data: [
        { athleteId: demo.id, isHistory: true, bodyZone: "Rodilla", injuryType: "Esguince", daysAbsent: 21, recurrent: true, occurredAt: ago(240) },
        { athleteId: demo.id, isHistory: true, bodyZone: "Hombro", injuryType: "Sobrecarga", daysAbsent: 7, occurredAt: ago(730) },
        { athleteId: demo.id, bodyZone: "Zona lumbar", intensity: 6, whenOccurs: "Al agarrar o levantar", limitation: "PARTIAL", occurredAt: ago(22) },
        { athleteId: demo.id, bodyZone: "Zona lumbar", intensity: 5, whenOccurs: "Al agarrar o levantar", limitation: "PARTIAL", occurredAt: ago(15) },
        { athleteId: demo.id, bodyZone: "Rodilla", intensity: 2, whenOccurs: "Entrenando", limitation: "NONE", occurredAt: ago(10) },
        { athleteId: demo.id, bodyZone: "Zona lumbar", intensity: 4, whenOccurs: "Entrenando", limitation: "NONE", occurredAt: ago(8) },
        { athleteId: demo.id, bodyZone: "Zona lumbar", intensity: 3, whenOccurs: "En reposo", limitation: "NONE", occurredAt: ago(2) },
      ],
    });

    const sessions = await prisma.programSession.findMany({
      where: { programId: program.id },
      orderBy: [{ week: "asc" }, { number: "asc" }],
    });
    const skip = new Set([2, 6]);
    const done = sessions.filter(
      (s, i) => (s.week <= 3 && !skip.has(i)) || (s.week === 4 && s.number === 1)
    );
    await prisma.completedSession.createMany({
      data: done.map((s) => ({
        athleteId: demo.id,
        sessionId: s.id,
        doneAt: new Date(start + ((s.week - 1) * 7 + (s.number - 1) * 2 + 1) * DAY),
      })),
    });
    console.log("Datos de demostración cargados para deportista@demo.local");
  }
}

main().finally(() => prisma.$disconnect());