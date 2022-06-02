#! /bin/sh

set -e

Color_Off='\033[0m'       # Text Reset
BGreen='\033[1;32m'       # Green

libs=(eventually eventually-pg eventually-express eventually-broker)
for lib in "${libs[@]}"
do
    export PACKAGE=@rotorsoft/${lib} 
    export DIRECTORY=libs/${lib}    
    echo "-----------------------------------------------------------------------------------------------------"
    echo "${BGreen}${PACKAGE}${Color_Off}"
    npx zx ./scripts/semrel/analyze.mjs
    echo "-----------------------------------------------------------------------------------------------------"
    echo
done

export PACKAGE=
export DIRECTORY=

