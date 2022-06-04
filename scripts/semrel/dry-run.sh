#! /bin/bash

set -e

libs=(eventually eventually-pg eventually-express eventually-broker)
for lib in "${libs[@]}"
do
    export GIT_HOST=github.com
    export GIT_REPO=rotorsoft/eventually-monorepo
    export PACKAGE=@rotorsoft/$lib
    export DIRECTORY=libs/$lib    
    echo "-----------------------------------------------------------------------------------------------------"
    echo $PACKAGE
    npx zx ./scripts/semrel/analyze.mjs | tail -4 | (
        read -r lastTag;
        read -r nextTag;
        read -r nextVersion;
        read -r releaseNotes;
        echo "lastTag = $lastTag";
        echo "nextTag = $nextTag";
        echo "nextVersion = $nextVersion";
        echo "releaseNotes = $(echo $releaseNotes | awk '{gsub(/\\n/,"\n")}1')";
    )
    echo "-----------------------------------------------------------------------------------------------------"
    echo
done

export PACKAGE=
export DIRECTORY=
export NEXT_TAG=
export RELEASE_NOTES=
export GIT_HOST=
export GIT_REPO=
