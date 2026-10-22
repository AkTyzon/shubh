import { displayDate } from "@/lib/timeline";
import type { TaskStatus, TimelinePlan } from "@/lib/types";

/**
 * The computed schedule.
 *
 * An ordered list, because the order is the information. Each task carries the
 * date it is due, how far that is from today, and *why* it has to happen then —
 * a planner deciding what to let slip needs the reason, and a date without one
 * is just an instruction.
 *
 * Status is encoded in a word and a left border, never in colour alone. The
 * overdue count is also stated in prose above the list, so it is available to
 * someone who cannot see the borders at all.
 */

const STATUS_LABEL: Record<TaskStatus, string> = {
  overdue: "Overdue",
  "due-now": "This week",
  upcoming: "Upcoming",
};

const STATUS_BORDER: Record<TaskStatus, string> = {
  overdue: "border-l-[var(--color-bad)]",
  "due-now": "border-l-[var(--color-warn)]",
  upcoming: "border-l-[var(--border-strong)]",
};

export function TimelineList({ timeline }: { timeline: TimelinePlan }) {
  const overdue = timeline.overdue.length;

  return (
    <section aria-labelledby="timeline-heading" className="grid gap-4">
      <div>
        <h2 id="timeline-heading" className="font-serif text-2xl font-semibold">
          What to do, and when
        </h2>
        <p className="mt-1 text-[var(--text-soft)]">
          {timeline.tasks.length} tasks, each dated backwards from{" "}
          {displayDate(timeline.eventDate)} by how much lead time it actually needs. Dependencies
          are enforced, so nothing is scheduled before the thing it depends on.
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
      </div>

      <ol className="grid gap-2.5">
        {timeline.tasks.map((task, index) => (
          <li
            key={task.id}
            className={`avoid-break rounded-r-lg border border-l-4 bg-[var(--surface-raised)] p-3 ${STATUS_BORDER[task.status]}`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h3 className="font-semibold">
                <span className="nums mr-1.5 text-[var(--text-soft)]" aria-hidden="true">
                  {index + 1}.
                </span>
                {task.label}
              </h3>
              <p className="nums text-sm whitespace-nowrap">
                <span className="font-semibold">{displayDate(task.dueDate)}</span>
                <span className="text-[var(--text-soft)]">
                  {" · "}
                  {STATUS_LABEL[task.status]}
                  {task.status === "overdue"
                    ? ` by ${Math.abs(task.daysFromToday)} ${Math.abs(task.daysFromToday) === 1 ? "day" : "days"}`
                    : task.status === "upcoming"
                      ? ` in ${task.daysFromToday} ${task.daysFromToday === 1 ? "day" : "days"}`
                      : ""}
                </span>
              </p>
            </div>
            <p className="mt-1 text-sm text-[var(--text-soft)]">{task.why}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
