#! bin/sh

echo "Cleaning dist"
find . -type d -name 'dist' -exec rm -rf {} \;

echo "Cleaning tsbuildinfo"
find . -type f -name '*.tsbuildinfo' -delete

echo "Cleaning garbage"
find . -type f -name '*.d.ts' -delete
find . -type f -name '*.d.ts.map' -delete
find . -type f -name '*.js.map' -delete
find ./libs/* -type f -name '*.js' -delete
find ./services/* -type f -name '*.js' -delete