#! /bin/sh

set -e

Color_Off='\033[0m'       # Text Reset
BGreen='\033[1;32m'       # Green

libs=(eventually eventually-pg eventually-express eventually-broker)
for lib in "${libs[@]}"
do
    export DRY_RUN=1
    export GIT_HOST=github.com
    export GIT_REPO=rotorsoft/eventually-monorepo
    export PACKAGE=@rotorsoft/$lib
    export DIRECTORY=libs/$lib    
    echo "-----------------------------------------------------------------------------------------------------"
    echo "${BGreen}${PACKAGE}${Color_Off}"
    read -r lastTag nextTag nextVersion releaseNotes <<< $(npx zx ./scripts/semrel/analyze.mjs | tail -n -1 | jq '.lastTag,.nextTag,.nextVersion,.releaseNotes' | cut -d "\"" -f 2)
    echo "lastTag = $lastTag"
    echo "nextTag = $nextTag"
    echo "nextVersion = $nextVersion"
    echo "releaseNotes = $releaseNotes"

    if [[ ! $nextTag = "null" ]]; then
       export NEXT_TAG=$nextTag
       export NEXT_VERSION=$nextVersion
       export RELEASE_NOTES=$releaseNotes
       sh ./scripts/semrel/log-commit-tag.sh
       sh ./scripts/semrel/github-release.sh
       sh ./scripts/semrel/npm-publish.sh
    fi
    echo "-----------------------------------------------------------------------------------------------------"
    echo
done

export PACKAGE=
export DIRECTORY=
export NEXT_TAG=
export RELEASE_NOTES=
export GIT_HOST=
export GIT_REPO=
export DRY_RUN=
