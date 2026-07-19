#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE="${NODE:-$(command -v node)}"
OUT="${OUT:-/tmp/ios-sim-cli-test}"
rm -rf "$OUT"
mkdir -p "$OUT"

pass=0
fail=0
skip=0

cli() {
  "$NODE" "$ROOT/build/index.js" "$@"
}

check() {
  local name="$1"
  shift
  echo ""
  echo "=== $name ==="
  if "$@"; then
    echo "PASS: $name"
    pass=$((pass + 1))
  else
    echo "FAIL: $name"
    fail=$((fail + 1))
  fi
}

skip() {
  local name="$1"
  local reason="$2"
  echo ""
  echo "=== $name ==="
  echo "SKIP: $name ($reason)"
  skip=$((skip + 1))
}

check version cli --version
check help cli --help
check get-booted-sim-id cli get-booted-sim-id
check open cli open
check launch-app cli launch-app --bundle-id com.apple.mobilesafari --terminate-running
check screenshot cli screenshot --output "$OUT/screen.png"

echo ""
echo "=== record-video + stop-recording ==="
if cli record-video --output "$OUT/video.mp4" --force; then
  sleep 2
  if cli stop-recording && sleep 1 && test -s "$OUT/video.mp4"; then
    echo "PASS: record-video + stop-recording"
    pass=$((pass + 1))
  else
    echo "FAIL: stop-recording or empty video"
    fail=$((fail + 1))
  fi
else
  echo "FAIL: record-video"
  fail=$((fail + 1))
fi

check launch-app-env cli launch-app --bundle-id com.apple.mobilesafari --env TEST=1
check unknown-fails bash -c '! cli badcmd 2>/dev/null'

if [[ -n "${IOS_SIMULATOR_CLI_IDB_PATH:-}" ]] && [[ -x "${IOS_SIMULATOR_CLI_IDB_PATH}" ]]; then
  export PATH="/usr/local/Cellar/idb-companion/1.1.8/bin:${PATH:-}"
  check ui-describe-all cli ui describe-all
  check ui-find-element bash -c 'cli ui find-element --search Safari --type Button | head -c 80 >/dev/null'
  check ui-tap cli ui tap --x 200 --y 200
  check ui-type cli ui type test
  check ui-swipe cli ui swipe --x-start 200 --y-start 500 --x-end 200 --y-end 200
  check ui-view cli ui view --output "$OUT/view.jpg"
else
  skip ui-describe-all "IOS_SIMULATOR_CLI_IDB_PATH not set"
  skip ui-find-element "IOS_SIMULATOR_CLI_IDB_PATH not set"
  skip ui-tap "IOS_SIMULATOR_CLI_IDB_PATH not set"
  skip ui-type "IOS_SIMULATOR_CLI_IDB_PATH not set"
  skip ui-swipe "IOS_SIMULATOR_CLI_IDB_PATH not set"
  skip ui-view "IOS_SIMULATOR_CLI_IDB_PATH not set"
fi

if [[ -n "${TEST_APP_PATH:-}" ]] && [[ -e "${TEST_APP_PATH}" ]]; then
  check install-app cli install-app --app-path "$TEST_APP_PATH"
else
  skip install-app "TEST_APP_PATH not set"
fi

echo ""
echo "=============================="
echo "Results: $pass passed, $fail failed, $skip skipped"
echo "Output: $OUT"
ls -la "$OUT" 2>/dev/null || true
file "$OUT"/* 2>/dev/null || true

exit "$fail"
