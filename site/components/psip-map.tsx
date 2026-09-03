'use client';

import { useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { LngLat } from 'mapbox-gl';
import ProjectHoverCard from '@/components/project-hover-card';
import type { ReadinessStatus, SchoolProject } from '@/lib/psip-data';

const statusColors = {
  Ready: '#14855f',
  Pending: '#c57a0a',
  'At risk': '#c83f50',
  Unknown: '#64748b',
};
const buildingColors = ['#1e5fc4', '#10a779', '#d89a12', '#7c3aed'];
const REGIONAL_VIEW = 'Regional Map View';
const regionColors: Record<string, string> = {
  'Region I': '#d7193f',
  'Region II': '#f58231',
  'Region III': '#f5b700',
  'Region IV-A': '#07883f',
  'Region IV-B': '#70bec1',
  'Region V': '#07583f',
  'Region VI': '#12b8df',
  'Region VII': '#287dbd',
  'Region VIII': '#0969f3',
  'Region IX': '#8a17c5',
  'Region X': '#6114e8',
  'Region XI': '#cf405d',
  'Region XII': '#b64fa1',
  'Region XIII': '#4011f0',
  'Region XVIII': '#84a91c',
  NCR: '#00ad35',
  CAR: '#ed1758',
  BARMM: '#ed00dc',
};

type RegionStatus = ReadinessStatus | 'No data';
type RegionSummary = {
  projects: number;
  sites: number;
  readyRate: number;
  status: RegionStatus;
  counts: Record<ReadinessStatus, number>;
};
type RegionFeature = {
  id?: string | number;
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: unknown;
  };
  properties: Record<string, unknown>;
};
type RegionFeatureCollection = {
  type: 'FeatureCollection';
  features: RegionFeature[];
};

const regionAliases: Record<string, string> = {
  'REGION I': 'Region I',
  'ILOCOS REGION': 'Region I',
  'REGION II': 'Region II',
  'CAGAYAN VALLEY': 'Region II',
  'REGION III': 'Region III',
  'CENTRAL LUZON': 'Region III',
  'REGION IV A': 'Region IV-A',
  CALABARZON: 'Region IV-A',
  'REGION IV B': 'Region IV-B',
  MIMAROPA: 'Region IV-B',
  'MIMAROPA REGION': 'Region IV-B',
  'REGION V': 'Region V',
  'BICOL REGION': 'Region V',
  'REGION VI': 'Region VI',
  'WESTERN VISAYAS': 'Region VI',
  'REGION VII': 'Region VII',
  'CENTRAL VISAYAS': 'Region VII',
  'REGION VIII': 'Region VIII',
  'EASTERN VISAYAS': 'Region VIII',
  'REGION IX': 'Region IX',
  'ZAMBOANGA PENINSULA': 'Region IX',
  'REGION X': 'Region X',
  'NORTHERN MINDANAO': 'Region X',
  'REGION XI': 'Region XI',
  'DAVAO REGION': 'Region XI',
  'REGION XII': 'Region XII',
  SOCCSKSARGEN: 'Region XII',
  NCR: 'NCR',
  'NATIONAL CAPITAL REGION': 'NCR',
  CAR: 'CAR',
  'CORDILLERA ADMINISTRATIVE REGION': 'CAR',
  'REGION XIII': 'Region XIII',
  CARAGA: 'Region XIII',
  'REGION XVIII': 'Region XVIII',
  'NEGROS ISLAND REGION': 'Region XVIII',
  'NEGROS ISLAND REGION NIR': 'Region XVIII',
  NIR: 'Region XVIII',
  BARMM: 'BARMM',
  ARMM: 'BARMM',
  'BANGSAMORO AUTONOMOUS REGION IN MUSLIM MINDANAO': 'BARMM',
};

function canonicalRegion(value: string) {
  const key = value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
  return regionAliases[key] || value;
}

function summarizeRegions(projects: SchoolProject[]) {
  const grouped = new Map<string, SchoolProject[]>();
  projects.forEach((project) => {
    const region = canonicalRegion(project.region);
    grouped.set(region, [...(grouped.get(region) || []), project]);
  });
  return new Map<string, RegionSummary>(
    Array.from(grouped, ([region, rows]) => {
      const counts = {
        Ready: rows.filter((row) => row.readiness === 'Ready').length,
        Pending: rows.filter((row) => row.readiness === 'Pending').length,
        'At risk': rows.filter((row) => row.readiness === 'At risk').length,
        Unknown: rows.filter((row) => row.readiness === 'Unknown').length,
      };
      const status: RegionStatus = counts['At risk']
        ? 'At risk'
        : counts.Pending
          ? 'Pending'
          : counts.Unknown
            ? 'Unknown'
            : 'Ready';
      return [
        region,
        {
          projects: rows.length,
          sites: new Set(rows.map((row) => row.id)).size,
          readyRate: Math.round((counts.Ready / rows.length) * 100),
          status,
          counts,
        },
      ];
    }),
  );
}

