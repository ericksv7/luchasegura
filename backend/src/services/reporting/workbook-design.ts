import ExcelJS, { type Worksheet } from "exceljs";

const palette = {
  dark: "173A33", green: "238A70", soft: "EAF5F0", ink: "243B35",
  muted: "52685F", border: "DCE8E2", white: "FFFFFF", stripe: "F5FAF8",
};
const font = "Calibri";
const border = { style: "thin", color: { argb: "FF" + palette.border } } as const;
export const format = { date: "dd/mm/yyyy", timestamp: "dd/mm/yyyy hh:mm", number: "0.######", percent: "0.00%" };
export const tableHeader = 7;
type Value = string | number | Date | null;
export type Column = readonly [label: string, width: number, numberFormat?: string];
type KPI = readonly [label: string, value: Value, numberFormat?: string];

const solid = (color: string) => ({ type: "pattern", pattern: "solid", fgColor: { argb: "FF" + color } } as const);
const foreground = (color: string) => ({ argb: "FF" + color });
const missing = "—";

export function day(value: string | null | undefined): Date | null {
  return value ? new Date(value + "T00:00:00Z") : null;
}

// Excel usa fechas sin huso horario. La hora visible se fija en Bogotá.
export function timestamp(value: string | null): Date | null {
  return value ? new Date(Date.parse(value) - 5 * 60 * 60 * 1000) : null;
}

export function percent(value: number | null | undefined): number | null {
  return value == null ? null : value / 100;
}

function lines(value: Value, width: number) {
  if (typeof value !== "string") return 1;
  return value.split(/\r?\n/).reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / (width * .92))), 0);
}

export class ReportingWorkbook {
  readonly book = new ExcelJS.Workbook();

  constructor(private readonly classification: string, private readonly subtitle: string, generatedAt: string) {
    this.book.creator = "LuchaSegura";
    this.book.company = "LuchaSegura";
    this.book.created = new Date(generatedAt);
    this.book.modified = new Date(generatedAt);
    this.book.views = [{ x: 0, y: 0, width: 16000, height: 10000, firstSheet: 0, activeTab: 0, visibility: "visible" }];
  }

  private sheet(name: string, widths: number[], header?: number, headingNote?: string) {
    const landscape = Boolean(header && widths.reduce((sum, width) => sum + width, 0) > 92);
    const sheet = this.book.addWorksheet(name, {
      properties: { tabColor: foreground(header ? palette.green : palette.dark), defaultRowHeight: 17 },
      views: header ? [{ state: "frozen", ySplit: header, showGridLines: false }] : [{ state: "normal", showGridLines: false }],
      pageSetup: {
        paperSize: 9, orientation: landscape ? "landscape" : "portrait",
        fitToPage: true, fitToWidth: 1, fitToHeight: 0,
        horizontalCentered: true, showGridLines: false,
        margins: { left: .32, right: .32, top: .48, bottom: .52, header: .2, footer: .22 },
      },
      headerFooter: { oddFooter: "&LLuchaSegura · " + this.classification + "&RPágina &P de &N" },
    });
    sheet.columns = widths.map(width => ({ width }));
    this.band(sheet, 1, 1, widths.length, "LUCHASEGURA", 21, palette.dark, palette.white, 10, true);
    this.band(sheet, 2, 1, widths.length, header ? name : "Informe del programa preventivo", 33, palette.dark, palette.white, 19, true);
    this.band(sheet, 3, 1, widths.length, header ? this.subtitle + "   /   " + this.classification : this.subtitle, 22,
      palette.green, palette.white, 10, true);
    if (headingNote) this.note(sheet, 5, headingNote);
    return sheet;
  }

  private band(sheet: Worksheet, row: number, first: number, last: number, value: Value, height: number,
    fill: string, color: string, size: number, bold = false, numberFormat?: string) {
    if (first < last) sheet.mergeCells(row, first, row, last);
    const cell = sheet.getCell(row, first);
    cell.value = value ?? missing;
    cell.fill = solid(fill);
    cell.font = { name: font, size, color: foreground(color), bold };
    cell.alignment = { horizontal: "left", vertical: "middle", indent: 1, wrapText: true };
    if (numberFormat) cell.numFmt = numberFormat;
    sheet.getRow(row).height = Math.max(height, sheet.getRow(row).height ?? 0);
  }

