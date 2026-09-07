import type { SchoolProject } from './psip-data';

export const normalizeSearch = (value: string) => value.trim().toLowerCase();

export function searchProjects(projects: SchoolProject[], query: string) {
  const term = normalizeSearch(query);
  if (!term) return projects;
  const exact = projects.filter((p) =>
    [p.id, p.name, p.division, p.region].some(
      (value) => normalizeSearch(value) === term,
    ),
  );
  return exact.length
    ? exact
    : projects.filter((p) =>
        [p.id, p.name, p.division, p.region].some((value) =>
          normalizeSearch(value).includes(term),
        ),
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
