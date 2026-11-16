/* Resolve the file(s) under test.
   APP      – the live tracker (default: the one beside this tests/ folder)
   BASELINE – a pre-change snapshot, only needed by test-regression.js.
              Create one with:  git show <ref>:"Sparta Finance Tracker/Sparta ap stock tracker.html" > tests/baseline.html
*/
const path = require('path');
const APP = process.env.APP || path.join(__dirname, '..', 'Sparta ap stock tracker.html');
const BASELINE = process.env.BASELINE || path.join(__dirname, 'baseline.html');
module.exports = { APP, BASELINE };
