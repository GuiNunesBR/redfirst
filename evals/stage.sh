#!/usr/bin/env bash
# Stages a corpus case as the agent's workspace: the suite as it was when the case was recorded,
# and the failure Playwright left in test-results. Usage: stage.sh <case id> <test-results folder>
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
case_dir="$root/fixtures/failures/cases/$1"
cp -r "$root/fixtures/failures/suite/." .
mkdir -p "test-results/$2"
cp "$case_dir/recorded/error-context.md" "test-results/$2/"
