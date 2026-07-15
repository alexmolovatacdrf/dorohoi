"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "./language-provider";

const navItems = [
  { href: "/", key: "nav.overview" as const },
  { href: "/map", key: "nav.map" as const },
  { href: "/presentation/map", key: "nav.presentationMap" as const },
  { href: "/persons", key: "nav.persons" as const },
  { href: "/places", key: "nav.places" as const },
  { href: "/documents", key: "nav.documents" as const },
  { href: "/review", key: "nav.review" as const },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { language, setLanguage, t } = useLanguage();

  return (
    <header className="site-header sticky top-0 z-50 border-b border-white/10 bg-[#153a32]/96 text-[#f8f2e6] shadow-[0_10px_30px_rgba(17,42,35,0.18)] backdrop-blur-xl">
      <div className="mx-auto flex min-h-17 max-w-[1440px] items-center gap-5 px-4 sm:px-7 lg:px-12">
        <Link href="/" className="group mr-auto flex min-w-fit items-center gap-3" aria-label="Dosare Dorohoi overview">
          <span className="grid size-9 place-items-center border border-[#d7b36a]/70 text-[11px] font-black tracking-[0.14em] text-[#e7c680] transition group-hover:bg-[#e7c680] group-hover:text-[#173f36]">
            DD
          </span>
          <span>
            <span className="block text-[9px] font-bold tracking-[0.21em] text-[#d9c6a0] uppercase">
              {t("brand.kicker")}
            </span>
            <span className="font-editorial block text-[1.06rem] leading-none font-bold tracking-[-0.02em]">
              {t("brand.name")}
            </span>
          </span>
        </Link>

        <nav aria-label="Primary navigation" className="hidden self-stretch lg:flex">
          {navItems.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center px-3 text-[11px] font-bold tracking-[0.08em] uppercase transition ${
                  active ? "text-white" : "text-[#c8d4cf] hover:text-white"
                }`}
              >
                {t(item.key)}
                {active ? <span className="absolute right-3 bottom-0 left-3 h-0.5 bg-[#d8ab5d]" /> : null}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center rounded-sm border border-white/15 bg-black/10 p-0.5" aria-label={t("language.label")}>
          {(["en", "ro"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setLanguage(item)}
              aria-pressed={language === item}
              className={`rounded-[2px] px-2 py-1.5 text-[10px] font-black tracking-[0.13em] uppercase transition ${
                language === item ? "bg-[#f6f0e4] text-[#173f36]" : "text-[#c8d4cf] hover:text-white"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <nav aria-label="Mobile navigation" className="flex overflow-x-auto border-t border-white/8 px-3 lg:hidden">
        {navItems.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`min-w-fit border-b-2 px-3 py-2.5 text-[10px] font-bold tracking-[0.08em] uppercase ${
                active ? "border-[#d8ab5d] text-white" : "border-transparent text-[#c8d4cf]"
              }`}
            >
              {t(item.key)}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
