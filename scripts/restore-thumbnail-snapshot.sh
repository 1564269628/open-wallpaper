#!/usr/bin/env bash
set -euo pipefail

output_dir="${1:?thumbnail output directory is required}"
branch="${THUMBNAIL_BRANCH:-thumbnails}"
rm -rf "$output_dir"
mkdir -p "$output_dir"

if git fetch --quiet origin "+refs/heads/$branch:refs/remotes/origin/$branch" 2>/dev/null; then
  git archive "origin/$branch" | tar -x -C "$output_dir"
  echo "Restored thumbnail snapshot from $branch."
else
  echo "Thumbnail branch $branch does not exist yet; starting with an empty snapshot."
fi
