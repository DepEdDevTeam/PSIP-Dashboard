import type {PsipRecord,ReadinessStatus,SchoolProject,SchoolResponse} from '@/lib/psip-data';

import { DASHBOARD_CACHE_TTL_MS, readDashboardCache, writeDashboardCache, type CacheEntry } from './dashboard-cache';

let memoryCache: CacheEntry<DashboardApiResponse> | null = null;
let dashboardPromise: Promise<DashboardApiResponse> | null = null;

type FabricRecord=PsipRecord;

export type DashboardApiResponse={
  generatedAt:string; snapshotDate:string|null;
  summary:{recordVersions:number;uniqueSchools:number;uniqueProjects:number;classrooms:number;currentRecords:number};
  classroomClassifications:{name:string;value:number}[];
  readinessCounts:{name:string;value:number}[];
  regions:{region:string;classrooms:number;records:number;uniqueSchools:number}[];
  options:{regions:string[];divisions:string[];buildingTypes:string[];readiness:ReadinessStatus[];scopes:string[]};
  records:FabricRecord[];
};

function inferFloors(buildingType:string|null){
  const match=buildingType?.match(/(\d+)\s*(?:sty|storey|story|floor)/i);
  if(match)return Number(match[1]);
  if(/high/i.test(buildingType||''))return 5;
  if(/mid/i.test(buildingType||''))return 4;
  return 2;
}

function classifyBuilding(buildingType:string|null){
  const floors=inferFloors(buildingType);
  if(!buildingType)return 'Unknown';
  if(floors<=3)return 'Low-rise';
  if(floors<=6)return 'Mid-rise';
  return 'High-rise';
}

export function toSchoolProject(record:FabricRecord):SchoolProject{
  return {
    id:record.schoolId, recordId:record.recordId, projectId:record.projectId,
    name:record.schoolName, region:record.region, division:record.division,
    municipality:record.municipality, buildingType:classifyBuilding(record.buildingType),
    classrooms:record.classrooms, readiness:record.readiness,
    demolition:record.demolition, siteImprovement:record.siteImprovement,
    slopeProtection:record.slopeProtection, lat:record.latitude, lng:record.longitude,
    floors:inferFloors(record.buildingType), completion:null,
    effectiveStartDate:record.effectiveStartDate,
    effectiveEndDate:record.effectiveEndDate,
    isCurrent:record.isCurrent,
    facilities:{
      academic:record.facilities.academic,
      audioVisual:record.facilities.audioVisual,
      computerLab:record.facilities.ictLab,
      homeEconomics:record.facilities.homeEconomics,
      scienceLab:record.facilities.scienceLab,
      workshop:record.facilities.workshop,
    },
  };
}

function validCache(entry: CacheEntry<DashboardApiResponse> | null): entry is CacheEntry<DashboardApiResponse> {
  const data = entry?.data;
  return !!entry && Number.isFinite(entry.expiresAt) && entry.expiresAt > Date.now()
    && !!data && typeof data.generatedAt === 'string' && !!data.summary && !!data.options
    && Array.isArray(data.records) && Array.isArray(data.regions)
    && Array.isArray(data.classroomClassifications) && Array.isArray(data.readinessCounts)
    && data.records.every((record) => !!record && typeof record.schoolId === 'string' && !!record.facilities);
}

function requestDashboard(forceRefresh = false): Promise<DashboardApiResponse> {
  // Share both the persistent-cache lookup and network request across mounts/navigation.
  if (dashboardPromise) return dashboardPromise;
  if (!forceRefresh && validCache(memoryCache)) return Promise.resolve(memoryCache.data);
  dashboardPromise = (async () => {
    if (!forceRefresh) {
      const cached = await readDashboardCache<DashboardApiResponse>();
      if (validCache(cached)) {
        memoryCache = cached;
        return cached.data;
      }
    }
    const response = await fetch('/api/dashboard', { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { detail?: string } | null;
      throw new Error(payload?.detail || `Dashboard API returned HTTP ${response.status}.`);
    }
    const data = await response.json() as DashboardApiResponse;
    const entry = { expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS, data };
    if (!validCache(entry)) throw new Error('The dashboard API returned invalid data. Please retry.');
    memoryCache = entry;
    // Rendering doesn't wait for the disk write; memory also covers unavailable storage.
    void writeDashboardCache(entry);
    return data;
  })().finally(() => { dashboardPromise = null; });
  return dashboardPromise;
}

function withAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new DOMException('The request was aborted.', 'AbortError'));
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new DOMException('The request was aborted.', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

export async function prefetchDashboard(): Promise<void> {
  try {
    await requestDashboard();
  } catch {
    // Preloading is opportunistic. The dashboard owns visible error and retry UI.
  }
}

export function fetchDashboard(signal?:AbortSignal, forceRefresh = false){
  return withAbort(requestDashboard(forceRefresh).then((dashboard) => ({...dashboard,projects:dashboard.records.map(toSchoolProject)})), signal);
}

export function fetchSchool(schoolId:string, signal?:AbortSignal): Promise<SchoolResponse>{
  return withAbort(requestDashboard().then((dashboard) => {
    const records = dashboard.records.filter((record) => record.schoolId === schoolId);
    return { schoolId, schoolName: records[0]?.schoolName || '', records };
  }), signal);
}
