# Symptom Tracking Cycle 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the symptom-tracking package on a real footing — vendor the HL7 Symptoms IG terminology as the single vocabulary source, realign the hand-rolled schema to the canonical `SymptomLogicalModel`, converge the two duplicated symptom-entry surfaces onto the shared `SymptomSelector`, and close the patient-privacy / private-API gaps.

**Architecture:** Add one pure, unit-tested catalog module (`lib/SymptomCatalog.js`) that reads vendored IG JSON and is the single source of truth for symptom concepts; extract the duplicated search/select UI into the (currently unused) `SymptomSelector`; make the wizard and the embedded tab both consume it; surgical fixes to the server search method, `ConditionMatcher`, and `SymptomIGSchema`.

**Tech Stack:** Meteor v3 client + server, React 18, Material-UI v5, lodash, FHIR R4. Package `@awatson1978/symptom-tracking` (extension, Artistic-2.0, nested private repo).

## Global Constraints

- **Package:** `extensions/symptom-tracking` — nested private git repo, branch `npm-migration`. Working tree is **already dirty with unrelated in-progress edits** (`client/pages/BackTrackerPage.jsx`, `client/pages/IssueReportPage.jsx`, `workflow.json`). Each task stages **only the files it touches** — **never `git add -A` / `git add .`**.
- **License is Artistic-2.0** — preserve `package.json` `"license"`; do not overwrite with UNLICENSED.
- **Live entry is `client.js`** (loaded via `EXTRA_WORKFLOWS=@awatson1978/symptom-tracking`). Do not touch Atmosphere-era files.
- **Don't regress the ONC path:** `tests/nightwatch/170.315.a.11.test.js` (smoking-status cert) must still pass. The `SymptomIGSchema` export mappers (US Core, C-CDA, QDM, ASTM, HL7v2, CSV) and smoking-status templates keep their output.
- **iconNames stay PascalCase MUI; `FooterButtons = []`** (migration invariants).
- **Meteor v3 async** on server (`findOneAsync`/`fetchAsync`/`updateAsync`); `function(){}` not arrow for methods.
- **Theming:** `isDark` conditionals are supported (legacy) here; prefer tokens for new/converged code. No unconditional hardcoded surface colors.
- **On-device only** posture is a Cycle-2 concern — Cycle 1 adds NO embedding/LLM code.
- **Unit tests:** only `lib/SymptomCatalog.js` is pure enough for an automated test (`node --test`, no framework — the package has no unit runner). Everything else is verified by grep + the running app.

---

## File map

| File | Responsibility | Tasks |
|------|----------------|-------|
| `data/terminology/*.json` *(new)* | Vendored IG ValueSets + CodeSystems (pinned) | 1 |
| `lib/SymptomCatalog.js` *(new)* | Pure symptom-concept catalog + axis-vocab accessors | 2, 3 |
| `tests/symptomCatalog.test.mjs` *(new)* | Node-runnable unit test for the catalog | 2 |
| `server/methods/performSemanticSearch.js` | Fallback search defers to catalog | 3 |
| `lib/ConditionMatcher.js` | `SYMPTOM_NAMES` defers to catalog | 3 |
| `lib/SymptomIGSchema.js` | Realign shape to `SymptomLogicalModel` (keep mappers) | 4 |
| `client/components/SymptomSelector.jsx` | Shared search-results/select/chips UI | 5 |
| `client/SymptomsTabContent.jsx` | Consume `SymptomSelector`; privacy + token fixes | 5, 7, 8 |
| `client/pages/SymptomSelectionPage.jsx` | Consume `SymptomSelector`; drop private-API reach | 6, 7 |

---

## Task 1: Vendor the IG terminology

**Files:**
- Create: `data/terminology/ValueSet-*.json`, `data/terminology/CodeSystem-*.json`

**Interfaces:**
- Produces: vendored JSON files read by `lib/SymptomCatalog.js` (Task 2).

- [ ] **Step 1: Download and extract the pinned IG package.**

