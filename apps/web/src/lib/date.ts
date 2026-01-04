export function parseDate(value?: string) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value?: string, locale = "pt-BR") {
  const date = parseDate(value);
  if (!date) {
    return "-";
  }
  return date.toLocaleDateString(locale);
}
