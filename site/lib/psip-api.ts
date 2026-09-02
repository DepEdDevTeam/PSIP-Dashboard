import type {ReadinessStatus,SchoolProject} from '@/lib/psip-data';

const API_BASE=(process.env.NEXT_PUBLIC_PSIP_API_URL||'http://127.0.0.1:8000').replace(/\/$/,'');

type FabricRecord={
  recordId:string; schoolId:string; schoolName:string; projectId:string|null;
  region:string; division:string; municipality:string; latitude:number|null; longitude:number|null;
  buildingType:string|null; classrooms:number; readiness:ReadinessStatus;
  demolition:boolean; siteImprovement:boolean; slopeProtection:boolean;
  facilities:{academic:number;workshop:number;ictLab:number;scienceLab:number;audioVisual:number;homeEconomics:number};
};

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

function readinessProgress(readiness:ReadinessStatus){
  return readiness==='Ready'?100:readiness==='Pending'?60:readiness==='At risk'?30:0;
}

export function toSchoolProject(record:FabricRecord):SchoolProject{
  return {
    id:record.schoolId, recordId:record.recordId, projectId:record.projectId,
    name:record.schoolName, region:record.region, division:record.division,
    municipality:record.municipality, buildingType:classifyBuilding(record.buildingType),
    classrooms:record.classrooms, readiness:record.readiness,
    demolition:record.demolition, siteImprovement:record.siteImprovement,
    slopeProtection:record.slopeProtection, lat:record.latitude, lng:record.longitude,
    floors:inferFloors(record.buildingType), completion:readinessProgress(record.readiness),
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
  const response=await fetch(`${API_BASE}/api/dashboard`,{headers:{Accept:'application/json'},signal});
  if(!response.ok){
    const payload=await response.json().catch(()=>null) as {detail?:string}|null;
    throw new Error(payload?.detail||`Dashboard API returned HTTP ${response.status}.`);
  }
  const dashboard=await response.json() as DashboardApiResponse;
  return {...dashboard,projects:dashboard.records.map(toSchoolProject)};
}

export async function fetchSchool(schoolId:string){
  const response=await fetch(`${API_BASE}/api/schools/${encodeURIComponent(schoolId)}`,{headers:{Accept:'application/json'},cache:'no-store'});
  if(response.status===404)return null;
  if(!response.ok)throw new Error(`School API returned HTTP ${response.status}.`);
  const payload=await response.json() as {schoolId:string;schoolName:string;records:FabricRecord[]};
  return payload.records.length?toSchoolProject(payload.records[0]):null;
}
