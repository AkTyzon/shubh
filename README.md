# Shubh — शुभ

**Celebration planning where the numbers actually add up.**

Plan an Indian wedding, birthday, griha pravesh or society function. Tell Shubh the date, the headcount, the city tier and what you can spend. It returns a budget that balances to the rupee, a schedule computed backwards from the date with dependencies enforced, and a straight answer about whether the plan is possible at all.

The AI explains and suggests. **It never produces a number.** And where it states one anyway, that figure is extracted and checked against the computed plan before you see it — with the result shown to you, not assumed.

- **Live:** https://shubh.vercel.app
- **Challenge:** Celebration & Event Planner
- **Runs with zero API keys.** The arithmetic never needed one.

---

## Judging guide — test it in 90 seconds

Four clicks. The home page carries each of these as a one-click example link, so nothing needs typing.

| # | Try this | What to look for |
|---|---|---|
| 1 | **Metro wedding, 300 guests, ₹25 lakh** (nine months out) | Scroll to the bottom of the budget table. `allocated + contingency = total`, printed as arithmetic. Not approximately — exactly, to the rupee. |
| 2 | **Metro wedding, 400 guests, ₹3 lakh** | It refuses. *"₹3.00 lakh across 400 guests is ₹750 a head. A typical wedding at this size and location runs near ₹30.96 lakh — a gap of about ₹27.96 lakh."* Then: *"Reduce to roughly 80 guests, which this budget does cover."* No model wrote that; it is arithmetic. |
| 3 | **Wedding in ten days** | The money is fine. The *date* is the problem. Tasks that should have been done months ago are listed as overdue with the shortfall in days, rather than silently rescheduled to tomorrow to keep the list looking tidy. |
| 4 | On any plan, press **Explain this plan** | Text streams in marked *"Generating — not yet verified"*. When it finishes, a panel reports how many of its figures and dates matched the computed plan. Anything invented is **struck through in the text itself**. |

**Then disable JavaScript and reload.** The budget, the schedule and the feasibility findings are all still there. The form is a plain `GET` form; the page is computed on the server. Only the AI explanation needs scripting, because it genuinely cannot work without a network call.

**Then run it with no credentials:**

```bash
git clone https://github.com/AkTyzon/shubh && cd shubh
npm ci && npm run dev
```

No `.env`, no key, no account. You get the full product, including a written explanation — because the fallback narrative is generated from the computed plan, not from a model.

---

## Why not just ask ChatGPT to plan your wedding?

Because you will get a confident, tidy, plausible table whose rows do not add up to your budget — and checking it is exactly the work you were trying to avoid.

Ask the same model twice and you get two different budgets. Neither tells you that the date you picked leaves 54 days for a venue that needs 180. Neither adds the lines up. And the failure is not a clumsy sentence: it is a confident ₹8,40,000 that someone commits borrowed money against.

A language model is genuinely good at parts of this — what to serve, how to make a tight budget feel generous, what to ask a caterer, which rituals a region expects. It is unreliable at the part people act on with money. So here it does the first and is kept out of the second:

| | Who decides | Enforced how |
|---|---|---|
| Every rupee allocation | **Code** | Allocations plus contingency must equal the total. `lib/budget.ts` throws rather than return a budget that does not balance. |
| Every date | **Code** | Computed backwards from the event date; dependency ordering enforced; impossibility reported, not absorbed. |
| Whether the plan is possible | **Code** | Thresholds against market benchmarks and lead times, each finding stating its own arithmetic. |
| Categories, themes, menus, wording, what to ask a vendor | **The model** | What it is actually good at. |
| Any figure the model states regardless | **Checked** | Extracted and matched against the plan's allow-list. Matched, rounded, or invented — and the reader is told which. |

---

## The verification gate

This is the part worth reading the code for: [`lib/verify.ts`](lib/verify.ts).

The model is handed a plan that is already computed and asked to explain it. That is a narrow job, and it still goes wrong in a specific, dangerous way — models round, restate and embellish numbers:

- *"About ₹7 lakh for catering"* when the allocation is ₹6,75,000.
- *"You'll want roughly ₹50,000 for the pandit"* when nothing in the plan says that.

