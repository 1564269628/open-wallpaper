#!/usr/bin/env bash
set -euo pipefail

snapshot_dir="${1:?thumbnail snapshot directory is required}"
branch="${THUMBNAIL_BRANCH:-thumbnails}"
: "${GITHUB_TOKEN:?GITHUB_TOKEN is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"

if [[ ! -f "$snapshot_dir/manifest.json" ]]; then
  echo "Thumbnail manifest is missing: $snapshot_dir/manifest.json" >&2
  exit 1
fi

rm -rf "$snapshot_dir/.git"
git -C "$snapshot_dir" init --quiet
git -C "$snapshot_dir" switch --orphan "$branch" >/dev/null
git -C "$snapshot_dir" config user.name "github-actions[bot]"
git -C "$snapshot_dir" config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git -C "$snapshot_dir" add --all
git -C "$snapshot_dir" commit --quiet -m "chore: refresh thumbnail snapshot"
git -C "$snapshot_dir" remote add origin "https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"
git -C "$snapshot_dir" push --force --quiet origin "HEAD:${branch}"
echo "Published current thumbnail snapshot to $branch without retaining branch history."
