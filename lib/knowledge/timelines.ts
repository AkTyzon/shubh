/**
 * What has to happen before a celebration, and how long before.
 *
 * Lead times are the part people get wrong. A caterer does not need "a few
 * weeks" — a wedding kitchen needs its final headcount far enough ahead to buy
 * and staff for it, and a good photographer in season is booked months out. When
 * a plan ignores that, nothing looks broken until the day it is too late to fix.
 *
 * So each task carries the number of days before the event it must be done, and
 * *why* — a planner deciding what to let slip needs the reason, not just a date.
 * Dependencies are declared explicitly and validated to be acyclic at load.
 *
 * Lead times assume a reasonably busy season. They are deliberately a little
 * conservative: being early costs nothing, being late can cost the venue.
 */

import type { EventTypeId } from "../types";

export interface TaskTemplate {
  id: string;
  label: string;
  why: string;
  /** Days before the event by which this should be complete. */
  leadDays: number;
  /** Task ids that must complete before this one can. */
  dependsOn: string[];
  /** Budget category this task books, where there is one. */
  categoryId?: string;
}

const WEDDING: TaskTemplate[] = [
  {
    id: "budget-set",
    label: "Agree the total budget and who is contributing",
    why: "Every other decision is downstream of this number. Agreeing it late is how families end up overcommitted.",
    leadDays: 240,
    dependsOn: [],
  },
  {
    id: "guest-list",
    label: "Draft the guest list and agree a cap",
    why: "Catering and venue are both priced off the headcount, so the list sets most of the budget.",
    leadDays: 220,
    dependsOn: ["budget-set"],
  },
  {
    id: "date-fix",
    label: "Fix the date with the family and the pandit",
    why: "Auspicious dates are limited and venues fill on them first.",
    leadDays: 210,
    dependsOn: ["budget-set"],
  },
  {
    id: "venue-book",
    label: "Book the venue and pay the advance",
    why: "The single hardest thing to change later, and the first to be taken on a popular date.",
    leadDays: 180,
    dependsOn: ["date-fix", "guest-list"],
    categoryId: "venue",
  },
  {
    id: "photographer-book",
    label: "Book the photographer and videographer",
    why: "Good teams take one wedding a day and are booked months ahead in season.",
    leadDays: 150,
    dependsOn: ["date-fix"],
    categoryId: "photography",
  },
  {
    id: "caterer-shortlist",
    label: "Shortlist caterers and attend tastings",
    why: "A tasting tells you more than any menu card, and it takes time to arrange.",
    leadDays: 120,
    dependsOn: ["venue-book"],
    categoryId: "catering",
  },
  {
    id: "attire-order",
    label: "Order outfits for the couple",
    why: "Tailored and embroidered pieces take weeks, and fittings need slack for alterations.",
    leadDays: 110,
    dependsOn: ["budget-set"],
    categoryId: "attire",
  },
  {
    id: "caterer-book",
    label: "Confirm the caterer and the menu",
    why: "Locks your largest single cost, and the kitchen needs lead time for a date in season.",
    leadDays: 90,
    dependsOn: ["caterer-shortlist"],
    categoryId: "catering",
  },
  {
    id: "decor-book",
    label: "Confirm the decorator and the mandap design",
    why: "Flowers and structures are ordered in advance, and good decorators hold limited dates.",
    leadDays: 75,
    dependsOn: ["venue-book"],
    categoryId: "decor",
  },
  {
    id: "makeup-book",
    label: "Book makeup and hair",
    why: "Senior artists take one bride a day; a trial should happen well before the date.",
    leadDays: 75,
    dependsOn: ["date-fix"],
    categoryId: "grooming",
  },
  {
    id: "invites-print",
    label: "Finalise and print invitations",
    why: "Printing and any foiling takes a fortnight, before you have even started delivering.",
    leadDays: 70,
    dependsOn: ["guest-list", "venue-book"],
    categoryId: "invitations",
  },
  {
    id: "entertainment-book",
    label: "Book DJ, dhol and any performers",
    why: "Sound and baraat acts are shared across weddings on the same evening.",
    leadDays: 60,
    dependsOn: ["venue-book"],
    categoryId: "entertainment",
  },
  {
    id: "invites-send",
    label: "Send invitations",
    why: "Outstation guests need time to book travel and leave.",
    leadDays: 45,
    dependsOn: ["invites-print"],
  },
  {
    id: "rooms-block",
    label: "Block rooms for outstation guests",
    why: "Hotels near the venue fill up with your own guest list competing for them.",
    leadDays: 45,
    dependsOn: ["venue-book"],
    categoryId: "logistics",
  },
  {
    id: "pandit-book",
    label: "Confirm the pandit and the ritual list",
    why: "The ritual sequence determines the timing of the whole day.",
    leadDays: 40,
    dependsOn: ["date-fix"],
    categoryId: "rituals",
  },
  {
    id: "rsvp-chase",
    label: "Chase RSVPs and firm up the headcount",
    why: "The caterer needs a real number, and a guessed one is paid for either way.",
    leadDays: 21,
    dependsOn: ["invites-send"],
  },
  {
    id: "headcount-final",
    label: "Give the caterer the final headcount",
    why: "This is the number you are billed on. Most contracts fix it about a week out.",
    leadDays: 10,
    dependsOn: ["rsvp-chase", "caterer-book"],
  },
  {
    id: "payments-schedule",
    label: "Schedule the remaining vendor payments",
    why: "Balances usually fall due on or just before the day; nobody wants that unplanned.",
    leadDays: 7,
    dependsOn: ["caterer-book", "decor-book", "photographer-book"],
  },
  {
    id: "run-sheet",
    label: "Share a run sheet with vendors and family",
    why: "One written timing sheet prevents most of what goes wrong on the day.",
    leadDays: 3,
    dependsOn: ["headcount-final", "pandit-book"],
  },
];

