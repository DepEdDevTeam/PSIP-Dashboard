'use client';

import {useEffect,useRef} from 'react';
import type {SchoolProject} from '@/lib/psip-data';

const statusColors={Ready:'#19a974',Pending:'#e1a11a','At risk':'#d94b5b'};
const regionColors=['#1854bd','#19a974','#e1a11a','#d94b5b','#7c3aed','#db2777','#0891b2','#65a30d'];

function popupContent(project:SchoolProject){
 const root=document.createElement('div');
 const name=document.createElement('strong');
 name.textContent=project.name;
 const place=document.createElement('p');
 place.textContent=`${project.municipality}, ${project.region}`;
 place.style.cssText='margin:4px 0 0;color:#526079;font-size:12px';
 const detail=document.createElement('p');
 detail.textContent=`${project.classrooms} classrooms · ${project.readiness}`;
 detail.style.cssText='margin:5px 0 0;font-size:12px;font-weight:700';
 root.append(name,place,detail);
 return root;
}

export default function PsipMap({projects,onSelect,view='Regional Map View'}:{projects:SchoolProject[];onSelect:(project:SchoolProject)=>void;view?:string}){
 const host=useRef<HTMLDivElement>(null);
 const selectRef=useRef(onSelect);
 selectRef.current=onSelect;
 useEffect(()=>{
  const token=process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if(!host.current||!token?.startsWith('pk.'))return;
  let disposed=false;
  let cleanup=()=>{};
  void import('mapbox-gl').then(({default:mapboxgl})=>{
   if(disposed||!host.current)return;
   mapboxgl.accessToken=token;
   const map=new mapboxgl.Map({container:host.current,style:'mapbox://styles/mapbox/light-v11',center:[122.3,12.8],zoom:4.7,minZoom:3.5,maxZoom:14,attributionControl:true});
   map.addControl(new mapboxgl.NavigationControl({showCompass:false}),'top-right');
   const bounds=new mapboxgl.LngLatBounds();
   const markers:mapboxgl.Marker[]=[];
   projects.forEach(project=>{
    const markerButton=document.createElement('button');
    markerButton.type='button';
    markerButton.className='psip-map-marker';
    const regionIndex=Math.max(0,Array.from(new Set(projects.map(p=>p.region))).indexOf(project.region));
    markerButton.style.background=view==='Sites Operational Readiness Locator'?statusColors[project.readiness]:view==='Buildings Geographical Location'?regionColors[regionIndex%regionColors.length]:'#1854bd';
    markerButton.setAttribute('aria-label',`Preview ${project.name}, ${project.classrooms} classrooms, ${project.readiness}`);
    const popup=new mapboxgl.Popup({offset:18,className:'psip-map-popup',closeButton:true,maxWidth:'260px'}).setDOMContent(popupContent(project));
    markerButton.addEventListener('click',()=>selectRef.current(project));
    const marker=new mapboxgl.Marker({element:markerButton,anchor:'center'}).setLngLat([project.lng,project.lat]).setPopup(popup).addTo(map);
    markerButton.addEventListener('mouseenter',()=>popup.addTo(map));
    markerButton.addEventListener('mouseleave',()=>popup.remove());
    markers.push(marker);
    bounds.extend([project.lng,project.lat]);
   });
   map.once('load',()=>{if(!bounds.isEmpty())map.fitBounds(bounds,{padding:48,maxZoom:7,duration:0});requestAnimationFrame(()=>map.resize())});
   map.on('error',event=>console.error('Mapbox failed to render',event.error));
   cleanup=()=>{markers.forEach(marker=>marker.remove());map.remove()};
  });
  return()=>{disposed=true;cleanup()};
 },[projects]);
 const tokenReady=process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.startsWith('pk.');
 if(!tokenReady)return <div className="grid h-full place-items-center bg-[#eaf0f7] p-6 text-center text-sm font-semibold text-[#526079]">Add a public Mapbox token to NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN.</div>;
 return <div ref={host} className="h-full w-full" role="application" aria-label="Interactive Mapbox map of PSIP school projects"/>;
}
