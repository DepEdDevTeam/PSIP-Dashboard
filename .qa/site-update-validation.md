# Site update redesign validation

Implemented school-wide local demo updates with 1–8 photos per visit and the existing 40-photo session limit. Existing single-photo records and the `pending`, `approved`, and `rejected` persistence statuses remain compatible. Reviews remain per photo. Public-view batches are assembled only after filtering approved records for the selected school.

Validation completed:
- Production build: `npm.cmd run build` passed.
- Application TypeScript check: `.qa/tsconfig.site-update.json` passed.
- Storage checks: atomic saves, mixed reviews, wrong-school decisions, reload, legacy records, invalid dates/images, capacity, and storage failure passed.
- Browser workflow: multi-photo submission, reorder, replace, remove, preview, pending confirmation, mixed approve/disapprove, pending exclusion, timeline, comparison slider, playback, mobile reduced-motion reopen, reload, and school isolation passed without page errors.
- Map integration: school marker → overview → Site Progress → close retained the same canvas and filter URL using controlled dashboard data and map style.
- Desktop and 375px mobile screenshots inspected. Fixed dialog centering on reduced-motion reopen and kept Close outside the scrolling content.

Limits of verification:
- Browser tests use isolated synthetic dashboard responses; nothing is seeded into the user's session or backend.
- Live Fabric data did not return in the test browser and external map tiles failed to load. Real upstream availability was not verified.
- Full repository TypeScript checking still reports an existing `site/vite.config.ts` plugin-type incompatibility. Application source checking passes.
- The Sites build wrapper declines the existing mixed lockfiles; the preserved npm build script succeeds. Dependencies and lockfiles were not changed for this task.

No Fabric, DAX, backend/API, dashboard filtering, project relationships, or map renderer changes were made by this task. Existing unrelated workspace edits were preserved.
