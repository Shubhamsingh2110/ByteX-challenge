export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="rounded-full border border-black/10 px-3 py-1 text-xs font-medium uppercase tracking-widest text-foreground/60 dark:border-white/15">
          ByteX Challenge
        </span>
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          It&apos;s all set up.
        </h1>
        <p className="max-w-md text-balance text-foreground/60">
          A Turborepo monorepo running Next.js, TypeScript, and Tailwind CSS.
          Edit{" "}
          <code className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-sm dark:bg-white/10">
            app/page.tsx
          </code>{" "}
          to get started.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {["Next.js 15", "TypeScript", "Tailwind CSS v4", "Turborepo"].map(
          (tech) => (
            <span
              key={tech}
              className="rounded-lg border border-black/10 bg-black/[0.02] px-4 py-2 text-sm font-medium dark:border-white/15 dark:bg-white/[0.03]"
            >
              {tech}
            </span>
          ),
        )}
      </div>
    </main>
  );
}
