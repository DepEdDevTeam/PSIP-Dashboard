import {
  School,
  MapPin,
  GraduationCap,
  Presentation,
  Monitor,
  Mic,
  House,
  FlaskConical,
  Wrench,
  Building2,
  Construction,
  Mountain,
  Hammer,
  CircleCheck,
  CircleX,
  Clock,
  CircleHelp,
  X,
} from 'lucide-react';
import type { SchoolProject } from '@/lib/psip-data';

export function summarizeSchool(rows: SchoolProject[]) {
  const total = (field: keyof NonNullable<SchoolProject['facilities']>) =>
    rows.reduce((sum, p) => sum + (p.facilities?.[field] ?? 0), 0);
  const facilities = {
    audioVisual: total('audioVisual'),
    computerLab: total('computerLab'),
    homeEconomics: total('homeEconomics'),
    scienceLab: total('scienceLab'),
    workshop: total('workshop'),
  };
  return {
    classrooms: rows.reduce((sum, p) => sum + p.classrooms, 0),
    academic: total('academic'),
    special: Object.values(facilities).reduce((sum, count) => sum + count, 0),
    facilities,
    readiness: ['Ready', 'Pending', 'At risk', 'Unknown']
      .map((status) => ({
        status,
        count: rows.filter((p) => p.readiness === status).length,
      }))
      .filter((item) => item.count),
    buildings: Array.from(new Set(rows.map((p) => p.buildingType))).filter(
      Boolean,
    ),
    works: Array.from(
      new Set(
        rows.map(
          (p) =>
            `${p.floors ? `${p.floors}-storey · ` : ''}${p.classrooms} classrooms`,
        ),
      ),
    ),
  };
}

export function SchoolMapTooltip({
  rows,
  pinned,
  onClose,
}: {
  rows: SchoolProject[];
  pinned: boolean;
  onClose: () => void;
}) {
  const school = rows[0];
  const summary = summarizeSchool(rows);
  const metrics = [
    {
      label: 'Total classrooms',
      value: summary.classrooms,
      icon: Presentation,
    },
    {
      label: 'Academic classrooms',
      value: summary.academic,
      icon: GraduationCap,
    },
    { label: 'Special classrooms', value: summary.special, icon: School },
  ];
  const facilities = [
    {
      label: 'Audio visual room',
      value: summary.facilities.audioVisual,
      icon: Mic,
    },
    {
      label: 'Computer laboratory',
      value: summary.facilities.computerLab,
      icon: Monitor,
    },
    {
      label: 'Home economics',
      value: summary.facilities.homeEconomics,
      icon: House,
    },
    {
      label: 'Science laboratory',
      value: summary.facilities.scienceLab,
      icon: FlaskConical,
    },
    { label: 'Workshop', value: summary.facilities.workshop, icon: Wrench },
  ];
  return (
    <section
      className="school-map-card"
      aria-label={`${school.name} school projects overview`}
    >
      <header>
        <School aria-hidden="true" />
        <strong>School Projects Overview</strong>
        {pinned && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close school tooltip"
          >
            <X aria-hidden="true" />
          </button>
        )}
      </header>
      <div className="school-map-body">
        <h2>{school.name}</h2>
        <p className="school-map-location">
          <MapPin aria-hidden="true" />
          {school.id} · {school.municipality} · {school.division} ·{' '}
          {school.region}
        </p>
        <div className="school-map-readiness">
          <strong>Operational readiness</strong>
          <div>
            {summary.readiness.map(({ status, count }) => {
              const Icon =
                status === 'Ready'
                  ? CircleCheck
                  : status === 'At risk'
                    ? CircleX
                    : status === 'Pending'
                      ? Clock
                      : CircleHelp;
              return (
                <span key={status} data-status={status}>
                  <Icon aria-hidden="true" />
                  {count} {status}
                </span>
              );
            })}
          </div>
          <small>
            {rows.length} project {rows.length === 1 ? 'record' : 'records'}
          </small>
        </div>
        <div className="school-map-metrics">
          {metrics.map(({ label, value, icon: Icon }) => (
            <div key={label}>
              <Icon aria-hidden="true" />
              <span>{label}</span>
              <b>{value.toLocaleString('en-PH')}</b>
            </div>
          ))}
        </div>
        <div className="school-map-facilities">
          {facilities.map(({ label, value, icon: Icon }) => (
            <div key={label}>
              <Icon aria-hidden="true" />
              <span>{label}</span>
              <b>{value.toLocaleString('en-PH')}</b>
            </div>
          ))}
        </div>
        <div className="school-map-works">
          <div>
            <h3>
              <Building2 aria-hidden="true" />
              Building types
            </h3>
            {summary.buildings.map((type) => (
              <p key={type}>{type}</p>
            ))}
          </div>
          <div>
            <h3>
              <Construction aria-hidden="true" />
              Scope of works
            </h3>
            {summary.works.map((work) => (
              <p key={work}>{work}</p>
            ))}
          </div>
        </div>
        <div className="school-map-scopes">
          {(
            [
              {
                label: 'Site improvement',
                key: 'siteImprovement',
                icon: Construction,
              },
              {
                label: 'Slope protection',
                key: 'slopeProtection',
                icon: Mountain,
              },
              { label: 'For demolition', key: 'demolition', icon: Hammer },
            ] as const
          ).map(({ label, key, icon: Icon }) => {
            const count = rows.filter((p) => p[key]).length;
            const StatusIcon = count ? CircleCheck : CircleX;
            return (
              <div key={key}>
                <Icon aria-hidden="true" />
                <span>{label}</span>
                <StatusIcon
                  aria-hidden="true"
                  className={count ? 'scope-yes' : 'scope-no'}
                />
                <small>
                  {count} of {rows.length} projects
                </small>
              </div>
            );
          })}
        </div>
        <a
          className="school-map-details"
          href={`/schools/${encodeURIComponent(school.id)}`}
        >
          Open full details
        </a>
      </div>
    </section>
  );
}
