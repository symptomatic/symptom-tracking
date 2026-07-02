# Symptom Tracking — Revitalization (design)

**Date:** 2026-07-02
**Package:** `@awatson1978/symptom-tracking` (`extensions/symptom-tracking`, nested private repo, branch `npm-migration`)
**License:** Artistic-2.0 (preserve — do NOT overwrite with the UNLICENSED default)
**Status:** Draft for review

---

## The three-cycle arc (context)

Three independent spec → plan → build cycles, mirroring the timelines revitalization. Each keeps the app working and de-risks the next.

1. **Cycle 1 — Foundation** *(full detail below)*. Import the HL7 Symptoms IG terminology, realign the hand-rolled schema to the real `SymptomLogicalModel`, converge the two duplicated symptom-entry surfaces onto the (currently unused) shared `SymptomSelector`, and fix the correctness/privacy footguns.
2. **Cycle 2 — On-device embedding search**. Replace the mis-named keyword "semantic search" with real transformers.js embeddings running locally on WebGPU (PHI never leaves the browser), build-time-precomputed catalog vectors, cosine ranking in full N-D space, keyword fallback.
3. **Cycle 3 — Explainability magic**. The volumetric embedding point-cloud fingerprint, the explainable `ConditionMatcher` pairing, absence/assessment-scale capture from the logical model, optional WebLLM generative layer — all reproducibility-stamped.

> **Cross-cycle:** the fingerprint's *renderer* is a swappable skin over one data contract (query embedding → catalog embeddings → cosine → top-K → optional 3-D projection). We keep that contract renderer-agnostic so Cycle 3 can pick the visual without reworking Cycle 2.

---

## Current state (what we're building on)

