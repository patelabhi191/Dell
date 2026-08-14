#!/bin/bash
tot=0; totf=0
suites="test-data test-ui test-contrib"
[ -f baseline.html ] || [ -n "$BASELINE" ] && suites="test-regression $suites"
for t in $suites; do
  echo "════════ $t ════════"
  out=$(node $t.js 2>&1); echo "$out" | tail -3
  line=$(echo "$out" | grep -E "^[A-Z].*: [0-9]+ passed, [0-9]+ failed$")
  p=$(echo "$line" | grep -oE "[0-9]+ passed" | grep -oE "[0-9]+")
  f=$(echo "$line" | grep -oE "[0-9]+ failed" | grep -oE "[0-9]+")
  tot=$((tot+p)); totf=$((totf+f))
done
echo; echo "════════════════════════════════════"
echo "  TOTAL: $tot passed, $totf failed"
echo "════════════════════════════════════"
