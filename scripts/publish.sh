#! /bin/sh

set -e

readonly usage="Use: yarn publish lib [patch|minor|major]"
readonly lib="$1"
readonly target="./libs/${lib}"

if [[ $# -eq 0 ]]; then
    echo "Missing lib name"
    echo $usage
    exit 1
fi;

if [[ ! -d "${target}" ]]; then
    echo "Invalid lib name: [${lib}]"
    exit 1
fi; 

bump="patch"
if [[ ! -z $2 ]]; then
    case "$2" in 
        "patch"|"minor"|"major")
            bump="$2";;
        *)
            echo "Invalid version bump"
            echo $usage
            exit 1;;
    esac
fi;

echo "Bumping [${bump}] version ..."
yarn "${target}" version "${bump}"

echo "Publishing lib [${lib}] ..."
yarn build
yarn "${target}" npm publish --access public
 
