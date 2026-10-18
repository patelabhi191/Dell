#!/bin/bash
tot=0; totf=0; crashed=""
suites="test-data test-ui test-contrib test-yf-me-contrib test-yf-highlights test-bills test-billpay test-import test-dates test-plan test-notes test-mobile test-ui-edits test-storage test-archives test-escaping test-contrast test-opacity test-print"
[ -f baseline.html ] || [ -n "$BASELINE" ] && suites="test-regression $suites"
for t in $suites; do
  echo "════════ $t ════════"
  out=$(node $t.js 2>&1); echo "$out" | tail -3
  line=$(echo "$out" | grep -E "^[A-Z].*: [0-9]+ passed, [0-9]+ failed$")
  # A SUITE THAT DIED PRINTS NO SUMMARY LINE, and until this was here it then
  # contributed 0 passed and 0 failed -- invisible. A startup error that took
  # the whole app down came back as "1236 passed, 1 failed": six suites had
  # silently stopped counting, and the one failure looked like a detail.
  if [ -z "$line" ]; then
    echo "  >>> NO SUMMARY LINE -- $t DID NOT FINISH. Counting it as a failure."
    crashed="$crashed $t"; totf=$((totf+1)); continue
  fi
  p=$(echo "$line" | grep -oE "[0-9]+ passed" | grep -oE "[0-9]+")
  f=$(echo "$line" | grep -oE "[0-9]+ failed" | grep -oE "[0-9]+")
  tot=$((tot+p)); totf=$((totf+f))
done
echo; echo "════════════════════════════════════"
echo "  TOTAL: $tot passed, $totf failed"
[ -n "$crashed" ] && echo "  DID NOT FINISH:$crashed"
echo "════════════════════════════════════"
