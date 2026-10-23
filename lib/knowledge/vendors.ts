/**
 * Vendor checklists.
 *
 * What to ask before you pay anyone, and what to get in writing.
 *
 * This is the part of planning where money is actually lost, and it is lost to
 * the same handful of omissions every time: a per-plate quote with no stated
 * headcount, a venue booking with no overtime rate, a photographer whose
 * delivery date was never agreed, an advance paid with no cancellation terms. By
 * the time any of these surface, the advance is gone.
 *
 * So each checklist is tied to a budget category and carries four things a
 * first-time planner cannot get from a vendor's brochure:
 *
 * - **Questions** to ask before committing, phrased the way you would say them.
 * - **In writing** — the clauses whose absence costs money later.
 * - **Red flags** that mean walk away, or at least slow down.
 * - **Payment** — what an advance normally looks like for this category, so an
 *   unusual demand is recognisable as unusual.
 *
 * None of it names a price. Prices come from `costs.ts` and the arithmetic in
 * `lib/budget.ts`; a figure written by hand here would be a number outside the
 * computed plan, which is the one thing this project does not do. Payment
 * guidance is therefore in percentages and milestones, never rupees.
 */

import { COST_CATEGORIES } from "./costs";
import type { EventTypeId } from "../types";

export interface VendorChecklist {
  /**
   * The budget category this spend comes out of, so the checklist sits beside
   * its money. Several checklists may share one category — a birthday cake and
   * the wider menu both come out of catering, and a community event's
   * permissions and safety arrangements both come out of logistics.
   */
  categoryId: string;
  /** What this kind of vendor is actually called when you go looking. */
  vendorName: string;
  /** Questions to ask before committing. */
  questions: string[];
  /** Clauses to get in writing. Their absence is what costs money later. */
  inWriting: string[];
  /** Signs to walk away, or at least to slow down. */
  redFlags: string[];
  /** What a normal payment schedule looks like for this category. */
  payment: string;
}

const CATERING: VendorChecklist = {
  categoryId: "catering",
  vendorName: "Caterer",
  questions: [
    "What is the per-plate rate, and at what headcount does it change?",
    "How many service counters and how many staff, for this guest count?",
    "Is there a tasting before I confirm, and is it charged?",
    "Who supplies crockery, cutlery, chafing dishes and water — you or me?",
    "What happens to the rate if the final count drops after I have confirmed?",
    "Are service staff, transport and fuel inside the per-plate rate or extra?",
  ],
  inWriting: [
    "The per-plate rate and the exact headcount it assumes.",
    "The full menu, item by item, including what counts as a 'live counter'.",
    "Service start and end times, and the overtime rate per hour beyond them.",
    "The date by which you must confirm the final headcount.",
    "Whether GST is included in the quoted rate or added to it.",
  ],
  redFlags: [
    "A quote with no headcount written on it. It is not a quote.",
    "Refusing a tasting, or charging a large fee for one.",
    "A per-plate rate well under the local market — the menu will shrink, not the margin.",
    "Vagueness about how many counters and staff will actually turn up.",
  ],
  payment:
    "Typically a modest booking advance, a larger instalment a week or two before, and " +
    "the balance on or just after the event. Resist paying most of it up front.",
};

const VENUE: VendorChecklist = {
  categoryId: "venue",
  vendorName: "Venue or banquet manager",
  questions: [
    "What is the seated capacity, and the capacity with a buffet laid out?",
    "How many hours does the booking cover, from setup to clear-out?",
    "Is there a generator, and will it actually run the lighting and air conditioning?",
    "How many cars can park on site, and who manages the entry flow?",
    "Can I bring my own caterer and decorator, or are they tied?",
    "Is there another function on the same day, before or after mine?",
  ],
  inWriting: [
    "The hours included, and the overtime rate per hour.",
    "The cancellation and date-change terms, with how much of the advance is refundable.",
    "Whether outside caterers and decorators are permitted, and any fee for them.",
    "Power backup, air conditioning and washroom provision as stated commitments.",
    "What the venue does if their own equipment fails on the day.",
  ],
  redFlags: [
    "A capacity figure that does not say whether it is seated or standing.",
    "No written cancellation terms, especially on a large advance.",
    "Reluctance to let you see the hall set up for a function of your size.",
    "Another event scheduled so close that setup and clear-out overlap.",
  ],
  payment:
    "A booking advance secures the date and is usually the least refundable money you " +
    "will pay. Get the cancellation terms before you transfer it, not after.",
};