function regionPopupContent(region: string, summary?: RegionSummary) {
  const root = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = region;
  title.style.cssText = 'display:block;color:#102044;font-size:14px';
  const headline = document.createElement('p');
  headline.textContent = summary
    ? `${summary.readyRate}% ready · ${summary.status}`
    : 'No matching project data';
  headline.style.cssText =
    'margin:6px 0 0;color:#102044;font-size:12px;font-weight:700';
  root.appendChild(title);
  root.appendChild(headline);
  if (summary) {
    const detail = document.createElement('p');
    detail.textContent = `${summary.projects} projects · ${summary.sites} school sites`;
    detail.style.cssText = 'margin:4px 0 0;color:#526079;font-size:12px';
    const statuses = document.createElement('p');
    statuses.textContent = `Ready ${summary.counts.Ready} · Pending ${summary.counts.Pending} · At risk ${summary.counts['At risk']} · Unknown ${summary.counts.Unknown}`;
    statuses.style.cssText = 'margin:5px 0 0;color:#526079;font-size:11px';
    root.appendChild(detail);
    root.appendChild(statuses);
  }
  return root;
}

function extendGeometryBounds(
  bounds: { extend: (point: [number, number]) => unknown },
  coordinates: unknown,
) {
  if (!Array.isArray(coordinates)) return;
  if (
    coordinates.length >= 2 &&
    typeof coordinates[0] === 'number' &&
    typeof coordinates[1] === 'number'
  ) {
    bounds.extend([coordinates[0], coordinates[1]]);
    return;
  }
  coordinates.forEach((coordinate) => extendGeometryBounds(bounds, coordinate));
}

