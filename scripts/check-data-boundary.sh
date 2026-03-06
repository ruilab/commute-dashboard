#!/usr/bin/env bash
# Data boundary check: ensures no private/user data is tracked in git.
# Run: bash scripts/check-data-boundary.sh
# Exit code 0 = clean, 1 = violation found.

set -euo pipefail

violations=0

echo "Checking data boundary policy..."

# 1. Check for .env files (not .env.example)
env_files=$(git ls-files '*.env' '.env.*' 2>/dev/null | grep -v '.env.example' || true)
if [ -n "$env_files" ]; then
  echo "VIOLATION: .env files tracked in git:"
  echo "$env_files"
  violations=$((violations + 1))
fi

# 2. Check for database files
db_files=$(git ls-files '*.sqlite' '*.db' '*.dump' '*.sql.gz' 2>/dev/null || true)
if [ -n "$db_files" ]; then
  echo "VIOLATION: Database files tracked in git:"
  echo "$db_files"
  violations=$((violations + 1))
fi

# 3. Check for data/private/ contents
private_files=$(git ls-files 'data/private/' 2>/dev/null || true)
if [ -n "$private_files" ]; then
  echo "VIOLATION: Private data files tracked in git:"
  echo "$private_files"
  violations=$((violations + 1))
fi

# 4. Check for common secret patterns in tracked files
# (skip node_modules, .next, binary files)
secret_patterns='(PRIVATE_KEY|SECRET_KEY|password\s*=\s*["\x27][^"\x27]+|sk_live_|-----BEGIN.*PRIVATE)'
matches=$(git ls-files '*.ts' '*.tsx' '*.js' '*.json' '*.md' '*.yml' '*.yaml' 2>/dev/null | \
  xargs grep -l -E "$secret_patterns" 2>/dev/null | \
  grep -v '.env.example' | \
  grep -v 'node_modules' | \
  grep -v 'DATA_BOUNDARY.md' | \
  grep -v 'check-data-boundary.sh' | \
  grep -v 'CLAUDE.md' || true)
if [ -n "$matches" ]; then
  echo "WARNING: Files may contain secret patterns (review manually):"
  echo "$matches"
  # This is a warning, not a hard failure — some references are documentation
fi

# 5. Check for CSV/JSON data files that might contain user data
# (files > 10KB in data/ that aren't in data/public/)
large_data=$(git ls-files 'data/' 2>/dev/null | grep -v 'data/public/' | grep -v '.gitkeep' || true)
if [ -n "$large_data" ]; then
  echo "VIOLATION: Data files outside data/public/:"
  echo "$large_data"
  violations=$((violations + 1))
fi

if [ "$violations" -gt 0 ]; then
  echo ""
  echo "FAILED: $violations data boundary violation(s) found."
  echo "See docs/DATA_BOUNDARY.md for policy details."
  exit 1
fi

echo "PASSED: No data boundary violations found."
exit 0
