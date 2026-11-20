import { ageOf } from './age';
import { bogotaDay, formatHistoryDay } from './civil-date';
import { ago } from './team-store';

describe('Fechas civiles de Bogotá', () => {
  it('mantiene el día de Bogotá en los cambios de mes y año UTC', () => {
    expect(bogotaDay(new Date('2027-01-01T04:59:59Z'))).toBe('2026-12-31');
    expect(bogotaDay(new Date('2027-01-01T05:00:00Z'))).toBe('2027-01-01');
    expect(bogotaDay(new Date('2026-02-01T12:00:00+09:00'))).toBe('2026-01-31');
  });

  it('calcula la mayoría de edad con el día civil de Bogotá', () => {
    expect(ageOf('2009-01-01', new Date('2027-01-01T04:59:59Z'))).toBe(17);
    expect(ageOf('2009-01-01', new Date('2027-01-01T05:00:00Z'))).toBe(18);
    expect(ageOf('2026-02-30')).toBeNull();
  });

  it('distingue un antecedente sin fecha registrada', () => {
    expect(formatHistoryDay(null)).toBe('Fecha sin registrar');
    expect(formatHistoryDay('2026-12-31')).toContain('31');
  });

  it('etiqueta las alertas por día de Bogotá aunque hayan transcurrido menos de 24 horas', () => {
    const reported = '2027-01-01T04:59:59Z';
    expect(ago(reported, new Date('2027-01-01T04:59:59Z'))).toBe('Hoy');
    expect(ago(reported, new Date('2027-01-01T05:00:00Z'))).toBe('Ayer');
    expect(ago(reported, new Date('2027-01-02T05:00:00Z'))).toBe('Hace 2 días');
  });
});
