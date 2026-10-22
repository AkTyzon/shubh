/**
 * Curated celebration ideas.
 *
 * These are the suggestions the product falls back on when no language model is
 * configured, and the reason the app is genuinely useful with zero API keys
 * rather than just non-crashing.
 *
 * They are written, not generated, and that is the point. Each one is tagged with
 * the budget band it actually suits, because the useful advice at ₹400 a head is
 * the opposite of the useful advice at ₹2,500 a head, and a suggestion list that
 * ignores the budget is the thing people complain about when they try an AI
 * planner. Each carries a `why` — a suggestion a planner cannot evaluate is just
 * noise.
 *
 * None of them names a price. Prices come from `costs.ts` and the arithmetic in
 * `lib/budget.ts`; mixing figures into prose written by hand would put numbers
 * outside the computed plan, which is exactly what this project refuses to do.
 */

import type { CityTier, EventTypeId } from "../types";

/**
 * Which band a plan falls in, as a fraction of the typical market total.
 *
 * `tight` is where most first-time planners actually are, so it gets the most
 * ideas.
 */
export type BudgetBand = "tight" | "moderate" | "generous";

export interface Idea {
  id: string;
  title: string;
  detail: string;
  /** Why this is worth doing, in terms a planner can weigh. */
  why: string;
  /** Bands this suits. An idea listed for all three is genuinely universal. */
  bands: BudgetBand[];
  /** Restrict to certain city tiers where availability actually differs. */
  tiers?: CityTier[];
}

const WEDDING: Idea[] = [
  {
    id: "haldi-at-home",
    title: "Hold the haldi at home instead of at a venue",
    detail:
      "Terrace, courtyard or building society hall, with marigold strings and a few dhols. " +
      "The function that photographs best is usually the one with the least staging.",
    why: "Removes a full day of venue hire and catering from the budget while losing nothing people remember.",
    bands: ["tight", "moderate"],
  },
  {
    id: "weekday-offseason",
    title: "Ask every venue for a weekday and off-season rate",
    detail:
      "The same hall on a Tuesday in July against a Saturday in November is often a different " +
      "price entirely. Ask for both quotes in writing before you say which date you want.",
    why: "Date and day of week are the cheapest levers you have; they cost you nothing but flexibility.",
    bands: ["tight", "moderate", "generous"],
  },
  {
    id: "limited-live-counters",
    title: "Two live counters, not six",
    detail:
      "Pick a chaat counter and one regional counter the family is known for, and put the rest " +
      "of the menu on the buffet. Guests queue at live counters regardless of how many there are.",
    why: "Live counters are priced per counter per hour, and the marginal ones are rarely finished.",
    bands: ["tight", "moderate"],
  },
  {
    id: "sangeet-at-home",
    title: "Make the sangeet a family production rather than a produced show",
    detail:
      "Cousins' performances, a borrowed speaker and a playlist. Choreographers and event " +
      "managers are worth it for a large reception, less so for an evening among people who know each other.",
    why: "The most expensive part of a sangeet is usually the production, not the evening itself.",
    bands: ["tight", "moderate"],
  },
  {
    id: "photographer-over-decor",
    title: "If you have to choose, put the money in photography over decor",
    detail:
      "Decor lasts one evening and is seen by people who were already there. The photographs " +
      "are what the family actually keeps.",
    why: "Of all the wedding line items, this is the one people say afterwards they wish they had spent more on.",
    bands: ["tight", "moderate"],
  },
  {
    id: "regional-menu",
    title: "Build the menu around one region, done properly",
    detail:
      "A full Malvani, Chettinad, Awadhi or Rajasthani spread, cooked by someone who actually " +
      "cooks it, reads as more generous than a multi-cuisine buffet at the same price.",
    why: "Caterers price breadth, not quality. Narrowing the menu buys you better food for the same money.",
    bands: ["tight", "moderate", "generous"],
  },
  {
    id: "invite-digital",
    title: "Digital invitations for everyone except the elders",
    detail:
      "A well-made WhatsApp invitation with the venue pin, plus thirty printed cards hand-delivered " +
      "to the relatives for whom a card matters.",
    why: "Printing and courier for a full list is a surprisingly large line, and most of it is thrown away.",
    bands: ["tight", "moderate"],
  },
  {
    id: "mehendi-artists-count",
    title: "Count the mehendi artists against the guest list, not the hours",
    detail:
      "One artist manages roughly eight to ten pairs of hands in an evening. Book to the number " +
      "of women attending, not to a block of time.",
    why: "The usual mehendi complaint is a queue that never clears, which is an arithmetic problem, not a budget one.",
    bands: ["tight", "moderate", "generous"],
  },
  {
    id: "guest-transport",
    title: "Arrange one shuttle rather than paying for parking chaos",
    detail:
      "A single hired bus from a landmark near the station, with one family member on it, " +
      "solves arrival for out-of-town guests.",
    why: "Cheaper than valet at a metro venue, and it removes the most common source of guests arriving late and annoyed.",
    bands: ["moderate", "generous"],
    tiers: ["metro", "tier1"],
  },
  {
    id: "pandit-brief",
    title: "Brief the pandit on timing, out loud, a week before",
    detail:
      "Agree how long each ritual will take and what can be shortened. Write the sequence down " +
      "and give a copy to whoever is managing the day.",
    why: "Ceremonies running two hours over is the single most common reason catering and venue overtime charges appear.",
    bands: ["tight", "moderate", "generous"],
  },
  {
    id: "return-gift-local",
    title: "One good local thing as a return gift, in quantity",
    detail:
      "Kolhapuri chappals, brass diyas, a regional sweet from a named shop. Bought directly " +
      "and in bulk rather than through the decorator.",
    why: "Return gifts bought through a vendor carry a margin on something guests judge by recognisability, not price.",
    bands: ["moderate", "generous"],
  },
  {
    id: "generous-guest-comfort",
    title: "Spend the surplus on guest comfort, not more decor",
    detail:
      "Cooling or heating that actually works, enough seating for the elderly, clean and staffed " +
      "washrooms, and water stations away from the buffet queue.",
    why: "These are what guests remember as a wedding being well run, and they are rarely in the first draft of a budget.",
    bands: ["generous"],
  },
];