```bash
cd extensions/symptom-tracking
mkdir -p data/terminology
curl -L -o /tmp/symptoms-ig.tgz https://build.fhir.org/ig/HL7/fhir-symptoms-ig/package.tgz
mkdir -p /tmp/symptoms-ig && tar -xzf /tmp/symptoms-ig.tgz -C /tmp/symptoms-ig
cp /tmp/symptoms-ig/package/ValueSet-*.json /tmp/symptoms-ig/package/CodeSystem-*.json data/terminology/
```

If `package.tgz` 404s, fall back to `definitions.json.zip` from the same base, or `curl` the individual artifacts (their ids are listed in the design doc's terminology inventory) from `https://build.fhir.org/ig/HL7/fhir-symptoms-ig/en/{Type}-{id}.json`.

- [ ] **Step 2: Verify the counts.**

Run: `ls data/terminology/ValueSet-*.json | wc -l` → expect `17`.
Run: `ls data/terminology/CodeSystem-*.json | wc -l` → expect `6`.
Run: `node -e "const v=require('./data/terminology/ValueSet-CommonSymptomCodes.json'); console.log(v.resourceType, v.url)"` → expect `ValueSet http://hl7.org/fhir/uv/symptoms/ValueSet/CommonSymptomCodes`.

- [ ] **Step 3: Commit.**

```bash
git add data/terminology/
git commit -m "feat(symptoms): vendor HL7 Symptoms IG terminology (17 ValueSets + 6 CodeSystems, pinned 1.0.0)"
```

---

## Task 2: The pure `SymptomCatalog` module (TDD)

**Files:**
- Create: `lib/SymptomCatalog.js`
- Test: `tests/symptomCatalog.test.mjs`

**Interfaces:**
- Produces (consumed by Tasks 3, and Cycle 2):
  - `getSymptomCatalog(): Array<{ code, system, display, source }>` — the union of symptom-concept sets (`CommonSymptomCodes` + `SymptomTemporary` + Excluded Symptom + openEHR symptom-sign, when present), de-duplicated by `system|code`. These are the embedding match targets.
  - `getSymptomName(code): string` — display for a SNOMED/symptom code, or the code if unknown (replaces `ConditionMatcher.SYMPTOM_NAMES`).
  - `AXIS_VALUESETS: string[]` — the filenames of the axis/qualifier value sets that are **not** part of the symptom catalog.

- [ ] **Step 1: Write the failing test.**

Create `tests/symptomCatalog.test.mjs`:

```js
import assert from 'node:assert/strict';
import { getSymptomCatalog, getSymptomName, AXIS_VALUESETS } from '../lib/SymptomCatalog.js';

const catalog = getSymptomCatalog();

// Seeded from CommonSymptomCodes (52) plus other symptom-concept sets → at least 52.
assert.ok(catalog.length >= 52, 'catalog has at least the 52 CommonSymptomCodes');

// Every concept is well-formed.
for (const c of catalog) {
  assert.ok(c.code && c.system && c.display, 'concept has code/system/display');
}

// A known SNOMED symptom is present with its display.
const dizziness = catalog.find(c => c.code === '404640003');
assert.ok(dizziness, 'Dizziness present');
assert.equal(dizziness.display.toLowerCase().includes('dizz'), true);

// De-duplicated by system|code.
const keys = catalog.map(c => c.system + '|' + c.code);
assert.equal(keys.length, new Set(keys).size, 'no duplicate system|code');

// getSymptomName resolves a known code and falls back to the code.
assert.equal(getSymptomName('404640003').toLowerCase().includes('dizz'), true);
assert.equal(getSymptomName('not-a-real-code'), 'not-a-real-code');

// Axis value sets are NOT match targets — a severity code must not appear as a symptom.
assert.ok(Array.isArray(AXIS_VALUESETS) && AXIS_VALUESETS.length > 0);
assert.ok(!catalog.some(c => /severity|frequency|trend/i.test(c.display)),
  'no qualifier concepts leaked into the symptom catalog');

console.log('symptomCatalog: all assertions passed (' + catalog.length + ' concepts)');
```

- [ ] **Step 2: Run the test to verify it fails.**

Run: `cd extensions/symptom-tracking && node tests/symptomCatalog.test.mjs`
Expected: FAIL — `Cannot find module '.../lib/SymptomCatalog.js'`.

- [ ] **Step 3: Write the implementation.**

Create `lib/SymptomCatalog.js`:

```js
// lib/SymptomCatalog.js
//
// Pure, isomorphic single source of truth for symptom vocabulary. Reads the
// vendored HL7 Symptoms IG terminology (data/terminology/) and returns:
//   - the SYMPTOM-CONCEPT catalog (embedding match targets), unioned + deduped
//   - the AXIS/QUALIFIER value sets (structured capture, NOT match targets)
// No Meteor/React deps — only lodash — so it is unit-testable with plain node.

import { get } from 'lodash';

import commonSymptomCodes from '../data/terminology/ValueSet-CommonSymptomCodes.json';
import symptomTemporary from '../data/terminology/CodeSystem-SymptomTemporary.json';

// The axis/qualifier value sets — imported elsewhere for structured capture,
// listed here so we can assert they are never treated as symptom match targets.
export const AXIS_VALUESETS = [
  'ValueSet-SeverityCodes',
  'ValueSet-ClinicalCourseCodes',
  'ValueSet-TrendCodes',
  'ValueSet-SpeedOfOnset',
  'ValueSet-FrequencyCodes',
  'ValueSet-QualityCodes',
  'ValueSet-FunctionalClassification',
  'ValueSet-AlleviatingFactorCodes',
  'ValueSet-TriggersOrExacerbatingFactorCodes'
];

// Pull {code, system, display} out of either a compose.include or an expansion.
function conceptsFromValueSet(vs, source) {
  const out = [];
  const includes = get(vs, 'compose.include', []);
  includes.forEach(function (inc) {
    const system = get(inc, 'system', '');
    get(inc, 'concept', []).forEach(function (c) {
      if (c && c.code) out.push({ code: c.code, system: system, display: c.display || c.code, source: source });
    });
  });
  get(vs, 'expansion.contains', []).forEach(function (c) {
    if (c && c.code) out.push({ code: c.code, system: get(c, 'system', ''), display: c.display || c.code, source: source });
  });
  return out;
}

function conceptsFromCodeSystem(cs, source) {
  const system = get(cs, 'url', '');
  return get(cs, 'concept', [])
    .filter(function (c) { return c && c.code; })
    .map(function (c) { return { code: c.code, system: system, display: c.display || c.code, source: source }; });
}

let _catalog = null;

export function getSymptomCatalog() {
  if (_catalog) return _catalog;
  const all = [
    ...conceptsFromValueSet(commonSymptomCodes, 'CommonSymptomCodes'),
    ...conceptsFromCodeSystem(symptomTemporary, 'SymptomTemporary')
  ];
  // De-duplicate by system|code (first wins).
  const seen = new Set();
  _catalog = [];
  all.forEach(function (c) {
    const key = c.system + '|' + c.code;
    if (!seen.has(key)) { seen.add(key); _catalog.push(c); }
  });
  return _catalog;
}

export function getSymptomName(code) {
  const hit = getSymptomCatalog().find(function (c) { return c.code === code; });
  return hit ? hit.display : code;
}
```

*(If the Excluded-Symptom / openEHR symptom-sign ValueSets are present after Task 1, add their imports + `conceptsFromValueSet(...)` lines to the union. The test only requires ≥52, so `CommonSymptomCodes` alone passes — but include them for completeness.)*

- [ ] **Step 4: Run the test to verify it passes.**

Run: `cd extensions/symptom-tracking && node tests/symptomCatalog.test.mjs`
Expected: PASS — prints `symptomCatalog: all assertions passed (52 concepts)` (or more), exit 0.

- [ ] **Step 5: Commit.**

```bash
git add lib/SymptomCatalog.js tests/symptomCatalog.test.mjs
git commit -m "feat(symptoms): pure SymptomCatalog module (IG-seeded, deduped) with node test"
```

---

## Task 3: Retire the scattered vocabulary

**Files:**
- Modify: `server/methods/performSemanticSearch.js`, `lib/ConditionMatcher.js`

**Interfaces:**
- Consumes: `getSymptomCatalog`, `getSymptomName` from `lib/SymptomCatalog.js`.

- [ ] **Step 1: Replace the hard-coded 10 symptoms in the search fallback.**

In `server/methods/performSemanticSearch.js`, delete the `hardCodedSymptoms` array (the ~10 inline objects) and import the catalog:

```js
import { getSymptomCatalog } from '../../lib/SymptomCatalog.js';
```

Replace the `matchingHardCoded` filter to draw from the catalog instead:

```js
const searchTerms = query.toLowerCase().split(/\s+/);
const matchingHardCoded = getSymptomCatalog()
  .filter(function (c) {
    const text = c.display.toLowerCase();
    return searchTerms.some(function (t) { return text.includes(t); });
  })
  .map(function (c) {
    return { id: c.code, display: c.display, code: c.code, system: c.system, description: null };
  });
```

- [ ] **Step 2: Point `ConditionMatcher` at the catalog for display names.**

In `lib/ConditionMatcher.js`, import `getSymptomName` and replace uses of the local `SYMPTOM_NAMES[code]` lookups with `getSymptomName(code)`. Keep the `CONDITION_MAPPINGS` (the rule logic) as-is. Leave `SYMPTOM_NAMES` exported for now (other callers) but have the matcher itself use `getSymptomName`.

```js
import { getSymptomName } from './SymptomCatalog.js';
// e.g. matchedRequired.push(getSymptomName(reqSymptom));
```

- [ ] **Step 3: Verify no orphaned hard-coded vocab remains in the search path.**

Run: `grep -n "flank-pain\|hardCodedSymptoms\|solar-retinopathy" server/methods/performSemanticSearch.js`
Expected: no matches.
Run the catalog test again to confirm nothing broke its import graph: `node tests/symptomCatalog.test.mjs` → PASS.

- [ ] **Step 4: Manual verification.**

Boot the app, open the symptom search, type "dizzy" — results still include Dizziness (now sourced from the catalog, not the inline list).

- [ ] **Step 5: Commit.**

```bash
git add server/methods/performSemanticSearch.js lib/ConditionMatcher.js
git commit -m "refactor(symptoms): search fallback + ConditionMatcher defer to SymptomCatalog"
```

---

## Task 4: Realign `SymptomIGSchema` to the canonical logical model

**Files:**
- Modify: `lib/SymptomIGSchema.js`

**Interfaces:**
- Produces: the same exported mapper functions (unchanged signatures + output); a schema object shaped to `SymptomLogicalModel`.

- [ ] **Step 1: Pin the ONC mapper outputs with a characterization test first.**

Create `tests/symptomIgSchema.test.mjs` capturing current output of the mappers on a known smoking-status observation, so the realignment can't regress the cert:

```js
import assert from 'node:assert/strict';
import { mapToHL7FHIR, mapToUSCoreObservation, generateCCDASnippet, validateONCCompliance, SmokingStatusTemplates, createSymptomObservation } from '../lib/SymptomIGSchema.js';

const obs = createSymptomObservation(SmokingStatusTemplates['current-smoker'], 'Patient/123');
const us = mapToUSCoreObservation(obs);
assert.equal(us.code.coding[0].code, '72166-2');           // LOINC tobacco smoking status
assert.equal(us.category[0].coding[0].code, 'social-history');
const hl7 = mapToHL7FHIR(obs);
assert.equal(hl7.meta.profile[0].includes('us-core-smokingstatus'), true);
assert.ok(generateCCDASnippet(obs).includes('72166-2'));
assert.equal(validateONCCompliance(obs).compliant, true);
console.log('symptomIgSchema: ONC mapper outputs pinned');
```

Run: `node tests/symptomIgSchema.test.mjs` → PASS (against current code, before edits).

- [ ] **Step 2: Add the header + realign the schema object.**

At the top of `lib/SymptomIGSchema.js`, add a comment referencing the canonical model:

```js
// Aligned to HL7 Symptoms IG SymptomLogicalModel:
// http://hl7.org/fhir/uv/symptoms/StructureDefinition/SymptomLogicalModel
```

Rework the exported `SymptomIGSchema` object so its element names track the logical model: `symptomCode`, `presentFlag` (boolean, absence), `reporter`, `associatedSymptoms` (recursive), `associatedConditions`, and a `keyFeatures` block (`location`, `quality`, `severity`, `impact` each with `scaleCode`; `surroundingEvents`; `frequency`), `timing` (`speedOfOnset`, `onset`, `duration`), `clinicalCourse`, `trend`, and metadata (`documentationDate`, `issued`). Keep `status`'s existing allowed values as a compatibility alias.

- [ ] **Step 3: Do NOT touch the mapper functions.**

Leave `mapToUSCoreObservation`, `mapToHL7FHIR`, `generateCCDASnippet`, `mapToQDM`, `mapToASTM`, `generateHL7v2Message`, `generateCSVReport`, `validateONCCompliance`, `deriveSNOMEDSmoking*`, and the `SmokingStatus*` templates unchanged.

- [ ] **Step 4: Verify the ONC outputs did not regress.**

Run: `node tests/symptomIgSchema.test.mjs` → still PASS after the edits.

- [ ] **Step 5: Commit.**

```bash
git add lib/SymptomIGSchema.js tests/symptomIgSchema.test.mjs
git commit -m "refactor(symptoms): realign schema to SymptomLogicalModel; pin ONC mappers with test"
```

---

## Task 5: Extract the shared `SymptomSelector` and adopt it in `SymptomsTabContent`

**Files:**
- Modify: `client/components/SymptomSelector.jsx` (currently unused — becomes the shared UI)
- Modify: `client/SymptomsTabContent.jsx`

**Interfaces:**
- Produces: `SymptomSelector` — presentational search-results list + selected chips.
  Props: `{ results, selected, onToggle, onRemove, isSearching }` where `results`/`selected` are `[{ code, system, display, description? }]`.

- [ ] **Step 1: Read the current `SymptomSelector.jsx`.**

Run: `sed -n '1,60p' client/components/SymptomSelector.jsx` — it's imported nowhere, so its current body can be replaced wholesale.

- [ ] **Step 2: Write the shared component** (lifted from `SymptomsTabContent`'s inline list + chips, theme-token based):

```jsx
// client/components/SymptomSelector.jsx
import React from 'react';
import { Box, Typography, FormGroup, FormControlLabel, Checkbox, Chip, CircularProgress, Alert } from '@mui/material';

export function SymptomSelector({ results = [], selected = [], onToggle, onRemove, isSearching = false }) {
  const isChecked = (s) => selected.some((x) => x.code === s.code);

  if (isSearching) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
        <CircularProgress size={28} /><Typography sx={{ ml: 2 }}>Analyzing symptoms…</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {results.length > 0 && (
        <Box sx={{ maxHeight: 400, overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, p: 2, mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Select matching symptoms ({results.length} found):</Typography>
          <FormGroup>
            {results.map((s) => (
              <Box key={s.code || s.id} sx={{ display: 'flex', alignItems: 'flex-start', mb: 1, px: 1, py: 0.5, borderRadius: 1,
                bgcolor: isChecked(s) ? 'action.selected' : 'transparent', '&:hover': { bgcolor: 'action.hover' } }}>
                <FormControlLabel sx={{ flex: 1, m: 0 }}
                  control={<Checkbox checked={isChecked(s)} onChange={() => onToggle(s)} color="primary" sx={{ mt: -0.5 }} />}
                  label={<Box>
                    <Typography variant="body2">{s.display}</Typography>
                    {s.description && <Typography variant="caption" color="text.secondary">{s.description}</Typography>}
                  </Box>} />
                <Typography variant="caption" color="text.secondary"
                  sx={{ fontFamily: 'monospace', fontSize: '0.7rem', bgcolor: 'action.hover', px: 1, py: 0.5, borderRadius: 1, alignSelf: 'flex-start', mt: 0.5 }}>
                  {s.code}
                </Typography>
              </Box>
            ))}
          </FormGroup>
        </Box>
      )}
      {selected.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Selected symptoms:</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {selected.map((s) => (
              <Chip key={s.code} label={s.display} color="primary" size="small" onDelete={() => onRemove(s.code)} />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}

export default SymptomSelector;
```

- [ ] **Step 3: Adopt it in `SymptomsTabContent`.**

Import it (`import { SymptomSelector } from './components/SymptomSelector.jsx';`) and replace the inline results-`Box` + `FormGroup` block *and* the "Selected Chips below search" block (the markup spanning roughly the `{!isSearching && searchResults.length > 0 && (...)}` region) with:

```jsx
<SymptomSelector
  results={searchResults}
  selected={selectedSymptoms}
  isSearching={isSearching}
  onToggle={handleSymptomToggle}
  onRemove={handleRemoveSymptom}
/>
```

Keep the search `TextField`/`Button`, the "Log Symptoms" sidebar, and "Today's Log" table as-is.

- [ ] **Step 4: Verify.**

Run: `grep -c "FormGroup" client/SymptomsTabContent.jsx` → expect `0` (the inline list is gone).
Run: `grep -c "SymptomSelector" client/SymptomsTabContent.jsx` → expect `≥1`.
Boot the app, open the orbital DailyLogPage (or the tab route), search + select + deselect — behaves as before.

- [ ] **Step 5: Commit.**

```bash
git add client/components/SymptomSelector.jsx client/SymptomsTabContent.jsx
git commit -m "refactor(symptoms): extract shared SymptomSelector; adopt in SymptomsTabContent"
```

---

## Task 6: Adopt `SymptomSelector` in the wizard

**Files:**
- Modify: `client/pages/SymptomSelectionPage.jsx`

**Interfaces:**
- Consumes: `SymptomSelector` from Task 5.

- [ ] **Step 1: Import and replace the inline list + chips.**

Import `SymptomSelector`. Replace the inline results `Box`/`FormGroup` and the "Selected Symptoms Chips" `Box` with:

```jsx
<SymptomSelector
  results={searchResults}
  selected={selectedSymptoms}
  isSearching={isSearching}
  onToggle={handleSymptomToggle}
  onRemove={(code) => handleSymptomToggle(selectedSymptoms.find((s) => s.code === code))}
/>
```

Keep the `Stepper`, the explainable-AI `Accordion` (`currentExplanation`), and the Back/Continue actions unchanged.

- [ ] **Step 2: Verify.**

Run: `grep -c "FormGroup" client/pages/SymptomSelectionPage.jsx` → expect `0`.
Run: `grep -c "SymptomSelector" client/pages/SymptomSelectionPage.jsx` → expect `≥1`.
Boot the app, walk the wizard (`/issue-report` → symptom selection); the `ConditionMatcher` explanation accordion still updates on selection.

- [ ] **Step 3: Commit.**

```bash
git add client/pages/SymptomSelectionPage.jsx
git commit -m "refactor(symptoms): wizard consumes shared SymptomSelector"
```

---

## Task 7: Close the patient-privacy and private-API gaps

**Files:**
- Modify: `client/SymptomsTabContent.jsx`, `client/pages/SymptomSelectionPage.jsx`

**Interfaces:**
- Consumes: `Meteor.FhirUtilities.addPatientFilterToQuery`.

- [ ] **Step 1: Anchor the patient filter in `SymptomsTabContent`.**

Replace the `todayConditions` query's `'subject.reference': { $regex: selectedPatientId }` with the shared, anchored helper:

```js
const base = (Meteor.FhirUtilities && selectedPatientId)
  ? Meteor.FhirUtilities.addPatientFilterToQuery(selectedPatientId)
  : { 'subject.reference': 'Patient/' + selectedPatientId };
const todayConditions = Conditions.find({
  ...base,
  recordedDate: { $gte: dayStart, $lte: dayEnd }
}).fetch();
```

- [ ] **Step 2: Remove the private-API reach in the wizard.**

In `SymptomSelectionPage.jsx`, replace `QuestionnaireResponses._collection.updateAsync(...)` with a public method call — `Meteor.callAsync('questionnaireResponses.update', questionnaireResponseId, updatedResponse)` (use the existing update method; if none exists, fall back to the public `QuestionnaireResponses.update` collection call). Do not reach through `._collection`.

- [ ] **Step 3: Verify privacy.**

Boot the app, load two patients each with distinct Conditions on the same date. Select patient A → "Today's Log" shows only A's symptoms, never B's. Repeat for B.
Run: `grep -n "_collection" client/pages/SymptomSelectionPage.jsx` → no matches.
Run: `grep -n "\$regex: selectedPatientId" client/SymptomsTabContent.jsx` → no matches.

- [ ] **Step 4: Commit.**

```bash
git add client/SymptomsTabContent.jsx client/pages/SymptomSelectionPage.jsx
git commit -m "fix(symptoms): anchored patient filter + drop private-collection API reach"
```

---

## Task 8: Theming consistency in the converged surface

**Files:**
- Modify: `client/SymptomsTabContent.jsx`

**Interfaces:** none (visual only).

- [ ] **Step 1: Migrate the search-card `isDark` rgba overrides to tokens.**

Where `SymptomsTabContent` sets explicit rgba via `isDark` for the search card, inputs, and alerts, prefer MUI tokens (`bgcolor: 'background.paper'`, `color: 'text.primary'`, `borderColor: 'divider'`, `action.hover`). The orbital embed still passes `cardBgColor`/`cardTextColor` — keep honoring those props where provided (fall back to tokens when absent). Do not change the embed prop contract.

- [ ] **Step 2: Verify in both modes.**

Boot in light and dark settings; the symptom tab reads correctly in both (no black-on-black, no white cards in dark).

- [ ] **Step 3: Commit.**

```bash
git add client/SymptomsTabContent.jsx
git commit -m "style(symptoms): prefer theme tokens over isDark rgba in SymptomsTabContent"
```

---

## Task 9: Verify the orbital embed still renders

**Files:** none expected (verification; edits only if drifted).

- [ ] **Step 1: Confirm orbital references the embed.**

Run: `grep -rn "SymptomsTabContent" /Volumes/MobileDev/Code/honeycomb/extensions/orbital 2>/dev/null | grep -v node_modules`
- If found: proceed to Step 2.
- If not found: the package `CLAUDE.md` claims the embed exists — locate orbital's DailyLogPage and confirm how it renders the symptom tab (it may import the package default or a differently-named binding). Note findings in the commit message.

- [ ] **Step 2: Manual check.**

Boot with `EXTRA_WORKFLOWS=@awatson1978/symptom-tracking,@orbital/...` (orbital's package name), open the DailyLogPage, confirm the symptom tab renders via the refactored `SymptomsTabContent` + `SymptomSelector`, search/select/log still work, and the passed `cardBgColor`/`cardTextColor` styling is intact.

- [ ] **Step 3: Commit only if a reconnection edit was needed.**

```bash
git add -u
git commit -m "fix(symptoms): reconnect orbital DailyLogPage symptom-tab embed"
```

---

## Self-review notes (coverage vs. spec)

- Spec §1 (IG terminology import + catalog union, axis-set separation, retire scattered vocab) → Tasks 1, 2, 3. ✔
- Spec §2 (realign to `SymptomLogicalModel`, preserve ONC mappers) → Task 4 (with characterization test guarding the cert). ✔
- Spec §3 (converge both surfaces onto `SymptomSelector`) → Tasks 5, 6. ✔
- Spec §4 (privacy `$regex` + private-API) → Task 7. ✔
- Spec §5 (theming consistency) → Task 8. ✔
- Spec §6 (verify orbital embed) → Task 9. ✔
- Cycles 2–3 (embeddings, fingerprint, reproducibility) → correctly **absent** from this plan. ✔
- Type consistency: `SymptomSelector` props `{ results, selected, onToggle, onRemove, isSearching }` are identical in Tasks 5 and 6; catalog concept shape `{ code, system, display, source }` is consistent across Tasks 2 and 3. ✔
