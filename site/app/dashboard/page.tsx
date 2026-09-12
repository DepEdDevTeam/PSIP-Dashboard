'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useReveals, useEntrance, useDrawer } from '@/lib/animation';
import { AnimatedNumber } from '@/components/animated-number';
import SchoolReportDetails from '@/components/school-report-details';
import { PhotoNavbar, type PhotoSchool } from '@/components/site-photos';
import { MapFilterToggle } from '@/components/ui/map-filter-toggle';
import dynamic from 'next/dynamic';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  ArrowUpDown,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FlaskConical,
  GraduationCap,
  Home,
  LayoutDashboard,
  MapPinned,
  Mic,
  Monitor,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Flame,
  Wrench,
  X,
} from 'lucide-react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ProjectFilters, SchoolProject } from '@/lib/psip-data';
import {
  searchProjects,
  searchContext,
  searchSuggestions,
} from '@/lib/dashboard-search';
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
} from '@/components/ui/combobox';
import { fetchDashboard } from '@/lib/psip-api';

const PsipMap = dynamic(() => import('@/components/psip-map'), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center bg-[#eaf0f7] text-sm font-semibold text-[#526079]">
      Preparing the interactive map…
    </div>
  ),
});

const number = new Intl.NumberFormat('en-PH');
const blank: ProjectFilters = {
  region: '',
  division: '',
  buildingType: '',
  readiness: '',
  scope: '',
  search: '',
};
const readinessColor = {
  Ready: '#14855f',
  Pending: '#c57a0a',
  'At risk': '#c83f50',
  Unknown: '#64748b',
};
const buildingColors = ['#1e5fc4', '#10a779', '#d89a12', '#7c3aed'];
const col = createColumnHelper<SchoolProject>();

type DashboardView = 'map' | 'report' | 'directory';
const dashboardViews: DashboardView[] = ['map', 'report', 'directory'];
export type AnalyticsLens =
  | 'Regional View'
  | 'Building Profile'
  | 'Site Readiness'
  | 'At-risk Heatmap';
type RegionRow = {
  region: string;
  classrooms: number;
  sites: number;
  special: number;
  buildings: Record<string, number>;
  readiness: Record<string, number>;
};

const lenses = [
  { value: 'Regional View', short: 'Regions' },
  { value: 'Building Profile', short: 'Buildings' },
  {
    value: 'Site Readiness',
    short: 'Readiness',
  },
  { value: 'At-risk Heatmap', short: 'Heatmap' },
] as const;

const reportLenses = [lenses[1], lenses[2]] as const;

function appliesScope(project: SchoolProject, scope: string) {
  return (
    !scope ||
    (scope === 'Demolition' && project.demolition) ||
    (scope === 'Site improvement' && project.siteImprovement) ||
    (scope === 'Slope protection' && project.slopeProtection)
  );
}
function uniqueSites(data: SchoolProject[]) {
  return new Set(data.map((project) => project.id)).size;
}
function specialRooms(project: SchoolProject) {
  const facilities = project.facilities;
  return facilities
    ? (facilities.audioVisual || 0) +
        (facilities.computerLab || 0) +
        (facilities.homeEconomics || 0) +
        (facilities.scienceLab || 0) +
        (facilities.workshop || 0)
    : 0;
}

