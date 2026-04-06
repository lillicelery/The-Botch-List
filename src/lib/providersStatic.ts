import type { SearchProvider } from "../types/provider";
import apifyProviders from "../data/apifyProviders.json";

/** Slugs for `/provider/:slug` — use these in routes and links. */
export const PROVIDER_SLUGS = {
  sarahJenkins: "dr-sarah-jenkins-dpt",
  advancedRecoveryCenter: "advanced-recovery-center",
  michaelChen: "dr-michael-chen",
  cascadeNeurology: "cascade-neurology-seattle",
} as const;

const DEMO_ORIGIN = "https://example.org";

/** Scraped Google Maps providers → run `npm run apify:map` after `npm run apify:maps`. */
const FROM_APIFY: SearchProvider[] = apifyProviders as SearchProvider[];

const DEMO_SEARCH_PROVIDERS: SearchProvider[] = [
  {
    slug: PROVIDER_SLUGS.sarahJenkins,
    name: "Dr. Sarah Jenkins, DPT",
    metaLine: "Orthopedic physical therapy • 12 years experience • Seattle, WA",
    summary:
      "Patients often mention clear explanations, steady progress on knee and shoulder programs, and a focus on safe return-to-sport. A few threads note scheduling friction during peak season.",
    cardSentiment: "Positive",
    tags: ["Knee", "Shoulder", "Post-surgical rehab"],
    specialties: ["orthopedics", "sports"],
    locationLabel: "Seattle, WA",
    stats: {
      snippetsCollected: 128,
      avgSentimentLabel: "Mostly Positive",
      topConcern: "Scheduling / wait times",
      monthOverMonthPct: 12,
    },
    sentimentBreakdown: { negative: 18, good: 44, veryGood: 38 },
    defaultProcedureFilters: ["ACL rehab", "Rotator cuff", "Runner's knee"],
    snippets: [
      {
        id: "sj-r1",
        authorLabel: "u/patientrunner_sea",
        postedRelative: "3 weeks ago",
        sentiment: "Positive",
        excerpt:
          "Six months post-ACL reconstruction—Sarah progressed me slowly but I never felt rushed. Explained every exercise and why it mattered. Back to easy miles now.",
        procedureTags: ["ACL rehab", "Knee"],
        sourceName: "Reddit",
        sourceLogo: "reddit",
        originalUrl: `${DEMO_ORIGIN}/public/patient-experiences/reddit/sj-acl-01`,
      },
      {
        id: "sj-hg1",
        authorLabel: "Verified visit",
        postedRelative: "2 months ago",
        sentiment: "Positive",
        excerpt:
          "Rotator cuff protocol was thorough. Front desk mixed reviews but the clinical time felt focused and kind.",
        procedureTags: ["Rotator cuff", "Shoulder"],
        sourceName: "Healthgrades",
        originalUrl: `${DEMO_ORIGIN}/public/patient-experiences/healthgrades/sj-shoulder-02`,
      },
      {
        id: "sj-r2",
        authorLabel: "u/throwaway_PT_2024",
        postedRelative: "5 days ago",
        sentiment: "Okay",
        excerpt:
          "Good exercises for runner's knee but had to wait two weeks for a follow-up slot. Once in, the session was helpful.",
        procedureTags: ["Runner's knee", "Knee"],
        sourceName: "Reddit",
        sourceLogo: "reddit",
        originalUrl: `${DEMO_ORIGIN}/public/patient-experiences/reddit/sj-runners-knee-03`,
      },
    ],
  },
  {
    slug: PROVIDER_SLUGS.advancedRecoveryCenter,
    name: "Advanced Recovery Center",
    metaLine: "Multi-specialty clinic • Physical therapy, OT, chiropractic • Downtown Seattle",
    summary:
      "Public posts frequently describe billing surprises, difficulty reaching the office, and inconsistent communication between providers. Others praise convenience of multiple services in one building.",
    cardSentiment: "Very Negative",
    tags: ["Back pain", "Sciatica", "Chiropractic"],
    specialties: ["orthopedics", "sports"],
    locationLabel: "Seattle, WA",
    stats: {
      snippetsCollected: 94,
      avgSentimentLabel: "Mostly Negative",
      topConcern: "Billing & communication",
      monthOverMonthPct: -8,
    },
    sentimentBreakdown: { negative: 52, good: 35, veryGood: 13 },
    defaultProcedureFilters: ["Sciatica", "Lower back", "Chiropractic care"],
    snippets: [
      {
        id: "arc-fb1",
        authorLabel: "Member post (anonymized)",
        postedRelative: "11 days ago",
        sentiment: "Negative",
        excerpt:
          "Was quoted one copay at booking and charged differently at checkout. Took three calls to get a straight answer. Care itself was fine.",
        procedureTags: ["Lower back", "Sciatica"],
        sourceName: "Facebook",
        sourceLogo: "facebook",
        originalUrl: `${DEMO_ORIGIN}/public/patient-experiences/facebook/arc-billing-01`,
      },
      {
        id: "arc-y1",
        authorLabel: "Public review",
        postedRelative: "1 month ago",
        sentiment: "Negative",
        excerpt:
          "Chiropractic visit felt rushed. Different therapist than who I booked with—no one told me ahead of time.",
        procedureTags: ["Chiropractic care", "Lower back"],
        sourceName: "Yelp",
        originalUrl: `${DEMO_ORIGIN}/public/patient-experiences/yelp/arc-chiro-02`,
      },
      {
        id: "arc-r1",
        authorLabel: "u/SeattleSpineWatch",
        postedRelative: "2 months ago",
        sentiment: "Okay",
        excerpt:
          "Convenient location and parking validation. Mixed feelings on whether PT and chiro were aligned on my sciatica plan.",
        procedureTags: ["Sciatica", "Lower back"],
        sourceName: "Reddit",
        sourceLogo: "reddit",
        originalUrl: `${DEMO_ORIGIN}/public/patient-experiences/reddit/arc-sciatica-03`,
      },
    ],
  },
  {
    slug: PROVIDER_SLUGS.michaelChen,
    name: "Dr. Michael Chen, MD",
    metaLine: "Sports medicine • 8 years experience • Bellevue, WA",
    summary:
      "Athletes and weekend warriors mention pragmatic, evidence-based advice. Telehealth is not offered; some patients wish weekend hours were easier to book.",
    cardSentiment: "Okay",
    tags: ["ACL", "Concussion", "Sports injury"],
    specialties: ["sports", "orthopedics"],
    locationLabel: "Bellevue, WA",
    stats: {
      snippetsCollected: 56,
      avgSentimentLabel: "Mixed / Okay",
      topConcern: "Appointment availability",
      monthOverMonthPct: 4,
    },
    sentimentBreakdown: { negative: 28, good: 50, veryGood: 22 },
    defaultProcedureFilters: ["ACL", "Concussion protocol", "Ankle sprain"],
    snippets: [
      {
        id: "mc-rs1",
        authorLabel: "Public thread",
        postedRelative: "18 days ago",
        sentiment: "Positive",
        excerpt:
          "Clear return-to-play criteria after ankle sprain—no vague 'listen to your body' only. Appreciated the written plan.",
        procedureTags: ["Ankle sprain", "Sports injury"],
        sourceName: "RealSelf",
        originalUrl: `${DEMO_ORIGIN}/public/patient-experiences/realself/mc-ankle-01`,
      },
      {
        id: "mc-r1",
        authorLabel: "u/bellevue_clinic_tea",
        postedRelative: "6 weeks ago",
        sentiment: "Okay",
        excerpt:
          "Good clinician but earliest follow-up was almost a month out. Would use again if timing works.",
        procedureTags: ["ACL", "Sports injury"],
        sourceName: "Reddit",
        sourceLogo: "reddit",
        originalUrl: `${DEMO_ORIGIN}/public/patient-experiences/reddit/mc-acl-02`,
      },
      {
        id: "mc-hg1",
        authorLabel: "Family member post",
        postedRelative: "2 months ago",
        sentiment: "Negative",
        excerpt:
          "Concussion protocol questions went to a portal that felt slow. In-person visit was better once we got in.",
        procedureTags: ["Concussion protocol", "Sports injury"],
        sourceName: "Healthgrades",
        originalUrl: `${DEMO_ORIGIN}/public/patient-experiences/healthgrades/mc-concussion-03`,
      },
    ],
  },
  {
    slug: PROVIDER_SLUGS.cascadeNeurology,
    name: "Cascade Neurology Associates",
    metaLine: "Outpatient neurology • Headache & neuropathy • Seattle, WA",
    summary:
      "Public reviews often highlight thorough diagnostic explanations and conservative treatment paths. A few patients describe long new-patient wait times.",
    cardSentiment: "Positive",
    tags: ["Migraine", "Neuropathy", "EMG"],
    specialties: ["neurology"],
    locationLabel: "Seattle, WA",
    stats: {
      snippetsCollected: 41,
      avgSentimentLabel: "Mostly Positive",
      topConcern: "Wait for new patients",
      monthOverMonthPct: 3,
    },
    sentimentBreakdown: { negative: 12, good: 48, veryGood: 40 },
    defaultProcedureFilters: ["Migraine", "Neuropathy", "EMG"],
    snippets: [
      {
        id: "cn-r1",
        authorLabel: "u/chronicmigrainePNW",
        postedRelative: "4 weeks ago",
        sentiment: "Positive",
        excerpt:
          "Finally felt heard about migraine triggers. Left with a written plan and clear follow-up milestones instead of vague advice.",
        procedureTags: ["Migraine"],
        sourceName: "Reddit",
        sourceLogo: "reddit",
        originalUrl: `${DEMO_ORIGIN}/public/patient-experiences/reddit/cn-migraine-01`,
      },
      {
        id: "cn-hg1",
        authorLabel: "Public review",
        postedRelative: "3 months ago",
        sentiment: "Okay",
        excerpt:
          "EMG results were explained well. Scheduling the test took longer than I expected but staff communicated delays.",
        procedureTags: ["EMG", "Neuropathy"],
        sourceName: "Healthgrades",
        originalUrl: `${DEMO_ORIGIN}/public/patient-experiences/healthgrades/cn-emg-02`,
      },
    ],
  },
];

/** Apify-backed listings first, then hand-authored demos (compare / deep snippets). */
export const ALL_SEARCH_PROVIDERS: SearchProvider[] = [...FROM_APIFY, ...DEMO_SEARCH_PROVIDERS];

const bySlug = new Map(ALL_SEARCH_PROVIDERS.map((p) => [p.slug, p]));

export function getProviderBySlug(slug: string | undefined): SearchProvider | undefined {
  if (!slug) return undefined;
  return bySlug.get(slug);
}

export function getProviderDisplayName(slug: string | undefined): string {
  if (!slug) return "Provider";
  return bySlug.get(slug)?.name ?? titleFromSlug(slug);
}

function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
