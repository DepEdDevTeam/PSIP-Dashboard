'use client';

import { useReveals } from '@/lib/animation';
import { AnimatedNumber } from '@/components/animated-number';
import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  Clock3,
  FlaskConical,
  GraduationCap,
  History,
  MapPin,
  RefreshCw,
  ShieldAlert,
  X,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { SiteProgress } from '@/components/site-photos';
import {
  ApiError,
  formatDate,
  type PsipRecord,
  type ReadinessStatus,
  type SchoolResponse,
} from '@/lib/psip-data';
import { fetchSchool } from '@/lib/psip-api';

export default function SchoolReportDetails({
  schoolId,
}: {
  schoolId: string;
}) {
  const [data, setData] = useState<SchoolResponse | null>(null);
  const [selected, setSelected] = useState<PsipRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void fetchSchool(schoolId, controller.signal)
      .then((response) => {
        setData(response);
        const requestedRecord = new URLSearchParams(window.location.search).get(
          'record',
        );
        setSelected(
          response.records.find(
            (record) => record.recordId === requestedRecord,
          ) ||
            response.records.find((record) => record.isCurrent === true) ||
            response.records[0] ||
            null,
        );
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          cause instanceof ApiError || cause instanceof Error
            ? cause.message
            : 'The school history could not be loaded.',
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [requestVersion, schoolId]);

  useEffect(() => {
    if (!loading && window.location.hash === '#school-details') {
      const frame = requestAnimationFrame(() =>
        document
          .getElementById('school-details')
          ?.scrollIntoView({ block: 'start' }),
      );
      return () => cancelAnimationFrame(frame);
    }
  }, [loading]);

  const revealRef = useReveals<HTMLElement>(selected?.recordId, ':scope > section, :scope > section > article');

  const chooseRecord = (record: PsipRecord) => {
    setSelected(record);
    const query = new URLSearchParams(window.location.search);
    query.set('record', record.recordId);
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}?${query.toString()}${window.location.hash}`,
    );
  };

  return (
    <section
      ref={revealRef}
      id="school-details"
      className="min-w-0 scroll-mt-4"
      aria-label="Full school details"
    >
      {loading ? (
        <SchoolSkeleton />
      ) : error ? (
        <section
          className="grid min-h-96 place-items-center rounded-2xl border border-red-200 bg-red-50 p-8 text-center"
          role="alert"
        >
          <div>
            <AlertTriangle
              className="mx-auto size-10 text-red-700"
              aria-hidden="true"
            />
            <h1 className="mt-4 text-2xl font-bold text-red-950">
              School data is unavailable
            </h1>
            <p className="mt-2 max-w-xl text-sm text-red-800">{error}</p>
            <button
              onClick={() => {
                setLoading(true);
                setError('');
                setRequestVersion((value) => value + 1);
              }}
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-700 px-4 text-sm font-bold text-white"
            >
              <RefreshCw aria-hidden="true" className="size-4" />
              Try again
            </button>
          </div>
        </section>
      ) : data && selected ? (
        <SchoolRecord data={data} selected={selected} onSelect={chooseRecord} />
      ) : (
        <p className="rounded-2xl border bg-white p-6">
          No school history records are available.
        </p>
      )}
    </section>
  );
}

function SchoolRecord({
  data,
  selected,
  onSelect,
}: {
  data: SchoolResponse;
  selected: PsipRecord;
  onSelect: (record: PsipRecord) => void;
}) {
  const facilityTotal = Object.values(selected.facilities).reduce(
    (sum, value) => sum + value,
    0,
  );
  return (
    <>
      <section className="overflow-hidden rounded-2xl bg-[#0b245f] text-white">
        <div className="grid gap-4 p-5 md:grid-cols-[1fr_auto]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.15em] text-blue-200">
              School {selected.schoolId} · Project{' '}
              {selected.projectId || 'not recorded'}
            </p>
            <h2 className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">
              {data.schoolName}
            </h2>
            <p className="mt-3 flex items-center gap-2 text-blue-100">
              <MapPin aria-hidden="true" className="size-4" />
              {selected.municipality}, {selected.division} · {selected.region}
            </p>
          </div>
          <div className="min-w-56 rounded-2xl bg-white/10 p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-200">
              Operational readiness
            </p>
            <div className="mt-3">
              <Status value={selected.readiness} />
            </div>
            <p className="mt-5 text-sm font-bold">
              {versionLabel(selected.isCurrent)}
            </p>
            <p className="mt-1 text-xs text-blue-200">
              Effective {formatDate(selected.effectiveStartDate)}
            </p>
          </div>
        </div>
      </section>

      <SiteProgress
        key={selected.schoolId}
        school={{ schoolId: selected.schoolId, schoolName: data.schoolName, schoolLocation: [selected.municipality, selected.division, selected.region].filter(Boolean).join(' · ') }}
      />

      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          icon={GraduationCap}
          label="Classrooms"
          value={selected.classrooms}
        />
        <Metric
          icon={Building2}
          label="Building profile"
          value={selected.buildingType || 'Unknown'}
        />
        <Metric
          icon={FlaskConical}
          label="Classified spaces"
          value={facilityTotal}
        />
        <Metric
          icon={History}
          label="School history"
          value={`${data.records.length} versions`}
        />
      </section>

      <section className="mt-5">
        <article className="rounded-2xl border bg-white p-5 shadow-[0_8px_24px_rgba(21,48,93,.05)]">
          <p className="text-xs font-bold uppercase tracking-[.13em] text-[#2366dc]">
            Version history
          </p>
          <h2 className="mt-1 text-xl font-bold">Effective records</h2>
          <p className="mt-1 text-xs leading-5 text-[#647089]">
            Choose a historical version to inspect its project facts.
          </p>
          <div className="mt-4 max-h-[430px] space-y-2 overflow-y-auto pr-1">
            {data.records.map((record) => (
              <button
                key={record.recordId}
                onClick={() => onSelect(record)}
                aria-pressed={record.recordId === selected.recordId}
                className={`w-full rounded-xl border p-3 text-left transition-colors ${
                  record.recordId === selected.recordId
                    ? 'border-[#1854bd] bg-[#edf4ff]'
                    : 'bg-white hover:bg-[#f7f9fd]'
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <b className="text-sm">
                    {formatDate(record.effectiveStartDate)}
                  </b>
                  <VersionBadge value={record.isCurrent} />
                </span>
                <span className="mt-1 block text-xs text-[#647089]">
                  {record.projectId || 'No project reference'} ·{' '}
                  {record.classrooms} rooms
                </span>
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <article className="rounded-2xl border bg-white p-6 shadow-[0_8px_24px_rgba(21,48,93,.05)]">
          <p className="text-xs font-bold uppercase tracking-[.13em] text-[#2366dc]">
            Scope and readiness
          </p>
          <h2 className="mt-1 text-xl font-bold">Site work requirements</h2>
          <div className="mt-5 space-y-3">
            <Scope label="Site improvement" active={selected.siteImprovement} />
            <Scope label="Slope protection" active={selected.slopeProtection} />
            <Scope label="For demolition" active={selected.demolition} />
          </div>
        </article>
        <article className="rounded-2xl border bg-white p-6 shadow-[0_8px_24px_rgba(21,48,93,.05)]">
          <p className="text-xs font-bold uppercase tracking-[.13em] text-[#2366dc]">
            Record context
          </p>
          <h2 className="mt-1 text-xl font-bold">Location and identifiers</h2>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <Info title="Region" value={selected.region} />
            <Info title="Schools division" value={selected.division} />
            <Info title="Municipality" value={selected.municipality} />
            <Info title="Record ID" value={selected.recordId} />
          </dl>
        </article>
      </section>
    </>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: string | number;
}) {
  return (
    <article className="min-w-0 rounded-2xl border bg-white p-5 shadow-[0_8px_24px_rgba(21,48,93,.05)]">
      <span className="grid size-9 place-items-center rounded-xl bg-[#eaf0fb] text-[#1854bd]">
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <p className="mt-5 text-xs font-semibold text-[#647089]">{label}</p>
      <p className="mt-1 break-words text-xl font-bold">
        <AnimatedNumber value={value} />
      </p>
    </article>
  );
}

function Status({ value }: { value: ReadinessStatus }) {
  const colors: Record<ReadinessStatus, string> = {
    Ready: '#33d69f',
    'At risk': '#ff7b87',
    Pending: '#f1b84b',
    Unknown: '#cbd5e1',
  };
  const Icon =
    value === 'Ready'
      ? CheckCircle2
      : value === 'At risk'
        ? ShieldAlert
        : value === 'Pending'
          ? Clock3
          : AlertTriangle;
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold"
      style={{ background: `${colors[value]}20`, color: colors[value] }}
    >
      <Icon aria-hidden="true" className="size-4" />
      {value}
    </span>
  );
}

