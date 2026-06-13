# CLAUDE.md — @node-on-fhir/symptom-tracking

Migrated from Atmosphere `symptomatic:symptom-tracking` (2026-06-12); an orbital
migration-chain gate (orbital embeds `SymptomsTabContent` in its DailyLogPage).
See root `FABLE-TECH-DEBT-PAYDOWN.md` § P1 migration.

## What this is

Symptom assessment + tracking for spaceflight participants. Routes (all
`requireAuth: true`): `/issue-report`, `/symptom-selection`,
`/symptom-back-tracker`, `/smoking-status` (the last is an ONC (g)(10) smoking
status item). Exports `SymptomsTabContent` + reusable `SymptomSelector` /
`IssueReportInput` for host embedding.

## Migration-specific gotchas (don't regress)

- **License is Artistic-2.0** (declared in LICENSE.MD, Perl Foundation) —
  PRESERVED in package.json, NOT the UNLICENSED default. Don't overwrite.
- **iconNames corrected** to PascalCase MUI in workflow.json: `medical_services`
  →`MedicalServices`, `notepad`→`EventNote`, `smoking_rooms`→`SmokingRooms`
  (the parser warns on lowercase).
- **FooterButtons** is now `[]`. The Atmosphere package registered one no-op
  footer (a component returning `null` on `/issue-report`) using the legacy
  `{pathname, component}` shape; an empty list is the equivalent behavior under
  the host's `{pathname, element}` contract.
- **Dropped the `Package['symptomatic:symptom-tracking'] = {...}` global** from
  index.jsx — that was Atmosphere's package-registration shim; NPM uses the
  default export via WorkflowRegistry.
- **`data/Questionnaire-SymptomAssessment.json`** is carried over but is not
  referenced in code (orphan data file); no Meteor Assets API was used.
- **Server**: `server/index.js` imports methods + `performSemanticSearch` and
  re-exports the latter; wired via `server.js` with `serverEntry: ./server`.

## Conventions

- `lib/ConditionMatcher.js`, `lib/SymptomIGSchema.js` are isomorphic/pure.
- The `tests/` dir carries Atmosphere tinytest + nightwatch specs (not the P3
  `node --test` kind) — left as-is.
- Theming: tokens preferred; existing `isDark` is supported legacy.