  private note(sheet: Worksheet, row: number, value: string) {
    const width = sheet.columns.reduce((sum, col) => sum + (col.width ?? 0), 0);
    this.band(sheet, row, 1, sheet.columnCount, value, Math.max(25, lines(value, width) * 15 + 9), palette.soft, palette.muted, 10);
  }

  executive(name: string, metadata: readonly KPI[], metrics: readonly KPI[], notes: readonly string[]) {
    const sheet = this.sheet(name, [13, 14, 2.5, 13, 14, 2.5, 13, 14], undefined, this.classification);
    let row = 7;
    this.band(sheet, row++, 1, 8, "CONTEXTO DEL INFORME", 20, palette.dark, palette.white, 10, true);
    for (const [label, value, numFmt] of metadata) {
      this.band(sheet, row, 1, 2, label, 20, palette.stripe, palette.muted, 10, true);
      this.band(sheet, row++, 3, 8, value, Math.max(20, lines(value, 58) * 14 + 5), palette.white, palette.ink, 11, false, numFmt);
    }
    row++;
    this.band(sheet, row++, 1, 8, "INDICADORES CLAVE", 20, palette.dark, palette.white, 10, true);
    metrics.forEach(([label, value, numFmt], index) => {
      const top = row + Math.floor(index / 3) * 3;
      const col = 1 + (index % 3) * 3;
      this.band(sheet, top, col, col + 1, label, 28, palette.soft, palette.ink, 10, true);
      this.band(sheet, top + 1, col, col + 1, value, 35, palette.soft, palette.dark, 23, true, numFmt);
    });
    row += Math.ceil(metrics.length / 3) * 3;
    this.band(sheet, row++, 1, 8, "LECTURA DEL RESULTADO", 20, palette.dark, palette.white, 10, true);
    for (const note of notes) this.note(sheet, row++, note);
    sheet.pageSetup.printArea = `A1:H${row - 1}`;
  }

  table(name: string, columns: readonly Column[], rows: readonly Value[][], note: string, totalLast = false) {
    const sheet = this.sheet(name, columns.map(column => column[1]), tableHeader, note);
    const headings = sheet.getRow(tableHeader);
    headings.values = columns.map(column => column[0]);
    headings.height = 31;
    headings.eachCell(cell => {
      cell.fill = solid(palette.dark);
      cell.font = { name: font, color: foreground(palette.white), bold: true, size: 10 };
      cell.alignment = { vertical: "middle", wrapText: true, indent: 1 };
    });
    rows.forEach((values, index) => {
      const row = sheet.getRow(tableHeader + index + 1);
      row.height = Math.min(400, Math.max(21, 14 * Math.max(...columns.map(([, width], i) => lines(values[i] ?? null, width))) + 7));
      const total = totalLast && index === rows.length - 1;
      columns.forEach(([, , numFmt], i) => {
        const value = values[i] ?? null;
        const cell = row.getCell(i + 1);
        // Los datos del usuario permanecen como cadenas, incluidos prefijos de fórmula.
        cell.value = value ?? missing;
        cell.fill = solid(total ? palette.soft : index % 2 ? palette.stripe : palette.white);
        cell.font = { name: font, color: foreground(value === null ? palette.muted : palette.ink), size: 11, bold: total };
        cell.border = total ? { top: border, bottom: border } : { bottom: border };
        cell.alignment = { vertical: "middle", wrapText: true, indent: 1,
          horizontal: typeof value === "number" ? "right" : value instanceof Date ? "center" : "left" };
        if (numFmt) cell.numFmt = numFmt;
      });
    });
    const lastRow = tableHeader + rows.length;
    const lastCol = sheet.getColumn(columns.length).letter;
    if (rows.length) sheet.autoFilter = `A${tableHeader}:${lastCol}${lastRow}`;
    sheet.pageSetup.printTitlesRow = "1:" + tableHeader;
    sheet.pageSetup.printArea = `A1:${lastCol}${lastRow}`;
    return sheet;
  }

  progress(sheet: Worksheet, column: string, count: number, max: number) {
    if (count < 1 || max < 1) return;
    sheet.addConditionalFormatting({
      ref: `${column}${tableHeader + 1}:${column}${tableHeader + count}`,
      rules: [{
        type: "dataBar", priority: 1, gradient: false, showValue: true,
        cfvo: [{ type: "num", value: 0 }, { type: "num", value: max }],
        color: foreground(palette.green),
      } as ExcelJS.DataBarRuleType],
    });
  }
}
