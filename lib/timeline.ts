/**
 * Timeline scheduling.
 *
 * Dates are computed backwards from the event, in code. A language model asked
 * for a wedding schedule will produce one that looks right and quietly contains
 * "book the caterer three weeks before" for a date in peak season, or orders two
 * tasks the wrong way round. Neither is visible until it is too late to fix.
 *
 * Two rules the scheduler enforces that a generated list does not:
 *
 * 1. **Dependencies stay ordered.** If a task's computed date lands on or after
 *    something it depends on, it is pulled earlier. Booking a venue before
 *    fixing the date is not a plan.
 * 2. **Impossibility is reported, not absorbed.** When the lead time no longer
 *    fits before the event, the task is marked overdue with the shortfall in
 *    days, rather than silently rescheduled to tomorrow to keep the list tidy.
 *
 * All arithmetic is in whole calendar days in UTC. Using UTC avoids a class of
 * off-by-one where a date near midnight shifts by a day depending on where the
 * reader is -- and for a wedding date, a day matters.
 */

import { tasksFor } from "./knowledge/timelines";
import type { IsoDate, PlanInput, TimelinePlan, TimelineTask } from "./types";

const MS_PER_DAY = 86_400_000;

/** Parse `YYYY-MM-DD` as a UTC calendar day. */
export function parseDate(iso: IsoDate): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) throw new Error(`Invalid date "${iso}". Expected YYYY-MM-DD.`);
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  // Catches 2026-02-31, which Date would roll over to 3 March without complaint.
  if (date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) {
    throw new Error(`Invalid date "${iso}": that day does not exist.`);
  }
  return date;
}

export function formatDate(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  return formatDate(new Date(parseDate(iso).getTime() + days * MS_PER_DAY));
}

/** Whole days from `from` to `to`. Negative when `to` is earlier. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / MS_PER_DAY);
}

/** Human-friendly date, e.g. "14 Feb 2027". */
export function displayDate(iso: IsoDate): string {
  return parseDate(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Build the schedule.
 *
 * Each task starts at `eventDate - leadDays`, then a dependency pass pulls any
 * task that would otherwise land on or after one of its prerequisites. The pass
 * repeats until stable; the task graph is validated acyclic at load, so this
 * terminates.
 */
export function buildTimeline(input: PlanInput): TimelinePlan {
  const templates = tasksFor(input.eventType);
  const dueDates = new Map<string, IsoDate>();

  for (const task of templates) {
    dueDates.set(task.id, addDays(input.eventDate, -task.leadDays));
  }

  // Enforce ordering. Bounded by the task count: each pass moves at least one
  // task earlier or the schedule is already consistent.
  for (let pass = 0; pass < templates.length; pass += 1) {
    let changed = false;
    for (const task of templates) {
      for (const dependencyId of task.dependsOn) {
        const parentDue = dueDates.get(dependencyId)!;
        const ownDue = dueDates.get(task.id)!;
        if (daysBetween(parentDue, ownDue) <= 0) {
          // Pull the prerequisite a day earlier than its dependent.
          dueDates.set(dependencyId, addDays(ownDue, -1));
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  const tasks: TimelineTask[] = templates
    .map((template) => {
      const dueDate = dueDates.get(template.id)!;
      const daysFromToday = daysBetween(input.today, dueDate);
      return {
        id: template.id,
        label: template.label,
        why: template.why,
        categoryId: template.categoryId,
        leadDays: template.leadDays,
        dependsOn: template.dependsOn,
        dueDate,
        daysFromToday,
        status: statusFor(daysFromToday),
      };
    })
    // Earliest first: a planner reads a schedule in the order they must act.
    .sort((a, b) => daysBetween(b.dueDate, a.dueDate) || a.label.localeCompare(b.label));

  return {
    eventDate: input.eventDate,
    tasks,
    daysAvailable: daysBetween(input.today, input.eventDate),
    overdue: tasks.filter((task) => task.status === "overdue"),
  };
}

/** Within a week counts as due now: it needs attention this week, not "later". */
function statusFor(daysFromToday: number): TimelineTask["status"] {
  if (daysFromToday < 0) return "overdue";
  if (daysFromToday <= 7) return "due-now";
  return "upcoming";
}
