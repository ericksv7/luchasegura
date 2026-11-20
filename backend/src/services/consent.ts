import { createHash } from "node:crypto";
import { calendarDay } from "./program";

type RegistrationNotice = {
  version: string;
  status: "draft" | "approved";
  paragraphs: string[];
};

// Cualquier cambio del texto o su estado exige una versión nueva.
const notice: RegistrationNotice = {
  version: "v0.2-borrador",
  status: "draft",
  paragraphs: [
    "Esta demostración de LuchaSegura se usa con datos ficticios para evaluar el registro de molestias y el seguimiento del programa preventivo.",
    "La aplicación maneja datos de perfil, antecedentes, molestias y cumplimiento del programa. Los registros de salud requieren protección especial.",
    "El deportista consulta sus registros. El entrenador accede a un subconjunto de información de los deportistas asignados. Fisioterapia consulta los registros necesarios para el seguimiento. El administrador gestiona cuentas y asignaciones.",
    "LuchaSegura apoya el registro y el seguimiento. La valoración y las decisiones clínicas corresponden a fisioterapia.",
    "La entidad responsable, el canal para ejercer derechos, la conservación de datos y el procedimiento de autorización para menores están pendientes de aprobación institucional.",
  ],
};

const snapshot = [notice.version, notice.status, notice.paragraphs];
const textDigest = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");

export function registrationNotice(production: boolean) {
  return { ...notice, available: !production || notice.status === "approved" };
}

export function consentEvidence(minor: boolean) {
  return {
    textVersion: notice.version,
    textSnapshot: snapshot,
    textDigest,
    acceptanceMode: minor ? "SELF_DECLARED_WITH_GUARDIAN" : "SELF_DECLARED",
  };
}

export function isMinorOn(birth: Date, now = new Date()) {
  const today = calendarDay(now);
  const day = birth.toISOString().slice(0, 10);
  const age = Number(today.slice(0, 4)) - Number(day.slice(0, 4)) - Number(today.slice(5) < day.slice(5));
  return age < 18;
}
