#! /bin/sh

set -e

npx zx ./scripts/semantic-release/release.mjs eventually   
npx zx ./scripts/semantic-release/release.mjs eventually-pg   
npx zx ./scripts/semantic-release/release.mjs eventually-express   
npx zx ./scripts/semantic-release/release.mjs eventually-broker