const PHOTOGRAPHY: VendorChecklist = {
  categoryId: "photography",
  vendorName: "Photographer or studio",
  questions: [
    "Will the person whose portfolio I am looking at actually shoot my event?",
    "How many photographers and videographers, across which functions and hours?",
    "How many edited photographs do I receive, and by when?",
    "Do I get the unedited originals as well?",
    "What is your backup if you fall ill, and what if a camera fails mid-event?",
  ],
  inWriting: [
    "The names of the people shooting, not just the studio's.",
    "Which functions and which hours are covered.",
    "The number of edited images and the delivery deadline, with what happens if it slips.",
    "Whether raw files are included, and for how long they are retained.",
    "Usage rights — whether they may post your photographs publicly.",
  ],
  redFlags: [
    "A portfolio of someone else's work, shown as the studio's.",
    "No delivery deadline. This is the single most common complaint in this category.",
    "No answer to what happens if the lead shooter cannot attend.",
    "Being told the raw files are 'not usually given' with no reason.",
  ],
  payment:
    "Usually a booking advance, with the balance near or after delivery. Try to keep a " +
    "meaningful portion payable on delivery — it is the only leverage on the deadline.",
};

const DECOR: VendorChecklist = {
  categoryId: "decor",
  vendorName: "Decorator",
  questions: [
    "Can I see photographs of this exact setup at a venue of my size?",
    "Are the flowers fresh or artificial, and which parts are which?",
    "What time does setup begin, and is the venue's access window long enough?",
    "Is lighting included, and who supplies the power?",
    "Who clears it all away, and is that inside the quote?",
  ],
  inWriting: [
    "An itemised list: stage, entrance, seating, lighting, florals, each priced.",
    "Fresh versus artificial, stated per element.",
    "Setup and teardown times, and who pays if the venue charges for the extra hours.",
    "What is replaced, and how fast, if something is damaged or wilts before guests arrive.",
  ],
  redFlags: [
    "A single lump-sum price for 'decor' with no itemisation.",
    "Reference photographs that are clearly from a much larger or smaller venue.",
    "No mention of teardown — it is often charged separately, late.",
  ],
  payment:
    "Part on booking, the balance on setup day once you have seen it. Never settle in " +
    "full before the setup is standing.",
};

const PANDIT: VendorChecklist = {
  categoryId: "rituals",
  vendorName: "Pandit or priest",
  questions: [
    "How long will each ritual take, end to end?",
    "What samagri do you bring, and what should I buy myself?",
    "Which traditions do you follow, and does that match our family's?",
    "Can we agree the sequence and the timings a week beforehand?",
    "Will you come to the venue, and is travel included?",
  ],
  inWriting: [
    "The full samagri list, a week ahead, so you can buy it from the market yourself.",
    "The arrival time and the expected duration of each ritual.",
    "Whether dakshina is a fixed amount or at your discretion — agree it to avoid awkwardness.",
  ],
  redFlags: [
    "No clear answer on timings. Ceremonies running two hours over is the usual cause " +
      "of venue and catering overtime charges.",
    "Insisting on supplying all samagri through their own arrangement at a set fee.",
  ],
  payment:
    "Usually dakshina on the day. Agree the amount in advance anyway — a number discussed " +
    "calmly beforehand is better than one negotiated during a ceremony.",
};

