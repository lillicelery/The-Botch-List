export function resultsHeadline(q: string, loc: string): string {
  const query = q.trim();
  const place = loc.trim();
  if (query && place) return `${query} in ${place}`;
  if (query) return query;
  if (place) return `Providers in ${place}`;
  return "Search results";
}
