'use client';

import { useLayoutEffect, useRef } from 'react';
import { useEntrance } from '@/lib/animation';
import { useDemoSitePhotos } from '@/hooks/use-demo-site-photos';
import { SiteProgress } from '@/components/site-photos';
import {
  School,
  MapPin,
  GraduationCap,
  Presentation,
  Building2,
  Construction,
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
  const cardRef = useEntrance<HTMLElement>(school.id);
  const heroRef = useRef<HTMLDivElement>(null);
  const schoolNameRef = useRef<HTMLHeadingElement>(null);
  const { photos } = useDemoSitePhotos(school.id);
  const latestApprovedPhoto = photos.find(
    (photo) => photo.status === 'approved',
  );
  useLayoutEffect(() => {
    const heading = schoolNameRef.current;
    const hero = heroRef.current;
    if (!heading || !hero) return;

    const fitName = () => {
      const heroFontSize = 22;
      heading.style.fontSize = `${heroFontSize}px`;
      const availableWidth = heading.clientWidth;
      const requiredWidth = heading.scrollWidth;
      if (!availableWidth || requiredWidth <= availableWidth) return;

      // Scale from the hero size using the rendered text width so the complete
      // school name always remains visible on one line at every tooltip width.
      const fittedSize = Math.max(
        8,
        Math.floor(
          heroFontSize * ((availableWidth - 2) / requiredWidth) * 10,
        ) / 10,
      );
      heading.style.fontSize = `${fittedSize}px`;
    };

    const frame = requestAnimationFrame(fitName);
    const observer = new ResizeObserver(fitName);
    observer.observe(hero);
    void document.fonts?.ready.then(fitName);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [school.name]);
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
  return (
    <section
      ref={cardRef}
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
        <div
          ref={heroRef}
          className="school-map-hero"
          data-has-photo={latestApprovedPhoto ? 'true' : 'false'}
          style={
            latestApprovedPhoto
              ? {
                  backgroundImage: `url(${JSON.stringify(latestApprovedPhoto.image)})`,
                }
              : undefined
          }
        >
          <h2 ref={schoolNameRef} title={school.name}>
            {school.name}
          </h2>
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
        {pinned && <SiteProgress key={school.id} compact school={{ schoolId: school.id, schoolName: school.name, schoolLocation: [school.municipality, school.division, school.region].filter(Boolean).join(' · ') }} />}
        <a
          className="school-map-details"
          href={`/dashboard?search=${encodeURIComponent(school.id)}&view=report#school-details`}
        >
          Open full details
        </a>
      </div>
    </section>
  );
}
