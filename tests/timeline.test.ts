/**
 * Date arithmetic and the backwards scheduler.
 *
 * Dates are the half of this product that is not money, and they fail more
 * quietly: a schedule that looks plausible but orders two tasks wrongly is not
 * visible until the day it matters.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tasksFor } from "../lib/knowledge/timelines";
import { addDays, buildTimeline, daysBetween, displayDate, formatDate, parseDate } from "../lib/timeline";
import { EVENT_TYPES, input, intBetween, pick, seeded, TODAY } from "./helpers";

describe("date arithmetic", () => {
  it("parses an ISO date as a UTC calendar day", () => {
    const date = parseDate("2027-02-14");
    assert.equal(date.getUTCFullYear(), 2027);
    assert.equal(date.getUTCMonth(), 1);
    assert.equal(date.getUTCDate(), 14);
  });

  it("rejects a day that does not exist instead of rolling it over", () => {
    // `new Date("2027-02-31")` silently becomes 3 March. A wedding date is not
    // something to silently move.
    assert.throws(() => parseDate("2027-02-31"), /does not exist/);
    assert.throws(() => parseDate("2027-13-01"), /does not exist|Invalid date/);
    assert.throws(() => parseDate("2027-04-31"), /does not exist/);
  });

  it("rejects malformed input", () => {
    for (const bad of ["", "14-02-2027", "2027/02/14", "next tuesday", "2027-2-4"]) {
      assert.throws(() => parseDate(bad), /Invalid date/, `accepted "${bad}"`);
    }
  });

  it("accepts a leap day in a leap year and rejects it otherwise", () => {
    assert.doesNotThrow(() => parseDate("2028-02-29"));
    assert.throws(() => parseDate("2027-02-29"), /does not exist/);
  });

  it("adds and subtracts whole days across month and year boundaries", () => {
    assert.equal(addDays("2026-10-22", 1), "2026-10-23");
    assert.equal(addDays("2026-10-31", 1), "2026-11-01");
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
    assert.equal(addDays("2027-01-01", -1), "2026-12-31");
    assert.equal(addDays("2028-02-28", 1), "2028-02-29");
    assert.equal(addDays("2027-02-28", 1), "2027-03-01");
  });

  it("round-trips any offset", () => {
    const random = seeded(31);
    for (let i = 0; i < 300; i += 1) {
      const offset = intBetween(random, -2_000, 2_000);
      const moved = addDays(TODAY, offset);
      assert.equal(addDays(moved, -offset), TODAY, `offset ${offset} did not round-trip`);
      assert.equal(daysBetween(TODAY, moved), offset);
    }
  });

  it("counts days between dates, negative when the target is earlier", () => {
    assert.equal(daysBetween("2026-10-22", "2026-10-22"), 0);
    assert.equal(daysBetween("2026-10-22", "2026-10-23"), 1);
    assert.equal(daysBetween("2026-10-23", "2026-10-22"), -1);
    assert.equal(daysBetween("2026-10-22", "2027-10-22"), 365);
  });

  it("is unaffected by a DST transition", () => {
    // UTC day arithmetic throughout, so a date near a clock change does not
    // shift by one. India has no DST, but a visitor's browser locale might.
    assert.equal(daysBetween("2027-03-13", "2027-03-15"), 2);
    assert.equal(daysBetween("2027-11-06", "2027-11-08"), 2);
  });

  it("formats a date for an Indian reader", () => {
    assert.equal(displayDate("2027-02-14"), "14 Feb 2027");
    assert.equal(displayDate("2026-12-01"), "1 Dec 2026");
  });

  it("formats a Date back to ISO", () => {
    assert.equal(formatDate(parseDate("2027-07-19")), "2027-07-19");
  });
});

describe("the scheduler", () => {
  it("dates every task backwards from the event", () => {
    const plan = input({ eventDate: "2027-07-19" });
    const timeline = buildTimeline(plan);

    for (const task of timeline.tasks) {
      assert.ok(
        daysBetween(task.dueDate, plan.eventDate) >= 0,
        `${task.id} is scheduled after the event`,
      );
    }
  });

  it("places a task at eventDate minus its lead time when nothing pulls it earlier", () => {
    const plan = input({ eventDate: "2028-01-01", eventType: "birthday" });
    const timeline = buildTimeline(plan);
    const templates = new Map(tasksFor("birthday").map((task) => [task.id, task]));

    for (const task of timeline.tasks) {
      const expected = addDays(plan.eventDate, -templates.get(task.id)!.leadDays);
      assert.ok(
        daysBetween(task.dueDate, expected) >= 0,
        `${task.id} is later than its lead time allows`,
      );
    }
  });

  it("keeps every dependency strictly before its dependent", () => {
    // The invariant the dependency pass exists for. Swept across event types and
    // dates, including dates so close that lead times collide.
    const random = seeded(2_026);
    for (let i = 0; i < 200; i += 1) {
      const eventType = pick(random, EVENT_TYPES);
      const plan = input({ eventType, eventDate: addDays(TODAY, intBetween(random, 1, 400)) });
      const timeline = buildTimeline(plan);
      const dueById = new Map(timeline.tasks.map((task) => [task.id, task.dueDate]));

      for (const task of timeline.tasks) {
        for (const dependency of task.dependsOn) {
          assert.ok(
            daysBetween(dueById.get(dependency)!, task.dueDate) > 0,
            `${eventType} on ${plan.eventDate}: ${dependency} (${dueById.get(dependency)}) ` +
              `is not before ${task.id} (${task.dueDate})`,
          );
        }
      }
    }
  });

  it("orders the list earliest first", () => {
    for (const eventType of EVENT_TYPES) {
      const timeline = buildTimeline(input({ eventType }));
      for (let i = 1; i < timeline.tasks.length; i += 1) {
        assert.ok(
          daysBetween(timeline.tasks[i - 1]!.dueDate, timeline.tasks[i]!.dueDate) >= 0,
          `${eventType} task ${i} is earlier than task ${i - 1}`,
        );
      }
    }
  });

  it("reports an impossible lead time as overdue instead of rescheduling it", () => {
    // A wedding in ten days cannot have its 240-day tasks done on time. The
    // scheduler says so rather than moving them to tomorrow to look tidy.
    const timeline = buildTimeline(input({ eventDate: addDays(TODAY, 10) }));
    assert.ok(timeline.overdue.length > 0, "no task was reported overdue");
    for (const task of timeline.overdue) {
      assert.ok(task.daysFromToday < 0, `${task.id} is overdue but not in the past`);
      assert.equal(task.status, "overdue");
    }
  });

  it("marks nothing overdue when there is ample notice", () => {
    const timeline = buildTimeline(input({ eventDate: addDays(TODAY, 400) }));
    assert.equal(timeline.overdue.length, 0);
  });

  it("classifies status at the documented boundaries", () => {
    const timeline = buildTimeline(input({ eventDate: addDays(TODAY, 400) }));
    for (const task of timeline.tasks) {
      const expected =
        task.daysFromToday < 0 ? "overdue" : task.daysFromToday <= 7 ? "due-now" : "upcoming";
      assert.equal(task.status, expected, `${task.id} at ${task.daysFromToday} days`);
    }
  });

  it("reports days available, negative for a past date", () => {
    assert.equal(buildTimeline(input({ eventDate: addDays(TODAY, 90) })).daysAvailable, 90);
    assert.equal(buildTimeline(input({ eventDate: addDays(TODAY, -5) })).daysAvailable, -5);
  });

  it("carries the reason forward onto every scheduled task", () => {
    const timeline = buildTimeline(input());
    for (const task of timeline.tasks) {
      assert.ok(task.why.length > 25, `${task.id} lost its reason`);
      assert.ok(task.label.length > 5, `${task.id} lost its label`);
    }
  });

  it("produces the same schedule for the same input, every time", () => {
    const plan = input({ eventDate: "2027-05-05", eventType: "community" });
    const first = buildTimeline(plan);
    const second = buildTimeline(plan);
    assert.deepEqual(first, second);
  });

  it("schedules every template task, losing none", () => {
    for (const eventType of EVENT_TYPES) {
      const timeline = buildTimeline(input({ eventType }));
      assert.equal(timeline.tasks.length, tasksFor(eventType).length, `${eventType} lost a task`);
    }
  });

  it("handles an event date in the past without throwing", () => {
    const timeline = buildTimeline(input({ eventDate: addDays(TODAY, -30) }));
    assert.ok(timeline.daysAvailable < 0);
    assert.equal(timeline.overdue.length, timeline.tasks.length);
  });
});
