export function presentHistoryDate<T extends { historyDate: Date | null }>(record: T) {
  return { ...record, historyDate: record.historyDate?.toISOString().slice(0, 10) ?? null };
}
