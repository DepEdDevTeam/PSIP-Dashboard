export type ReadinessStatus = 'Ready' | 'At risk' | 'Pending' | 'Unknown';
export type BuildingType = string;

export type FacilityCounts = {
  academic?: number;
  audioVisual: number;
  computerLab: number;
  homeEconomics: number;
  scienceLab: number;
  workshop: number;
};

export type SchoolProject = {
  id: string;
  recordId?: string;
  projectId?: string | null;
  name: string;
  region: string;
  division: string;
  municipality: string;
  buildingType: BuildingType;
  classrooms: number;
  readiness: ReadinessStatus;
  demolition: boolean;
  siteImprovement: boolean;
  slopeProtection: boolean;
  lat: number | null;
  lng: number | null;
  facilities?: FacilityCounts;
  floors: number;
  completion: number | null;
  effectiveStartDate?: string | null;
  effectiveEndDate?: string | null;
  isCurrent?: boolean | null;
};

export type PsipRecord = {
  recordId: string;
  schoolId: string;
  schoolName: string;
  projectId: string | null;
  region: string;
  division: string;
  municipality: string;
  latitude: number | null;
  longitude: number | null;
  buildingType: string | null;
  classrooms: number;
  facilities: {
    academic: number;
    workshop: number;
    ictLab: number;
    scienceLab: number;
    audioVisual: number;
    homeEconomics: number;
  };
  readiness: ReadinessStatus;
  demolition: boolean;
  siteImprovement: boolean;
  slopeProtection: boolean;
  effectiveStartDate: string | null;
  effectiveEndDate: string | null;
  isCurrent: boolean | null;
};

export type SchoolResponse = {
  schoolId: string;
  schoolName: string;
  records: PsipRecord[];
};

export type ProjectFilters = {
  region: string;
  division: string;
  buildingType: string;
  readiness: string;
  scope: string;
  search: string;
};

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => null)) as
    | ({ detail?: string } & T)
    | null;
  if (!response.ok) {
    throw new ApiError(
      payload?.detail || 'The PSIP data service could not complete the request.',
      response.status,
    );
  }
  return payload as T;
}

export function fetchSchool(
  schoolId: string,
  signal?: AbortSignal,
): Promise<SchoolResponse> {
  return fetchJson<SchoolResponse>(
    `/api/schools/${encodeURIComponent(schoolId)}`,
    signal,
  );
}

export function formatDate(value: string | null, fallback = 'Not recorded') {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-PH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}
