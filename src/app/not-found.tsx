import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#0b0a09] px-4 py-10 text-stone-100">
      <div className="mx-auto max-w-2xl rounded-[1.4rem] border border-white/8 bg-white/[0.03] p-6">
        <p className="page-label">Not found</p>
        <h1 className="mt-2 font-serif text-3xl text-stone-50">This page does not exist</h1>
        <p className="mt-4 text-sm leading-7 text-stone-300">
          The route you tried to open could not be found. Head back to the dashboard and keep
          your run going.
        </p>
        <div className="mt-6">
          <Link className="quest-button" href="/dashboard">
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
