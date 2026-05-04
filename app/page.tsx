import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-xl">
        <div className="flex items-center justify-center gap-3 mb-6">
          <i className="fa-solid fa-cube text-violet-700 text-4xl" />
          <span className="text-3xl font-bold text-slate-800">
            Docu<span className="font-extrabold">Vault</span>
          </span>
        </div>

        <h1 className="text-4xl font-bold text-slate-900 mb-4 leading-tight">
          APIEngine + uilib DocuVault Demo
        </h1>

        <p className="text-lg text-slate-500 mb-8">
          File Storage backend powered by APIEngine, UI by uilib
        </p>

        <Link
          href="/files"
          className="inline-flex items-center gap-2 px-6 py-3 text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors"
        >
          View Files
          <i className="fa-solid fa-arrow-right" />
        </Link>
      </div>

      <footer className="mt-16 text-sm text-slate-400">
        Built with Next.js 14 · APIEngine · uilib
      </footer>
    </main>
  );
}