const BIRTHDAY: Idea[] = [
  {
    id: "home-party",
    title: "At home, with the furniture moved out",
    detail:
      "For under about twenty children, a cleared living room beats a play zone. Borrow folding " +
      "chairs rather than hiring them.",
    why: "Venue hire for a children's party is usually the largest line and the least remembered.",
    bands: ["tight"],
  },
  {
    id: "one-strong-theme",
    title: "One theme, carried by three things",
    detail:
      "A backdrop, the cake and the return gifts. Themed cutlery, napkins and danglers add cost " +
      "without adding to what anyone notices.",
    why: "Theme cost scales with the number of themed objects; impact does not.",
    bands: ["tight", "moderate"],
  },
  {
    id: "games-over-entertainer",
    title: "A run sheet of games instead of a hired entertainer",
    detail:
      "Six games, in order, with prizes bought in bulk and one adult running them. Forty minutes " +
      "of structure is what stops a party drifting.",
    why: "Children's parties fail from unstructured time, not from a shortage of professional entertainment.",
    bands: ["tight", "moderate"],
  },
  {
    id: "cake-separate",
    title: "Order the cake from a baker, not the caterer",
    detail: "Pick the baker on taste and photographs of their actual work, not on a catalogue of designs.",
    why: "A caterer's cake is usually a marked-up outsourced cake, and it is the one thing everybody tastes.",
    bands: ["tight", "moderate", "generous"],
  },
  {
    id: "food-for-adults",
    title: "Feed the adults properly, keep the children's menu simple",
    detail:
      "Children eat very little at parties. Chaat, sandwiches and one hot snack covers them; put " +
      "the catering money into food the accompanying parents will actually eat.",
    why: "Half the headcount at a child's party is adults, and they are the half that notices the food.",
    bands: ["tight", "moderate", "generous"],
  },
  {
    id: "afternoon-slot",
    title: "An afternoon slot, not an evening one",
    detail: "Four to seven works better for children and is the cheaper slot at nearly every venue.",
    why: "Evening slots are priced for adult functions, and tired children are a worse party.",
    bands: ["tight", "moderate"],
  },
  {
    id: "photographer-hour",
    title: "Book a photographer for one hour, not the whole party",
    detail: "The cake, the group photograph and the first twenty minutes. Phones cover the rest.",
    why: "Most of a children's party is not photogenic, and hourly rates make the coverage affordable.",
    bands: ["moderate", "generous"],
  },
  {
    id: "return-gift-useful",
    title: "A return gift that survives the week",
    detail: "A book, a plant in a small pot, a decent set of colours. Not a plastic assortment.",
    why: "Parents notice return gifts more than children do, and the useful ones cost about the same.",
    bands: ["moderate", "generous"],
  },
];