function VersionBadge({ value }: { value: boolean | null }) {
  return (
    <span
      className={`rounded-full px-2 py-1 text-[10px] font-bold ${value === true ? 'bg-[#ddf7ec] text-[#087a54]' : value === false ? 'bg-[#eef1f5] text-[#526079]' : 'bg-amber-50 text-amber-800'}`}
    >
      {versionLabel(value)}
    </span>
  );
}

function versionLabel(value: boolean | null) {
  return value === true
    ? 'Current'
    : value === false
      ? 'Historical'
      : 'Unmarked';
}

function Scope({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl border px-4 py-3 text-sm">
      <span>{label}</span>
      <span
        className={`grid size-7 place-items-center rounded-full ${active ? 'bg-[#ddf7ec] text-[#087a54]' : 'bg-[#f0f2f6] text-[#8490a3]'}`}
      >
        {active ? (
          <Check aria-label="Included" className="size-4" />
        ) : (
          <X aria-label="Not included" className="size-4" />
        )}
      </span>
    </div>
  );
}

function Info({ title, value }: { title: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-[#f4f7fb] p-4">
      <dt className="text-xs font-bold uppercase tracking-wider text-[#647089]">
        {title}
      </dt>
      <dd className="mt-2 break-words font-bold">{value}</dd>
    </div>
  );
}

function SchoolSkeleton() {
  return (
    <output className="block space-y-5" aria-label="Loading school history">
      <Skeleton className="h-64 rounded-3xl" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-36 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-2xl" />
      <span className="sr-only">Loading school history</span>
    </output>
  );
}
