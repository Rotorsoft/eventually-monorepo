#! /bin/sh

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
    read lastTag nextTag nextVersion releaseNotes <<< $(npx zx ./scripts/semrel/analyze.mjs | tail -4)
    echo "lastTag = $lastTag"
    echo "nextTag = $nextTag"
    echo "nextVersion = $nextVersion"
    echo "releaseNotes = $releaseNotes"
    echo "-----------------------------------------------------------------------------------------------------"
    echo
done

export PACKAGE=
export DIRECTORY=
export NEXT_TAG=
export RELEASE_NOTES=
export GIT_HOST=
export GIT_REPO=