Each sounds authoritative. Each is a number the reader may act on. So every rupee figure and every date in the output is extracted and checked:

- **Matched** — the figure is in the plan. Safe to show.
- **Rounded** — within a small tolerance of a real figure. Flagged with the exact value, because *"about ₹7 lakh"* is how a ₹25,000 error enters a budget.
- **Invented** — matches nothing. Struck through in the text, with a warning.

The reader sees the tally. An explanation where every figure checks out reads very differently from one where two were invented, and the person spending the money is the one who needs to know which they are looking at.

**Two limitations, stated rather than hidden.** Both are asserted by tests so they cannot quietly be claimed otherwise:

1. **The allow-list is a set of values, not of meanings.** A figure that coincidentally equals a real plan figure passes even if the model attached it to the wrong thing — "₹2,00,000 for the elephant" matches because ₹2,00,000 happens to be the metro venue floor. The check catches invention, not misattribution. Closing that needs the model to emit structured references rather than prose, which is the obvious next step and is not claimed here.

2. **The allow-list includes derived figures, which makes it denser.** A per-plate rate or a shortfall that the product itself displays has to be allow-listed, or a reader quoting the screen back would be flagged. A denser list is a weaker check — more wrong values land within rounding tolerance of something real. [A test measures that density](tests/verify.test.ts) rather than assuming it is acceptable.

---

## Architecture

```
lib/knowledge/          Hand-written, typed, self-checking data
  costs.ts              Market ranges by city tier for 4 event types, 25 categories
  timelines.ts          46 task templates with lead times, dependencies and reasons
  ideas.ts              Curated suggestions, tagged by budget band

lib/                    The engines. No model is reachable from any of these.
  budget.ts             Allocation. Floor-then-distribute so the sum is exact.
  timeline.ts           Backwards scheduling in UTC calendar days.
  feasibility.ts        The part willing to say no.
  plan.ts               Validation, assembly, and the verification allow-list.
  narrative.ts          The deterministic explanation. Needs no API key.
  verify.ts             The gate. Checks model output against the plan.
  prompt.ts             Instructions that keep the model out of the arithmetic.
  llm.ts                Multi-provider streaming over raw REST. No SDK.

app/                    Next.js App Router
  page.tsx              Server component. Renders the whole plan without JS.
  api/plan              The computed plan as JSON.
  api/ideas             Streams the narrative, then appends its verification.
  api/health            What this instance can actually do.
```

**The knowledge is typed TypeScript, not YAML or JSON**, so the compiler checks it and the modules can police themselves at import time:

```ts
// lib/knowledge/costs.ts — runs when the module loads
function assertSharesSumToOne(): void {
  for (const [eventType, categories] of Object.entries(COST_CATEGORIES)) {
    const basisPoints = categories.reduce((s, c) => s + Math.round(c.share * 10_000), 0);
    if (basisPoints !== 10_000) throw new Error(/* … */);
  }
}
```

Compared in basis points because `0.3 + 0.2 + 0.12 + …` is not exactly `1` in binary floating point. A mistyped percentage is a startup failure, not a budget that quietly does not add up. `lib/knowledge/timelines.ts` does the same for its task graph: dependencies must exist, must have longer lead times than their dependents, and must be acyclic.

### Model providers

One client, four providers, over raw `fetch` — no vendor SDK. Gemini, OpenAI, Anthropic, or **any OpenAI-compatible local server** (Ollama, llama.cpp, LM Studio). Resolution order is deliberate:

1. A visitor's own key, if they supplied one. They asked for it to be used.
2. A local model, if configured. On-device inference is a deliberate privacy choice and should not be silently overridden by a cloud key left in the environment from something else.
3. `GEMINI_API_KEY`, then `OPENAI_API_KEY`, then `ANTHROPIC_API_KEY`.
4. Nothing — which is not an error. The built-in narrative takes over.

Streaming degrades in stages: streaming → three retries with jittered backoff → Gemini's non-streaming endpoint → the deterministic narrative, with the reason stated above it. A visitor never sees a bare error where content could have been.

