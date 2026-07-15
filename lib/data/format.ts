import type { DateRange, SourceReference } from "@/lib/domain/schemas";

export type DateLanguage = "en" | "ro";

export function formatIsoDate(value: string, language: DateLanguage = "en"): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(language === "ro" ? "ro-RO" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatDateRange(date: DateRange, language: DateLanguage = "en"): string {
  if (!date.start && !date.end) {
    return typeof date.raw === "string" ? date.raw : "Date unresolved";
  }
  if (date.precision === "year" && date.start) return date.start.slice(0, 4);
  if (date.precision === "month" && date.start) {
    const [year, month] = date.start.split("-").map(Number);
    return new Intl.DateTimeFormat(language === "ro" ? "ro-RO" : "en-GB", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(year, month - 1, 1)));
  }
  if (date.start === date.end && date.start) return formatIsoDate(date.start, language);
  const start = date.start ? formatIsoDate(date.start, language) : "?";
  const end = date.end ? formatIsoDate(date.end, language) : "?";
  return `${start} – ${end}`;
}

export function humanizeSlug(value: string): string {
  const text = value.replaceAll("_", " ");
  return text.charAt(0).toLocaleUpperCase("en") + text.slice(1);
}

export function formatSourceReference(source: SourceReference): string {
  const parts = [source.documentId ?? source.sourceRecordId ?? source.sourceDataset];
  if (source.pagePdf) parts.push(`PDF p. ${source.pagePdf}`);
  if (source.pagePrinted !== null) parts.push(`printed p. ${source.pagePrinted}`);
  if (source.field) parts.push(source.field);
  return parts.join(" · ");
}

export function rawValueLabel(value: unknown): string {
  if (value === null || value === undefined) return "Not supplied";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}
