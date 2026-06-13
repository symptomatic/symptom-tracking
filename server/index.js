// packages/symptom-tracking/server/index.js

// Side-effect imports: each registers its Meteor.methods({...}).
// (performSemanticSearch.js registers a method but exports nothing — the
// Atmosphere original's `export { performSemanticSearch }` re-export was dead
// and warned under Rspack ESM, so it was dropped during the npm migration.)
import './methods/performSemanticSearch.js';
import './methods.js';