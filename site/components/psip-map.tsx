'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReadinessStatus, SchoolProject } from '@/lib/psip-data';

const statusColors: Record<ReadinessStatus, string> = {
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
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown };
  properties: Record<string, unknown>;
};
type RegionFeatureCollection = {
  type: 'FeatureCollection';
  features: RegionFeature[];
};
type ProjectPointCollection = {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: {
      projectIndex: number;
      color: string;
      schoolName: string;
      classrooms: number;
      readiness: ReadinessStatus;
    };
  }>;
};
type MapPointFeature = {
  geometry: { type: string; coordinates: [number, number] };
  properties?: Record<string, unknown>;
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
    detail.textContent = `${summary.projects} project records · ${summary.sites} school sites`;
    detail.style.cssText = 'margin:4px 0 0;color:#526079;font-size:12px';
    root.appendChild(detail);
  }
  return root;
}

function projectPopupContent(project: SchoolProject) {
  const root = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = project.name;
  title.style.cssText = 'display:block;color:#102044;font-size:14px';
  const location = document.createElement('p');
  location.textContent = `${project.division} · ${project.region}`;
  location.style.cssText = 'margin:5px 0 0;color:#526079;font-size:11px';
  const detail = document.createElement('p');
  detail.textContent = `${project.classrooms} classrooms · ${project.readiness}`;
  detail.style.cssText =
    'margin:5px 0 0;color:#102044;font-size:12px;font-weight:700';
  root.appendChild(title);
  root.appendChild(location);
  root.appendChild(detail);
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
  view = REGIONAL_VIEW,
}: {
  projects: SchoolProject[];
  onSelect: (project: SchoolProject) => void;
  view?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const selectRef = useRef(onSelect);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    selectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!host.current || !token?.startsWith('pk.')) return;
    let disposed = false;
    let cleanup = () => {};
    const controller = new AbortController();
    setLoading(true);
    setError('');

    const idleTimer = window.setTimeout(() => {
      void import('mapbox-gl')
        .then(({ default: mapboxgl }) => {
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
          const bounds = new mapboxgl.LngLatBounds();

          map.once('load', async () => {
            if (disposed) return;
            try {
              if (view === REGIONAL_VIEW) {
                const response = await fetch(
                  '/data/philippines-regions.geojson',
                  {
                    signal: controller.signal,
                  },
                );
                if (!response.ok)
                  throw new Error('Regional boundaries unavailable');
                const geojson =
                  (await response.json()) as RegionFeatureCollection;
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
                    'fill-color': [
                      'coalesce',
                      ['get', 'regionColor'],
                      '#94a3b8',
                    ],
                    'fill-opacity': [
                      'case',
                      ['boolean', ['get', 'hasData'], false],
                      [
                        'case',
                        ['boolean', ['feature-state', 'hover'], false],
                        0.78,
                        0.68,
                      ],
                      0,
                    ],
                  },
                });
                map.addLayer({
                  id: 'psip-regions-outline',
                  type: 'line',
                  source: 'psip-regions',
                  paint: {
                    'line-color': '#173a70',
                    'line-opacity': 0.72,
                    'line-width': 1,
                  },
                });
                const popup = new mapboxgl.Popup({
                  closeButton: false,
                  closeOnClick: false,
                  maxWidth: '290px',
                  offset: 12,
                });
                let hoveredId: string | number | undefined;
                map.on('mousemove', 'psip-regions-fill', (event) => {
                  const feature = event.features?.[0] as
                    | RegionFeature
                    | undefined;
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
                  const rawRegion = feature.properties?.region;
                  const region =
                    typeof rawRegion === 'string' ? rawRegion : 'Region';
                  map.getCanvas().style.cursor = 'pointer';
                  popup
                    .setLngLat(event.lngLat)
                    .setDOMContent(
                      regionPopupContent(region, summaries.get(region)),
                    )
                    .addTo(map);
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
              } else {
                const buildingTypes = Array.from(
                  new Set(projects.map((project) => project.buildingType)),
                );
                const points: ProjectPointCollection = {
                  type: 'FeatureCollection',
                  features: projects.flatMap((project, projectIndex) => {
                    if (
                      !Number.isFinite(project.lng) ||
                      !Number.isFinite(project.lat)
                    ) {
                      return [];
                    }
                    const buildingIndex = Math.max(
                      0,
                      buildingTypes.indexOf(project.buildingType),
                    );
                    const color =
                      view === 'Sites Operational Readiness Locator'
                        ? statusColors[project.readiness]
                        : buildingColors[buildingIndex % buildingColors.length];
                    const coordinates: [number, number] = [
                      project.lng!,
                      project.lat!,
                    ];
                    bounds.extend(coordinates);
                    return [
                      {
                        type: 'Feature' as const,
                        geometry: { type: 'Point' as const, coordinates },
                        properties: {
                          projectIndex,
                          color,
                          schoolName: project.name,
                          classrooms: project.classrooms,
                          readiness: project.readiness,
                        },
                      },
                    ];
                  }),
                };
                map.addSource('psip-projects', {
                  type: 'geojson',
                  data: points as never,
                  cluster: true,
                  clusterMaxZoom: 12,
                  clusterRadius: 48,
                });
                map.addLayer({
                  id: 'psip-clusters',
                  type: 'circle',
                  source: 'psip-projects',
                  filter: ['has', 'point_count'],
                  paint: {
                    'circle-color': '#1854bd',
                    'circle-radius': [
                      'step',
                      ['get', 'point_count'],
                      18,
                      25,
                      23,
                      100,
                      29,
                    ],
                    'circle-stroke-color': '#ffffff',
                    'circle-stroke-width': 3,
                  },
                });
                map.addLayer({
                  id: 'psip-cluster-count',
                  type: 'symbol',
                  source: 'psip-projects',
                  filter: ['has', 'point_count'],
                  layout: {
                    'text-field': ['get', 'point_count_abbreviated'],
                    'text-size': 12,
                  },
                  paint: { 'text-color': '#ffffff' },
                });
                map.addLayer({
                  id: 'psip-points',
                  type: 'circle',
                  source: 'psip-projects',
                  filter: ['!', ['has', 'point_count']],
                  paint: {
                    'circle-color': ['get', 'color'],
                    'circle-radius': 7,
                    'circle-stroke-color': '#ffffff',
                    'circle-stroke-width': 2,
                  },
                });
                map.on('click', 'psip-clusters', (event) => {
                  const feature = event.features?.[0] as unknown as
                    | MapPointFeature
                    | undefined;
                  if (!feature || feature.geometry.type !== 'Point') return;
                  const clusterId = Number(feature.properties?.cluster_id);
                  const source = map.getSource(
                    'psip-projects',
                  ) as mapboxgl.GeoJSONSource;
                  source.getClusterExpansionZoom(
                    clusterId,
                    (clusterError, zoom) => {
                      if (clusterError || zoom === null || zoom === undefined)
                        return;
                      map.easeTo({
                        center: feature.geometry.coordinates as [
                          number,
                          number,
                        ],
                        zoom,
                      });
                    },
                  );
                });
                const popup = new mapboxgl.Popup({
                  closeButton: false,
                  closeOnClick: false,
                  maxWidth: '290px',
                  offset: 12,
                });
                map.on('mouseenter', 'psip-points', (event) => {
                  const feature = event.features?.[0] as unknown as
                    | MapPointFeature
                    | undefined;
                  const project =
                    projects[Number(feature?.properties?.projectIndex)];
                  if (!feature || feature.geometry.type !== 'Point' || !project)
                    return;
                  map.getCanvas().style.cursor = 'pointer';
                  popup
                    .setLngLat(feature.geometry.coordinates as [number, number])
                    .setDOMContent(projectPopupContent(project))
                    .addTo(map);
                });
                map.on('mouseleave', 'psip-points', () => {
                  map.getCanvas().style.cursor = '';
                  popup.remove();
                });
                map.on('click', 'psip-points', (event) => {
                  const feature = event.features?.[0] as unknown as
                    | MapPointFeature
                    | undefined;
                  const project =
                    projects[Number(feature?.properties?.projectIndex)];
                  if (project) selectRef.current(project);
                });
              }
              if (!bounds.isEmpty()) {
                map.fitBounds(bounds, { padding: 48, maxZoom: 7, duration: 0 });
              }
              requestAnimationFrame(() => map.resize());
              setLoading(false);
            } catch (cause) {
              if (controller.signal.aborted) return;
              console.error('Map data failed to render', cause);
              setError(
                'The map data could not be rendered. The table remains available.',
              );
              setLoading(false);
            }
          });
          map.on('error', () => {
            if (!disposed) {
              setError(
                'The map tiles could not be loaded. The table remains available.',
              );
              setLoading(false);
            }
          });
          cleanup = () => map.remove();
        })
        .catch(() => {
          if (!disposed) {
            setError('The interactive map could not be initialized.');
            setLoading(false);
          }
        });
    }, 120);

    return () => {
      disposed = true;
      window.clearTimeout(idleTimer);
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
    <div className="relative h-full w-full">
      <div
        ref={host}
        className="h-full w-full"
        role="application"
        aria-label={
          view === REGIONAL_VIEW
            ? 'Interactive Mapbox map shaded by regional operational readiness'
            : 'Clustered interactive Mapbox map of PSIP school projects'
        }
      />
      {loading && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-[#eaf0f7] text-sm font-semibold text-[#526079]">
          Loading map data…
        </div>
      )}
      {error && (
        <div className="absolute bottom-4 left-1/2 z-[600] w-[min(90%,420px)] -translate-x-1/2 rounded-xl border border-red-200 bg-white px-4 py-3 text-center text-xs font-semibold text-red-700 shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
}
