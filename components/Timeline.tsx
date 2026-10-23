import { displayDate, parseDate } from "@/lib/timeline";
import type { TimelinePlan, TimelineTask } from "@/lib/types";
import { StatusBadge, StatusDot } from "./Verdict";

/**
 * The schedule, as a spine.
 *
 * An ordered list down a single vertical rule, grouped by month, because the
 * order and the clustering are the information — seeing four tasks land in one
 * month is the thing that tells a planner that month is the hard one.
 *
 * Status is carried by a badge with a word in it, never by the dot colour alone.
 * The overdue count is also stated in prose above the list, so it reaches
 * someone who cannot see the spine at all.
 *
 * Every task says *why* it has its deadline. A planner deciding what to let slip
 * needs the reason; a date without one is just an instruction.
 */
export function Timeline({ timeline }: { timeline: TimelinePlan }) {
  const overdue = timeline.overdue.length;
  const groups = groupByMonth(timeline.tasks);

  return (
    <section aria-labelledby="timeline-heading" className="grid gap-5">
      <header>
        <h2 id="timeline-heading" className="text-2xl font-semibold sm:text-3xl">
          What to do, and when
        </h2>
        <p className="mt-1.5 max-w-2xl text-[var(--text-soft)]">
          {timeline.tasks.length} tasks, each dated backwards from{" "}
          {displayDate(timeline.eventDate)} by the lead time it actually needs. Dependencies are
          enforced, so nothing is scheduled before the thing it depends on.
          {overdue > 0 && (
            <>
              {" "}
              <strong className="text-[var(--text)]">
                {overdue} {overdue === 1 ? "task is" : "tasks are"} already past the date{" "}
                {overdue === 1 ? "it" : "they"} should have been done.
              </strong>
            </>
          )}
        </p>
      </header>

      <div className="card p-4 sm:p-6">
        <ol className="spine grid gap-3">
          {groups.map((group) => (
            <li key={group.key}>
              <h3 className="mb-3 text-xs font-bold tracking-widest uppercase text-[var(--accent)]">
                {group.label}
              </h3>
              <ol className="grid gap-3">
                {group.tasks.map((task) => (
                  <li key={task.id} className="avoid-break relative">
                    <StatusDot status={task.status} index={task.position} />
                    <div className="rounded-lg border bg-[var(--surface-sunken)] p-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <h4 className="font-semibold">{task.label}</h4>
                        <p className="nums flex items-center gap-2 text-sm whitespace-nowrap">
                          <span className="font-semibold">{displayDate(task.dueDate)}</span>
                          <StatusBadge status={task.status} />
                        </p>
                      </div>
                      <p className="mt-1 text-sm text-[var(--text-soft)]">
                        {task.status === "overdue"
                          ? `${Math.abs(task.daysFromToday)} ${Math.abs(task.daysFromToday) === 1 ? "day" : "days"} late. `
                          : task.status === "upcoming"
                            ? `In ${task.daysFromToday} ${task.daysFromToday === 1 ? "day" : "days"}. `
                            : ""}
                        {task.why}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

interface MonthGroup {
  key: string;
  label: string;
  tasks: (TimelineTask & { position: number })[];
}

/**
 * Group tasks by the month they fall in, preserving order.
 *
 * `position` is the task's index across the whole schedule, not within its
 * month, so the numbers down the spine run 1..n continuously. Numbering restarted
 * per month would make the list look shorter than it is.
 */
function groupByMonth(tasks: TimelineTask[]): MonthGroup[] {
  const groups: MonthGroup[] = [];

  tasks.forEach((task, index) => {
    const date = parseDate(task.dueDate);
    const key = task.dueDate.slice(0, 7);
    const label = date.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });

    const last = groups.at(-1);
    const entry = { ...task, position: index + 1 };
    if (last?.key === key) last.tasks.push(entry);
    else groups.push({ key, label, tasks: [entry] });
  });

  return groups;
}