export default function DashboardPage() {
  const [filters, setFilters] = useState<ProjectFilters>(blank);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [view, setView] = useState<DashboardView>('report');
  const [viewDirection, setViewDirection] = useState(0);
  const [lens, setLens] = useState<AnalyticsLens>('Regional View');
  const [mapBuildingTypes, setMapBuildingTypes] = useState<string[]>([]);
  const [mapReadiness, setMapReadiness] = useState<string[]>([]);
  const [projects, setProjects] = useState<SchoolProject[]>([]);
  const [apiOptions, setApiOptions] = useState({
    regions: [] as string[],
    divisions: [] as string[],
    buildingTypes: [] as string[],
  });
  const [snapshotDate, setSnapshotDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const viewRef = useEntrance<HTMLDivElement>(`${view}:${loading}`, viewDirection * 20);

  const navigateToView = (nextView: DashboardView) => {
    if (nextView === view) return;
    setViewDirection(
      Math.sign(
        dashboardViews.indexOf(nextView) - dashboardViews.indexOf(view),
      ),
    );
    setView(nextView);
  };

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    setFilters({
      region: query.get('region') || '',
      division: query.get('division') || '',
      buildingType: query.get('building') || '',
      readiness: query.get('readiness') || '',
      scope: query.get('scope') || '',
      search: query.get('search') || '',
    });
    const queryView = query.get('view');
    if (
      queryView === 'map' ||
      queryView === 'report' ||
      queryView === 'directory'
    )
      setView(queryView);
    const queryLens = query.get('lens');
    if (lenses.some((item) => item.value === queryLens))
      setLens(queryLens as AnalyticsLens);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchDashboard(controller.signal, reloadKey > 0)
      .then((data) => {
        setProjects(data.projects);
        setApiOptions({
          regions: data.options.regions,
          divisions: data.options.divisions,
          buildingTypes: Array.from(
            new Set(data.projects.map((project) => project.buildingType)),
          ).sort(),
        });
        setSnapshotDate(data.snapshotDate);
      })
      .catch((reason) => {
        if (reason?.name !== 'AbortError')
          setError(
            reason instanceof Error
              ? reason.message
              : 'Unable to load Fabric data.',
          );
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [reloadKey]);

  useEffect(() => {
    const query = new URLSearchParams();
    const record = new URLSearchParams(location.search).get('record');
    if (record) query.set('record', record);
    Object.entries(filters).forEach(([key, value]) => {
      if (value) query.set(key === 'buildingType' ? 'building' : key, value);
    });
    if (view !== 'report') query.set('view', view);
    if (lens !== 'Regional View') query.set('lens', lens);
    history.replaceState(
      null,
      '',
      `/dashboard${query.size ? `?${query}` : ''}${location.hash}`,
    );
  }, [filters, lens, view]);

  useEffect(() => {
    if (!projects.length || !filters.region || !filters.division) return;
    const divisionBelongsToRegion = projects.some(
      (project) =>
        project.region === filters.region &&
        project.division === filters.division,
    );
    if (!divisionBelongsToRegion)
      setFilters((current) => ({ ...current, division: '' }));
  }, [filters.division, filters.region, projects]);

  const availableDivisions = useMemo(
    () =>
      Array.from(
        new Set(
          projects
            .filter(
              (project) => !filters.region || project.region === filters.region,
            )
            .map((project) => project.division),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [filters.region, projects],
  );

  const searched = useMemo(
    () => searchProjects(projects, filters.search),
    [projects, filters.search],
  );
  const context = useMemo(
    () => searchContext(searched, filters.search),
    [searched, filters.search],
  );
  const suggestions = useMemo(
    () =>
      Array.from(
        new Set(projects.flatMap((p) => [p.name, p.id, p.division, p.region])),
      ).sort(),
    [projects],
  );

  const filtered = useMemo(
    () =>
      searched.filter(
        (project) =>
          (!filters.region || project.region === filters.region) &&
          (!filters.division || project.division === filters.division) &&
          (!filters.buildingType ||
            project.buildingType === filters.buildingType) &&
          (!filters.readiness || project.readiness === filters.readiness) &&
          appliesScope(project, filters.scope),
      ),
    [filters, searched],
  );
  const mapBase = useMemo(
    () =>
      searched.filter(
        (project) =>
          (!filters.region || project.region === filters.region) &&
          (!filters.division || project.division === filters.division),
      ),
    [filters.division, filters.region, searched],
  );
  const mapFiltered = useMemo(() => {
    if (lens === 'Building Profile' && mapBuildingTypes.length)
      return mapBase.filter((project) =>
        mapBuildingTypes.includes(project.buildingType),
      );
    if (lens === 'Site Readiness' && mapReadiness.length)
      return mapBase.filter((project) => mapReadiness.includes(project.readiness));
    return mapBase;
  }, [lens, mapBase, mapBuildingTypes, mapReadiness]);
  const buildingData = useMemo(
    () =>
      apiOptions.buildingTypes
        .map((name, index) => ({
          name,
          value: filtered.filter((project) => project.buildingType === name)
            .length,
          color: buildingColors[index % buildingColors.length],
          fill: buildingColors[index % buildingColors.length],
        }))
        .filter((item) => item.value > 0),
    [apiOptions.buildingTypes, filtered],
  );
  const regionData = useMemo<RegionRow[]>(
    () =>
      Array.from(new Set(filtered.map((project) => project.region)))
        .map((region) => {
          const rows = filtered.filter((project) => project.region === region);
          return {
            region,
            classrooms: rows.reduce(
              (sum, project) => sum + project.classrooms,
              0,
            ),
            sites: uniqueSites(rows),
            special: rows.reduce(
              (sum, project) => sum + specialRooms(project),
              0,
            ),
            buildings: Object.fromEntries(
              apiOptions.buildingTypes.map((type) => [
                type,
                rows.filter((project) => project.buildingType === type).length,
              ]),
            ),
            readiness: Object.fromEntries(
              ['Ready', 'At risk', 'Unknown'].map((status) => [
                status,
                rows.filter((project) => project.readiness === status).length,
              ]),
            ),
          };
        })
        .sort((a, b) => b.classrooms - a.classrooms),
    [apiOptions.buildingTypes, filtered],
  );
  const classificationData = useMemo(
    () => [
      {
        name: 'Academic Classroom',
        value: filtered.reduce(
          (sum, project) => sum + (project.facilities?.academic || 0),
          0,
        ),
        icon: GraduationCap,
      },
      {
        name: 'Computer Laboratory',
        value: filtered.reduce(
          (sum, project) => sum + (project.facilities?.computerLab || 0),
          0,
        ),
        icon: Monitor,
      },
      {
        name: 'Science Laboratory',
        value: filtered.reduce(
          (sum, project) => sum + (project.facilities?.scienceLab || 0),
          0,
        ),
        icon: FlaskConical,
      },
      {
        name: 'Workshop',
        value: filtered.reduce(
          (sum, project) => sum + (project.facilities?.workshop || 0),
          0,
        ),
        icon: Wrench,
      },
      {
        name: 'Home Economics',
        value: filtered.reduce(
          (sum, project) => sum + (project.facilities?.homeEconomics || 0),
          0,
        ),
        icon: Home,
      },
      {
        name: 'Audio Visual Room',
        value: filtered.reduce(
          (sum, project) => sum + (project.facilities?.audioVisual || 0),
          0,
        ),
        icon: Mic,
      },
    ],
    [filtered],
  );
  const readinessData = useMemo(
    () =>
      ['Ready', 'Pending', 'At risk', 'Unknown']
        .map((name) => ({
          name,
          value: filtered.filter((project) => project.readiness === name)
            .length,
          color: readinessColor[name as keyof typeof readinessColor],
        }))
        .filter((item) => item.value > 0),
    [filtered],
  );
  const active = Object.entries(filters).filter(
    (entry): entry is [keyof ProjectFilters, string] => Boolean(entry[1]),
  );
  const columns = useMemo(
    () => [
      col.accessor('region', { header: 'Region' }),
      col.accessor('division', { header: 'Division' }),
      col.accessor('id', { header: 'School ID' }),
      col.accessor('name', {
        header: 'School',
        cell: (info) => (
          <a
            className="font-semibold text-[#164da8] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1854bd]"
            href={`/dashboard?search=${encodeURIComponent(info.row.original.id)}&view=report#school-details`}
          >
            {info.getValue()}
          </a>
        ),
      }),
      col.accessor('buildingType', { header: 'Building' }),
      col.accessor('classrooms', { header: 'Rooms' }),
      col.accessor('projectId', {
        header: 'Project reference',
        cell: (info) => info.getValue() || '—',
      }),
      col.accessor('readiness', {
        header: 'Readiness',
        cell: (info) => <Status value={info.getValue()} />,
      }),
    ],
    [],
  );
  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const update = (key: keyof ProjectFilters, value: string) =>
    setFilters((current) => {
      if (key === 'search')
        return { ...current, search: value, region: '', division: '' };
      if (key !== 'region') return { ...current, [key]: value };
      const divisionStillApplies =
        !value ||
        !current.division ||
        projects.some(
          (project) =>
            project.region === value && project.division === current.division,
        );
      return {
        ...current,
        region: value,
        division: divisionStillApplies ? current.division : '',
      };
    });
  const filtersPanel = (
    <DashboardFilters
      suggestions={suggestions}
      filters={filters}
      active={active}
      update={update}
      clear={() => setFilters(blank)}
      regions={apiOptions.regions}
      divisions={availableDivisions}
      buildingTypes={apiOptions.buildingTypes}
      showRegion
    />
  );
  const mapActive = active.filter(([key]) =>
    ['search', 'region', 'division'].includes(key),
  );
  const mapFiltersPanel = (
    <DashboardFilters
      suggestions={suggestions}
      filters={filters}
      active={mapActive}
      update={update}
      clear={() => {
        setFilters(blank);
        setMapBuildingTypes([]);
        setMapReadiness([]);
        setLens('Regional View');
      }}
      regions={apiOptions.regions}
      divisions={availableDivisions}
      buildingTypes={apiOptions.buildingTypes}
      showRegion
      showBuilding={false}
      showScope={false}
      mapLayout
    />
  );

  return (
    <main className="flex h-screen h-dvh min-w-0 flex-col overflow-hidden bg-[#edf2f8] text-[#102044]">
      <AppHeader photoSchools={projects.map(p => ({ schoolId: p.id, schoolName: p.name, schoolLocation: [p.municipality, p.division, p.region].filter(Boolean).join(' · ') }))} photoCurrent={filtered.length === 1 ? { schoolId: filtered[0].id, schoolName: filtered[0].name, schoolLocation: [filtered[0].municipality, filtered[0].division, filtered[0].region].filter(Boolean).join(' · ') } : undefined}
        view={view}
        onNavigate={navigateToView}
        snapshotDate={snapshotDate}
      />
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ApiError
            message={error}
            onRetry={() => setReloadKey((key) => key + 1)}
          />
        ) : (
          <div
              ref={viewRef}
              className="absolute inset-0 min-h-0 overflow-hidden"
            >
              {(view === 'map' ? mapFiltered : filtered).length === 0 ? (
                <div className="h-full overflow-auto p-4">
                  {view === 'map' ? mapFiltersPanel : filtersPanel}
                  <Empty
                    onClear={() => {
                      setFilters(blank);
                      if (view === 'map') {
                        setMapBuildingTypes([]);
                        setMapReadiness([]);
                        setLens('Regional View');
                      }
                    }}
                  />
                </div>
              ) : view === 'map' ? (
                <MapPanel
                  data={mapFiltered}
                  allProjects={projects}
                  controls={mapFiltersPanel}
                  lens={
                    context &&
                    context.kind !== 'region' &&
                    lens === 'Regional View'
                      ? 'Building Profile'
                      : lens
                  }
                  searchKind={context?.kind}
                  onLensChange={setLens}
                  buildingTypes={apiOptions.buildingTypes}
                  selectedBuildingTypes={mapBuildingTypes}
                  selectedReadiness={mapReadiness}
                  onToggleBuilding={(buildingType) => {
                    setMapReadiness([]);
                    const removingLast =
                      mapBuildingTypes.length === 1 &&
                      mapBuildingTypes.includes(buildingType);
                    setLens(
                      removingLast ? 'Regional View' : 'Building Profile',
                    );
                    setMapBuildingTypes((current) =>
                      current.includes(buildingType)
                        ? current.filter((item) => item !== buildingType)
                        : [...current, buildingType],
                    );
                  }}
                  onToggleReadiness={(readiness) => {
                    setMapBuildingTypes([]);
                    const removingLast =
                      mapReadiness.length === 1 &&
                      mapReadiness.includes(readiness);
                    setLens(
                      removingLast ? 'Regional View' : 'Site Readiness',
                    );
                    setMapReadiness((current) =>
                      current.includes(readiness)
                        ? current.filter((item) => item !== readiness)
                        : [...current, readiness],
                    );
                  }}
                  onToggleHeatmap={() => {
                    const enable = lens !== 'At-risk Heatmap';
                    setMapBuildingTypes([]);
                    setMapReadiness([]);
                    setLens(
                      enable ? 'At-risk Heatmap' : 'Regional View',
                    );
                  }}
                />
              ) : view === 'report' ? (
                <ReportOverview
                  data={filtered}
                  regionData={regionData}
                  buildingData={buildingData}
                  classificationData={classificationData}
                  readinessData={readinessData}
                  buildingTypes={apiOptions.buildingTypes}
                  lens={lens}
                  onLensChange={setLens}
                  filters={filtersPanel}
                  searchHeader={context}
                  selectedRegion={filters.region}
                  selectedDivision={filters.division}
                  update={update}
                />
              ) : (
                <DirectoryView
                  table={table}
                  filters={filtersPanel}
                  count={filtered.length}
                />
              )}
            </div>
        )}
      </div>
    </main>
  );
}

function AppHeader({ photoSchools, photoCurrent,
  view,
  onNavigate,
  snapshotDate,
}: {
  photoSchools: PhotoSchool[]; photoCurrent?: PhotoSchool;
  view: DashboardView;
  onNavigate: (view: DashboardView) => void;
  snapshotDate: string | null;
}) {
  const headerRef = useEntrance<HTMLElement>();
  const navRef = useReveals<HTMLElement>(view, '[aria-current="page"] > [aria-hidden="true"]');
  const formatted = snapshotDate
    ? new Intl.DateTimeFormat('en-PH', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }).format(new Date(snapshotDate))
    : 'Connecting to Fabric';
  const items = [
    { value: 'map' as const, label: 'Map overview', short: 'Map' },
    { value: 'report' as const, label: 'Report Overview', short: 'Report' },
    { value: 'directory' as const, label: 'Directory', short: 'Directory' },
  ];
  return (
    <header ref={headerRef} className="z-20 shrink-0 bg-[#0b245f] text-white shadow-lg">
      <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-2 lg:px-6">
        <Link
          href="/"
          aria-label="PPP Dashboard home"
          className="flex shrink-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <div className="grid size-9 place-items-center rounded-xl bg-white text-[#123b8f]">
            <Building2 className="size-5" aria-hidden="true" />
          </div>
          <div className="hidden sm:block">
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-blue-200">
              Department of Education
            </p>
            <p className="font-semibold tracking-tight">PPP Dashboard</p>
          </div>
        </Link>
        <nav
          ref={navRef}
          className="flex items-center gap-1 rounded-xl bg-white/10 p-1"
          aria-label="Dashboard views"
        >
          {items.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-current={view === item.value ? 'page' : undefined}
              onClick={() => onNavigate(item.value)}
              className={`relative min-h-10 overflow-hidden rounded-lg px-2 py-2 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:px-3 sm:text-sm ${view === item.value ? 'text-[#123b8f]' : 'text-blue-100 hover:bg-white/15'}`}
            >
              {view === item.value && (
                <span
                  className="absolute inset-0 rounded-lg bg-white shadow-sm"
                  aria-hidden="true"
                />
              )}
              <span className="relative z-10 sm:hidden">{item.short}</span>
              <span className="relative z-10 hidden sm:inline">
                {item.label}
              </span>
            </button>
          ))}
        <PhotoNavbar schools={photoSchools} current={photoCurrent} /></nav>
        <div className="hidden shrink-0 text-right lg:block">
          <p className="text-[10px] text-blue-200">Date as of</p>
          <p className="text-xs font-semibold">{formatted}</p>
        </div>
      </div>
    </header>
  );
}

