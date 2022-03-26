#! bin/sh

set -u

target="."

if [[ $# -eq 1 ]]; then
    target="libs/$1"
fi;

echo "Cleaning $target"
find $target -type d -name 'dist' -exec rm -rf {} \;
find $target -type f -name '*.tsbuildinfo' -delete
find $target -type f -name '*.d.ts' -delete
find $target -type f -name '*.d.ts.map' -delete
find $target -type f -name '*.js.map' -delete
find $target/* -type f -name '**/src/**/*.js' -delete