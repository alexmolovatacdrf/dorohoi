export function SiteFooter() {
  return (
    <footer className="site-footer border-t border-[#cec8ba] bg-[#e8e3d7]/70">
      <div className="mx-auto grid max-w-[1440px] gap-4 px-5 py-8 text-xs text-[#596760] sm:grid-cols-2 sm:px-8 lg:px-12">
        <div>
          <p className="font-editorial text-base font-bold text-[#173f36]">Dosare Dorohoi</p>
          <p className="mt-1 max-w-xl leading-relaxed">
            A V1 research interface for person-level histories, documentary evidence and geographic context.
          </p>
        </div>
        <p className="max-w-xl leading-relaxed sm:text-right">
          Analytical records support research. Source scans remain the documentary authority; unresolved readings stay visible.
        </p>
      </div>
    </footer>
  );
}
