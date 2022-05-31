#! /bin/sh

set -e

node ./scripts/release.mjs eventually   
node ./scripts/release.mjs eventually-pg   
node ./scripts/release.mjs eventually-express   
node ./scripts/release.mjs eventually-broker
