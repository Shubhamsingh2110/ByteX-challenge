# 💸 Smart Mini-Ledger

A lightweight, full-stack financial ledger: add income & expenses in plain
English, watch your money flow through a live Sankey diagram, and get flagged
when a purchase is unusual — built on a typed monorepo with a fully-tested
domain core.

> **Stack:** Turborepo · Next.js 15 (App Router) · TypeScript · Tailwind CSS v4
> · MongoDB Atlas (Mongoose) · Claude (`@anthropic-ai/sdk`) · Zod · Recharts ·
> Vitest.

---

## ✨ What it does

**Core ledger**

- Add, edit, and delete transactions (income / expense) with category, amount,
  description, and date.
- Filter and search the transaction list; two-step delete confirmation.
- Live summary dashboard: total income, total expenses, net balance, and
  savings rate.
- Per-category spending breakdown.

**The "smart" bits (USPs — see [Standout features](#-standout-features))**

- 🗣️ **Natural-language quick-add** — type `coffee 4.50 yesterday` and Claude
  parses the amount, category, type, and date. You review before it saves.
- 🌊 **Sankey cash-flow diagram** — income sources → an "available" hub →
  spending categories, with the surplus flowing to *Savings* (or a *Deficit*
  node when you overspend).
- 🚨 **Anomaly detection** — flags an expense that's an outlier for its category
  (e.g. *"4.1× your usual Groceries spend"*).
- 📈 **Month-end forecast** — projects your end-of-month net from the current
  spending run-rate.

---

## 🏗️ Architecture

A Turborepo monorepo. The key idea: **all domain logic lives in a pure,
framework-free package** (`@repo/core`) so it can be unit-tested in isolation
*and* run on both the server (source of truth) and the client (instant
optimistic UI).

```
ByteX-challenge/
├── apps/
│   └── web/                    # Next.js UI + Server Actions
│       ├── app/                # routes, layout, global styles
│       ├── components/         # LedgerApp, forms, list, charts, toasts
│       └── lib/                # server actions, data loader, types
└── packages/
    ├── core/    (@repo/core)   # 💡 pure domain logic — NO React, NO DB
    │   ├── money.ts            #    integer-cent math (never floats)
    │   ├── schema.ts           #    categories + Zod validation
    │   ├── insights.ts         #    summary · anomalies · forecast · sankey
    │   └── test/               #    22 Vitest unit tests
    ├── db/      (@repo/db)      # Mongoose models + Atlas connection + repo
    ├── ai/      (@repo/ai)      # Claude natural-language parser (+ cache)
    └── typescript-config/      # shared tsconfig
```

### Why this shape

- **Testability & correctness.** Money math, statistics, and the Sankey builder
  are pure functions with no I/O — so they're covered by fast unit tests, and
  the same functions power the UI's optimistic updates.
- **One source of truth for money & categories.** The `amount → integer cents`
  parser and the category taxonomy are defined once and imported everywhere
  (client form, server action, DB model, AI validator).
- **Server Actions** handle mutations with Zod validation, friendly error
  messages, and `revalidatePath`. The page is server-rendered with live data
  and degrades gracefully to a banner if the DB is unreachable.

---

## 🚀 Getting started

### Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9 (`npm i -g pnpm`)
- A MongoDB Atlas connection string
- An Anthropic API key (for the natural-language quick-add)

### 1. Install

```bash
pnpm install
```

### 2. Configure secrets

```bash
cp .env.example .env
```

Then edit `.env` and fill in **both** values:

```ini
MONGODB_URI="mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/?retryWrites=true&w=majority"
ANTHROPIC_API_KEY="sk-ant-..."     # required for the AI quick-add
```

> `.env` is gitignored — never commit real secrets. In a monorepo, Next.js only
> auto-loads `.env` from the app directory, so [`apps/web/next.config.ts`](apps/web/next.config.ts)
> explicitly loads the repo-root `.env`.

### 3. Seed demo data (optional but recommended)

```bash
pnpm --filter @repo/db seed
```

Inserts a realistic month of transactions (including one grocery anomaly) so the
dashboard, forecast, and Sankey have something to show immediately.

### 4. Run

```bash
pnpm dev
```

Open http://localhost:3000.

### Handy scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Start the dev server |
| `pnpm build` | Production build (Turbo-cached) |
| `pnpm test` | Run the Vitest unit suite |
| `pnpm check-types` | Type-check every package |
| `pnpm lint` | Lint every package |
| `pnpm --filter @repo/db seed` | Reseed the database |

---

## 🌟 Standout features (the "beyond AI output" part)

### 1. Natural-language quick-add — with a validation guard

Type `uber 18 yesterday` and Claude returns a structured suggestion (amount,
type, category, resolved date, confidence). Engineering decisions that matter:

- **Structured outputs, not string parsing.** The model is constrained to a JSON
  schema, so we never regex an LLM's prose.
- **We don't trust the model.** Even a schema-valid response is re-validated in
  [`packages/ai/src/parser.ts`](packages/ai/src/parser.ts): a category whose type
  contradicts the inferred type is replaced with the correct generic bucket, the
  amount must be positive & finite, and low-confidence parses are rejected.
- **It's a suggestion, not an action.** The parse pre-fills the form; the user
  confirms before anything is persisted.
- **Caching trick.** Identical notes are cached (keyed by *date + text*), so
  repeated input never re-hits the API — while relative dates like "yesterday"
  still resolve correctly across day boundaries.

### 2. Sankey money-flow visualization

Instead of another pie chart, [`SankeyChart`](apps/web/components/SankeyChart.tsx)
renders `income → available → categories` as flowing streams, with a *Savings*
or *Deficit* terminal node. The graph is built by a pure function
([`buildSankey`](packages/core/src/insights.ts)) and verified by a test that
asserts **flow conservation** (money into the hub equals money out).

### 3. Financial-correctness edge cases

- **Integer-cent money math.** All money is integer cents, parsed from strings —
  so `0.1 + 0.2` and `1.005` behave correctly (see the AI section below).
- **Idempotent writes.** Each create carries an idempotency key backed by a
  sparse-unique Mongo index, so a double-click or retry can't create duplicates
  (race-safe via the E11000 fallback in the repository).
- **Timezone-aware, future-proof dates.** Dates can't be set in the future;
  relative dates resolve against "now".

### 4. Robust anomaly detection

Flags outliers using the **category median**, not mean+σ — a deliberate fix for
a real bug (below).

---

## 🤖 AI tools: how they helped, and where they fell short

This project was built with **Claude Code (Claude Opus 4.8)** as a pair
programmer. Being honest about *where the AI was wrong* is the point of this
section — every item below actually happened during this build.

### How AI accelerated the work

- **Boilerplate & scaffolding.** Monorepo wiring (Turborepo tasks, tsconfig
  inheritance, `transpilePackages`), the Next.js app shell, Mongoose model,
  Tailwind design tokens, and dozens of small React components were generated in
  minutes rather than hours.
- **Repetitive-but-fiddly code.** The Zod schemas, the category taxonomy, the
  toast system, and the form state management were exactly the kind of
  well-trodden code LLMs produce reliably.
- **Test authoring.** The AI drafted the unit-test tables quickly, which then
  immediately earned their keep (see the anomaly bug).

### Where the AI fell short — and how human judgment fixed it

1. **Float money math (the classic trap).**
   The instinctive AI-generated approach to "dollars → cents" is
   `Math.round(amount * 100)`. That's **wrong**: `1.005 * 100` is
   `100.499…` in IEEE-754, so it rounds to `100`, not `101`. We rejected it and
   wrote a **string-based parser** in [`money.ts`](packages/core/src/money.ts)
   that never multiplies floats. A test asserts both the correct result *and*
   that the naive version is buggy.

2. **A statistics bug the tests caught.**
   The first anomaly detector used the textbook `mean + 2·standard-deviation`
   rule. The unit test failed — because a single large outlier inflates both the
   mean *and* the standard deviation so much that it exceeds *its own* threshold
   (the "masking effect"). The AI's plausible-looking statistics silently missed
   the very thing it was meant to catch. Fixed by switching to a **median-based
   ratio**, which is robust to outliers and matches the "N× your usual spend"
   framing. See [`detectAnomalies`](packages/core/src/insights.ts).

3. **Hallucinated / stale SDK surface.**
   The initial `@anthropic-ai/sdk` version and API usage didn't match reality:
   `messages.parse` + the Zod output helper didn't exist in the pinned version,
   and the current helper targets **Zod v4** while the rest of the workspace is
   on **Zod v3**. Rather than fork the whole codebase to Zod v4, we upgraded the
   SDK and switched to **structured outputs with a hand-written JSON schema**,
   keeping one Zod major version across the repo. (We deliberately consulted the
   SDK reference for the correct current model ID — `claude-opus-4-8` — instead
   of trusting a memorized one.)

4. **Monorepo environment loading.**
   The app rendered but every value was `$0.00`. The cause: Next.js only
   auto-loads `.env` from the *app* directory, not the monorepo root — a detail
   the generated setup glossed over. The graceful DB-error banner (already built
   in) surfaced the real message, and the fix was to load the root `.env`
   explicitly in `next.config.ts`.

5. **ESM `.js` import specifiers vs. the bundler.**
   TypeScript's NodeNext style wants `import "./money.js"`, but Next's webpack
   couldn't resolve those to the `.ts` source in an internal package. Since these
   packages are consumed as source by a bundler, we dropped the extensions.

6. **Tailwind v4 `@apply` semantics.**
   Generated CSS used `@apply btn` to compose one custom class from another —
   which Tailwind v4 rejects (`@apply` only accepts real utilities). Fixed by
   inlining the base utilities into each button variant.

7. **Trusting LLM output at runtime.**
   Beyond build-time issues, the design itself guards against the AI being wrong
   *in production*: the quick-add parser re-validates and clamps Claude's output,
   and never auto-saves — because a confident-sounding parse can still pick the
   wrong category or a nonsense amount.

**Takeaway:** the AI was a force-multiplier for breadth and speed, but the
correctness-critical decisions — money representation, statistical method, trust
boundaries, and monorepo/tooling reality — needed human review, and the test
suite is what turned "looks right" into "is right."

---

## 🧪 Testing

The domain core is covered by **22 Vitest unit tests** (money parsing including
the float traps, summaries, anomaly detection, month-end forecast, and Sankey
flow conservation):

```bash
pnpm test
```

Type-safety is enforced repo-wide with `pnpm check-types`, and the whole thing
builds with `pnpm build`.

---

## 🔧 Limitations & possible next steps

- **Single-user.** No auth — every visitor shares one ledger. Adding per-user
  scoping would be a `userId` on the model + a session.
- **AI parsing requires a key.** Without `ANTHROPIC_API_KEY`, the app runs fully;
  the quick-add just returns a friendly "enter it manually" message.
- **Currency is USD-only** in the UI formatting (the money layer is
  currency-agnostic).
- Future: recurring transactions, CSV import/export, and a spending-goals view.

---

Built as a challenge submission. The interesting code is in
[`packages/core`](packages/core/src) — that's where the money math, statistics,
and money-flow graph live, and where the tests prove they're correct.