**Two symptom-entry surfaces that reimplement each other:**
- **Wizard** — [`IssueReportPage`](../client/pages/IssueReportPage.jsx) → [`SymptomSelectionPage`](../client/pages/SymptomSelectionPage.jsx) (a Stepper flow that hands off to the host's `/intervention-execution` + `/plan-definitions`).
- **Embedded tab** — [`SymptomsTabContent`](../client/SymptomsTabContent.jsx) (self-contained search → select → log-as-`Condition`; per the package `CLAUDE.md`, orbital embeds this in its DailyLogPage).

Both hand-roll the same search box + checkbox list + selected-chips UI.

**Unused shared components:** [`SymptomSelector`](../client/components/SymptomSelector.jsx) and [`IssueReportInput`](../client/components/IssueReportInput.jsx) are exported from `client.js` but imported **nowhere** — the abstractions exist; the surfaces just don't use them.

**The "semantic search" isn't semantic:** [`performSemanticSearch`](../server/methods/performSemanticSearch.js) tries an MCP tool only if `settings.private.mcp.enabled`, else falls back to a **regex text search over existing `Condition` records** plus a **hard-coded list of ~10 spaceflight symptoms** filtered by substring.

**Worth keeping:** [`ConditionMatcher`](../lib/ConditionMatcher.js) — a genuinely nice *explainable* rule engine (symptom codes → best-matching protocol, with human-readable "why this / why not the others"). Keep and expand; it becomes the second explainability layer in Cycle 3.

**Scattered vocabulary (3 overlapping sources):** the ~10 hard-coded symptoms in the server method; `ConditionMatcher`'s own SNOMED-name map + 3 condition mappings; and the orphaned `data/Questionnaire-SymptomAssessment.json` (carried, unreferenced).

**Correctness / hygiene issues:**
- 🔒 Unanchored `$regex` patient match in `SymptomsTabContent` (`'subject.reference': { $regex: selectedPatientId }`) — substring-collision risk (same class of bug as timelines' `buildPatientQuery`).
- Reach into `QuestionnaireResponses._collection.updateAsync` (private API) in `SymptomSelectionPage`.
- `SymptomsTabContent` is heavy with manual `isDark` rgba overrides while `SymptomSelectionPage` uses clean theme tokens — inconsistent.
- The hand-rolled [`SymptomIGSchema.js`](../lib/SymptomIGSchema.js) is a smoking-status-centric *approximation* of the real logical model (though its ONC export mappers — US Core, C-CDA, QDM, ASTM, HL7v2, CSV — are valuable and stay).

**Migration constraints (don't regress — from package `CLAUDE.md`):** Artistic-2.0 license; `iconName`s must be PascalCase MUI; `FooterButtons = []`; live entry is `client.js` (npm / `EXTRA_WORKFLOWS`). Tests present: `tests/integration.test.js`, `tests/symptom-tracking.bdd.js`, `tests/nightwatch/170.315.a.11.test.js` (ONC smoking-status cert).

---

## The HL7 Symptoms IG (source material)

Canonical base: `http://hl7.org/fhir/uv/symptoms/` (STU 1, v1.0.0 continuous build).

- **`CommonSymptomCodes`** ValueSet — **52 explicit SNOMED CT codes** (Fatigue `84229001`, Nausea `422587007`, Dyspnea `267036007`, Dizziness `404640003`, Palpitations `80313002`, Syncope `271594007`, Blurred vision `111516008`, Anosmia `44169009`, …). Canonical `.../ValueSet/CommonSymptomCodes`. **This is the embedding catalog seed.**
- **17 ValueSets + 6 CodeSystems** total — beyond the symptom list, the *axis* value sets: Severity, ClinicalCourse, Trend, SpeedOfOnset, Frequency, Quality, FunctionalClassification, Alleviating/Triggering factors, and openEHR-derived (Episodicity, Occurrence, Progression, Severity Category, **Excluded Symptom**), plus a `SymptomTemporary` CodeSystem.
- **`SymptomLogicalModel`** — `symptomCode`, **`presentFlag`** (absence), `reporter[x]`, recursive `associatedSymptoms`, `associatedConditions`; keyFeatures block (location / quality / severity / impact — each with a `scaleCode`; surroundingEvents; frequency); timing (`speedOfOnset`, `onset[x]`, `duration`); `clinicalCourse`; `trend`; metadata (`documentationDate`, `issued`).
- **Profiles**: Symptom Observation, **Symptom Absent Observation** (absence is first-class), Assessment Scale Collection/Observation, Functional Assessment Collection/Observation — the assessment scales are **PACIO-derived** (ties into this repo's `pacio-core`).

---

## Cycle 1 scope (Foundation)

### 1. Import the IG terminology as the single vocabulary source 📚

- Vendor the IG's machine-readable artifacts into `data/terminology/` — the published `ValueSet-*.json` and `CodeSystem-*.json` for **all 17 ValueSets + 6 CodeSystems** (fetch from the canonical base; pin the `1.0.0` build).
- Expose one **catalog module** (`lib/SymptomCatalog.js`, pure/isomorphic) that builds the embedding-catalog seed as the **union of the symptom-concept sets** — `CommonSymptomCodes` (52 SNOMED) + the `SymptomTemporary` CodeSystem (draft symptom terms) + the openEHR symptom-sign concepts + the **Excluded Symptom** set (for absence) — de-duplicated by `system|code`, returning `[{ code, system, display, source }]`. This union (not just `CommonSymptomCodes`) is the single source of truth the semantic search embeds.
- **Separate the axis / qualifier value sets** (Severity, ClinicalCourse, Trend, SpeedOfOnset, Frequency, Quality, FunctionalClassification, Alleviating/Triggering factors, Episodicity, Occurrence, Progression, Severity Category) — these are imported as **structured-capture vocabularies** that populate the logical model's `keyFeatures`, **not** embedding match targets. (A free-text complaint must match a symptom, never a qualifier like "moderate" or "3x/day".)
- **Retire the scattered vocab**: the ~10 hard-coded symptoms in `performSemanticSearch` and `ConditionMatcher`'s ad-hoc `SYMPTOM_NAMES` map both defer to the catalog module. (Cycle 2 embeds this catalog; Cycle 1 just unifies it.)

### 2. Realign the schema to `SymptomLogicalModel` 🧬

- Rebuild [`SymptomIGSchema.js`](../lib/SymptomIGSchema.js) around the real logical-model elements (`symptomCode`, `presentFlag`, `keyFeatures{location,quality,severity,impact,surroundingEvents,frequency}`, `timing`, `clinicalCourse`, `trend`, metadata). Reference the canonical StructureDefinition URL in a header comment.
- **Preserve** the ONC export mappers (`mapToUSCoreObservation`, `generateCCDASnippet`, `mapToQDM`, `mapToASTM`, `generateHL7v2Message`, `generateCSVReport`, `validateONCCompliance`) and the smoking-status templates — they back the `170.315.a.11` cert and must keep passing.
- Note the **absence** path (`presentFlag=false` → Symptom Absent Observation profile) for Cycle 3; Cycle 1 only realigns the shape.

### 3. Converge both surfaces onto the shared `SymptomSelector` 🔀

- Move the duplicated **search → checkbox-list → selected-chips** UI into [`SymptomSelector`](../client/components/SymptomSelector.jsx) (currently unused). Props: `{ results, selected, onToggle, onRemove, isSearching }`.
- Refactor `SymptomsTabContent` and `SymptomSelectionPage` to **consume** `SymptomSelector` instead of their inline copies. The search *invocation* stays per-surface for now (both call `performSemanticSearch`); only the presentational selector is shared.
- This is the seam Cycle 2 plugs the embedding search into — one component, one place.

### 4. Fix correctness / privacy 🔒

- Replace the unanchored `$regex` patient filter in `SymptomsTabContent` with `Meteor.FhirUtilities.addPatientFilterToQuery(...)` (or an anchored `^Patient/<id>$` form) — no substring collisions across patients.
- Replace the `QuestionnaireResponses._collection.updateAsync` private-API reach with a proper Meteor method / public collection call.

### 5. Theming consistency 🎨

- Migrate `SymptomsTabContent`'s manual `isDark` rgba overrides toward MUI theme tokens (`background.paper`, `text.primary`, `divider`), matching `SymptomSelectionPage`. Opportunistic where it touches the converged selector; not a blanket rewrite.

### 6. Verify the orbital embed 🛰️

- Confirm orbital's DailyLogPage still renders `SymptomsTabContent` after the refactor (the package `CLAUDE.md` claims it does; a direct import wasn't found in a grep). Reconnect if the integration has drifted; do not break the embed contract (`{ isDark, cardBgColor, cardTextColor, noteDate, simulationMeta }` props).

---

## Cycle 2 outline — on-device embedding search

- **Engine:** transformers.js feature-extraction (`@xenova/transformers` / `@huggingface/transformers`). Baseline model `Xenova/all-MiniLM-L6-v2` (384-d); option for a clinical model (~768-d, e.g. PubMedBERT-derived). **WebGPU** with WASM/keyword fallback. PHI (the query text) never leaves the browser.
- **Loading:** prefer the `esm.run` lazy `<script type=module>` pattern already proven in `international-patient-summary`'s `narrativeEngine.js` (no bundler dep, no `rspack.config.js` change); bundler-import + `fullySpecified:false` is the fallback path.
- **Catalog vectors:** precompute at build time — embed the **full symptom-concept catalog** from §1 (the union across the symptom value sets + code systems, not just `CommonSymptomCodes`) displays + synonyms → ship `data/catalog-vectors.json` with an embedded **version + content hash + generation date**. The axis/qualifier sets are not embedded.
- **Query path:** embed the query on-device → cosine similarity against catalog vectors **in full N-D space** (exact) → top-K. Retire the hard-coded-10 branch; keep the regex search as the offline/no-WebGPU fallback.
- **Reproducibility (starts here):** every result set carries `{ embeddingModel, embeddingModelVersion, embeddingDim, catalogVersion }`.

---

## Cycle 3 outline — explainability + magic

### The fingerprint (hero visualization)

- **Volumetric embedding point-cloud** (X-Y-Z): the query embedded *within* a cloud of catalog concepts, nearest neighbors lit up; cosine computed in **full N-D space** (drives ranking + exact angle), the 3-D projection (PCA / UMAP) is **display-only** — labeled as such on the chart.
- **Renderer:** interactive/orbitable needs a 3-D lib (Three.js / react-three-fiber, Plotly 3-D, or deck.gl — check `genome-central-redux` / WASM-sim packages for existing precedent before adding one). Static SVG (like the design mockups) is the graceful fallback.
- Pairs with the **`ConditionMatcher`** for two-layer explainability: layer 1 = semantic neighborhood (the cloud), layer 2 = the rule that fired (protocol reasoning).

### Two palettes (light + dark) — explicit, not just token-adaptive

Surfaces/text use MUI tokens; the **data-mark colors are fixed per mode** (deployment-independent, so the fingerprint always reads teal-query / purple-similarity):

| Role | Light | Dark |
|------|-------|------|
| Query point | teal `#1D9E75` | teal `#5DCAA5` |
| Similarity ramp (low → high cosine) | `#CECBF6` → `#7F77DD` → `#534AB7` | `#3C3489` → `#7F77DD` → `#AFA9EC` |
| Distant / low-score point | gray `#888780` | gray `#888780` |
| Axes / gridlines | `rgba(0,0,0,0.10)` | `rgba(255,255,255,0.12)` |
| Axis / caption text | `text.secondary` token | `text.secondary` token |

Quality bar (both modes): flat, `0.5px` hairline borders, no gradients / shadows / glow, light-dark parity.

### Compact readout (legibility)

A compact panel beside/under the fingerprint — **keep it dense**:
- the **original query term** (what the user typed);
- the **matched term(s)**: display + `code` + `system`;
- the **exact cosine value** per match (3–4 decimals, not rounded to the ranking bucket).

### Reproducibility stamp

- **On-screen footer** (one line): `model: all-MiniLM-L6-v2 · dim 384 · catalog v1 (CommonSymptomCodes @ 1.0.0)`.
- **On the FHIR resource**: stamp the created `Condition`/`Observation` with provenance so the suggestion is auditable and re-derivable — recommended carrier: a `meta.tag` pair (system `http://awatson1978/symptom-tracking/embedding-model` + `…/catalog-version`) and/or an `Observation.device` → `Device` (software, `Device.version` = model revision). Final carrier is an open question below.

### Other Cycle-3 items

- **Absence capture** (`presentFlag=false` → Symptom Absent Observation profile) — "patient denies fever."
- **Assessment scales** (PACIO-derived) via the logical model's `scaleCode` slots.
- **Optional WebLLM generative layer** — query expansion (dysuria ⇄ "burning when peeing") and/or narrating the matcher's reasoning; lazy, off by default.

---

## Explicitly deferred / non-goals

- Cloud embedding APIs (OpenAI 1536-d etc.) — rejected for the HIPAA/local posture; on-device only.
- Rewriting the ONC export mappers — they work and back the cert; only the schema *shape* they read from is realigned.
- Sensitive-topic filtering / life-stage modeling — not in scope.
- Atmosphere-era leftovers beyond what Cycle 1 touches.

---

## Open questions

- **Embedding model:** general `all-MiniLM-L6-v2` (384-d, tiny, fast) vs a clinical PubMedBERT-style model (~768-d, better medical semantics, larger download)? Lean MiniLM for Cycle 2 baseline, revisit.
- **Provenance carrier:** `meta.tag` (cheap, queryable) vs `Device` reference vs a full `Provenance` resource. Lean `meta.tag` + optional `Device`.
- **3-D renderer:** reuse an existing repo 3-D dependency if one exists (check `genome-central-redux`), else Three.js/react-three-fiber. Confirm before adding.

---

## Verification (Cycle 1)

Runs via `EXTRA_WORKFLOWS=@awatson1978/symptom-tracking` (plus orbital for the embed check).

1. **Terminology import** — `SymptomCatalog.js` returns 52 concepts from the vendored `CommonSymptomCodes`; the vendored ValueSet/CodeSystem count is 17 + 6.
2. **Schema realignment** — the `170.315.a.11` Nightwatch cert test still passes; smoking-status export mappers unchanged in output.
3. **Convergence** — both `SymptomsTabContent` and `SymptomSelectionPage` render via the shared `SymptomSelector` (grep: the inline checkbox lists are gone; `SymptomSelector` is now imported in ≥2 places).
4. **Privacy** — with two patients loaded, symptom search/log in `SymptomsTabContent` never returns the other patient's `Condition`s.
5. **Orbital embed** — orbital's DailyLogPage still shows the symptom tab.

No new automated harness in Cycle 1 (the package's tests are TinyTest/Nightwatch/BDD); the pure `SymptomCatalog.js` is the natural first `node --test` unit target when we add one.

---

## Healthy Paranoia Checklist: Symptom Tracking revitalization

**What could still go wrong:**
- 🎯 The IG is a *continuous build* (STU 1) — canonical URLs/codes can shift under us. Mitigation: vendor pinned `1.0.0` JSON into `data/`, don't fetch live at runtime.
- 💥 transformers.js model weights (~25–90 MB) fail to download on a locked-down clinical network. Mitigation: WebGPU→WASM→keyword fallback chain; the app degrades to today's behavior, never blocks.
- 🐛 Converging onto `SymptomSelector` subtly changes the orbital embed's props/markup and breaks DailyLogPage. Mitigation: preserve the embed prop contract; verify in orbital (item 6).
- 📱 No WebGPU (older iPad / Safari) → no on-device embeddings. Mitigation: keyword fallback + the static-SVG fingerprint; feature-detect, don't assume.
- 🔒 A cloud embedding API sneaks in "just for quality" and PHI leaves the device. Mitigation: on-device is a hard requirement; cloud is an explicit non-goal.
- 😭 Nightmare: an embedding model silently updates (unpinned revision) and the same complaint maps to a different symptom next release — irreproducible clinical suggestions. Mitigation: the reproducibility stamp (pinned model **revision** + catalog hash on every resource) is the whole point — pin, record, and surface it.

**But remember:** the hard, valuable parts already exist — a proven on-device LLM stack in-repo (`narrativeEngine`, mcp `WebLLMService`), an explainable rule matcher, an ONC-certified smoking-status path, and now a real IG terminology to stand on. Most of Cycle 1 is *unification and cleanup*; the magic in 2–3 is additive on a foundation that's largely already here.
