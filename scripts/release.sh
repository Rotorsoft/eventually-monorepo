#! /bin/sh

set -e

npx zx ./scripts/release.mjs eventually   
npx zx ./scripts/release.mjs eventually-pg   
npx zx ./scripts/release.mjs eventually-express   
npx zx ./scripts/release.mjs eventually-broker
