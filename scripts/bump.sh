#! /bin/sh

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

bump="patch"
if [[ ! -z $2 ]]; then
    case "$2" in 
        "patch"|"minor"|"major"|"premajor"|"preminor"|"prepatch"|"prerelease")
            bump="$2";;
        *)
            echo "Invalid version bump"
            exit 1;;
    esac
fi;

readonly base=$(PWD);
cd ./${target}
echo "Bumping ${target} [${bump}]";
npm version ${bump};
cd ${base}
