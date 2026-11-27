#!/bin/bash
cd /workspace/prop-hunt/tools
for t in ${SUITES:-e2e-v14 e2e-v13 e2e e2e-office e2e-v7 e2e-v9 e2e-v10 e2e-lucky e2e-v12}; do
  echo "=== $t"; timeout 1500 node $t.mjs > /tmp/run-$t.log 2>&1; echo "exit $?"; grep -E "passed|failed|^FAIL" /tmp/run-$t.log | tail -6
done
