#!/usr/bin/env bash
# Stamp content hashes onto the asset URLs in index.html.
#
# WHY THIS EXISTS. Cloudflare Pages serves static assets with
# `cache-control: public, max-age=14400` (4 hours) but serves index.html with
# `max-age=0, must-revalidate`. With unversioned `./app.js` references that
# combination means a returning visitor keeps the OLD bundle for up to four
# hours after a deploy, while getting the new HTML. A copy fix, a bug fix or a
# question change is simply invisible to them, and it looks like the deploy
# silently failed.
#
# Stamping `?v=<content hash>` makes the URL change whenever the file changes,
# so the always-fresh HTML points at a URL the browser has never cached. Run
# this before every deploy; it is idempotent.
set -euo pipefail
cd "$(dirname "$0")/public"

# ⚠ Every asset index.html references must be listed here. forge.js was added
# to the page and not to this loop, so it shipped unversioned once: returning
# visitors would have kept a stale copy for four hours. If you add a script or
# stylesheet, add it here in the same commit.
for f in styles.css demos.js forge.js forms.js app.js; do
  h=$(shasum -a 256 < "$f" | cut -c1-10)
  # Replace the existing reference, with or without a previous ?v= stamp.
  perl -0pi -e "s{(src|href)=\"\./${f}(\?v=[0-9a-f]+)?\"}{\$1=\"./${f}?v=${h}\"}g" index.html
  echo "  ${f} -> v=${h}"
done
echo "stamped index.html"