function DashboardFilters({
  suggestions,
  filters,
  active,
  update,
  clear,
  regions,
  divisions,
  buildingTypes,
  showRegion,
  showBuilding = true,
  showScope = true,
  mapLayout = false,
}: {
  suggestions: string[];
  filters: ProjectFilters;
  active: [keyof ProjectFilters, string][];
  update: (key: keyof ProjectFilters, value: string) => void;
  clear: () => void;
  regions: string[];
  divisions: string[];
  buildingTypes: string[];
  showRegion: boolean;
  showBuilding?: boolean;
  showScope?: boolean;
  mapLayout?: boolean;
}) {
  return (
    <div aria-label="Dashboard filters">
      <div
        className={`grid min-w-0 grid-cols-2 gap-2 max-[359px]:grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${mapLayout ? 'xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]' : !showBuilding && !showScope ? 'xl:grid-cols-[minmax(300px,1.5fr)_minmax(150px,.65fr)_minmax(170px,.85fr)_auto]' : showRegion ? 'xl:grid-cols-[minmax(240px,1.5fr)_repeat(4,minmax(132px,1fr))_auto]' : 'xl:grid-cols-[minmax(240px,1.5fr)_repeat(3,minmax(140px,1fr))_auto]'}`}
      >
        <div className={`relative col-span-2 min-w-0 max-[359px]:col-span-1 lg:col-span-3 ${mapLayout ? 'xl:col-span-3' : 'xl:col-span-1'}`}>
          <Combobox<string>
            items={searchSuggestions(suggestions, filters.search)}
            filter={null}
            inputValue={filters.search}
            onInputValueChange={(value) => update('search', value)}
            onValueChange={(value) => {
              if (value) update('search', value);
            }}
          >
            <ComboboxInput
              aria-label="Search schools, school IDs, divisions, or regions"
              placeholder="Search school, ID, division, or region"
              showTrigger={false}
              className={`h-11 w-full rounded-xl bg-white ${mapLayout ? 'pr-12' : ''}`}
            />
            <ComboboxContent>
              <ComboboxList>
                {(item: string) => (
                  <ComboboxItem key={item} value={item}>
                    {item}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
          {mapLayout && (
            <Search
              className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-[#173f7d]"
              strokeWidth={2.25}
              aria-hidden="true"
            />
          )}
        </div>
        {showRegion && (
          <FilterSelect
            label="Region"
            value={filters.region}
            onChange={(value) => update('region', value)}
            options={regions}
          />
        )}
        <FilterSelect
          label="Division"
          value={filters.division}
          onChange={(value) => update('division', value)}
          options={divisions}
        />
        {showBuilding && (
          <FilterSelect
            label="Building"
            value={filters.buildingType}
            onChange={(value) => update('buildingType', value)}
            options={buildingTypes}
          />
        )}
        {showScope && (
          <FilterSelect
            label="Project scope"
            value={filters.scope}
            onChange={(value) => update('scope', value)}
            options={['Demolition', 'Site improvement', 'Slope protection']}
          />
        )}
        <button
          type="button"
          onClick={clear}
          disabled={!active.length}
          className="col-span-2 flex h-11 items-center justify-center gap-2 rounded-xl border border-[#b8c5d6] bg-white px-4 text-sm font-semibold text-[#34445f] transition-colors hover:bg-[#f5f8fc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1854bd] disabled:cursor-not-allowed disabled:text-[#758197] disabled:opacity-60 max-[359px]:col-span-1 lg:col-span-1 xl:h-10"
        >
          <X className="size-4" aria-hidden="true" />
          Clear
        </button>
      </div>
      {active.length > 0 && (
        <div
          className="mt-3 flex flex-wrap gap-2 border-t border-[#e2e8f0] pt-3"
          aria-label="Active filters"
        >
          {active.map(([key, value]) => (
            <button
              type="button"
              key={key}
              onClick={() => update(key, '')}
              className="flex min-h-8 items-center gap-1 rounded-full bg-[#e6eefb] px-3 py-1 text-xs font-semibold text-[#164da8] hover:bg-[#d9e6fa] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1854bd]"
            >
              {value}
              <X className="size-3" aria-hidden="true" />
              <span className="sr-only">Remove filter</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="relative min-w-0">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full min-w-0 appearance-none truncate rounded-xl border border-[#cad5e3] bg-white pl-3 pr-9 text-base font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[#1854bd] sm:text-sm xl:h-10"
      >
        <option value="">{label}</option>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-3.5 size-4 text-[#526079] xl:top-3"
        aria-hidden="true"
      />
    </label>
  );
}

function LensControl({
  value,
  onChange,
  items = lenses,
}: {
  value: AnalyticsLens;
  onChange: (value: AnalyticsLens) => void;
  items?: readonly (typeof lenses)[number][];
}) {
  return (
    <div
      className="grid w-full min-w-0 gap-1 rounded-xl bg-[#eef3fa] p-1 xl:max-w-[704px]"
      style={{
        gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
      }}
      role="tablist"
      aria-label="Analytics lens"
    >
      {items.map((item) => (
        <button
          type="button"
          key={item.value}
          role="tab"
          aria-selected={value === item.value}
          aria-label={item.value}
          onClick={() => onChange(item.value)}
          className={`min-h-11 min-w-0 rounded-lg px-3 py-2 text-left text-xs font-bold leading-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1854bd] xl:min-h-10 ${value === item.value ? 'bg-[#1854bd] text-white shadow-sm' : 'text-[#526079] hover:bg-white'}`}
        >
          <span className="sm:hidden md:inline">{item.value}</span>
          <span className="hidden sm:inline md:hidden">{item.short}</span>
        </button>
      ))}
    </div>
  );
}

function MapPanel({
  searchKind,
  data,
  allProjects,
  controls,
  lens,
  buildingTypes,
  selectedBuildingTypes,
  selectedReadiness,
  onToggleBuilding,
  onToggleReadiness,
  onToggleHeatmap,
}: {
  searchKind?: string;
  data: SchoolProject[];
  allProjects: SchoolProject[];
  controls: React.ReactNode;
  lens: AnalyticsLens;
  onLensChange: (lens: AnalyticsLens) => void;
  buildingTypes: string[];
  selectedBuildingTypes: string[];
  selectedReadiness: string[];
  onToggleBuilding: (value: string) => void;
  onToggleReadiness: (value: string) => void;
  onToggleHeatmap: () => void;
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const mapFeedbackRef = useEntrance<HTMLDivElement>(JSON.stringify([lens, selectedBuildingTypes, selectedReadiness, data.length]));

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const timer = window.setTimeout(() => setPanelOpen(desktop.matches), 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <article className="relative flex h-full min-h-0 flex-col overflow-x-hidden overflow-y-auto bg-[#dce5ef] sm:overflow-hidden">
      <div ref={mapFeedbackRef} className="relative z-10 mx-2 mt-2 shrink-0 rounded-2xl border border-white/70 bg-white/95 p-4 shadow-[0_8px_24px_rgba(21,48,93,.12)] backdrop-blur sm:mx-3 sm:mt-3 lg:grid lg:grid-cols-[minmax(280px,.8fr)_minmax(520px,1.2fr)] lg:items-center lg:gap-8 lg:p-5">
        <div className="mb-4 min-w-0 lg:mb-0">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#e9f7fb] px-3 py-1.5 text-sm font-bold text-[#2366dc]">
            <MapPinned className="size-4" aria-hidden="true" />
            Map Overview
          </div>
          <h1 className="mt-3 text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl">
            PPP Projects across the Philippines
          </h1>
        </div>
        <div className="min-w-0">{controls}</div>
      </div>
      <div className="relative mt-2 min-h-[420px] flex-1 bg-[#dce5ef] sm:absolute sm:inset-0 sm:mt-0 sm:min-h-0">
        <PsipMap
          projects={data}
          allProjects={allProjects}
          view={lens}
          searchKind={searchKind}
        />
        <MapLegend lens={lens} />
        <div className="absolute left-4 top-[228px] z-[520] sm:top-[190px]">
          <div className="group relative">
            <button
              type="button"
              aria-expanded={panelOpen}
              aria-controls="map-filter-panel"
              aria-label={panelOpen ? 'Hide map filters' : 'Show map filters'}
              title={panelOpen ? 'Hide map filters' : 'Find projects'}
              onClick={() => setPanelOpen((open) => !open)}
              className="grid size-14 touch-manipulation place-items-center rounded-2xl border border-white/80 bg-white text-[#173a70] shadow-[0_12px_30px_rgba(21,48,93,.18)] transition hover:bg-[#f5f8fc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1854bd] active:scale-95"
            >
              {panelOpen ? (
                <X className="size-6" aria-hidden="true" />
              ) : (
                <SlidersHorizontal className="size-6" aria-hidden="true" />
              )}
            </button>
            {!panelOpen && (
              <span className="pointer-events-none absolute left-[calc(100%+.65rem)] top-1/2 hidden -translate-y-1/2 whitespace-nowrap rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#526079] opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 lg:block">
                Find projects
              </span>
            )}
          </div>
        </div>
        <MapFilterPanel
            open={panelOpen}
            buildingTypes={buildingTypes}
            selectedBuildingTypes={selectedBuildingTypes}
            selectedReadiness={selectedReadiness}
            heatmapActive={lens === 'At-risk Heatmap'}
            onToggleBuilding={onToggleBuilding}
            onToggleReadiness={onToggleReadiness}
            onToggleHeatmap={onToggleHeatmap}
            onClose={() => {
              setPanelOpen(false);
              document.querySelector<HTMLButtonElement>('[aria-controls="map-filter-panel"]')?.focus();
            }}
          />
      </div>
    </article>
  );
}

function buildingColor(name: string, index: number) {
  const normalized = name.toLowerCase();
  if (normalized.includes('low')) return '#f5b700';
  if (normalized.includes('mid')) return '#10a779';
  if (normalized.includes('high')) return '#1e5fc4';
  return buildingColors[index % buildingColors.length];
}

function MapFilterPanel({
  open,
  buildingTypes,
  selectedBuildingTypes,
  selectedReadiness,
  heatmapActive,
  onToggleBuilding,
  onToggleReadiness,
  onToggleHeatmap,
  onClose,
}: {
  open: boolean;
  buildingTypes: string[];
  selectedBuildingTypes: string[];
  selectedReadiness: string[];
  heatmapActive: boolean;
  onToggleBuilding: (value: string) => void;
  onToggleReadiness: (value: string) => void;
  onToggleHeatmap: () => void;
  onClose: () => void;
}) {
  const readinessItems = ['Ready'] as const;
  const orderedBuildingTypes = [...buildingTypes].sort((a, b) => {
    const order = ['high', 'mid', 'low'];
    const rank = (value: string) => {
      const index = order.findIndex((type) => value.toLowerCase().includes(type));
      return index === -1 ? order.length : index;
    };
    return rank(a) - rank(b);
  });
  const drawerRef = useDrawer(open);
  return (
    <aside
      ref={drawerRef}
      inert={!open}
      aria-hidden={!open}
      style={{ display: 'none' }}
      id="map-filter-panel"
      aria-label="Map display filters"
      className="absolute inset-x-3 bottom-3 z-[510] max-h-[min(70dvh,560px)] overflow-y-auto rounded-2xl border border-white/80 bg-white/95 p-4 shadow-[0_18px_45px_rgba(21,48,93,.22)] backdrop-blur lg:inset-x-auto lg:bottom-auto lg:left-[84px] lg:top-[190px] lg:w-[272px]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-[#d9e2ee] pb-3">
        <div className="flex items-center gap-3">
          <SlidersHorizontal className="size-5 text-[#1854bd]" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-bold">Find projects</h2>
            <p className="text-xs text-[#647089]">Choose one map category</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close map filters"
          className="grid size-11 place-items-center rounded-xl text-[#526079] hover:bg-[#eef3fa] focus-visible:outline-2 focus-visible:outline-[#1854bd] lg:hidden"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
      <FilterToggleGroup
        title="Building Profile"
        items={orderedBuildingTypes.map((name, index) => ({
          name,
          color: buildingColor(name, index),
        }))}
        selected={selectedBuildingTypes}
        onToggle={onToggleBuilding}
      />
      <FilterToggleGroup
        title="Site Readiness"
        items={readinessItems.map((name) => ({
          name,
          color: readinessColor[name],
        }))}
        selected={selectedReadiness}
        onToggle={onToggleReadiness}
        hideLabels
      />
      <div className="mt-4">
        <p className="mb-2 text-sm font-bold text-[#34445f]">Risk Heatmap</p>
        <MapFilterToggle
          label="At-risk density"
          hideLabel
          checked={heatmapActive}
          onToggle={onToggleHeatmap}
          color="#c83f50"
          icon={Flame}
        />
      </div>
    </aside>
  );
}

function FilterToggleGroup({
  title,
  items,
  selected,
  onToggle,
  hideLabels = false,
}: {
  title: string;
  items: { name: string; color: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  hideLabels?: boolean;
}) {
  return (
    <fieldset className="mt-4">
      <legend className="mb-2 text-sm font-bold text-[#34445f]">{title}</legend>
      <div className="space-y-1">
        {items.map((item) => {
          const active = selected.includes(item.name);
          return (
            <MapFilterToggle
              key={item.name}
              label={item.name}
              checked={active}
              onToggle={() => onToggle(item.name)}
              color={item.color}
              hideLabel={hideLabels}
              icon={title === 'Building Profile' ? (item.name.toLowerCase().includes('low') ? Home : Building2) : item.name === 'Ready' ? CheckCircle2 : item.name === 'Pending' ? Clock3 : item.name === 'At risk' ? ShieldAlert : Activity}
            />
          );
        })}
      </div>
    </fieldset>
  );
}
function MapLegend({ lens }: { lens: AnalyticsLens }) {
  if (lens === 'Regional View')
    return (
      <div className="pointer-events-none absolute bottom-4 left-4 z-[500] flex max-w-[calc(100%-2rem)] items-center gap-2 rounded-xl border bg-white/95 px-3 py-2 text-xs font-medium text-[#526079] shadow-sm">
        <span className="flex overflow-hidden rounded-full" aria-hidden="true">
          {['#d7193f', '#f5b700', '#07883f', '#0969f3', '#8a17c5'].map(
            (color) => (
              <span
                key={color}
                className="block h-2.5 w-2"
                style={{ background: color }}
              />
            ),
          )}
        </span>
        Colors identify regions · Hover or tap for readiness details
      </div>
    );
  if (lens === 'At-risk Heatmap')
    return (
      <div className="pointer-events-none absolute bottom-4 left-4 z-[500] rounded-xl border bg-white/95 px-3 py-2 text-xs font-medium text-[#526079] shadow-sm">
        <span className="mr-2 inline-block h-2.5 w-20 rounded-full bg-gradient-to-r from-[#fde68a] via-[#f97316] to-[#b91c1c]" />
        Lower to higher at-risk density
      </div>
    );
  return null;
}

function ReportOverview({
  searchHeader,
  data,
  regionData,
  buildingData,
  classificationData,
  readinessData,
  buildingTypes,
  lens,
  onLensChange,
  filters,
  selectedRegion,
  selectedDivision,
  update,
}: {
  searchHeader: ReturnType<typeof searchContext>;
  data: SchoolProject[];
  regionData: RegionRow[];
  buildingData: { name: string; value: number; color: string }[];
  classificationData: {
    name: string;
    value: number;
    icon: typeof GraduationCap;
  }[];
  readinessData: { name: string; value: number; color: string }[];
  buildingTypes: string[];
  lens: AnalyticsLens;
  onLensChange: (lens: AnalyticsLens) => void;
  filters: React.ReactNode;
  selectedRegion: string;
  selectedDivision: string;
  update: (key: keyof ProjectFilters, value: string) => void;
}) {
  const reportLens =
    lens === 'Site Readiness' ? 'Site Readiness' : 'Building Profile';
  const classrooms = data.reduce((sum, project) => sum + project.classrooms, 0),
    specials = classificationData
      .slice(1)
      .reduce((sum, item) => sum + item.value, 0),
    academic =
      classificationData[0]?.value || Math.max(0, classrooms - specials),
    sites = uniqueSites(data),
    ready = readinessData.find((item) => item.name === 'Ready')?.value || 0,
    readyRate = data.length ? Math.round((ready / data.length) * 100) : 0;
  const revealRevision = useMemo(() => ({ data, reportLens }), [data, reportLens]);
  const reportRef = useReveals<HTMLDivElement>(revealRevision);
  return (
    <div ref={reportRef} className="dashboard-typography h-full overflow-y-auto bg-[#edf2f8]">
      <div className="mx-auto max-w-[1500px] space-y-4 px-4 py-4 lg:px-6 lg:py-6">
        <section className="overflow-hidden rounded-2xl border border-[#d9e2ee] bg-white shadow-[0_8px_24px_rgba(21,48,93,.06)]">
          <div className="p-4">{filters}</div>
          <div className="grid gap-4 border-t border-[#e2e8f0] p-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,.65fr)] lg:items-center">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#e7eefb] px-3 py-1 text-xs font-bold text-[#1854bd]">
                <LayoutDashboard className="size-3.5" aria-hidden="true" />
                Report Overview
              </div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {searchHeader?.title ||
                  selectedDivision ||
                  selectedRegion ||
                  'National infrastructure portfolio at a glance'}
              </h1>
              {(searchHeader?.subtitle || selectedDivision) && (
                <p className="mt-2 text-sm text-[#526079]">
                  {searchHeader?.subtitle || selectedRegion}
                </p>
              )}
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#526079]">
                All cards and charts use the current dashboard filters. Choose
                between building composition and operational readiness.
              </p>
            </div>
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[.12em] text-[#63718a]">
                Report view
              </p>
              <LensControl
                value={reportLens}
                onChange={onLensChange}
                items={reportLenses}
              />
            </div>
          </div>
        </section>
        <section
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          aria-label="Portfolio summary"
        >
          <MetricCard
            label="Classrooms"
            value={classrooms}
            detail="Academic Rooms"
            icon={GraduationCap}
            color="#1e5fc4"
          />
          <MetricCard
            label="Special classrooms"
            value={specials}
            detail="Laboratories and specialized rooms"
            icon={FlaskConical}
            color="#7c3aed"
          />
          <MetricCard
            label="Projects"
            value={data.length}
            detail={`implemented in ${number.format(sites)} school sites`}
            icon={MapPinned}
            color="#0b8b69"
          />
          <MetricCard
            label="Ready to operate"
            value={`${readyRate}%`}
            detail={`${number.format(ready)} operational projects`}
            icon={CheckCircle2}
            color="#14855f"
          />
        </section>
        <div aria-live="polite" className="sr-only">
          Report changed to {reportLens}
        </div>
        {reportLens !== 'Site Readiness' && (
          <BuildingReport
            buildingData={buildingData}
            classificationData={classificationData}
            regionData={regionData}
            buildingTypes={buildingTypes}
            data={data}
            selectedRegion={selectedRegion}
            selectedDivision={selectedDivision}
            onSelect={(value) => update('buildingType', value)}
          />
        )}{' '}
        {reportLens === 'Site Readiness' && (
          <ReadinessReport
            readinessData={readinessData}
            regionData={regionData}
            data={data}
            selectedRegion={selectedRegion}
            selectedDivision={selectedDivision}
            rate={readyRate}
            onSelect={(value) => update('readiness', value)}
          />
        )}
      </div>
    </div>
  );
}
function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  color,
}: {
  label: string;
  value: number | string;
  detail: string;
  icon: typeof GraduationCap;
  color: string;
}) {
  const numeric = typeof value === 'number';
  return (
    <article data-reveal="kpi" className="transition-shadow hover:shadow-[0_12px_30px_rgba(21,48,93,.12)] relative min-h-[154px] overflow-hidden rounded-[20px] border border-[#d9e2ee] bg-white p-6 shadow-[0_8px_24px_rgba(21,48,93,.05)]">
      <div
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: color }}
      />
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="text-base font-semibold text-[#526079]">{label}</p>
          <p
            className="font-number mt-2 text-4xl font-bold leading-none tabular-nums text-[#102044]"
            title={numeric ? number.format(value) : undefined}
          >
            <AnimatedNumber value={value} />
          </p>
          <p className="mt-4 text-sm leading-5 text-[#69768d]">{detail}</p>
        </div>
        <div
          className="grid size-13 shrink-0 place-items-center rounded-2xl"
          style={{ background: `${color}16`, color }}
        >
          <Icon className="size-6" strokeWidth={1.8} aria-hidden="true" />
        </div>
      </div>
    </article>
  );
}

function BuildingReport({
  buildingData,
  classificationData,
  regionData,
  buildingTypes,
  data,
  selectedRegion,
  selectedDivision,
  onSelect,
}: {
  buildingData: { name: string; value: number; color: string }[];
  classificationData: {
    name: string;
    value: number;
    icon: typeof GraduationCap;
  }[];
  regionData: RegionRow[];
  buildingTypes: string[];
  data: SchoolProject[];
  selectedRegion: string;
  selectedDivision: string;
  onSelect: (value: string) => void;
}) {
  const comparisonData = selectedRegion
    ? Array.from(new Set(data.map((project) => project.division)))
        .map((division) => {
          const divisionProjects = data.filter(
            (project) => project.division === division,
          );
          return {
            label: division,
            total: divisionProjects.length,
            ...Object.fromEntries(
              buildingTypes.map((type) => [
                type,
                divisionProjects.filter(
                  (project) => project.buildingType === type,
                ).length,
              ]),
            ),
          };
        })
        .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label))
    : regionData
        .map((row) => ({
          label: row.region,
          total: Object.values(row.buildings).reduce(
            (sum, value) => sum + value,
            0,
          ),
          ...row.buildings,
        }))
        .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label))
        .slice(0, 15);
  const comparisonLabel = selectedRegion ? 'division' : 'region';
  const buildingChartData = (
    selectedDivision ? buildingData : comparisonData
  ) as Array<Record<string, string | number>>;
  const buildingTotal = buildingData.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className="space-y-4">
      <ClassificationPanel data={classificationData} />
      {data.length > 0 && data.every((project) => project.id === data[0].id) ? (
        <SchoolReportDetails key={data[0].id} schoolId={data[0].id} />
      ) : (
        <section className="grid items-stretch gap-4 xl:grid-cols-[minmax(380px,.52fr)_minmax(0,1.48fr)]">
          <ChartCard
            eyebrow="Building portfolio"
            title="Projects by building type"
          >
            <ChartContainer
              config={{ value: { label: 'Projects' } }}
              className="mt-4 h-[300px] w-full"
              aria-label="Donut chart of projects by building type"
            >
              <PieChart accessibilityLayer>
                <Pie
                  data={buildingData}
                  dataKey="value"
                  nameKey="name"
                  cx="48%"
                  innerRadius={58}
                  outerRadius={90}
                  paddingAngle={1}
                  labelLine={false}
                  label={({ cx, cy, midAngle, outerRadius, value, fill }) => {
                    const angle = -(Number(midAngle) * Math.PI) / 180;
                    const direction = Math.cos(angle);
                    const x = Number(cx) + direction * (Number(outerRadius) + 18);
                    const y = Number(cy) + Math.sin(angle) * (Number(outerRadius) + 24);
                    const percent = buildingTotal
                      ? Math.round((Number(value) / buildingTotal) * 1000) / 10
                      : 0;
                    return (
                      <text
                        x={x}
                        y={y}
                        fill={String(fill || '#526079')}
                        fontSize={12}
                        textAnchor={direction >= 0 ? 'start' : 'end'}
                        dominantBaseline="central"
                      >
                        {`${percent}%`}
                      </text>
                    );
                  }}
                  onClick={(item) => {
                    const name = String(item.name ?? '');
                    if (name) onSelect(name);
                  }}
                />
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              </PieChart>
            </ChartContainer>
            <div className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-2">
              {buildingData.map((item) => (
                <button
                  type="button"
                  key={item.name}
                  onClick={() => onSelect(item.name)}
                  className="flex min-h-9 items-center rounded-lg px-2 text-sm hover:bg-[#f1f5fa] focus-visible:outline-2 focus-visible:outline-[#1854bd]"
                >
                  <span className="flex items-center">
                    <span
                      className="mr-2 inline-block size-2.5 rounded-full"
                      style={{ background: item.color }}
                    />
                    {item.name}
                  </span>
                </button>
              ))}
            </div>
          </ChartCard>
          <ChartCard
            eyebrow={selectedDivision ? 'Division detail' : selectedRegion ? 'Division comparison' : ''}
            title={selectedDivision ? `Building types in ${selectedDivision}` : `Building types by ${comparisonLabel}`}
            description={selectedDivision ? 'Project totals for each building type in the selected division.' : `Ranked by total projects, the grouped bars show how each building type is distributed across ${comparisonLabel}s.`}
          >
          <ChartContainer
            config={Object.fromEntries(
              buildingTypes.map((type, index) => [
                type,
                {
                  label: type,
                  color: buildingColors[index % buildingColors.length],
                },
              ]),
            )}
            className="h-[380px] w-full"
            aria-label={
              selectedDivision
                ? `Bar chart of building types in ${selectedDivision}`
                : `Grouped bar chart comparing building types across ${comparisonLabel}s`
            }
          >
            <BarChart
              data={buildingChartData}
              margin={{ left: 8, right: 8 }}
              accessibilityLayer
            >
              <CartesianGrid vertical={false} stroke="#e3e9f1" />
              <XAxis
                dataKey={selectedDivision ? 'name' : 'label'}
                interval={0}
                angle={-32}
                textAnchor="end"
                height={78}
              />
              <YAxis allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              {selectedDivision ? (
                <Bar dataKey="value" fill="#1e5fc4" radius={[3, 3, 0, 0]} />
              ) : (
                buildingTypes.map((type, index) => (
                  <Bar
                    key={type}
                    dataKey={type}
                    fill={buildingColors[index % buildingColors.length]}
                    radius={[3, 3, 0, 0]}
                  />
                ))
              )}
            </BarChart>
          </ChartContainer>
          </ChartCard>
        </section>
      )}
    </div>
  );
}
function ClassificationPanel({
  data,
}: {
  data: { name: string; value: number; icon: typeof GraduationCap }[];
}) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <section
      aria-label="Classroom classification"
      className="overflow-hidden rounded-[28px] border border-[#d9e2ee] bg-white shadow-[0_8px_24px_rgba(21,48,93,.05)]"
    >
      <div className="flex items-center justify-between gap-4 border-b border-[#e2e8f0] px-6 py-4">
        <div>
          <h2 className="text-xl font-bold">Classrooms classification</h2>
          <p className="mt-1 text-sm text-[#647089]">Live totals from the current filter selection.</p>
        </div>
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#e8f0fc] text-[#1854bd]">
          <GraduationCap className="size-5" strokeWidth={1.8} aria-hidden="true" />
        </div>
      </div>
      <div className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-3">
        {data.map(({ name, value, icon: Icon }) => (
          <article
            key={name}
            className="rounded-[24px] border border-[#e1e7ef] bg-[#fbfcfe] p-5"
          >
            <div className="flex items-center gap-3">
              <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#e8f0fc] text-[#1854bd]">
                <Icon className="size-6" strokeWidth={1.7} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold leading-5 text-[#526079]">
                  {name}
                </p>
                <b className="font-number mt-2 block text-2xl tabular-nums text-[#102044]">
                  {number.format(value)}
                </b>
              </div>
            </div>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-[#e8edf4]">
              <span
                className="block h-full rounded-full bg-[#1e5fc4]"
                style={{
                  width: `${Math.max(value ? 5 : 0, (value / max) * 100)}%`,
                }}
              />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ReadinessReport({
  readinessData,
  regionData,
  data,
  selectedRegion,
  selectedDivision,
  rate,
  onSelect,
}: {
  readinessData: { name: string; value: number; color: string }[];
  regionData: RegionRow[];
  data: SchoolProject[];
  selectedRegion: string;
  selectedDivision: string;
  rate: number;
  onSelect: (value: string) => void;
}) {
  const statuses = ['Ready', 'Pending', 'At risk', 'Unknown'] as const;
  const statusDetailData = statuses.map((status) => ({
    name: status,
    value: readinessData.find((item) => item.name === status)?.value || 0,
    color: readinessColor[status],
  }));
  const comparisonData = selectedRegion
    ? Array.from(new Set(data.map((project) => project.division)))
        .map((division) => {
          const divisionProjects = data.filter(
            (project) => project.division === division,
          );
          return {
            label: division,
            total: divisionProjects.length,
            ...Object.fromEntries(
              statuses.map((status) => [
                status,
                divisionProjects.filter(
                  (project) => project.readiness === status,
                ).length,
              ]),
            ),
          };
        })
        .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label))
    : regionData
        .map((row) => ({
          label: row.region,
          total: Object.values(row.readiness).reduce(
            (sum, value) => sum + value,
            0,
          ),
          ...row.readiness,
        }))
        .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label))
        .slice(0, 18);
  const comparisonLabel = selectedRegion ? 'division' : 'region';
  const readinessChartData = (
    selectedDivision ? statusDetailData : comparisonData
  ) as Array<Record<string, string | number>>;
  return (
    <section className={data.length > 0 && data.every(project => project.id === data[0].id) ? "space-y-4" : "grid gap-4 xl:grid-cols-[minmax(340px,.62fr)_minmax(0,1.38fr)]"}>
      <article className="overflow-hidden rounded-2xl bg-[#0d2d70] p-5 text-white shadow-[0_14px_30px_rgba(11,36,95,.16)]">
        <p className="text-xs font-bold uppercase tracking-[.13em] text-blue-200">
          Operational readiness
        </p>
        <h2 className="mt-1 text-xl font-bold">Visible site status</h2>
        <p className="mt-1 text-sm text-blue-100">
          Select a status to filter all dashboard views.
        </p>
        <div className="my-6 grid place-items-center">
          <div
            className="grid size-40 place-items-center rounded-full"
            style={{
              background: `conic-gradient(#2fc997 0 ${rate}%,rgba(255,255,255,.14) ${rate}% 100%)`,
            }}
          >
            <div className="grid size-28 place-items-center rounded-full bg-[#0d2d70] text-center">
              <div>
                <strong className="text-3xl tabular-nums">{rate}%</strong>
                <p className="text-xs text-blue-200">Ready</p>
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          {readinessData.map((item) => (
            <button
              type="button"
              key={item.name}
              onClick={() => onSelect(item.name)}
              className="flex min-h-11 w-full items-center justify-between rounded-xl bg-white/8 px-3 text-sm hover:bg-white/14 focus-visible:outline-2 focus-visible:outline-white"
            >
              <span className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full"
                  style={{ background: item.color }}
                />
                {item.name}
              </span>
              <b className="tabular-nums">{number.format(item.value)}</b>
            </button>
          ))}
        </div>
      </article>
      {data.length > 0 && data.every((project) => project.id === data[0].id) ? (
        <SchoolReportDetails key={data[0].id} schoolId={data[0].id} />
      ) : (
        <ChartCard
          eyebrow={
            selectedDivision
              ? 'Division detail'
              : selectedRegion
                ? 'Division comparison'
                : ''
          }
          title={
            selectedDivision
              ? `Readiness status in ${selectedDivision}`
              : `Readiness status by ${comparisonLabel}`
          }
          description={
            selectedDivision
              ? 'Record totals for each readiness status in the selected division.'
              : 'Ranked by total projects, each bar shows the mix of ready, pending, at-risk, and unclassified records.'
          }
        >
          <ChartContainer
            config={{
              Ready: { label: 'Ready', color: readinessColor.Ready },
              Pending: { label: 'Pending', color: readinessColor.Pending },
              'At risk': { label: 'At risk', color: readinessColor['At risk'] },
              Unknown: { label: 'Unknown', color: readinessColor.Unknown },
            }}
            className="h-[470px] w-full"
            aria-label={
              selectedDivision
                ? `Bar chart of readiness status in ${selectedDivision}`
                : `Stacked horizontal bar chart comparing operational readiness by ${comparisonLabel}`
            }
          >
            <BarChart
              data={readinessChartData}
              layout={selectedDivision ? 'horizontal' : 'vertical'}
              margin={{ left: 12, right: 20 }}
              accessibilityLayer
            >
              <CartesianGrid
                horizontal={selectedDivision ? undefined : false}
                vertical={selectedDivision ? false : undefined}
                stroke="#e3e9f1"
              />
              <XAxis
                type={selectedDivision ? 'category' : 'number'}
                dataKey={selectedDivision ? 'name' : undefined}
                allowDecimals={false}
              />
              <YAxis
                dataKey={selectedDivision ? undefined : 'label'}
                type={selectedDivision ? 'number' : 'category'}
                width={selectedDivision ? undefined : 82}
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              {selectedDivision ? (
                <Bar dataKey="value" fill="#1854bd" radius={[3, 3, 0, 0]} />
              ) : (
                statuses.map((status) => (
                  <Bar
                    key={status}
                    dataKey={status}
                    stackId="readiness"
                    fill={readinessColor[status]}
                  />
                ))
              )}
            </BarChart>
          </ChartContainer>
          <div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold text-[#526079]">
            {(['Ready', 'Pending', 'At risk', 'Unknown'] as const).map(
              (status) => (
                <span key={status} className="inline-flex items-center gap-1.5">
                  <span
                    className="size-2.5 rounded-sm"
                    style={{ background: readinessColor[status] }}
                  />
                  {status}
                </span>
              ),
            )}
          </div>
        </ChartCard>
      )}
    </section>
  );
}

function ChartCard({
  eyebrow,
  title,
  description,
  insight,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  insight?: string;
  children: React.ReactNode;
}) {
  return (
    <article data-reveal="chart" className="rounded-2xl border border-[#d9e2ee] bg-white p-5 shadow-[0_8px_24px_rgba(21,48,93,.05)]">
      {eyebrow && (
        <p className="text-xs font-bold uppercase tracking-[.13em] text-[#2366dc]">
          {eyebrow}
        </p>
      )}
      <h2 data-reveal="chart-label" className={`${eyebrow ? 'mt-1' : ''} text-xl font-bold`}>{title}</h2>
      {description && (
        <p className="mb-3 mt-1 text-sm text-[#647089]">{description}</p>
      )}
      {children}
      {insight && (
        <p className="mt-3 rounded-xl bg-[#edf4ff] px-3 py-2 text-sm font-medium leading-6 text-[#1c4b95]">
          <Activity className="mr-2 inline size-4" aria-hidden="true" />
          {insight}
        </p>
      )}
    </article>
  );
}
function DirectoryView({
  table,
  filters,
  count,
}: {
  table: ReturnType<typeof useReactTable<SchoolProject>>;
  filters: React.ReactNode;
  count: number;
}) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1500px] space-y-4 px-4 py-4 lg:px-6 lg:py-6">
        <section className="rounded-2xl border border-[#d9e2ee] bg-white p-4 shadow-[0_8px_24px_rgba(21,48,93,.05)]">
          {filters}
        </section>
        <SchoolTable table={table} count={count} />
      </div>
    </div>
  );
}
function SchoolTable({
  table,
  count,
}: {
  table: ReturnType<typeof useReactTable<SchoolProject>>;
  count?: number;
}) {
  const rows = table.getRowModel().rows;
  const tableRef = useReveals<HTMLElement>(rows, 'tbody tr');
  return (
    <section ref={tableRef} className="overflow-hidden rounded-2xl border border-[#d9e2ee] bg-white shadow-[0_8px_24px_rgba(21,48,93,.05)]">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#e2e8f0] p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.13em] text-[#2366dc]">
            Project directory
          </p>
          <h1 className="mt-1 text-2xl font-bold">School building readiness</h1>
        </div>
        <p className="text-sm text-[#647089]">
          {count === undefined
            ? 'Select a school for a quick preview'
            : `${number.format(count)} visible records · select a school for details`}
        </p>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {table.getFlatHeaders().map((header) => (
                <TableHead key={header.id}>
                  <button
                    type="button"
                    className="flex min-h-9 items-center gap-1 font-bold focus-visible:outline-2 focus-visible:outline-[#1854bd]"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                    <ArrowUpDown className="size-3" aria-hidden="true" />
                  </button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
function Status({ value }: { value: SchoolProject['readiness'] }) {
  const Icon =
    value === 'Ready'
      ? CheckCircle2
      : value === 'At risk'
        ? ShieldAlert
        : Clock3;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
      style={{
        background: `${readinessColor[value]}18`,
        color: readinessColor[value],
      }}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {value}
    </span>
  );
}

function LoadingState() {
  return (
    <section className="absolute inset-0 grid place-items-center bg-[#eaf0f7]">
      <div className="rounded-2xl border bg-white/95 px-6 py-5 text-center shadow-lg">
        <div className="mx-auto size-8 animate-spin rounded-full border-4 border-[#d9e4f4] border-t-[#1854bd]" />
        <h1 className="mt-4 font-bold">Loading Fabric data</h1>
        <p className="mt-1 text-sm text-[#647089]">
          Authenticating and preparing the PSIP portfolio…
        </p>
      </div>
    </section>
  );
}
function ApiError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <section className="absolute inset-0 grid place-items-center bg-[#eaf0f7] p-6">
      <div className="max-w-lg rounded-2xl border bg-white p-6 text-center shadow-lg">
        <ShieldAlert
          className="mx-auto size-10 text-[#d94b5b]"
          aria-hidden="true"
        />
        <h1 className="mt-3 text-xl font-bold">Fabric data is unavailable</h1>
        <p className="mt-2 text-sm leading-6 text-[#647089]">{message}</p>
        <p className="mt-2 text-xs text-[#7b879d]">
          Start the FastAPI backend at 127.0.0.1:8000 and complete Microsoft
          sign-in.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 min-h-11 rounded-xl bg-[#1854bd] px-4 py-2 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1854bd]"
        >
          Retry connection
        </button>
      </div>
    </section>
  );
}
function Empty({ onClear }: { onClear: () => void }) {
  return (
    <section className="grid min-h-80 place-items-center rounded-2xl border border-dashed bg-white p-8 text-center">
      <div>
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#eaf0fb] text-[#1854bd]">
          <Search aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-xl font-bold">
          No projects match these filters
        </h1>
        <p className="mt-2 text-sm text-[#647089]">
          Clear the current selection to return to the national portfolio.
        </p>
        <button
          type="button"
          onClick={onClear}
          className="mt-4 min-h-11 rounded-xl bg-[#1854bd] px-4 py-2 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1854bd]"
        >
          Clear filters
        </button>
      </div>
    </section>
  );
}
