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

echo ">>> cleaning $lib..."
yarn clean $lib

echo ">>> building $target..."
yarn $target build

version=$(npm pkg get version -w ${target})
lastpublished=$(npm view @andela-technology/${lib} version)

echo ">>> last published version ${lastpublished}"
echo ">>> publishing ${version} ..."
yarn "${target}" npm publish --access public
if [ $? -eq 0 ]; then
    echo ">>> DONE!"
fi