const GRIHA_PRAVESH: Idea[] = [
  {
    id: "muhurat-first",
    title: "Fix the muhurat before anything else",
    detail:
      "Everything on the day works backwards from it, including when the cooking has to start " +
      "and when guests should be told to arrive.",
    why: "A muhurat changed late invalidates the catering timing, the invitations and often the pandit's availability.",
    bands: ["tight", "moderate", "generous"],
  },
  {
    id: "puja-samagri-list",
    title: "Get the samagri list from the pandit in writing",
    detail:
      "Ask for the full list a week ahead and buy it yourself. A kalash, mango leaves, a coconut, " +
      "haldi-kumkum, a new broom, milk for the boil-over.",
    why: "Buying samagri through an arranged package costs several times buying it from the market yourself.",
    bands: ["tight", "moderate", "generous"],
  },
  {
    id: "home-cooked",
    title: "Cook at home or use a tiffin service, not a caterer",
    detail:
      "For thirty to fifty people a good local tiffin or mess kitchen does a full satvik meal " +
      "well. Serve on steel or leaf plates.",
    why: "Caterer minimums are set for far larger events, so a small function pays for capacity it does not use.",
    bands: ["tight", "moderate"],
  },
  {
    id: "flowers-market",
    title: "Buy flowers from the wholesale market that morning",
    detail:
      "Marigold strings, a rangoli at the door and banana stems at the frame. Done by the family " +
      "in an hour.",
    why: "Decorators charge for labour on something the family can genuinely do, and fresher flowers look better.",
    bands: ["tight", "moderate"],
  },
  {
    id: "neighbour-invite",
    title: "Invite the immediate neighbours, even briefly",
    detail: "A sweet box and ten minutes. You are going to live next to these people.",
    why: "The cheapest line in the whole budget and the one with the longest return.",
    bands: ["tight", "moderate", "generous"],
  },
  {
    id: "shift-after-puja",
    title: "Do not schedule the move on the same day",
    detail:
      "Keep the puja day for the puja. Movers on the same morning turn an auspicious occasion " +
      "into a logistics problem.",
    why: "Movers run late, and a delayed truck against a fixed muhurat is a bad trade.",
    bands: ["tight", "moderate", "generous"],
  },
];

