import type {PsipRecord,ReadinessStatus,SchoolProject,SchoolResponse} from '@/lib/psip-data';

const DASHBOARD_CACHE_KEY = 'psip-dashboard-cache-v1';
const DASHBOARD_CACHE_TTL_MS = 5 * 60 * 1000;
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

type CachedDashboard = { expiresAt: number; data: DashboardApiResponse };

function readBrowserCache(): DashboardApiResponse | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = JSON.parse(window.localStorage.getItem(DASHBOARD_CACHE_KEY) || 'null') as CachedDashboard | null;
    if (cached && cached.expiresAt > Date.now()) return cached.data;
    window.localStorage.removeItem(DASHBOARD_CACHE_KEY);
  } catch {
    // Storage can be unavailable or contain an older incompatible payload.
  }
  return null;
}

function writeBrowserCache(data: DashboardApiResponse) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      DASHBOARD_CACHE_KEY,
      JSON.stringify({ expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS, data }),
    );
  } catch {
    // A full/blocked browser cache must not prevent live data from loading.
  }
}

function requestDashboard(forceRefresh = false): Promise<DashboardApiResponse> {
  if (!forceRefresh) {
    const cached = readBrowserCache();
    if (cached) return Promise.resolve(cached);
    if (dashboardPromise) return dashboardPromise;
  }
  dashboardPromise = fetch('/api/dashboard',{headers:{Accept:'application/json'},cache:'no-store'})
    .then(async (response) => {
      if(!response.ok){
        const payload=await response.json().catch(()=>null) as {detail?:string}|null;
        throw new Error(payload?.detail||`Dashboard API returned HTTP ${response.status}.`);
      }
      return await response.json() as DashboardApiResponse;
    })
    .then((data) => {
      writeBrowserCache(data);
      return data;
    })
    .finally(() => {
      dashboardPromise = null;
    });
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

export function fetchDashboard(signal?:AbortSignal, forceRefresh = false){
  return withAbort(requestDashboard(forceRefresh).then((dashboard) => ({...dashboard,projects:dashboard.records.map(toSchoolProject)})), signal);
}

export function fetchSchool(schoolId:string, signal?:AbortSignal): Promise<SchoolResponse>{
  return withAbort(requestDashboard().then((dashboard) => {
    const records = dashboard.records.filter((record) => record.schoolId === schoolId);
    return { schoolId, schoolName: records[0]?.schoolName || '', records };
  }), signal);
}
