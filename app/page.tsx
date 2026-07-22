/**
 * Placeholder. The real home page arrives in the next change, with its Playwright test.
 *
 * It renders the design tokens rather than "Hello world" so the Deploy Preview for this
 * scaffold shows whether the palette actually reads as warm on a phone screen.
 */
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-6 py-20">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium tracking-wide text-terracotta-700 uppercase">
          Scaffold
        </p>
        <h1 className="text-4xl font-semibold text-balance text-ink-900 sm:text-5xl">
          The delivery pipeline, before the website.
        </h1>
        <p className="text-lg text-ink-700">
          This page exists to prove a change can travel from a pull request to a
          deploy preview to production. The home page replaces it next.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <span className="rounded-full bg-sage-700 px-5 py-2.5 text-sm font-medium text-cream-50">
          Sage carries every call to action
        </span>
        <span className="rounded-full border border-border bg-surface px-5 py-2.5 text-sm text-ink-700">
          Warm neutral surface
        </span>
      </div>
    </main>
  );
}
