import type { Prisma } from "@prisma/client";

export function documentedWellbeingScope(authorId: string): Prisma.AthleteWhereInput {
  return { OR: [
    { injuries: { some: { alerts: { some: { entries: { some: { kind: "REVIEW", authorId } } } } } } },
    { tests: { some: { revisions: { some: { authorId } } } } },
  ] };
}
