import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "TTV Library Coming Soon | Tate's TV",
  description:
    "TTV Library is the future on-demand home for Tate's TV premium access, creator features, and bonus content.",
};

export default function LibraryPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center px-6 py-20 text-center">
        <div className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.32em] text-white/70">
          Coming Soon
        </div>

        <h1 className="mt-8 text-4xl font-black uppercase tracking-[0.12em] sm:text-6xl">
          TTV Library
        </h1>

        <p className="mt-5 max-w-2xl text-base leading-8 text-white/70 sm:text-lg">
          The live Tate&apos;s TV channels are free to watch. The on-demand
          library is being prepared as a future TTV Plus feature with premium
          access, creator extras, favorites, and bonus content.
        </p>

        <div className="mt-8 rounded-3xl border border-pink-400/30 bg-pink-500/10 p-6 text-left shadow-[0_0_50px_rgba(244,63,94,0.18)]">
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-pink-200">
            Launch Plan
          </p>
          <p className="mt-3 text-sm leading-7 text-white/70">
            Live channels stay free. On-demand access will open later once user
            accounts, secure payments, and content permissions are fully ready.
          </p>
        </div>

        <Link
          href="/"
          className="mt-10 rounded-full border border-white/15 bg-white px-6 py-3 text-sm font-black uppercase tracking-[0.22em] text-black transition hover:bg-pink-100"
        >
          Back to Live TV
        </Link>
      </section>
    </main>
  );
}