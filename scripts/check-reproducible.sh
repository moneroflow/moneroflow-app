#!/usr/bin/env bash
# MoneroFlow reproducibility check for F-Droid.
# F-Droid rebuilds the APK from source on their servers and only accepts it
# if the result is BYTE-FOR-BYTE IDENTICAL to the published APK. This script
# builds the release APK twice from the same source into isolated output dirs
# and diffs them. If they match -> reproducible; if not -> fix the
# non-deterministic part (timestamps, zip order, etc) before submitting.
#
# Usage:  bash scripts/check-reproducible.sh
# Requires: ANDROID_HOME (or local.properties), JDK 17+, the gradle wrapper.

set -euo pipefail

cd "$(dirname "$0")/.."          # app dir
ROOT="$(pwd)"
APKDIR="android/app/build/outputs/apk/release"
A="$ROOT/.repro/A"
B="$ROOT/.repro/B"

echo "== Build 1 of 2 (output A)"
rm -rf "$A"
./android/gradlew -p android :app:assembleRelease --no-daemon > /tmp/repro_a.log 2>&1
mkdir -p "$A"
cp "$APKDIR"/*.apk "$A/"

echo "== Build 2 of 2 (output B)"
rm -rf "$B"
./android/gradlew -p android :app:assembleRelease --no-daemon > /tmp/repro_b.log 2>&1
mkdir -p "$B"
cp "$APKDIR"/*.apk "$B/"

echo ""
echo "== Comparison"
A_APK=$(find "$A" -name '*.apk' | head -1)
B_APK=$(find "$B" -name '*.apk' | head -1)
echo "A: $A_APK  $(sha256sum "$A_APK" | cut -d' ' -f1)"
echo "B: $B_APK  $(sha256sum "$B_APK" | cut -d' ' -f1)"
if cmp -s "$A_APK" "$B_APK"; then
    echo "RESULT: REPRODUCIBLE ✓ (byte-identical)"
else
    echo "RESULT: NOT REPRODUCIBLE ✗ (differ)"
    echo "-- zip entry-level diff:"
    diff <(unzip -l "$A_APK") <(unzip -l "$B_APK") | head -40 || true
fi