export default function PsipMap({
  projects,
  onSelect,
  view = 'Buildings Geographical Location',
}: {
  projects: SchoolProject[];
  onSelect: (project: SchoolProject) => void;
  view?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const selectRef = useRef(onSelect);
  useEffect(() => {
    selectRef.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!host.current || !token?.startsWith('pk.')) return;
    let disposed = false;
    let cleanup = () => {};
    const controller = new AbortController();
    void import('mapbox-gl').then(({ default: mapboxgl }) => {
      if (disposed || !host.current) return;
      mapboxgl.accessToken = token;
      const map = new mapboxgl.Map({
        container: host.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [122.3, 12.8],
        zoom: 4.7,
        minZoom: 3.5,
        maxZoom: 14,
        attributionControl: true,
      });
      map.addControl(
        new mapboxgl.NavigationControl({ showCompass: false }),
        'top-right',
      );
      const resizeMap = () => map.resize();
      const resizeObserver = new ResizeObserver(() =>
        requestAnimationFrame(resizeMap),
      );
      resizeObserver.observe(host.current);
      window.visualViewport?.addEventListener('resize', resizeMap);
      const bounds = new mapboxgl.LngLatBounds();
      const markers: mapboxgl.Marker[] = [];
      const reactRoots: Root[] = [];
      if (view !== REGIONAL_VIEW)
        projects
          .filter(
            (project) =>
              Number.isFinite(project.lng) && Number.isFinite(project.lat),
          )
          .forEach((project) => {
            const markerHost = document.createElement('div');
            const buildingIndex = Math.max(
              0,
              Array.from(new Set(projects.map((p) => p.buildingType))).indexOf(
                project.buildingType,
              ),
            );
            const color =
              view === 'Sites Operational Readiness Locator'
                ? statusColors[project.readiness]
                : buildingColors[buildingIndex % buildingColors.length];
            markerHost.style.setProperty('--marker-color', color);
            const reactRoot = createRoot(markerHost);
            reactRoot.render(
              <ProjectHoverCard
                project={project}
                onSelect={() => selectRef.current(project)}
              />,
            );
            reactRoots.push(reactRoot);
            const marker = new mapboxgl.Marker({
              element: markerHost,
              anchor: 'center',
            })
              .setLngLat([project.lng!, project.lat!])
              .addTo(map);
            markers.push(marker);
            bounds.extend([project.lng!, project.lat!]);
          });
      map.once('load', async () => {
        if (view === REGIONAL_VIEW) {
          try {
            const response = await fetch('/data/philippines-regions.geojson', {
              signal: controller.signal,
            });
            if (!response.ok)
              throw new Error('Regional boundaries unavailable');
            const geojson = (await response.json()) as RegionFeatureCollection;
            if (disposed) return;
            const summaries = summarizeRegions(projects);
            geojson.features.forEach((feature) => {
              const rawRegion = feature.properties.region;
              const region = canonicalRegion(
                typeof rawRegion === 'string' ? rawRegion : 'Region',
              );
              const summary = summaries.get(region);
              feature.properties = {
                ...feature.properties,
                region,
                hasData: Boolean(summary),
                status: summary?.status || 'No data',
                regionColor: regionColors[region] || '#94a3b8',
              };
              if (summary)
                extendGeometryBounds(bounds, feature.geometry.coordinates);
            });
            map.addSource('psip-regions', {
              type: 'geojson',
              data: geojson as never,
              generateId: true,
            });
            map.addLayer({
              id: 'psip-regions-fill',
              type: 'fill',
              source: 'psip-regions',
              paint: {
                'fill-color': ['coalesce', ['get', 'regionColor'], '#94a3b8'],
                'fill-opacity': [
                  'case',
                  ['boolean', ['feature-state', 'hover'], false],
                  0.78,
                  ['boolean', ['get', 'hasData'], false],
                  0.68,
                  0.3,
                ],
              },
            });
            map.addLayer({
              id: 'psip-regions-outline',
              type: 'line',
              source: 'psip-regions',
              paint: {
                'line-color': [
                  'case',
                  ['boolean', ['get', 'hasData'], false],
                  '#173a70',
                  '#94a3b8',
                ],
                'line-opacity': [
                  'case',
                  ['boolean', ['get', 'hasData'], false],
                  0.9,
                  0.35,
                ],
                'line-width': [
                  'case',
                  ['boolean', ['get', 'hasData'], false],
                  1.3,
                  0.7,
                ],
              },
            });
            const popup = new mapboxgl.Popup({
              closeButton: true,
              closeOnClick: false,
              maxWidth: '290px',
              offset: 12,
            });
            let hoveredId: string | number | undefined;
            const showRegionPopup = (
              feature: RegionFeature,
              lngLat: LngLat,
            ) => {
              const rawRegion = feature.properties?.region;
              const region =
                typeof rawRegion === 'string' ? rawRegion : 'Region';
              popup
                .setLngLat(lngLat)
                .setDOMContent(
                  regionPopupContent(region, summaries.get(region)),
                )
                .addTo(map);
            };
            map.on('mousemove', 'psip-regions-fill', (event) => {
              const feature = event.features?.[0] as RegionFeature | undefined;
              if (!feature) return;
              if (hoveredId !== undefined)
                map.setFeatureState(
                  { source: 'psip-regions', id: hoveredId },
                  { hover: false },
                );
              hoveredId = feature.id;
              if (hoveredId !== undefined)
                map.setFeatureState(
                  { source: 'psip-regions', id: hoveredId },
                  { hover: true },
                );
              map.getCanvas().style.cursor = 'pointer';
              showRegionPopup(feature, event.lngLat);
            });
            map.on('click', 'psip-regions-fill', (event) => {
              const feature = event.features?.[0] as RegionFeature | undefined;
              if (feature) showRegionPopup(feature, event.lngLat);
            });
            map.on('mouseleave', 'psip-regions-fill', () => {
              if (hoveredId !== undefined)
                map.setFeatureState(
                  { source: 'psip-regions', id: hoveredId },
                  { hover: false },
                );
              hoveredId = undefined;
              map.getCanvas().style.cursor = '';
              popup.remove();
            });
          } catch (error) {
            if (!controller.signal.aborted)
              console.error('Regional boundaries failed to render', error);
          }
        }
        if (!bounds.isEmpty()) {
          const width = host.current?.clientWidth || window.innerWidth;
          const padding = width < 640 ? 20 : width < 1024 ? 32 : 48;
          map.fitBounds(bounds, { padding, maxZoom: 7, duration: 0 });
        }
        requestAnimationFrame(() => map.resize());
      });
      map.on('error', (event) =>
        console.error('Mapbox failed to render', event.error),
      );
      cleanup = () => {
        resizeObserver.disconnect();
        window.visualViewport?.removeEventListener('resize', resizeMap);
        reactRoots.forEach((root) => root.unmount());
        markers.forEach((marker) => marker.remove());
        map.remove();
      };
    });
    return () => {
      disposed = true;
      controller.abort();
      cleanup();
    };
  }, [projects, view]);
  const tokenReady =
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.startsWith('pk.');
  if (!tokenReady)
    return (
      <div className="grid h-full place-items-center bg-[#eaf0f7] p-6 text-center text-sm font-semibold text-[#526079]">
        Add a public Mapbox token to NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN.
      </div>
    );
  return (
    <div
      ref={host}
      className="h-full w-full"
      role="application"
      aria-label={
        view === REGIONAL_VIEW
          ? 'Interactive Mapbox map shaded by regional operational readiness'
          : 'Interactive Mapbox map of PSIP school projects'
      }
    />
  );
}
