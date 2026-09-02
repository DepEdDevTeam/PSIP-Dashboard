'use client';

import Link from 'next/link';
import {Building2,CheckCircle2,Clock3,ExternalLink,FlaskConical,GraduationCap,Home,MapPin,Mic,Monitor,ShieldAlert,Wrench,XCircle} from 'lucide-react';
import {HoverCard,HoverCardContent,HoverCardTrigger} from '@/components/ui/hover-card';
import type {SchoolProject} from '@/lib/psip-data';

const statusColor={Ready:'#19a974',Pending:'#e1a11a','At risk':'#d94b5b',Unknown:'#64748b'};

export default function ProjectHoverCard({project,onSelect}:{project:SchoolProject;onSelect:()=>void}){
 const facilities=project.facilities||{audioVisual:0,computerLab:0,homeEconomics:0,scienceLab:0,workshop:0};
 const special=facilities.audioVisual+facilities.computerLab+facilities.homeEconomics+facilities.scienceLab+facilities.workshop;
 const academic=facilities.academic??Math.max(0,project.classrooms-special);
 const StatusIcon=project.readiness==='Ready'?CheckCircle2:project.readiness==='At risk'?ShieldAlert:Clock3;
 const facilityRows=[
  ['Audio visual',facilities.audioVisual,Mic],['Computer lab',facilities.computerLab,Monitor],
  ['Home economics',facilities.homeEconomics,Home],['Science lab',facilities.scienceLab,FlaskConical],
  ['Workshop',facilities.workshop,Wrench],
 ] as const;
 return <HoverCard>
  <HoverCardTrigger delay={0} closeDelay={120} render={<button type="button" className="psip-map-marker" onClick={onSelect} aria-label={`Preview ${project.name}, ${project.classrooms} classrooms, ${project.readiness}`}/>}/>
  <HoverCardContent side="top" sideOffset={14} className="w-[min(390px,calc(100vw-24px))] overflow-hidden rounded-2xl p-0 shadow-[0_18px_48px_rgba(11,36,95,.24)]">
   <div className="flex items-center gap-2 bg-[#2366dc] px-4 py-3 text-white"><Building2 className="size-5"/><p className="font-bold">School Projects Overview</p></div>
   <div className="space-y-4 p-4">
    <div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="truncate text-base font-bold">{project.name}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-[#647089]"><MapPin className="size-3.5"/>{project.municipality}, {project.division} · {project.region}</p></div><span className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold" style={{background:`${statusColor[project.readiness]}18`,color:statusColor[project.readiness]}}><StatusIcon className="size-3.5"/>{project.readiness}</span></div>
    <div className="grid grid-cols-3 gap-2 rounded-xl bg-[#f4f7fb] p-3 text-center"><Summary icon={GraduationCap} label="Total classrooms" value={project.classrooms}/><Summary icon={GraduationCap} label="Academic" value={academic}/><Summary icon={FlaskConical} label="Special" value={special}/></div>
    <div className="grid grid-cols-5 gap-2">{facilityRows.map(([label,value,Icon])=><div key={label} className="text-center"><span className="mx-auto grid size-8 place-items-center rounded-lg bg-[#edf4ff] text-[#1854bd]"><Icon className="size-4"/></span><p className="mt-1 text-[10px] leading-3 text-[#647089]">{label}</p><b className="text-xs">{value}</b></div>)}</div>
    <div className="grid gap-3 border-t pt-3 sm:grid-cols-2"><div><p className="text-[10px] font-bold uppercase tracking-wider text-[#647089]">Building type</p><p className="mt-1 font-bold">{project.buildingType}</p><p className="text-xs text-[#647089]">{project.floors} storey · {project.classrooms} classroom package</p></div><div><p className="text-[10px] font-bold uppercase tracking-wider text-[#647089]">Scope of works</p><div className="mt-2 flex flex-wrap gap-2"><ScopeBadge label="Site" active={project.siteImprovement}/><ScopeBadge label="Slope" active={project.slopeProtection}/><ScopeBadge label="Demolition" active={project.demolition}/></div></div></div>
    <Link href={`/schools/${project.id}`} className="flex w-fit items-center gap-1 text-xs font-bold text-[#1854bd] underline-offset-4 hover:underline">Open full project details<ExternalLink className="size-3.5"/></Link>
   </div>
  </HoverCardContent>
 </HoverCard>
}

function Summary({icon:Icon,label,value}:{icon:typeof Building2;label:string;value:number}){return <div><Icon className="mx-auto size-4 text-[#1854bd]"/><p className="mt-1 text-[10px] text-[#647089]">{label}</p><b className="text-sm">{value.toLocaleString()}</b></div>}
function ScopeBadge({label,active}:{label:string;active:boolean}){const Icon=active?CheckCircle2:XCircle;return <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${active?'text-[#087a54]':'text-[#9aa4b5]'}`}><Icon className="size-3.5"/>{label}</span>}
