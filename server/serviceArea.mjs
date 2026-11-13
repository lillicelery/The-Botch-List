/**
 * Which states the app currently serves. Providers outside the service area stay in the database
 * (so totals and stats still count them) but are hidden from the app.
 *
 *   BOTCH_SERVICE_STATES=NY        (default) New York only
 *   BOTCH_SERVICE_STATES=NY,NJ     several states
 *   BOTCH_SERVICE_STATES=all       show every provider
 *
 * Keep the frontend fallback in src/lib/serviceArea.ts in sync with the default.
 */
const raw = process.env.BOTCH_SERVICE_STATES?.trim() || "NY";

/** Upper-case state codes, or null when every state is served. */
export const SERVICE_STATES =
  raw.toLowerCase() === "all"
    ? null
    : raw
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);

/** True when a location label such as "Brooklyn, NY" falls inside the service area. */
export function isInServiceArea(locationLabel) {
  if (!SERVICE_STATES) return true;
  const match = /,\s*([A-Za-z]{2})\s*$/.exec(String(locationLabel ?? ""));
  return match ? SERVICE_STATES.includes(match[1].toUpperCase()) : false;
}