const BIRTHDAY: TaskTemplate[] = [
  {
    id: "budget-set",
    label: "Set the budget and the guest count",
    why: "Food is usually the largest cost and it is priced per head.",
    leadDays: 45,
    dependsOn: [],
  },
  {
    id: "venue-book",
    label: "Book the venue or confirm the home setup",
    why: "Weekend slots at party venues and clubhouses go early.",
    leadDays: 30,
    dependsOn: ["budget-set"],
    categoryId: "venue",
  },
  {
    id: "theme-pick",
    label: "Pick the theme",
    why: "Decor, cake and return gifts all follow from it, so deciding late delays everything.",
    leadDays: 28,
    dependsOn: ["budget-set"],
    categoryId: "decor",
  },
  {
    id: "invites-send",
    label: "Send invitations",
    why: "Parents need notice, especially on a weekend.",
    leadDays: 21,
    dependsOn: ["venue-book", "theme-pick"],
    categoryId: "invitations",
  },
  {
    id: "entertainment-book",
    label: "Book the host, magician or activities",
    why: "Good children's entertainers are booked out on weekends.",
    leadDays: 21,
    dependsOn: ["theme-pick"],
    categoryId: "entertainment",
  },
  {
    id: "cake-order",
    label: "Order the cake",
    why: "Custom cakes need several days, and themed ones longer.",
    leadDays: 12,
    dependsOn: ["theme-pick"],
    categoryId: "catering",
  },
  {
    id: "caterer-book",
    label: "Confirm the menu and caterer",
    why: "Locks the per-head cost against a real headcount.",
    leadDays: 10,
    dependsOn: ["venue-book"],
    categoryId: "catering",
  },
  {
    id: "decor-book",
    label: "Confirm decor and return gifts",
    why: "Balloon and backdrop setups are booked by the slot.",
    leadDays: 10,
    dependsOn: ["theme-pick"],
    categoryId: "decor",
  },
  {
    id: "headcount-final",
    label: "Confirm the final headcount",
    why: "Catering and return gifts are both billed on it.",
    leadDays: 4,
    dependsOn: ["invites-send", "caterer-book"],
  },
  {
    id: "run-sheet",
    label: "Plan the running order for the day",
    why: "Cake, games and food in a sensible sequence keeps a room of children manageable.",
    leadDays: 2,
    dependsOn: ["headcount-final"],
  },
];

const GRIHA_PRAVESH: TaskTemplate[] = [
  {
    id: "muhurat",
    label: "Fix the muhurat with the pandit",
    why: "The auspicious window sets the timing of the entire day.",
    leadDays: 30,
    dependsOn: [],
    categoryId: "rituals",
  },
  {
    id: "guest-list",
    label: "Decide who to invite",
    why: "Food and prasad quantities follow from the count.",
    leadDays: 25,
    dependsOn: ["muhurat"],
  },
  {
    id: "pandit-book",
    label: "Confirm the pandit and the samagri list",
    why: "The puja list tells you exactly what to buy, and some items are not in every shop.",
    leadDays: 18,
    dependsOn: ["muhurat"],
    categoryId: "rituals",
  },
  {
    id: "invites-send",
    label: "Invite family and neighbours",
    why: "A morning muhurat often means guests need to plan leave.",
    leadDays: 14,
    dependsOn: ["guest-list"],
    categoryId: "invitations",
  },
  {
    id: "caterer-book",
    label: "Arrange the food",
    why: "Whether catered or cooked at home, quantities need a firm count.",
    leadDays: 10,
    dependsOn: ["guest-list"],
    categoryId: "catering",
  },
  {
    id: "samagri-buy",
    label: "Buy puja samagri and provisions",
    why: "Some items only come from specific shops; leaving it to the last day is risky.",
    leadDays: 5,
    dependsOn: ["pandit-book"],
    categoryId: "rituals",
  },
  {
    id: "decor-ready",
    label: "Prepare decor, rangoli and entrance",
    why: "Fresh flowers and rangoli are done the evening before or that morning.",
    leadDays: 1,
    dependsOn: ["samagri-buy"],
    categoryId: "decor",
  },
];

