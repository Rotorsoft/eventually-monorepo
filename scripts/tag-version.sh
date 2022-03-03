#! /bin/sh

set -e

readonly lib="$1"
readonly target="libs/${lib}"

if [[ $# -eq 0 ]]; then
    echo "Missing lib name"
    exit 1
fi;

if [[ ! -d "${target}" ]]; then
    echo "Invalid lib name: [${lib}]"
    exit 1
fi; 

version=$(npm view @rotorsoft/${lib} version)
echo ">>> tagging ${lib} to version ${version} ..."
&& git add . \
&& git commit -m "tagging ${target} with ${lib}@${version}" \
&& git tag "${lib}@${version}" \
&& git push origin master

echo ">>> DONE!"
