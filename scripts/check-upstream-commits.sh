#!/usr/bin/env bash
set -euo pipefail

upstream_ref=${1:-upstream/main}
review_manifest=${2:-upstream-sync.json}
review_base=$(node -e '
  const fs = require("node:fs");
  const checkpoint = JSON.parse(fs.readFileSync(process.argv[1], "utf8")).reviewedCommit;
  if (typeof checkpoint !== "string" || !/^[0-9a-f]{40}$/.test(checkpoint)) {
    throw new Error("Missing or invalid reviewed upstream commit");
  }
  process.stdout.write(checkpoint);
' "$review_manifest")

upstream_head=$(git rev-parse --verify --end-of-options "${upstream_ref}^{commit}")
if ! git merge-base --is-ancestor "$review_base" "$upstream_head"; then
  echo "Reviewed commit is not an ancestor of upstream; manual review is required." >&2
  exit 1
fi

commit_count=$(git rev-list --count "$review_base..$upstream_head")
printf 'review_base=%s\ncommit_count=%s\n' "$review_base" "$commit_count"
if [ "$commit_count" -eq 0 ]; then
  printf 'has_updates=false\n'
else
  printf 'has_updates=true\nnew_commits<<EOF\n'
  git log --oneline "$review_base..$upstream_head"
  printf 'EOF\n'
fi
