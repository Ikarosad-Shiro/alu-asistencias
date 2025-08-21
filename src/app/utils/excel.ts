// src/app/utils/excel.ts
export function excelSanitize(v: any): string {
  const s = String(v ?? '');
  const clean = s.replace(/[\u0000-\u001F]/g, ' '); // limpia control chars
  // evita que Excel interprete como fórmula
  return /^[=+\-@]/.test(clean) ? `'${clean}` : clean;
}

export const EXCEL_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