const ENTERTAINMENT: VendorChecklist = {
  categoryId: "entertainment",
  vendorName: "DJ, band or sound hire",
  questions: [
    "How many hours of performance, and what is the hourly rate beyond that?",
    "Do you bring your own sound, lighting and operator?",
    "What volume limit does this venue have, and what is the local cut-off time?",
    "What is your backup if a speaker or mixer fails?",
    "Can we give you a playlist, and a do-not-play list?",
  ],
  inWriting: [
    "Performance hours, arrival time and the overtime rate.",
    "Exactly what equipment is included and who operates it.",
    "Who is responsible for noise permissions and the cut-off time.",
  ],
  redFlags: [
    "No backup equipment plan.",
    "Unwillingness to confirm the local noise cut-off in writing — the fine, and the " +
      "shutdown, land on you.",
  ],
  payment: "Part on booking, balance on the day. Hold back enough to matter until they have set up.",
};

const CAKE: VendorChecklist = {
  // The cake is bought out of the catering line, which is what it covers.
  categoryId: "catering",
  vendorName: "Baker",
  questions: [
    "Can I taste the flavour I am ordering before I confirm?",
    "Can you show photographs of cakes you have actually made, not a catalogue?",
    "How is it delivered, and how long can it sit out in this weather?",
    "Does it contain egg, gelatin or alcohol? Any nuts?",
    "What happens if it is damaged in transit?",
  ],
  inWriting: [
    "Flavour, size, servings and the design, with a reference photograph attached.",
    "The delivery time and who receives it at the venue.",
    "Allergens and whether it is eggless, stated plainly.",
  ],
  redFlags: [
    "A catalogue of designs with no photographs of their own work.",
    "No tasting offered for a large or expensive cake.",
    "Vagueness about allergens, when children will be eating it.",
  ],
  payment: "Usually most of it on order, balance on delivery. Confirm the delivery window in writing.",
};

const RETURN_GIFTS: VendorChecklist = {
  // Return gifts sit in the invitations line alongside cards and shagun envelopes.
  categoryId: "invitations",
  vendorName: "Gift supplier",
  questions: [
    "Can I see and handle a sample before ordering in quantity?",
    "What is the lead time, and what is the minimum order?",
    "Is packing included, and does the quantity include spares?",
    "Can I buy this directly rather than through the decorator or planner?",
  ],
  inWriting: [
    "Quantity, unit description and the delivery date.",
    "Whether packing and any personalisation are included.",
    "The return or replacement terms for damaged items.",
  ],
  redFlags: [
    "No physical sample. Photographs flatter return gifts more than any other category.",
    "Being routed through a planner or decorator who adds a margin on something guests " +
      "judge by recognisability rather than price.",
  ],
  payment: "Commonly part on order, balance on delivery, after you have opened a box and checked it.",
};

const INVITATIONS: VendorChecklist = {
  categoryId: "invitations",
  vendorName: "Printer or designer",
  questions: [
    "Will I see a physical proof before the full run is printed?",
    "What is the turnaround once I approve, and what is the reprint cost for a typo?",
    "Can you do a digital version from the same artwork?",
    "Is delivery or courier included?",
  ],
  inWriting: [
    "Quantity, paper, finish and the exact text, with a signed-off proof.",
    "The turnaround after approval, and who pays for a reprint and whose error it was.",
  ],
  redFlags: [
    "No physical proof before the run. A name misspelled across 300 cards is unrecoverable.",
    "No written approval step, so a typo becomes an argument rather than a reprint.",
  ],
  payment: "Usually most on order. Make the physical proof the trigger for the main payment.",
};

const PERMISSIONS: VendorChecklist = {
  // Permissions, security and cleaning are all the community logistics line.
  categoryId: "logistics",
  vendorName: "Local authority and police station",
  questions: [
    "What permission does a loudspeaker need here, and by when must it be applied for?",
    "What is the noise cut-off time, and is it different on a festival date?",
    "Who must apply — the society, or a named individual?",
    "Is a separate permission needed to use the ground or close the lane?",
    "What fire or safety clearance applies to a stage and a crowd this size?",
  ],
  inWriting: [
    "The permission itself, with its validity dates and the cut-off time on it.",
    "A copy kept on site on the day, with the name and number of whoever applied.",
    "Any conditions attached — crowd limits, exits, parking.",
  ],
  redFlags: [
    "Being told verbally that 'nobody checks'. A permission refused late cancels an event " +
      "that is otherwise fully paid for.",
    "No named person taking responsibility for holding the paperwork on the day.",
  ],
  payment:
    "Official fees only, paid against a receipt. Anything demanded without one is not a fee.",
};