const COMMUNITY: Idea[] = [
  {
    id: "permissions-early",
    title: "Start the permissions before the programme",
    detail:
      "Police intimation for a loudspeaker, society or municipal permission for the ground, and " +
      "the noise cut-off time in writing. Keep copies on the day.",
    why: "A permission refused late cancels an event that is otherwise fully paid for.",
    bands: ["tight", "moderate", "generous"],
  },
  {
    id: "contribution-transparency",
    title: "Publish the collection and the spend, line by line",
    detail:
      "A sheet on the notice board, updated as money comes in and goes out, with two named " +
      "signatories on every payment.",
    why: "Community events are funded by neighbours, and the disputes are almost always about accounting rather than amounts.",
    bands: ["tight", "moderate", "generous"],
  },
  {
    id: "volunteer-rota",
    title: "A named rota, not a volunteer appeal",
    detail:
      "Two people per slot per task — entry, prasad, sound, clean-up — with names and phone " +
      "numbers printed and circulated.",
    why: "Unassigned work falls on the three people who organise everything, and they burn out before the last day.",
    bands: ["tight", "moderate", "generous"],
  },
  {
    id: "shared-sound",
    title: "Hire sound and lighting as one contract across all days",
    detail: "A single multi-day quote, with the rig left in place, instead of a daily rate.",
    why: "Setup and teardown labour is most of a one-day sound quote, and it is charged again every day.",
    bands: ["tight", "moderate"],
  },
  {
    id: "local-performers",
    title: "Programme local talent first",
    detail:
      "Society children's dance, a local bhajan mandali, a neighbourhood band. Book one outside " +
      "act as the draw if the budget allows.",
    why: "Attendance at a community event tracks how many families have someone performing in it.",
    bands: ["tight", "moderate"],
  },
  {
    id: "crowd-safety",
    title: "Plan the exits and the queue, in writing",
    detail:
      "Two clear exits kept unblocked, a barricaded queue for darshan or prasad, extinguishers " +
      "near the stage and the diya area, and one person whose only job is to watch the crowd.",
    why: "Crowd injuries at neighbourhood festivals are nearly always blocked exits or an unmanaged queue.",
    bands: ["tight", "moderate", "generous"],
  },
  {
    id: "prasad-logistics",
    title: "Count prasad in packets, not in kilos",
    detail:
      "Decide the headcount, pack to it the previous evening, and keep a sealed reserve of about " +
      "one in ten.",
    why: "Running out of prasad in front of the people who paid for the event is the failure nobody forgives.",
    bands: ["tight", "moderate", "generous"],
  },
  {
    id: "waste-plan",
    title: "Budget for the clean-up before the programme",
    detail: "Bins, bags, a sweeper for the morning after, and somewhere agreed for the waste to go.",
    why: "It is the line always left out, and the one the society remembers when it decides next year's budget.",
    bands: ["tight", "moderate", "generous"],
  },
];

export const IDEAS: Record<EventTypeId, Idea[]> = {
  wedding: WEDDING,
  birthday: BIRTHDAY,
  "griha-pravesh": GRIHA_PRAVESH,
  community: COMMUNITY,
};

/**
 * Ideas that suit this band and city tier.
 *
 * Returns them in catalogue order rather than shuffled: a plan that changes its
 * advice between two identical requests looks unreliable, and the same input
 * producing the same output is a property this project maintains everywhere else.
 */
export function ideasFor(eventType: EventTypeId, band: BudgetBand, tier: CityTier): Idea[] {
  return IDEAS[eventType].filter(
    (idea) => idea.bands.includes(band) && (!idea.tiers || idea.tiers.includes(tier)),
  );
}

/** Which band a plan sits in, from its ratio to the typical market total. */
export function bandFor(ratio: number): BudgetBand {
  if (ratio < 0.85) return "tight";
  if (ratio <= 1.15) return "moderate";
  return "generous";
}

/** Sanity check: every event type has ideas for every band. */
function assertCoverage(): void {
  const bands: BudgetBand[] = ["tight", "moderate", "generous"];
  for (const [eventType, ideas] of Object.entries(IDEAS)) {
    for (const band of bands) {
      // Tier-restricted ideas are excluded here: coverage must hold for a
      // planner in any city, including a tier-3 town.
      const universal = ideas.filter((i) => i.bands.includes(band) && !i.tiers);
      if (universal.length === 0) {
        throw new Error(
          `No tier-independent ${band}-budget ideas for "${eventType}". ` +
            `The no-API-key fallback would render an empty ideas section.`,
        );
      }
    }
  }
}

assertCoverage();
