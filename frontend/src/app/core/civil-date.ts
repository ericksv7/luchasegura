const bogotaFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
});
const civilFormatter = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric',
});

export function bogotaDay(now = new Date()): string {
  return bogotaFormatter.format(now);
}

export function formatHistoryDay(day?: string | null): string {
  return day ? civilFormatter.format(new Date(day)) : 'Fecha sin registrar';
}
