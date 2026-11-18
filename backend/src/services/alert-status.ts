import { AlertStatus, Prisma } from "@prisma/client";

export const PENDING_ALERTS: AlertStatus[] = ["NEW", "IN_REVIEW"];
export const ALERT_FILTERS = ["ALL", "PENDING", "NEW", "IN_REVIEW", "REVIEWED", "FOLLOW_UP_PENDING"] as const;
export type AlertFilter = typeof ALERT_FILTERS[number];

export function alertStatusFilter(status: AlertFilter): Prisma.AlertWhereInput {
  if (status === "ALL") return {};
  return { status: status === "PENDING" ? { in: PENDING_ALERTS } : status };
}

export const ALERT_STATUS_LABEL: Record<AlertStatus, string> = {
  NEW: "Pendiente de revisión",
  IN_REVIEW: "En revisión",
  REVIEWED: "Revisión registrada",
  FOLLOW_UP_PENDING: "Seguimiento pendiente",
};