const SAFETY: VendorChecklist = {
  categoryId: "logistics",
  vendorName: "Crowd, power and safety arrangements",
  questions: [
    "How many exits will be kept clear, and who is watching them?",
    "Where are the extinguishers, and does anyone present know how to use one?",
    "Is there a generator, and who is stationed at it?",
    "Who is the single named person watching the crowd rather than running the programme?",
    "Where is the nearest hospital, and who has the number?",
  ],
  inWriting: [
    "A rota with names and phone numbers for exits, queue, sound and clean-up.",
    "A simple site plan marking exits, extinguishers and the first-aid point.",
    "The generator hire terms, including who operates it.",
  ],
  redFlags: [
    "Exits blocked by stalls, seating or decor. This is the cause of most injuries at " +
      "neighbourhood festivals.",
    "An unmanaged queue for darshan or prasad.",
    "Nobody whose only job is to watch the crowd.",
  ],
  payment: "Mostly your own time. Budget for bins, a sweeper and extinguisher hire before the programme.",
};

const ATTIRE: VendorChecklist = {
  categoryId: "attire",
  vendorName: "Boutique, tailor or rental",
  questions: [
    "How many fittings are included, and when is the last one?",
    "What is the delivery date, and how much before the function is that?",
    "If it is rented, what is the damage and late-return policy?",
    "Can the blouse or kurta be altered later, or is it cut to final size?",
    "Is the jewellery insured while it is with me?",
  ],
  inWriting: [
    "The delivery date, with what happens if it is missed.",
    "The number of fittings included, and the charge for an extra one.",
    "For rentals: the return date, the damage policy and the security deposit terms.",
  ],
  redFlags: [
    "A delivery date inside the last week before the function, with no fitting after it.",
    "No written damage policy on rented jewellery or a heavy lehenga.",
    "A tailor who will not commit to a date in writing during wedding season.",
  ],
  payment:
    "Part on order, balance on final fitting. Keep the last instalment until the fit is " +
    "right — alterations stop happening once the money has gone.",
};

const GROOMING: VendorChecklist = {
  categoryId: "grooming",
  vendorName: "Makeup artist or salon",
  questions: [
    "Is there a trial, and is it charged separately?",
    "Will the artist from the trial be the one on the day?",
    "What time do you arrive, and how long do you need per person?",
    "How many family members are included, and what is the rate beyond that?",
    "Do you bring your own products, and can I see the brands?",
  ],
  inWriting: [
    "The arrival time and the time the bride will be ready by.",
    "How many people are included, and the per-head rate beyond that.",
    "The named artist, not just the salon.",
  ],
  redFlags: [
    "No trial offered for a bridal booking.",
    "A trial with one artist and a different one on the day.",
    "An arrival time that leaves no buffer before the muhurat.",
  ],
  payment: "Advance on booking, balance on the day. The trial is usually billed separately.",
};

const TRANSPORT: VendorChecklist = {
  categoryId: "logistics",
  vendorName: "Car hire, shuttle and guest rooms",
  questions: [
    "Is the rate per day or per kilometre, and what is included?",
    "Are the driver's food and night allowance inside the rate?",
    "What happens if the event runs late — is there an overtime charge?",
    "For guest rooms: what is the cancellation window on a block booking?",
    "Who is the one person a guest should call if their pickup does not arrive?",
  ],
  inWriting: [
    "The rate basis, the kilometres included and the charge beyond them.",
    "Driver allowances, tolls and parking — in or out.",
    "The cancellation window on any room block, and how many rooms can be released.",
  ],
  redFlags: [
    "A per-kilometre quote with no indication of the expected distance.",
    "A room block with no written release terms — you pay for empty rooms.",
    "No named contact for guests on the day.",
  ],
  payment:
    "Usually an advance to hold vehicles or rooms, balance after use. Hotels often allow " +
    "part of a block to be released free up to a stated date — get that date.",
};

