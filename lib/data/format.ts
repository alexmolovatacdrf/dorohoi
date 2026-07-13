import type { DateRange, SourceReference } from "@/lib/domain/schemas";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatIsoDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return DATE_FORMATTER.format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatDateRange(date: DateRange): string {
  if (!date.start && !date.end) {
    return typeof date.raw === "string" ? date.raw : "Date unresolved";
  }
  if (date.start === date.end && date.start) return formatIsoDate(date.start);
  if (date.precision === "year" && date.start) return date.start.slice(0, 4);
  const start = date.start ? formatIsoDate(date.start) : "?";
  const end = date.end ? formatIsoDate(date.end) : "?";
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
