import type { SchoolProject } from './psip-data';

export const normalizeSearch = (value: string) => value.trim().toLowerCase();

export function hammingDistance(left: string, right: string) {
  const a = Array.from(left),
    b = Array.from(right);
  if (a.length !== b.length) return Infinity;
  return a.reduce(
    (distance, character, index) => distance + Number(character !== b[index]),
    0,
  );
}

// Prefer name prefixes, then word prefixes, before broader matches.
export function searchScore(value: string, query: string, fuzzy = true) {
  const text = normalizeSearch(value),
    term = normalizeSearch(query);
  if (text === term) return 0;
  if (text.startsWith(term)) return 1;
  const wordPrefix = text
    .split(/[^\p{L}\p{N}]+/u)
    .some((word) => word.startsWith(term));
  if (wordPrefix) return 2;
  if (text.includes(term) && (!fuzzy || Array.from(term).length >= 4)) return 3;
  const needle = Array.from(term),
    haystack = Array.from(text);
  const tolerance = needle.length < 4 ? 0 : needle.length < 8 ? 1 : 2;
  if (!fuzzy || !tolerance || /^\d+$/.test(term)) return Infinity;
  let best = Infinity;
  for (let start = 0; start <= haystack.length - needle.length; start++) {
    const distance = hammingDistance(
      term,
      haystack.slice(start, start + needle.length).join(''),
    );
    if (distance <= tolerance) best = Math.min(best, 3 + distance);
  }
  return best;
}

export function searchSuggestions(values: string[], query: string) {
  if (!normalizeSearch(query)) return [];
  const matches = values
    .map((value) => ({
      value,
      score: searchScore(value, query, !/^\d+$/.test(value)),
    }))
    .filter((item) => Number.isFinite(item.score));
  // Typo suggestions are a fallback, not extra guesses alongside literal matches.
  const literal = matches.filter((item) => item.score <= 3);
  return (literal.length ? literal : matches)
    .sort((a, b) => a.score - b.score || a.value.localeCompare(b.value))
    .slice(0, 30)
    .map((item) => item.value);
}

export function searchProjects(projects: SchoolProject[], query: string) {
  if (!normalizeSearch(query)) return projects;
  const matches = projects
    .map((project) => ({
      project,
      score: Math.min(
        searchScore(project.id, query, false),
        ...[project.name, project.division, project.region].map((value) =>
          searchScore(value, query),
        ),
      ),
    }))
    .filter((item) => Number.isFinite(item.score));
  // A complete school/area selection retains its precise scope.
  const exact = matches.filter((item) => item.score === 0);
  return (exact.length ? exact : matches.sort((a, b) => a.score - b.score)).map(
    (item) => item.project,
  );
}

export function searchContext(projects: SchoolProject[], query: string) {
  if (!query.trim() || !projects.length) return null;
  const first = projects[0];
  const school = projects.every((p) => p.id === first.id);
  const division = projects.every(
    (p) => p.division === first.division && p.region === first.region,
  );
  const region = projects.every((p) => p.region === first.region);
  const term = normalizeSearch(query);
  if (region && normalizeSearch(first.region) === term)
    return { title: first.region, subtitle: '', kind: 'region' };
  if (division && normalizeSearch(first.division) === term)
    return { title: first.division, subtitle: first.region, kind: 'division' };
  if (school)
    return {
      title: first.name,
      subtitle: `${first.division} · ${first.region}`,
      kind: 'school',
    };
  return {
    title: `Search results for “${query.trim()}”`,
    subtitle: division
      ? `${first.division} · ${first.region}`
      : region
        ? first.region
        : '',
    kind: 'results',
  };
}
