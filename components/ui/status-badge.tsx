import type { ReactNode } from "react";

type Tone = "green" | "gold" | "rust" | "blue" | "slate" | "red";

const tones: Record<Tone, string> = {
  green: "border-[#8eb0a5] bg-[#e7f0ec] text-[#245146]",
  gold: "border-[#d7bb82] bg-[#f4ecd9] text-[#775620]",
  rust: "border-[#d5a18e] bg-[#f5e7e0] text-[#8a402b]",
  blue: "border-[#9cb9c2] bg-[#e8f0f2] text-[#315d68]",
  slate: "border-[#c6c9c5] bg-[#eff0ec] text-[#56615c]",
  red: "border-[#d5a09c] bg-[#f7e7e5] text-[#8d352c]",
};

export function StatusBadge({ children, tone = "slate" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] leading-4 font-bold tracking-[0.06em] uppercase ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function confidenceTone(confidence: string): Tone {
  if (confidence === "high") return "green";
  if (confidence === "medium") return "gold";
  if (confidence === "low") return "rust";
  return "slate";
}

export function reviewTone(state: string): Tone {
  return state === "needs_review" ? "rust" : state === "resolved" ? "green" : "slate";
}
