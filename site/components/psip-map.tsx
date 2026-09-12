'use client';

import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { animate } from 'animejs';
import { SchoolMapTooltip } from '@/components/school-map-tooltip';
import type { ReadinessStatus, SchoolProject } from '@/lib/psip-data';

const statusColors: Record<ReadinessStatus, string> = {
  Ready: '#14855f',
  Pending: '#c57a0a',
  'At risk': '#c83f50',
  Unknown: '#64748b',
};
const buildingColors = ['#1e5fc4', '#10a779', '#d89a12', '#7c3aed'];
function buildingColor(name: string, index: number) {
  const normalized = name.toLowerCase();
  if (normalized.includes('low')) return '#f5b700';
  if (normalized.includes('mid')) return '#10a779';
  if (normalized.includes('high')) return '#1e5fc4';
  return buildingColors[index % buildingColors.length];
}
const REGIONAL_VIEW = 'Regional View';
const REGIONAL_CLUSTER_ZOOM = 8.5;
const HEATMAP_VIEW = 'At-risk Heatmap';
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
  root.appendChild(title);
  if (summary) {
    const detail = document.createElement('p');
    detail.textContent = `${summary.projects} project records · ${summary.sites} school sites`;
    detail.style.cssText = 'margin:6px 0 0;color:#526079;font-size:12px';
    root.appendChild(detail);
  } else {
    const empty = document.createElement('p');
    empty.textContent = 'No matching project data';
    empty.style.cssText =
      'margin:6px 0 0;color:#102044;font-size:12px;font-weight:700';
    root.appendChild(empty);
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
  searchKind,
  allProjects,
  view = REGIONAL_VIEW,
}: {
  projects: SchoolProject[];
  searchKind?: string;
  allProjects: SchoolProject[];
  view?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
            'bottom-right',
          );
          const bounds = new mapboxgl.LngLatBounds();
          const popupHost = document.createElement('div');
          const popupRoot = createRoot(popupHost);
          let pinned = false;
          let hideTimer: ReturnType<typeof setTimeout> | undefined;
          let schoolPopup = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false,
            maxWidth: '480px',
            offset: 14,
            className: 'school-summary-popup',
          });
          const closeSchoolPopup = () => {
            pinned = false;
            schoolPopup.remove();
          };
          const showSchool = (project: SchoolProject, pin: boolean) => {
            if (pinned && !pin) return;
            if (!Number.isFinite(project.lng) || !Number.isFinite(project.lat))
              return;
            clearTimeout(hideTimer);
            pinned = pin;
            const rows = allProjects.filter((row) => row.id === project.id);
            flushSync(() =>
              popupRoot.render(
                <SchoolMapTooltip
                  rows={rows.length ? rows : [project]}
                  pinned={pinned}
                  onClose={closeSchoolPopup}
                />,
              ),
            );
            const point = map.project([project.lng!, project.lat!]);
            const mapHeight = map.getContainer().clientHeight;
            const mapWidth = map.getContainer().clientWidth;
            const above = point.y - 220;
            const below = mapHeight - point.y - 24;
            const vertical = above >= below ? 'bottom' : 'top';
            const horizontal =
              point.x < 250
                ? '-left'
                : point.x > mapWidth - 250
                  ? '-right'
                  : '';
            const body =
              popupHost.querySelector<HTMLElement>('.school-map-body');
            const besidePin = Math.max(point.x, mapWidth - point.x) >= 510;
            if (body)
              body.style.maxHeight = `${Math.max(150, Math.min(760, besidePin ? mapHeight - 320 : Math.max(above, below) - 76))}px`;
            schoolPopup.remove();
            schoolPopup = new mapboxgl.Popup({
              closeButton: false,
              closeOnClick: false,
              maxWidth: '480px',
              offset: 14,
              className: 'school-summary-popup',
              anchor: besidePin
                ? point.x < mapWidth / 2
                  ? 'left'
                  : 'right'
                : (`${vertical}${horizontal}` as
                    | 'top'
                    | 'bottom'
                    | 'top-left'
                    | 'top-right'
                    | 'bottom-left'
                    | 'bottom-right'),
            });
            schoolPopup
              .setLngLat([project.lng!, project.lat!])
              .setDOMContent(popupHost)
              .addTo(map);
            if (besidePin) {
              const cardHeight = popupHost.getBoundingClientRect().height;
              const centerY = Math.max(
                220 + cardHeight / 2,
                Math.min(point.y, mapHeight - 24 - cardHeight / 2),
              );
              schoolPopup.setOffset([
                point.x < mapWidth / 2 ? 14 : -14,
                centerY - point.y,
              ]);
            }
          };
          const hideSchool = () => {
            if (!pinned)
              hideTimer = setTimeout(() => {
                if (!pinned) schoolPopup.remove();
              }, 200);
          };
          popupHost.addEventListener('mouseenter', () =>
            clearTimeout(hideTimer),
          );
          popupHost.addEventListener('mouseleave', hideSchool);
          popupHost.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') closeSchoolPopup();
          });
          let regionalPinsVisible = map.getZoom() >= REGIONAL_CLUSTER_ZOOM;
          let regionalAnimation: ReturnType<typeof animate> | undefined;
          const bindSchoolInteraction = (
            layerId: string,
            property = 'projectIndex',
          ) => {
            const getProject = (event: { features?: unknown[] }) => {
              if (view === REGIONAL_VIEW && !regionalPinsVisible) return undefined;
              const feature = event.features?.[0] as
                | MapPointFeature
                | undefined;
              return projects[Number(feature?.properties?.[property])];
            };
            map.on('mouseenter', layerId, (event) => {
              map.getCanvas().style.cursor = 'pointer';
              const project = getProject(event);
              if (project) showSchool(project, false);
            });
            map.on('mouseleave', layerId, () => {
              map.getCanvas().style.cursor = '';
              hideSchool();
            });
            map.on('click', layerId, (event) => {
              const project = getProject(event);
              if (project) showSchool(project, true);
            });
          };

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
                map.on('zoom', () => {
                  if (regionalPinsVisible) popup.remove();
                  else closeSchoolPopup();
                });
                let hoveredId: string | number | undefined;
                map.on('mousemove', 'psip-regions-fill', (event) => {
                  if (regionalPinsVisible) return;
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
                const visibleSchools = new Set<string>();
                const points: ProjectPointCollection = {
                  type: 'FeatureCollection',
                  features: projects.flatMap((project, projectIndex) => {
                    if (
                      !Number.isFinite(project.lng) ||
                      !Number.isFinite(project.lat)
                    ) {
                      return [];
                    }
                    if (view !== HEATMAP_VIEW && visibleSchools.has(project.id))
                      return [];
                    visibleSchools.add(project.id);
                    const buildingIndex = Math.max(
                      0,
                      buildingTypes.indexOf(project.buildingType),
                    );
                    const color =
                      view === 'Site Readiness'
                        ? statusColors[project.readiness]
                        : buildingColor(project.buildingType, buildingIndex);
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
                if (view === HEATMAP_VIEW) {
                  map.addSource('psip-projects', {
                    type: 'geojson',
                    data: points as never,
                  });
                  map.addLayer({
                    id: 'psip-at-risk-heatmap',
                    type: 'heatmap',
                    source: 'psip-projects',
                    filter: ['==', ['get', 'readiness'], 'At risk'],
                    maxzoom: 11,
                    paint: {
                      'heatmap-weight': [
                        'interpolate',
                        ['linear'],
                        ['get', 'classrooms'],
                        0,
                        0.2,
                        40,
                        1,
                      ],
                      'heatmap-intensity': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        3,
                        0.7,
                        10,
                        2.2,
                      ],
                      'heatmap-radius': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        3,
                        16,
                        10,
                        42,
                      ],
                      'heatmap-color': [
                        'interpolate',
                        ['linear'],
                        ['heatmap-density'],
                        0,
                        'rgba(254,240,138,0)',
                        0.25,
                        '#fde68a',
                        0.5,
                        '#fb923c',
                        0.75,
                        '#ef4444',
                        1,
                        '#991b1b',
                      ],
                      'heatmap-opacity': 0.82,
                    },
                  });
                  map.addLayer({
                    id: 'psip-at-risk-points',
                    type: 'circle',
                    source: 'psip-projects',
                    filter: ['==', ['get', 'readiness'], 'At risk'],
                    minzoom: 8,
                    paint: {
                      'circle-color': statusColors['At risk'],
                      'circle-radius': 6,
                      'circle-stroke-color': '#ffffff',
                      'circle-stroke-width': 2,
                    },
                  });
                  bindSchoolInteraction('psip-at-risk-points');
                } else {
                  map.addSource('psip-projects', {
                    type: 'geojson',
                    data: points as never,
                    cluster: true,
                    clusterMaxZoom: 12,
                    clusterRadius: 48,
                    clusterProperties: {
                      readyCount: [
                        '+',
                        ['case', ['==', ['get', 'readiness'], 'Ready'], 1, 0],
                      ],
                      pendingCount: [
                        '+',
                        ['case', ['==', ['get', 'readiness'], 'Pending'], 1, 0],
                      ],
                      atRiskCount: [
                        '+',
                        ['case', ['==', ['get', 'readiness'], 'At risk'], 1, 0],
                      ],
                      unknownCount: [
                        '+',
                        ['case', ['==', ['get', 'readiness'], 'Unknown'], 1, 0],
                      ],
                    },
                  });
                  map.addLayer({
                    id: 'psip-clusters',
                    type: 'circle',
                    source: 'psip-projects',
                    filter: ['has', 'point_count'],
                    paint: {
                      'circle-color':
                        view === 'Site Readiness'
                          ? [
                              'case',
                              [
                                'all',
                                [
                                  '>=',
                                  ['get', 'atRiskCount'],
                                  ['get', 'readyCount'],
                                ],
                                [
                                  '>=',
                                  ['get', 'atRiskCount'],
                                  ['get', 'pendingCount'],
                                ],
                                [
                                  '>=',
                                  ['get', 'atRiskCount'],
                                  ['get', 'unknownCount'],
                                ],
                              ],
                              statusColors['At risk'],
                              [
                                'all',
                                [
                                  '>=',
                                  ['get', 'pendingCount'],
                                  ['get', 'readyCount'],
                                ],
                                [
                                  '>=',
                                  ['get', 'pendingCount'],
                                  ['get', 'unknownCount'],
                                ],
                              ],
                              statusColors.Pending,
                              [
                                '>=',
                                ['get', 'readyCount'],
                                ['get', 'unknownCount'],
                              ],
                              statusColors.Ready,
                              statusColors.Unknown,
                            ]
                          : '#1854bd',
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
                        if (clusterError || zoom == null) return;
                        map.easeTo({
                          center: feature.geometry.coordinates,
                          zoom,
                        });
                      },
                    );
                  });
                  bindSchoolInteraction('psip-points');
                }
              }
              if (view === REGIONAL_VIEW) {
                const regions = Array.from(
                  new Set(
                    projects.map((project) => canonicalRegion(project.region)),
                  ),
                );
                regions.forEach((region, regionIndex) => {
                  const sourceId = `regional-schools-${regionIndex}`;
                  const clusterId = `${sourceId}-clusters`;
                  const pointId = `${sourceId}-points`;
                  const seen = new Set<string>();
                  const features = projects.flatMap((project, projectIndex) => {
                    if (
                      canonicalRegion(project.region) !== region ||
                      seen.has(project.id) ||
                      !Number.isFinite(project.lng) ||
                      !Number.isFinite(project.lat)
                    )
                      return [];
                    seen.add(project.id);
                    return [
                      {
                        type: 'Feature' as const,
                        geometry: {
                          type: 'Point' as const,
                          coordinates: [project.lng!, project.lat!],
                        },
                        properties: { projectIndex },
                      },
                    ];
                  });
                  const color = regionColors[region] || '#94a3b8';
                  map.addSource(sourceId, {
                    type: 'geojson',
                    cluster: true,
                    clusterMaxZoom: 12,
                    clusterRadius: 48,
                    data: { type: 'FeatureCollection', features },
                  });
                  map.addLayer({
                    id: clusterId,
                    type: 'circle',
                    source: sourceId,
                    filter: ['has', 'point_count'],
                    paint: {
                      'circle-color': color,
                      'circle-radius': [
                        'step',
                        ['get', 'point_count'],
                        16,
                        25,
                        21,
                        100,
                        27,
                      ],
                      'circle-stroke-color': '#ffffff',
                      'circle-stroke-width': 2,
                    },
                  });
                  map.addLayer({
                    id: `${sourceId}-counts`,
                    type: 'symbol',
                    source: sourceId,
                    filter: ['has', 'point_count'],
                    layout: {
                      'text-field': ['get', 'point_count_abbreviated'],
                      'text-size': 12,
                      'text-allow-overlap': true,
                    },
                    paint: {
                      'text-color': [
                        'Region II',
                        'Region III',
                        'Region IV-B',
                        'Region VI',
                        'Region XVIII',
                      ].includes(region)
                        ? '#102044'
                        : '#ffffff',
                    },
                  });
                  map.addLayer({
                    id: pointId,
                    type: 'circle',
                    source: sourceId,
                    filter: ['!', ['has', 'point_count']],
                    paint: {
                      'circle-color': color,
                      'circle-radius': 7,
                      'circle-stroke-color': '#ffffff',
                      'circle-stroke-width': 2,
                    },
                  });
                  bindSchoolInteraction(pointId);
                  map.on('mouseenter', clusterId, () => {
                    map.getCanvas().style.cursor = 'pointer';
                  });
                  map.on('mouseleave', clusterId, () => {
                    map.getCanvas().style.cursor = '';
                  });
                  map.on('click', clusterId, (event) => {
                    if (view === REGIONAL_VIEW && !regionalPinsVisible) return;
                    const feature = event.features?.[0] as unknown as
                      | MapPointFeature
                      | undefined;
                    if (!feature) return;
                    const source = map.getSource(
                      sourceId,
                    ) as mapboxgl.GeoJSONSource;
                    source.getClusterExpansionZoom(
                      Number(feature.properties?.cluster_id),
                      (error, zoom) => {
                        if (error || zoom == null || disposed) return;
                        map.easeTo({
                          center: feature.geometry.coordinates,
                          zoom,
                          duration: window.matchMedia(
                            '(prefers-reduced-motion: reduce)',
                          ).matches
                            ? 0
                            : 500,
                        });
                      },
                    );
                  });
                });
                const progress = { pins: regionalPinsVisible ? 1 : 0 };
                const fillOpacity = map.getPaintProperty('psip-regions-fill', 'fill-opacity');
                const renderRegionalTransition = () => {
                  if (disposed) return;
                  const amount = progress.pins;
                  const scale = 0.8 + amount * 0.2;
                  map.setPaintProperty('psip-regions-fill', 'fill-opacity-transition', { duration: 0 });
                  map.setPaintProperty('psip-regions-outline', 'line-opacity-transition', { duration: 0 });
                  map.setPaintProperty('psip-regions-fill', 'fill-opacity', ['*', 1 - amount, fillOpacity]);
                  map.setPaintProperty('psip-regions-outline', 'line-opacity', 0.72 * (1 - amount));
                  for (const id of ['psip-regions-fill', 'psip-regions-outline']) {
                    map.setLayoutProperty(id, 'visibility', amount === 1 ? 'none' : 'visible');
                  }
                  regions.forEach((_, index) => {
                    const prefix = `regional-schools-${index}`;
                    for (const suffix of ['clusters', 'points', 'counts']) {
                      const id = `${prefix}-${suffix}`;
                      map.setLayoutProperty(id, 'visibility', amount === 0 ? 'none' : 'visible');
                      if (suffix === 'counts') {
                        map.setPaintProperty(id, 'text-opacity-transition', { duration: 0 });
                        map.setPaintProperty(id, 'text-opacity', amount);
                      } else {
                        for (const property of ['circle-opacity', 'circle-stroke-opacity', 'circle-radius'] as const) {
                          map.setPaintProperty(id, `${property}-transition`, { duration: 0 });
                        }
                        map.setPaintProperty(id, 'circle-opacity', amount);
                        map.setPaintProperty(id, 'circle-stroke-opacity', amount);
                        map.setPaintProperty(id, 'circle-radius', suffix === 'points' ? 7 * scale :
                          ['*', scale, ['step', ['get', 'point_count'], 16, 25, 21, 100, 27]]);
                      }
                    }
                  });
                };
                renderRegionalTransition();
                map.on('zoom', () => {
                  // Separate thresholds prevent flickering when zoom rests near the boundary.
                  const next = regionalPinsVisible
                    ? map.getZoom() > REGIONAL_CLUSTER_ZOOM - 0.15
                    : map.getZoom() >= REGIONAL_CLUSTER_ZOOM;
                  if (next === regionalPinsVisible) return;
                  regionalPinsVisible = next;
                  closeSchoolPopup();
                  regionalAnimation?.pause();
                  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                    progress.pins = next ? 1 : 0;
                    renderRegionalTransition();
                    return;
                  }
                  // Animate from the current value so interrupted zooms reverse smoothly.
                  regionalAnimation = animate(progress, {
                    pins: next ? 1 : 0,
                    duration: 450,
                    ease: 'out(3)',
                    onUpdate: renderRegionalTransition,
                    onComplete: renderRegionalTransition,
                  });
                });
              }
              if (!bounds.isEmpty()) {
                map.fitBounds(bounds, {
                  padding: { top: 220, bottom: 64, left: 64, right: 64 },
                  maxZoom: searchKind === 'school' ? 14 : searchKind ? 11 : 7,
                  duration: window.matchMedia(
                    '(prefers-reduced-motion: reduce)',
                  ).matches
                    ? 0
                    : 700,
                });
              }
              if (searchKind === 'school' && projects[0])
                showSchool(projects[0], false);
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
          cleanup = () => {
            regionalAnimation?.pause();
            clearTimeout(hideTimer);
            schoolPopup.remove();
            popupRoot.unmount();
            map.remove();
          };
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
  }, [projects, allProjects, view, searchKind]);

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
            : view === HEATMAP_VIEW
              ? 'Heatmap of at-risk PSIP school project density'
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
