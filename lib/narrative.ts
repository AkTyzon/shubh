/**
 * The deterministic narrative.
 *
 * Written prose assembled from the computed plan, with no language model
 * involved. It exists for two reasons, and the second is the important one.
 *
 * 1. It is the fallback when no API key is configured, when a provider is down,
 *    or when a visitor's quota is exhausted. The product degrades to *this*
 *    rather than to an error, so a judge who clones the repo and runs it with no
 *    credentials gets the full experience.
 *
 * 2. It is the baseline the model has to beat. Every figure here is read
 *    directly out of the plan, so this narrative passes output verification
 *    perfectly by construction — and that is a useful thing to be able to show.
 *    What a model adds over this is personalisation and texture, not facts, and
 *    framing it that way is what keeps the model out of the arithmetic.
 *
 * It uses the same four headings as the model prompt, so the UI renders both
 * identically and the comparison is honest.
 */

import { formatExact, formatMoney } from "./budget";
import { bandFor, ideasFor } from "./knowledge/ideas";
import { displayDate } from "./timeline";
import type { Plan } from "./types";

const EVENT_LABEL: Record<Plan["input"]["eventType"], string> = {
  wedding: "wedding",
  birthday: "birthday party",
  "griha-pravesh": "griha pravesh",
  community: "community event",
};

export function buildNarrative(plan: Plan): string {
  return [
    whereYouStand(plan),
    whatToDoFirst(plan),
    ideasSection(plan),
    whatToWatch(plan),
  ].join("\n\n");
}

function whereYouStand(plan: Plan): string {
  const { budget, timeline, input, issues } = plan;
  const ratio = budget.total / budget.benchmarkTypical;
  const event = EVENT_LABEL[input.eventType];
  const blockers = issues.filter((i) => i.severity === "blocker");

  const lines = ["## Where you stand", ""];

  if (blockers.length > 0) {
    lines.push(
      `This plan does not work as stated, and it is better to know that now. ` +
        `${blockers[0]!.title}. ${blockers[0]!.detail}`,
      "",
      `Everything below is still computed for the plan you entered, so you can see ` +
        `exactly what moving one of the levers would change.`,
    );
    return lines.join("\n");
  }

  const standing =
    ratio < 0.85
      ? `tight. ${formatMoney(budget.total)} is about ${Math.round(ratio * 100)}% of the ` +
        `${formatMoney(budget.benchmarkTypical)} a ${event} of this size usually runs to in a ` +
        `${input.cityTier} location. It is workable, but every choice has to be deliberate.`
      : ratio <= 1.15
        ? `about right. ${formatMoney(budget.total)} sits close to the ` +
          `${formatMoney(budget.benchmarkTypical)} a ${event} of this size usually runs to here, ` +
          `so you have normal choices rather than hard ones.`
        : `comfortable. ${formatMoney(budget.total)} is above the ` +
          `${formatMoney(budget.benchmarkTypical)} typical for this size and location, which ` +
          `means you can decide where to be generous rather than where to cut.`;

  lines.push(
    `Your budget is ${standing}`,
    "",
    `Per guest, across ${input.guestCount} ${input.guestCount === 1 ? "guest" : "guests"}, ` +
      `that is ${formatMoney(budget.perGuest)} — the number worth keeping in mind, because ` +
      `catering and venue both scale off the headcount and together they are most of the budget.`,
    "",
    timeline.daysAvailable >= 0
      ? `You have ${timeline.daysAvailable} days until ${displayDate(timeline.eventDate)}` +
        (timeline.overdue.length > 0
          ? `, and ${timeline.overdue.length} ${timeline.overdue.length === 1 ? "task is" : "tasks are"} already past the date they would ideally be done.`
          : `, which is enough time to work through the schedule below in order.`)
      : `${displayDate(timeline.eventDate)} has already passed, so the schedule below is shown ` +
        `for reference only.`,
  );

  return lines.join("\n");
}

function whatToDoFirst(plan: Plan): string {
  const { timeline } = plan;
  const lines = ["## What to do first", ""];

  // Overdue items first, then whatever is due within the week, then the next
  // few. Four items: a longer list is read as a schedule, not as a next action.
  const urgent = [
    ...timeline.overdue,
    ...timeline.tasks.filter((t) => t.status === "due-now"),
    ...timeline.tasks.filter((t) => t.status === "upcoming"),
  ].slice(0, 4);

  if (urgent.length === 0) {
    lines.push("There is nothing outstanding in the schedule.");
    return lines.join("\n");
  }

  for (const task of urgent) {
    const when =
      task.status === "overdue"
        ? `**now** — this would normally be done ${Math.abs(task.daysFromToday)} days ago`
        : task.status === "due-now"
          ? `**this week** — due ${displayDate(task.dueDate)}`
          : `by ${displayDate(task.dueDate)}`;
    lines.push(`- **${task.label}** — ${when}. ${task.why}`);
  }

  if (timeline.overdue.length > 4) {
    lines.push(
      "",
      `${timeline.overdue.length - urgent.filter((t) => t.status === "overdue").length} further ` +
        `overdue items are in the full schedule. Work down it in order rather than by what feels urgent.`,
    );
  }

  return lines.join("\n");
}

function ideasSection(plan: Plan): string {
  const { budget, input } = plan;
  const band = bandFor(budget.total / budget.benchmarkTypical);
  const ideas = ideasFor(input.eventType, band, input.cityTier).slice(0, 6);

  const lines = [
    "## Ideas for this celebration",
    "",
    band === "tight"
      ? "These are chosen for a budget that has to work hard. None of them is about spending less on everything — they are about spending nothing on the parts nobody remembers."
      : band === "moderate"
        ? "These suit a budget that is roughly in line with the market, where the question is where to put the attention rather than where to cut."
        : "With room above the typical cost, these are the places the surplus actually improves the day.",
    "",
  ];

  for (const idea of ideas) {
    lines.push(`- **${idea.title}.** ${idea.detail} *${idea.why}*`);
  }

  return lines.join("\n");
}

function whatToWatch(plan: Plan): string {
  const { budget, issues } = plan;
  const lines = ["## What to watch", ""];

  const nonBlockers = issues.filter((i) => i.severity !== "blocker");
  for (const issue of nonBlockers.slice(0, 3)) {
    lines.push(`- **${issue.title}.** ${issue.detail}`);
  }

  const underfunded = budget.lines.filter(
    (line) => line.verdict === "unrealistic" || line.verdict === "tight",
  );
  const generous = budget.lines.filter((line) => line.verdict === "generous");

  if (underfunded.length > 0 && generous.length > 0) {
    lines.push(
      `- **There is money in the wrong place.** ${generous
        .map((l) => l.label)
        .join(" and ")} ${generous.length === 1 ? "is" : "are"} above the usual range while ` +
        `${underfunded.map((l) => l.label).join(", ")} ${underfunded.length === 1 ? "is" : "are"} ` +
        `below it. Moving money between them costs nothing.`,
    );
  }

  lines.push(
    `- **The contingency is not spare money.** ${formatExact(budget.contingency)} is held back ` +
      `inside your ${formatExact(budget.total)}, not added on top of it. On an Indian celebration ` +
      `it gets used — extra guests, a ritual requirement nobody mentioned, transport. Spending it ` +
      `early is how a plan that balanced on paper stops balancing.`,
    `- **Get the per-head rate and the inclusions in writing.** A catering quote without a stated ` +
      `headcount, menu and service time is not a quote. The same is true of venue hire: ask what ` +
      `the overtime rate is before you need it.`,
  );

  return lines.join("\n");
}
