import type {PsipRecord,ReadinessStatus,SchoolProject} from '@/lib/psip-data';

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

export async function fetchDashboard(signal?:AbortSignal){
  const response=await fetch('/api/dashboard',{headers:{Accept:'application/json'},signal,cache:'no-store'});
  if(!response.ok){
    const payload=await response.json().catch(()=>null) as {detail?:string}|null;
    throw new Error(payload?.detail||`Dashboard API returned HTTP ${response.status}.`);
  }
  const dashboard=await response.json() as DashboardApiResponse;
  return {...dashboard,projects:dashboard.records.map(toSchoolProject)};
}
