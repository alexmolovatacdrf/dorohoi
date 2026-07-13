import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page-shell grid min-h-[60vh] place-items-center text-center">
      <div>
        <p className="text-[10px] font-black tracking-[0.2em] text-[#a54f32] uppercase">Record not found</p>
        <h1 className="font-editorial mt-3 text-5xl font-bold text-[#173f36]">This evidence record is unavailable.</h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-[#596760]">
          The identifier may not exist in the current normalized corpus, or the record has not yet been imported.
        </p>
        <Link className="mt-7 inline-flex bg-[#173f36] px-5 py-3 text-xs font-bold text-white" href="/">
          Return to overview
        </Link>
      </div>
    </div>
  );
}
