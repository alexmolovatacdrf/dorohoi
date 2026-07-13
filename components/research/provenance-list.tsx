import { formatSourceReference, rawValueLabel } from "@/lib/data/format";
import type { AlternativeReading, SourceReference } from "@/lib/domain/schemas";
import { StatusBadge, confidenceTone } from "@/components/ui/status-badge";

export function ProvenanceList({
  sourceRefs,
  raw,
  alternatives = [],
  label = "Evidence & provenance",
}: {
  sourceRefs: SourceReference[];
  raw?: unknown;
  alternatives?: AlternativeReading[];
  label?: string;
}) {
  return (
    <details className="group border border-[#d8d2c5] bg-[#f8f5ed] open:bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-xs font-bold text-[#344a42] marker:hidden">
        <span>{label}</span>
        <span className="text-lg leading-none text-[#8b6d40] transition group-open:rotate-45">+</span>
      </summary>
      <div className="space-y-3 border-t border-[#ded8cc] px-4 py-4 text-xs leading-5 text-[#56645e]">
        {sourceRefs.map((source, index) => (
          <div key={`${source.sourceFile}-${source.field}-${index}`} className="border-l-2 border-[#b9883b] pl-3">
            <p className="font-semibold text-[#253b33]">{formatSourceReference(source)}</p>
            <p className="break-all text-[10px] text-[#78817d]">{source.sourceFile}</p>
            {source.fragmentRaw ? <blockquote className="mt-2 font-serif text-sm text-[#433e35]">“{source.fragmentRaw}”</blockquote> : null}
          </div>
        ))}
        {raw !== undefined ? (
          <div>
            <p className="mb-1 text-[9px] font-black tracking-[0.12em] uppercase">Raw value</p>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-sm bg-[#ebe7dd] p-3 font-mono text-[10px] leading-4 text-[#3d4843]">
              {rawValueLabel(raw)}
            </pre>
          </div>
        ) : null}
        {alternatives.length ? (
          <div>
            <p className="mb-2 text-[9px] font-black tracking-[0.12em] uppercase">Alternative readings</p>
            <div className="space-y-2">
              {alternatives.map((alternative, index) => (
                <div key={index} className="rounded-sm border border-[#dfc9b7] bg-[#fbf3ed] p-3">
                  <div className="mb-1 flex items-center gap-2">
                    <StatusBadge tone={confidenceTone(alternative.confidence)}>{alternative.confidence}</StatusBadge>
                    <code className="text-[11px] text-[#493e36]">{rawValueLabel(alternative.value)}</code>
                  </div>
                  {alternative.note ? <p>{alternative.note}</p> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </details>
  );
}
