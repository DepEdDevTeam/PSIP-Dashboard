'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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
  Check,
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
  Wrench,
  X,
} from 'lucide-react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ProjectFilters, SchoolProject } from '@/lib/psip-data';
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
const compact = new Intl.NumberFormat('en-PH', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
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
export type AnalyticsLens =
  | 'Regional Map View'
  | 'Buildings Geographical Location'
  | 'Sites Operational Readiness Locator';
type RegionRow = {
  region: string;
  classrooms: number;
  sites: number;
  special: number;
  buildings: Record<string, number>;
  readiness: Record<string, number>;
};

const lenses = [
  { value: 'Regional Map View', short: 'Regions' },
  { value: 'Buildings Geographical Location', short: 'Buildings' },
  {
    value: 'Sites Operational Readiness Locator',
    short: 'Readiness',
  },
] as const;

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
  const [selected, setSelected] = useState<SchoolProject | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [view, setView] = useState<DashboardView>('map');
  const [lens, setLens] = useState<AnalyticsLens>('Regional Map View');
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
    if (queryView === 'report' || queryView === 'directory') setView(queryView);
    const queryLens = query.get('lens');
    if (lenses.some((item) => item.value === queryLens))
      setLens(queryLens as AnalyticsLens);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchDashboard(controller.signal)
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
        const school = new URLSearchParams(location.search).get('school');
        if (school)
          setSelected(
            data.projects.find((project) => project.id === school) || null,
          );
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
    Object.entries(filters).forEach(([key, value]) => {
      if (value) query.set(key === 'buildingType' ? 'building' : key, value);
    });
    if (view !== 'map') query.set('view', view);
    if (lens !== 'Regional Map View') query.set('lens', lens);
    if (selected) query.set('school', selected.id);
    history.replaceState(
      null,
      '',
      `/dashboard${query.size ? `?${query}` : ''}`,
    );
  }, [filters, lens, selected, view]);

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

  const filtered = useMemo(
    () =>
      projects.filter(
        (project) =>
          (!filters.region || project.region === filters.region) &&
          (!filters.division || project.division === filters.division) &&
          (!filters.buildingType ||
            project.buildingType === filters.buildingType) &&
          (!filters.readiness || project.readiness === filters.readiness) &&
          appliesScope(project, filters.scope) &&
          (!filters.search ||
            `${project.id} ${project.name} ${project.division}`
              .toLowerCase()
              .includes(filters.search.toLowerCase())),
      ),
    [filters, projects],
  );
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
              ['Ready', 'Pending', 'At risk', 'Unknown'].map((status) => [
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
          <button
            className="font-semibold text-[#164da8] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1854bd]"
            onClick={() => setSelected(info.row.original)}
          >
            {info.getValue()}
          </button>
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

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-[#edf2f8] text-[#102044]">
      <AppHeader view={view} onNavigate={setView} snapshotDate={snapshotDate} />
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ApiError
            message={error}
            onRetry={() => setReloadKey((key) => key + 1)}
          />
        ) : filtered.length === 0 ? (
          <div className="h-full overflow-auto p-4">
            <Empty onClear={() => setFilters(blank)} />
          </div>
        ) : view === 'map' ? (
          <MapPanel
            data={filtered}
            onSelect={setSelected}
            controls={filtersPanel}
            lens={lens}
            onLensChange={setLens}
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
      <SchoolPreview school={selected} onClose={() => setSelected(null)} />
    </main>
  );
}

function AppHeader({
  view,
  onNavigate,
  snapshotDate,
}: {
  view: DashboardView;
  onNavigate: (view: DashboardView) => void;
  snapshotDate: string | null;
}) {
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
    <header className="z-20 shrink-0 bg-[#0b245f] text-white shadow-lg">
      <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-2 lg:px-6">
        <Link
          href="/dashboard"
          onClick={() => onNavigate('map')}
          className="flex shrink-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <div className="grid size-9 place-items-center rounded-xl bg-white text-[#123b8f]">
            <Building2 className="size-5" aria-hidden="true" />
          </div>
          <div className="hidden sm:block">
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-blue-200">
              Department of Education
            </p>
            <p className="font-semibold tracking-tight">PSIP Monitor</p>
          </div>
        </Link>
        <nav
          className="flex items-center gap-1 rounded-xl bg-white/10 p-1"
          aria-label="Dashboard views"
        >
          {items.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-current={view === item.value ? 'page' : undefined}
              onClick={() => onNavigate(item.value)}
              className={`min-h-10 rounded-lg px-2 py-2 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:px-3 sm:text-sm ${view === item.value ? 'bg-white text-[#123b8f] shadow-sm' : 'text-blue-100 hover:bg-white/15'}`}
            >
              <span className="sm:hidden">{item.short}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="hidden shrink-0 text-right lg:block">
          <p className="text-[10px] text-blue-200">Fabric snapshot</p>
          <p className="text-xs font-semibold">{formatted}</p>
        </div>
      </div>
    </header>
  );
}

function DashboardFilters({
  filters,
  active,
  update,
  clear,
  regions,
  divisions,
  buildingTypes,
  showRegion,
}: {
  filters: ProjectFilters;
  active: [keyof ProjectFilters, string][];
  update: (key: keyof ProjectFilters, value: string) => void;
  clear: () => void;
  regions: string[];
  divisions: string[];
  buildingTypes: string[];
  showRegion: boolean;
}) {
  return (
    <div aria-label="Dashboard filters">
      <div
        className={`grid gap-2 sm:grid-cols-2 ${showRegion ? 'lg:grid-cols-[1.5fr_repeat(4,1fr)_auto]' : 'lg:grid-cols-[1.5fr_repeat(3,1fr)_auto]'}`}
      >
        <label className="relative">
          <span className="sr-only">Search schools</span>
          <Search
            className="pointer-events-none absolute left-3 top-3 size-4 text-[#5e6d85]"
            aria-hidden="true"
          />
          <input
            value={filters.search}
            onChange={(event) => update('search', event.target.value)}
            placeholder="Search school, ID, or division"
            className="h-10 w-full rounded-xl border border-[#cad5e3] bg-white pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#1854bd]"
          />
        </label>
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
        <FilterSelect
          label="Building"
          value={filters.buildingType}
          onChange={(value) => update('buildingType', value)}
          options={buildingTypes}
        />
        <FilterSelect
          label="Project scope"
          value={filters.scope}
          onChange={(value) => update('scope', value)}
          options={['Demolition', 'Site improvement', 'Slope protection']}
        />
        <button
          type="button"
          onClick={clear}
          disabled={!active.length}
          className="flex h-10 items-center justify-center gap-2 rounded-xl border border-[#cad5e3] bg-white px-4 text-sm font-semibold transition-colors hover:bg-[#f5f8fc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1854bd] disabled:cursor-not-allowed disabled:opacity-40"
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
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full appearance-none rounded-xl border border-[#cad5e3] bg-white pl-3 pr-9 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[#1854bd]"
      >
        <option value="">{label}</option>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-3 size-4 text-[#526079]"
        aria-hidden="true"
      />
    </label>
  );
}

function LensControl({
  value,
  onChange,
}: {
  value: AnalyticsLens;
  onChange: (value: AnalyticsLens) => void;
}) {
  return (
    <div
      className="grid grid-cols-3 gap-1 rounded-xl bg-[#eef3fa] p-1"
      role="tablist"
      aria-label="Analytics lens"
    >
      {lenses.map((item) => (
        <button
          type="button"
          key={item.value}
          role="tab"
          aria-selected={value === item.value}
          aria-label={item.value}
          onClick={() => onChange(item.value)}
          className={`min-h-10 rounded-lg px-3 py-2 text-left text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1854bd] ${value === item.value ? 'bg-[#1854bd] text-white shadow-sm' : 'text-[#526079] hover:bg-white'}`}
        >
          <span className="hidden xl:inline">{item.value}</span>
          <span className="xl:hidden">{item.short}</span>
        </button>
      ))}
    </div>
  );
}

function MapPanel({
  data,
  onSelect,
  controls,
  lens,
  onLensChange,
}: {
  data: SchoolProject[];
  onSelect: (project: SchoolProject) => void;
  controls: React.ReactNode;
  lens: AnalyticsLens;
  onLensChange: (lens: AnalyticsLens) => void;
}) {
  return (
    <article className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#dce5ef]">
      <div className="relative z-10 mx-3 mt-3 shrink-0 overflow-hidden rounded-2xl border border-white/70 bg-white/95 shadow-[0_8px_24px_rgba(21,48,93,.12)] backdrop-blur">
        <div className="p-3">{controls}</div>
        <div className="flex flex-col gap-3 border-t border-[#e2e8f0] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#2366dc]">
              {lens}
            </p>
            <h1 className="mt-1 text-lg font-bold">
              {lens === 'Regional Map View'
                ? 'Regional readiness across the Philippines'
                : 'School sites across the Philippines'}
            </h1>
          </div>
          <LensControl value={lens} onChange={onLensChange} />
        </div>
      </div>
      <div className="absolute inset-0 bg-[#dce5ef]">
        <PsipMap projects={data} onSelect={onSelect} view={lens} />
        <MapLegend data={data} lens={lens} />
      </div>
    </article>
  );
}
function MapLegend({
  data,
  lens,
}: {
  data: SchoolProject[];
  lens: AnalyticsLens;
}) {
  if (lens === 'Regional Map View')
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
        Colors identify regions · Hover for readiness details
      </div>
    );
  const items =
    lens === 'Sites Operational Readiness Locator'
      ? ['Ready', 'Pending', 'At risk', 'Unknown'].map((name) => ({
          name,
          color: readinessColor[name as keyof typeof readinessColor],
        }))
      : Array.from(new Set(data.map((project) => project.buildingType))).map(
          (name, index) => ({
            name,
            color: buildingColors[index % buildingColors.length],
          }),
        );
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 z-[500] flex max-w-[calc(100%-2rem)] flex-wrap gap-x-3 gap-y-1 rounded-xl border bg-white/95 px-3 py-2 text-xs font-medium text-[#526079] shadow-sm">
      {items.map((item) => (
        <span key={item.name} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block size-2 rounded-full"
            style={{ background: item.color }}
          />
          {item.name}
        </span>
      ))}
    </div>
  );
}

function ReportOverview({
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
  const classrooms = data.reduce((sum, project) => sum + project.classrooms, 0),
    specials = classificationData
      .slice(1)
      .reduce((sum, item) => sum + item.value, 0),
    academic =
      classificationData[0]?.value || Math.max(0, classrooms - specials),
    sites = uniqueSites(data),
    ready = readinessData.find((item) => item.name === 'Ready')?.value || 0,
    readyRate = data.length ? Math.round((ready / data.length) * 100) : 0;
  return (
    <div className="h-full overflow-y-auto bg-[#edf2f8]">
      <div className="mx-auto max-w-[1500px] space-y-4 px-4 py-4 lg:px-6 lg:py-6">
        <section className="overflow-hidden rounded-2xl border border-[#d9e2ee] bg-white shadow-[0_8px_24px_rgba(21,48,93,.06)]">
          <div className="p-4">{filters}</div>
          <div className="grid gap-4 border-t border-[#e2e8f0] p-4 lg:grid-cols-[minmax(0,1fr)_minmax(540px,.9fr)] lg:items-center">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#e7eefb] px-3 py-1 text-xs font-bold text-[#1854bd]">
                <LayoutDashboard className="size-3.5" aria-hidden="true" />
                Report Overview
              </div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                National infrastructure portfolio at a glance
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#526079]">
                All cards and charts use the current dashboard filters. Change
                the analytics lens to move between building composition and
                operational readiness.
              </p>
            </div>
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[.12em] text-[#63718a]">
                Analytics lens · synchronized with map
              </p>
              <LensControl value={lens} onChange={onLensChange} />
            </div>
          </div>
        </section>
        <section
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          aria-label="Portfolio summary"
        >
          <MetricCard
            label="Classrooms"
            value={classrooms}
            detail={`${academic ? number.format(academic) : '—'} academic rooms`}
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
            label="School sites"
            value={sites}
            detail={`${number.format(data.length)} visible project records`}
            icon={MapPinned}
            color="#0b8b69"
          />
          <MetricCard
            label="Ready to operate"
            value={`${readyRate}%`}
            detail={`${number.format(ready)} ready records`}
            icon={CheckCircle2}
            color="#14855f"
          />
        </section>
        <div aria-live="polite" className="sr-only">
          Report changed to {lens}
        </div>
        {lens !== 'Sites Operational Readiness Locator' && (
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
        {lens === 'Sites Operational Readiness Locator' && (
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
    <article className="relative overflow-hidden rounded-2xl border border-[#d9e2ee] bg-white p-5 shadow-[0_8px_24px_rgba(21,48,93,.05)]">
      <div
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: color }}
      />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#526079]">{label}</p>
          <p
            className="mt-2 text-3xl font-bold tabular-nums text-[#102044]"
            title={numeric ? number.format(value) : undefined}
          >
            {numeric ? compact.format(value) : value}
          </p>
          <p className="mt-2 text-xs leading-5 text-[#69768d]">{detail}</p>
        </div>
        <div
          className="grid size-11 shrink-0 place-items-center rounded-xl"
          style={{ background: `${color}16`, color }}
        >
          <Icon className="size-5" strokeWidth={1.8} aria-hidden="true" />
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
        .map((division) => ({
          label: division,
          ...Object.fromEntries(
            buildingTypes.map((type) => [
              type,
              data.filter(
                (project) =>
                  project.division === division &&
                  project.buildingType === type,
              ).length,
            ]),
          ),
        }))
        .sort((a, b) => a.label.localeCompare(b.label))
    : regionData.slice(0, 15).map((row) => ({
        label: row.region,
        ...row.buildings,
      }));
  const comparisonLabel = selectedRegion ? 'division' : 'region';
  const buildingChartData = (
    selectedDivision ? buildingData : comparisonData
  ) as Array<Record<string, string | number>>;
  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[minmax(340px,.62fr)_minmax(0,1.38fr)]">
        <ChartCard
          eyebrow="Building portfolio"
          title="Projects by building type"
          description="Select a segment or legend item to filter the full dashboard."
        >
          <div className="grid items-center sm:grid-cols-[1fr_180px] xl:grid-cols-1 2xl:grid-cols-[1fr_180px]">
            <ChartContainer
              config={{ value: { label: 'Projects' } }}
              className="h-[250px] w-full"
              aria-label="Donut chart of projects by building type"
            >
              <PieChart accessibilityLayer>
                <Pie
                  data={buildingData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={90}
                  paddingAngle={3}
                  onClick={(item) => {
                    const name = String(item.name ?? '');
                    if (name) onSelect(name);
                  }}
                />
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              </PieChart>
            </ChartContainer>
            <div className="space-y-2">
              {buildingData.map((item) => (
                <button
                  type="button"
                  key={item.name}
                  onClick={() => onSelect(item.name)}
                  className="flex min-h-10 w-full items-center justify-between rounded-lg px-2 text-sm hover:bg-[#f1f5fa] focus-visible:outline-2 focus-visible:outline-[#1854bd]"
                >
                  <span className="flex items-center">
                    <span
                      className="mr-2 inline-block size-2.5 rounded-full"
                      style={{ background: item.color }}
                    />
                    {item.name}
                  </span>
                  <b className="tabular-nums">{number.format(item.value)}</b>
                </button>
              ))}
            </div>
          </div>
        </ChartCard>
        <ClassificationPanel data={classificationData} />
      </section>
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
            ? `Building types in ${selectedDivision}`
            : `Building types by ${comparisonLabel}`
        }
        description={
          selectedDivision
            ? 'Project totals for each building type in the selected division.'
            : `The grouped bars show how each building type is distributed across ${comparisonLabel}s.`
        }
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
          className="h-[430px] w-full"
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
      className="overflow-hidden rounded-2xl border border-[#d9e2ee] bg-white shadow-[0_8px_24px_rgba(21,48,93,.05)]"
    >
      <div className="border-b border-[#e2e8f0] px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-[.13em] text-[#2366dc]">
          Portfolio mix
        </p>
        <h2 className="mt-1 text-xl font-bold">Classrooms classification</h2>
        <p className="mt-1 text-sm text-[#647089]">
          Live totals from the current filter selection.
        </p>
      </div>
      <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
        {data.map(({ name, value, icon: Icon }) => (
          <article
            key={name}
            className="rounded-xl border border-[#e1e7ef] bg-[#fbfcfe] p-3"
          >
            <div className="flex items-center gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#e8f0fc] text-[#1854bd]">
                <Icon className="size-5" strokeWidth={1.7} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold leading-4 text-[#526079]">
                  {name}
                </p>
                <b className="mt-1 block text-lg tabular-nums text-[#102044]">
                  {number.format(value)}
                </b>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e8edf4]">
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
        .map((division) => ({
          label: division,
          ...Object.fromEntries(
            statuses.map((status) => [
              status,
              data.filter(
                (project) =>
                  project.division === division && project.readiness === status,
              ).length,
            ]),
          ),
        }))
        .sort((a, b) => a.label.localeCompare(b.label))
    : regionData.slice(0, 18).map((row) => ({
        label: row.region,
        ...row.readiness,
      }));
  const comparisonLabel = selectedRegion ? 'division' : 'region';
  const readinessChartData = (
    selectedDivision ? statusDetailData : comparisonData
  ) as Array<Record<string, string | number>>;
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(340px,.62fr)_minmax(0,1.38fr)]">
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
            : 'Each bar shows the mix of ready, pending, at-risk, and unclassified records.'
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
    <article className="rounded-2xl border border-[#d9e2ee] bg-white p-5 shadow-[0_8px_24px_rgba(21,48,93,.05)]">
      {eyebrow && (
        <p className="text-xs font-bold uppercase tracking-[.13em] text-[#2366dc]">
          {eyebrow}
        </p>
      )}
      <h2 className={`${eyebrow ? 'mt-1' : ''} text-xl font-bold`}>{title}</h2>
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
  return (
    <section className="overflow-hidden rounded-2xl border border-[#d9e2ee] bg-white shadow-[0_8px_24px_rgba(21,48,93,.05)]">
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

function SchoolPreview({
  school,
  onClose,
}: {
  school: SchoolProject | null;
  onClose: () => void;
}) {
  if (!school) return null;
  const facilities = school.facilities || {
    audioVisual: 0,
    computerLab: 1,
    homeEconomics: 0,
    scienceLab: 1,
    workshop: 0,
  };
  return (
    <Sheet open={Boolean(school)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto p-0 sm:max-w-[480px]"
      >
        <div className="bg-[#0b245f] px-6 pb-6 pt-10 text-white">
          <SheetHeader className="p-0">
            <p className="text-xs font-bold uppercase tracking-[.14em] text-blue-200">
              School projects overview
            </p>
            <SheetTitle className="mt-2 text-2xl font-bold text-white">
              {school.name}
            </SheetTitle>
            <SheetDescription className="text-blue-100">
              {school.municipality}, {school.division} · {school.region}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-5 flex items-center justify-between rounded-xl bg-white/10 p-3">
            <span className="text-sm">Operational readiness</span>
            <Status value={school.readiness} />
          </div>
        </div>
        <div className="space-y-5 p-6">
          <div className="grid grid-cols-3 gap-3">
            <Mini label="Classrooms" value={school.classrooms} />
            <Mini label="Floors" value={school.floors} />
            <Mini label="Project" value={school.projectId || '—'} />
          </div>
          <div>
            <h3 className="mb-3 font-bold">Special facilities</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(facilities).map(([key, value]) => (
                <div key={key} className="rounded-xl bg-[#f4f7fb] p-3">
                  <p className="text-xs capitalize text-[#647089]">
                    {key.replace(/([A-Z])/g, ' $1')}
                  </p>
                  <b>{value}</b>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-3 font-bold">Scope of works</h3>
            <div className="space-y-2">
              <Scope label="Site improvement" active={school.siteImprovement} />
              <Scope label="Slope protection" active={school.slopeProtection} />
              <Scope label="For demolition" active={school.demolition} />
            </div>
          </div>
          <Link
            href={`/schools/${school.id}`}
            className="flex min-h-11 items-center justify-center rounded-xl bg-[#1854bd] font-bold text-white hover:bg-[#0b245f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1854bd]"
          >
            Open full details
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border p-3 text-center">
      <b className="text-xl">{value}</b>
      <p className="text-xs text-[#647089]">{label}</p>
    </div>
  );
}
function Scope({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm">
      <span>{label}</span>
      <span
        className={`grid size-6 place-items-center rounded-full ${active ? 'bg-[#ddf7ec] text-[#087a54]' : 'bg-[#f0f2f6] text-[#8490a3]'}`}
      >
        {active ? (
          <Check className="size-4" aria-hidden="true" />
        ) : (
          <X className="size-4" aria-hidden="true" />
        )}
      </span>
    </div>
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