const COMMUNITY: TaskTemplate[] = [
  {
    id: "committee",
    label: "Form the organising committee and agree the budget",
    why: "Shared events need named owners or tasks fall between people.",
    leadDays: 60,
    dependsOn: [],
  },
  {
    id: "permissions",
    label: "Apply for police and municipal permissions",
    why: "Loudspeaker and public-gathering permissions take time and have cut-offs, including noise-hour rules.",
    leadDays: 45,
    dependsOn: ["committee"],
    categoryId: "logistics",
  },
  {
    id: "venue-book",
    label: "Book the ground or hall and the tentage",
    why: "Festival season demand for grounds and tentage is the tightest constraint there is.",
    leadDays: 40,
    dependsOn: ["committee"],
    categoryId: "venue",
  },
  {
    id: "programme",
    label: "Fix the programme and invite performers",
    why: "Performers and anchors need the date well ahead, especially in festival season.",
    leadDays: 30,
    dependsOn: ["venue-book"],
    categoryId: "entertainment",
  },
  {
    id: "sound-book",
    label: "Book sound, lighting and the stage",
    why: "One supplier serves many societies on the same festival night.",
    leadDays: 25,
    dependsOn: ["venue-book"],
    categoryId: "entertainment",
  },
  {
    id: "contributions",
    label: "Collect contributions from residents",
    why: "Vendors want advances, and collection always takes longer than expected.",
    leadDays: 21,
    dependsOn: ["committee"],
  },
  {
    id: "caterer-book",
    label: "Confirm food and prasad arrangements",
    why: "Quantities depend on attendance, which for a society event is a judgement call.",
    leadDays: 14,
    dependsOn: ["contributions"],
    categoryId: "catering",
  },
  {
    id: "publicity",
    label: "Put up notices and share the programme",
    why: "Attendance depends on people knowing early enough to keep the evening free.",
    leadDays: 10,
    dependsOn: ["programme"],
  },
  {
    id: "safety",
    label: "Arrange security, first aid and cleaning",
    why: "Crowd safety and the clean-up afterwards are both conditions of most permissions.",
    leadDays: 7,
    dependsOn: ["permissions"],
    categoryId: "logistics",
  },
  {
    id: "run-sheet",
    label: "Share the run sheet with volunteers",
    why: "Volunteers need to know their slot without being chased on the day.",
    leadDays: 2,
    dependsOn: ["publicity", "sound-book"],
  },
];

export const TASK_TEMPLATES: Record<EventTypeId, TaskTemplate[]> = {
  wedding: WEDDING,
  birthday: BIRTHDAY,
  "griha-pravesh": GRIHA_PRAVESH,
  community: COMMUNITY,
};

/**
 * Validate the task graphs at module load.
 *
 * Three things must hold, and all three are the sort of mistake that would
 * otherwise surface as a subtly wrong schedule rather than an error:
 * every dependency must exist, the graph must be acyclic, and a task must never
 * be scheduled earlier than something it depends on.
 */
function assertTaskGraphsValid(): void {
  for (const [eventType, tasks] of Object.entries(TASK_TEMPLATES)) {
    const byId = new Map(tasks.map((t) => [t.id, t]));

    for (const task of tasks) {
      for (const dep of task.dependsOn) {
        const parent = byId.get(dep);
        if (!parent) {
          throw new Error(`Task "${task.id}" in "${eventType}" depends on unknown task "${dep}".`);
        }
        // A dependency must finish earlier, i.e. have a LARGER lead time.
        if (parent.leadDays <= task.leadDays) {
          throw new Error(
            `Task "${task.id}" (${task.leadDays}d) in "${eventType}" depends on "${dep}" ` +
              `(${parent.leadDays}d), which is not scheduled earlier.`,
          );
        }
      }
    }

    // Cycle detection. The lead-time check above makes a cycle nearly
    // impossible, but "nearly" is not a guarantee worth relying on.
    const visiting = new Set<string>();
    const done = new Set<string>();
    const visit = (id: string, trail: string[]): void => {
      if (done.has(id)) return;
      if (visiting.has(id)) {
        throw new Error(`Dependency cycle in "${eventType}": ${[...trail, id].join(" -> ")}`);
      }
      visiting.add(id);
      for (const dep of byId.get(id)?.dependsOn ?? []) visit(dep, [...trail, id]);
      visiting.delete(id);
      done.add(id);
    };
    for (const task of tasks) visit(task.id, []);
  }
}

assertTaskGraphsValid();

export function tasksFor(eventType: EventTypeId): TaskTemplate[] {
  return TASK_TEMPLATES[eventType];
}

/** The longest lead time for an event type — the minimum comfortable notice. */
export function minimumNoticeDays(eventType: EventTypeId): number {
  return Math.max(...TASK_TEMPLATES[eventType].map((t) => t.leadDays));
}
