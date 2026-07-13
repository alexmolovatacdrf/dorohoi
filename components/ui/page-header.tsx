import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 grid gap-5 border-b border-[#cdc7b8] pb-7 lg:grid-cols-[1fr_auto] lg:items-end">
      <div>
        <p className="mb-3 text-[10px] font-black tracking-[0.19em] text-[#a54f32] uppercase">{eyebrow}</p>
        <h1 className="font-editorial max-w-5xl text-4xl leading-[0.98] font-bold text-[#173f36] sm:text-5xl lg:text-[3.7rem]">
          {title}
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-[#596760] sm:text-base">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionHeader({
  kicker,
  title,
  count,
  action,
}: {
  kicker?: string;
  title: string;
  count?: number;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4 border-b border-[#d8d2c5] pb-3">
      <div>
        {kicker ? <p className="mb-1 text-[9px] font-black tracking-[0.16em] text-[#8f5b3d] uppercase">{kicker}</p> : null}
        <h2 className="font-editorial text-2xl font-bold text-[#173f36]">
          {title} {count !== undefined ? <span className="align-top text-sm text-[#7b857f]">{count}</span> : null}
        </h2>
      </div>
      {action}
    </div>
  );
}
