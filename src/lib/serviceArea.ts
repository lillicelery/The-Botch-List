/**
 * States the app serves. The API filters by BOTCH_SERVICE_STATES (see server/serviceArea.mjs);
 * this copy only applies to the bundled fallback data used when the API is unreachable.
 */
export const SERVICE_STATES: readonly string[] = ["NY"];

/** True when a location label such as "Brooklyn, NY" is in a served state. */
export function isInServiceArea(locationLabel: string | undefined): boolean {
  const match = /,\s*([A-Za-z]{2})\s*$/.exec(locationLabel ?? "");
  return match !== null && SERVICE_STATES.includes(match[1].toUpperCase());
}