---

## Hackathon evaluation standards audit

### Code quality

- **TypeScript strict**, zero `any` in application code, zero ESLint errors or warnings.
- **Five dependencies** in production: `next`, `react`, `react-dom`, `react-markdown`, `remark-gfm`. Every one is imported somewhere — [checked by walking each declared dependency](#efficiency), because three unused packages had already accumulated and were removed.
- **Comments explain decisions, not syntax.** Every non-obvious constant says why it has its value, every known failure mode is documented at the place it bit, and both limitations of the verification gate are written down in the module that has them.
- **One validator.** `parsePlanInput` serves the JSON API and the URL alike. Two would drift, and the drift would be a difference in what each surface accepts — [asserted by a test](tests/share.test.ts).
- **Pure functions where it matters.** `buildEndpoint` is exported specifically so the exact request body sent to each provider can be asserted without spending an API call.

### Security

- **CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, a closed `Permissions-Policy`**, all in [`next.config.ts`](next.config.ts) so they travel with the repository and apply in local development too.
- **`'strict-dynamic'` is deliberately absent, and the CI fails if it returns.** Adding it to `script-src` makes browsers ignore `'self'` and `'unsafe-inline'` and trust only nonced scripts; the App Router emits no nonce, so every script is served with a 200 and then refused. The page renders and nothing works. `curl` cannot see this — it neither executes scripts nor enforces CSP — which is precisely why the guard is a CI step and not a manual check.
- **No raw HTML, anywhere.** `dangerouslySetInnerHTML` and `innerHTML =` appear nowhere, and CI fails the build if they are introduced. Model output goes through `react-markdown`, which builds React elements rather than setting HTML, so the worst a hostile model achieves is odd-looking text. This is the mitigation that makes `'unsafe-inline'` acceptable.
- **No key reaches the browser.** `connect-src 'self'`: the page talks only to this origin, and every model call is server-side. CI greps the built client bundle for credential shapes, which catches an accidental `NEXT_PUBLIC_` exposure that reading the source would not.
- **Secret scanning looks for credential *shapes*, not variable names.** An earlier version searched for the string `GEMINI_API_KEY` and failed on the app's own help text telling the user which variable to set. It covers both Google key formats — `AIza…` and the newer `AQ.…` — because a real key of the second kind was once wrongly rejected by a validator that only knew the first.
- **Bring-your-own-key** is read from a header, never a query string (query strings are recorded by access logs, proxies and browser history), shape-checked before use, used for exactly one request, and never logged, stored or echoed. In the browser it is held in component state and never written to `localStorage` or `sessionStorage`.
- **Rate limited** per client, hard on the model route and generously on the computed one — and a 429 on the model route says plainly that *the plan itself is unaffected, because it is computed without a model.*
- **`npm audit --omit=dev --audit-level=high` gates CI, and passes with zero findings.** The full tree currently reports one advisory in `braces`, reachable only through ESLint's globber at lint time, against patterns from our own config. There is no fixed release — [the advisory covers every published version](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) — and npm's only proposed remedy is downgrading to Next 14. It is not in the production bundle and never sees user input, so the gate is production-only and the full audit is reported for visibility rather than silently suppressed.

### Efficiency

- **Zero model calls for the plan.** Budget, schedule and feasibility are arithmetic. The same input always produces the same plan, and no network request is involved. Most comparable tools spend a model call to produce a table that then has to be checked by hand.
- **Zero client JavaScript required for the core product.** `app/page.tsx` is a server component; the form is a plain `GET` form. The budget table, the schedule and the feasibility panel arrive in the HTML. The only client island is the AI explanation.
- **Five production dependencies.** Each declared one was checked by grepping for an actual import; `clsx`, `tailwind-merge` and `lucide-react` turned out to be declared but never used, along with the `lib/utils.ts` they existed for, and all four were deleted. This exact oversight cost marks on a previous submission.
- **Fonts are self-hosted** by `next/font` at build time — no runtime request to Google, no third party in the critical render path, and `connect-src 'self'` stays honest.
- **`output: "standalone"`** keeps the deployed function small and the cold start short on a free tier.
- **Split timeouts** on model calls: one budget for the first byte, a separate idle budget between chunks. A single wall-clock deadline was the original design and it was a bug — a local 8B model producing a long structured answer streams healthily for minutes, and a 60-second ceiling aborted it mid-sentence.
- **Links to example plans use `prefetch={false}`.** Six dynamic pages are not worth prefetching on a mobile connection just because the cards are on screen.

### Testing

**291 tests, 45 suites, no mocked models.** Run `npm test`.

Nothing here mocks an API. The engines are deterministic, so they are tested directly; the provider layer is tested through `buildEndpoint`, which is a pure function; the route handlers are tested by calling them with a `Request`, because App Router handlers are plain functions.

The suite is mostly **property tests over seeded sweeps**, not a handful of examples, because rounding bugs hide in specific values and a chosen example will not find them:

| What is asserted | Over |
|---|---|
| Allocations plus contingency equal the total, exactly | 600 generated plans — awkward budgets, prime guest counts, every event type and city tier |
| **The built-in narrative verifies perfectly against its own plan** | 400 generated plans, with a floor on how many figures were actually checked so it cannot pass vacuously |
| Every dependency falls strictly before its dependent | 200 schedules, including dates so close that lead times collide |
| Every feasibility finding quotes a concrete number and offers something to do | 150 plans × every finding |
| A plan survives a round trip through its shareable URL unchanged | 200 plans |
| The context handed to the model verifies clean against its own plan | 60 plans — so the context cannot set the model up to fail |
| Date arithmetic round-trips across month, year, leap-day and DST boundaries | 300 offsets |

Seeded, so a failure is reproducible. An invariant that fails once in two hundred runs is exactly the kind this project needs to catch.

Four of these tests found real defects while being written, all of which are fixed:

1. `collectFigures` omitted the derived figures the feasibility panel displays, so a model correctly repeating *"₹750 a head"* from the screen was reported as having invented it.
2. The lakh/crore display form of a figure was not allow-listed, so quoting the UI verbatim was flagged.
3. The ₹500 rounding floor had no relative bound, so ₹1 was reported as a "rounding" of a real ₹375 per-guest rate. Nobody rounds 375 to 1.
4. `splitStreamPayload` rendered a partially arrived sentinel as narrative text, briefly flashing `\n␞::shubh-ver` on screen mid-stream.

A dedicated CI job runs the whole pipeline **with an empty environment** and fails if the plan does not balance, if no narrative is produced, or if the narrative does not verify against its own plan. If that job ever needs a credential to pass, the zero-key claim is false.

### Accessibility

Built to WCAG 2.2 AA, with the decisions that matter stated rather than claimed:

- **It works with JavaScript disabled.** Not degraded — the budget, the schedule and the findings are all server-rendered. This is the accessibility feature that subsumes most others.
- **No colour-only encoding, anywhere.** Every verdict and every severity carries a colour, *a word* and a glyph. A budget table encoded only in red and green is unreadable to roughly one man in twelve, unreadable in a printout, and unreadable to a screen reader — and the information being encoded is "you cannot afford this".
- **Real tables.** `<caption>`, `<thead>`, `scope="col"` and `scope="row"`, and a `<tfoot>` carrying the total. A screen reader on a grid of divs gets a list of unrelated numbers; on this it gets *"Catering, allocated six lakh seventy-five thousand, verdict realistic"*. On a phone the same data renders as cards instead, because a five-column financial table at 360px is either unreadable or requires horizontal scrolling — and only one of the two is in the accessibility tree at a time.
- **Every form hint is wired with `aria-describedby`.** Without it a screen-reader user hears the label and the input and never the explanation of what the field means — which, for "city tier", is the entire content of the field.
- **The streaming narrative announces once, politely.** A live region updating on every token makes a screen reader unusable, so the announcement fires on state change and reports the verification tally.
- **A skip link** is the first focusable element. **A single visible focus style** is applied to everything via `:focus-visible`. **Zoom is not capped** — `maximum-scale=5`, because capping it is a common and avoidable failure on a page full of numbers people want to magnify.
- **`prefers-reduced-motion` and `prefers-color-scheme`** are both honoured. The dark palette re-tunes every verdict colour, because the light-mode greens and reds fall below 4.5:1 on a dark surface and a verdict nobody can read is worse than none.
- **`lang="hi"`** on the Devanagari शुभ, so a screen reader switches voice rather than spelling it with an English phoneme set.
- **Tabular figures** wherever one number is compared against another. Proportional digits make a column of rupee amounts impossible to scan.
- **Printing is a real output**, not an afterthought: a budget circulates as a PDF sent to family. Controls drop out, tables and narrative stay, rows do not split across page breaks, and link targets are not expanded — a printed budget covered in URLs is unreadable.

### Problem statement alignment

The challenge asks for a planning assistant covering *budgets, timelines, vendor checklists and personalised ideas* for *weddings, birthdays and community events*.

| Asked for | Delivered |
|---|---|
| Weddings | 10 budget categories, 19 scheduled tasks, 240 days of notice modelled, functions from roka to reception |
| Birthdays | 6 categories, 10 tasks — a different category set, not a wedding with the numbers scaled down |
| Community events | 5 categories, 10 tasks, with permissions, volunteer rotas, transparent accounting and crowd safety in the schedule, because those are what actually sink a society function |
| *(added)* Griha pravesh | The muhurat governs everything, so it earns its own event type |
| Budgets | Allocation that balances to the rupee, each line scored against a market range for the city tier and guest count |
| Timelines | Computed backwards from the date, dependency-ordered, with the shortfall named when a lead time no longer fits |
| Vendor checklists | Every task carries *why* it has its deadline, and the findings say what to get in writing and what a quote must contain |
| Personalised ideas | Model-generated against the computed plan — and verified — with a curated, budget-band-aware catalogue underneath for when no model is configured |

**India-first, deeply.** Costs vary more by city tier than by anything else here — a per-plate rate in Mumbai is three to four times the same menu in a tier-3 town — so `CityTier` is a first-class dimension rather than a multiplier bolted on. Money is formatted in lakh and crore with `en-IN` 2-2-3 grouping, because ₹1,200,000 instead of ₹12,00,000 is misread at a glance by exactly this audience. The wedding model knows haldi, mehendi and sangeet; griha pravesh is built around the muhurat; the community event type assumes volunteers and collected contributions rather than a client with a budget.

---

## Running it

```bash
npm ci
npm run dev          # http://localhost:3000 — fully functional with no API key
npm run check        # typecheck, lint, 291 tests, production build
```

**To add a model** (optional — see [`.env.example`](.env.example)):

```bash
echo 'GEMINI_API_KEY=your-key' > .env.local
```

**Or run it entirely on-device**, so nothing a planner types leaves the machine:

```bash
ollama serve && ollama pull qwen3:8b
echo 'SHUBH_LOCAL_MODEL=qwen3:8b' > .env.local
```

Reasoning is suppressed on local models by default. Measured on qwen3:8b: with thinking on, a 250-token budget was spent entirely in the `reasoning` field and produced **zero** content tokens, so the answer never arrived. Set `SHUBH_LOCAL_THINKING=1` to allow it.

`GET /api/health` reports which provider an instance resolved and whether the engines self-check cleanly, without naming a key.

---

## What this does not do

Stated plainly, because a planning tool that oversells itself is the thing this project is a reaction to.

- **The benchmarks are ranges, not quotations.** They are good enough to tell you when a quote is out of line. They are not a price. Prices move with season, day of week, and how hard you negotiate.
- **No real vendors.** No directory, no availability, no booking. The checklists tell you what to ask and what to get in writing; finding the caterer is still yours.
- **The verification catches invention, not misattribution** — see above. It is a real gap and the fix is known.
- **The rate limiter is per instance.** A serverless deployment gets one bucket per warm instance, which weakens it. It is a budget guard, not a security boundary, and the fix is a shared store behind the same `check()` signature.
- **Lead times assume a reasonably busy season** and are deliberately a little conservative. Being early costs nothing; being late can cost you the venue.

## Licence

MIT. See [LICENSE](LICENSE).
