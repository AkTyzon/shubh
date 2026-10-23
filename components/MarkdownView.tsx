"use client";

/**
 * Markdown rendering, in its own chunk.
 *
 * Split out purely for weight. `react-markdown` and `remark-gfm` pull in the
 * whole micromark pipeline — around 90 KB gzipped — and none of it is needed
 * until someone presses "Explain this plan". Most visitors read the budget, the
 * timeline and the checklists and never do, so shipping the parser to all of them
 * is paying for the page nobody asked for.
 *
 * `Narrative` loads this with `next/dynamic` and warms the import the moment the
 * button is pressed, so the chunk is in flight alongside the first tokens and
 * has arrived by the time there is anything to render.
 *
 * Note what this is *not*: `react-markdown` builds React elements rather than
 * setting `innerHTML`, so model output cannot inject markup here. That is the
 * mitigation that makes `'unsafe-inline'` acceptable in the CSP, and it is the
 * reason this component exists rather than a `dangerouslySetInnerHTML` call.
 */

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function MarkdownView({ children }: { children: string }) {
  return <Markdown remarkPlugins={[remarkGfm]}>{children}</Markdown>;
}