/**
 * Checklists per event type.
 *
 * The same vendor is a different conversation at a different kind of event, but
 * the questions that matter are stable enough to share — so wedding and
 * community events reuse the catering and venue checklists rather than carrying
 * near-duplicates that would drift apart.
 */
export const VENDOR_CHECKLISTS: Record<EventTypeId, VendorChecklist[]> = {
  wedding: [
    VENUE,
    CATERING,
    PHOTOGRAPHY,
    DECOR,
    PANDIT,
    ENTERTAINMENT,
    ATTIRE,
    GROOMING,
    INVITATIONS,
    RETURN_GIFTS,
    TRANSPORT,
  ],
  birthday: [VENUE, CATERING, CAKE, DECOR, ENTERTAINMENT, PHOTOGRAPHY, INVITATIONS, RETURN_GIFTS],
  "griha-pravesh": [PANDIT, CATERING, DECOR, INVITATIONS],
  community: [PERMISSIONS, SAFETY, VENUE, CATERING, ENTERTAINMENT, DECOR],
};

export function checklistsFor(eventType: EventTypeId): VendorChecklist[] {
  return VENDOR_CHECKLISTS[eventType];
}

/** Every checklist whose spend comes out of one budget category. */
export function checklistsForCategory(
  eventType: EventTypeId,
  categoryId: string,
): VendorChecklist[] {
  return VENDOR_CHECKLISTS[eventType].filter((entry) => entry.categoryId === categoryId);
}

/**
 * Checklists must point at real categories, and none may name a price.
 *
 * The category check earns its place: four checklists originally referenced
 * categories that did not exist -- a birthday "cake" line, wedding
 * "return-gifts", community "permissions" and "safety" -- because those costs
 * actually sit inside catering, invitations and logistics. Nothing failed; the
 * checklists simply would not have rendered beside their money.
 *
 * The price check is the same rule the rest of the project follows: a rupee
 * figure written by hand here would be a number in front of the user that the
 * computed plan does not contain, and output verification would then be
 * inconsistent with the page it sits on. Payment guidance is in milestones.
 */
function assertChecklistsSound(): void {
  for (const [eventType, checklists] of Object.entries(VENDOR_CHECKLISTS)) {
    if (checklists.length === 0) {
      throw new Error(`No vendor checklists for "${eventType}".`);
    }

    const categoryIds = new Set(
      COST_CATEGORIES[eventType as EventTypeId].map((category) => category.id),
    );
    const names = new Set<string>();

    for (const checklist of checklists) {
      if (!categoryIds.has(checklist.categoryId)) {
        throw new Error(
          `Vendor checklist "${checklist.vendorName}" for "${eventType}" points at category ` +
            `"${checklist.categoryId}", which does not exist. It would never render beside ` +
            `its budget line.`,
        );
      }

      if (names.has(checklist.vendorName)) {
        throw new Error(
          `Two "${eventType}" checklists are both called "${checklist.vendorName}".`,
        );
      }
      names.add(checklist.vendorName);

      const text = [
        checklist.vendorName,
        checklist.payment,
        ...checklist.questions,
        ...checklist.inWriting,
        ...checklist.redFlags,
      ].join(" ");

      if (/₹|\bRs\.?\s*\d|\blakh\b|\bcrore\b/i.test(text)) {
        throw new Error(
          `Vendor checklist "${checklist.vendorName}" names a price. Payment guidance must ` +
            `be in percentages and milestones -- every rupee figure comes from the computed plan.`,
        );
      }
    }
  }
}

assertChecklistsSound();
