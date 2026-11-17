import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const DAY = 86_400_000;

type Lim = "NONE" | "PARTIAL" | "FULL";

// Datos de DEMOSTRACIÓN (ficticios) para ver el panel del equipo con contenido
const DEMO: {
  email: string; name: string; week: number; done: number; category: string; years: number;
  reports: { zone: string; pain: number; limit: Lim; when: string; ago: number }[];
  history: { zone: string; type: string; ago: number; absent: number; recurrent: boolean }[];
}[] = [
  {
    email: "deportista.b@demo.local", name: "Deportista B", week: 4, done: 10, category: "74 kg", years: 6,
    reports: [
      { zone: "Zona lumbar", pain: 4, limit: "NONE", when: "Entrenando", ago: 9 },
      { zone: "Zona lumbar", pain: 7, limit: "PARTIAL", when: "Al agarrar o levantar", ago: 2 },
    ],
    history: [{ zone: "Hombro", type: "Luxación", ago: 400, absent: 30, recurrent: true }],
  },
  {
    email: "deportista.c@demo.local", name: "Deportista C", week: 3, done: 4, category: "57 kg", years: 2,
    reports: [{ zone: "Rodilla", pain: 2, limit: "NONE", when: "Entrenando", ago: 6 }],
    history: [],
  },
  {
    email: "deportista.d@demo.local", name: "Deportista D", week: 6, done: 17, category: "86 kg", years: 8,
    reports: [],
    history: [{ zone: "Tobillo o pie", type: "Esguince", ago: 300, absent: 14, recurrent: false }],
  },
  {
    email: "deportista.e@demo.local", name: "Deportista E", week: 2, done: 6, category: "61 kg", years: 3,
    reports: [{ zone: "Hombro", pain: 3, limit: "NONE", when: "Al competir", ago: 3 }],
    history: [],
  },
];

async function main() {
  const coach = await prisma.user.findUnique({ where: { email: "entrenador@demo.local" } });
  const program = await prisma.program.findFirst({
    where: { sessions: { some: {} } },
    include: { sessions: { orderBy: [{ week: "asc" }, { number: "asc" }] } },
  });
  if (!coach || !program) {
    console.log("Primero corre: npm run db:seed y npx tsx prisma/seed-program.ts");
    return;
  }

  const hash = await bcrypt.hash("Cambiar123!", 12);
  const now = Date.now();

  for (const d of DEMO) {
    if (await prisma.user.findUnique({ where: { email: d.email } })) continue;

    const created = new Date(now - ((d.week - 1) * 7 + 2) * DAY); // queda en la semana d.week
    const user = await prisma.user.create({
      data: {
        email: d.email,
        fullName: d.name,
        role: "ATHLETE",
        passwordHash: hash,
        athlete: { create: { coachId: coach.id, createdAt: created, category: d.category, style: "Libre", yearsExperience: d.years } },
      },
      include: { athlete: true },
    });
    const athleteId = user.athlete!.id;

    const toDo = program.sessions.filter((s) => s.week <= d.week).slice(0, d.done);
    await prisma.completedSession.createMany({
      data: toDo.map((s) => ({
        athleteId,
        sessionId: s.id,
        doneAt: new Date(created.getTime() + ((s.week - 1) * 7 + (s.number - 1) * 2 + 1) * DAY),
      })),
    });

    await prisma.injury.createMany({
      data: [
        ...d.history.map((h) => ({
          athleteId, isHistory: true, bodyZone: h.zone, injuryType: h.type,
          daysAbsent: h.absent, recurrent: h.recurrent, occurredAt: new Date(now - h.ago * DAY),
        })),
        ...d.reports.map((r) => ({
          athleteId, bodyZone: r.zone, intensity: r.pain, limitation: r.limit,
          whenOccurs: r.when, occurredAt: new Date(now - r.ago * DAY),
        })),
      ],
    });
  }

  // Alertas para los reportes que superan el umbral de ejemplo (5 de 10).
  // Las de hace más de 10 días quedan como revisadas, las recientes como nuevas.
  const pending = await prisma.injury.findMany({
    where: { isHistory: false, intensity: { gte: 5 }, alerts: { none: {} } },
  });
  for (const i of pending) {
    await prisma.alert.create({
      data: {
        injuryId: i.id,
        createdAt: i.occurredAt,
        status: now - i.occurredAt.getTime() > 10 * DAY ? "REVIEWED" : "NEW",
      },
    });
  }
  console.log("Datos de demostración del panel del equipo cargados");
}

main().finally(() => prisma.$disconnect());