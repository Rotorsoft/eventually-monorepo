#! /bin/sh

set -e

msg="🚀 ${NEXT_TAG} released succesfully!"
if [[ ! $DRY_RUN -eq 1 ]]; then
    npm config set registry https://registry.npmjs.org
    yarn ${DIRECTORY} npm publish --access public
    #npm config set registry https://npm.pkg.github.com
    #yarn ${DIRECTORY} npm publish --no-git-tag-version
    echo $msg;
else
    echo "npm-publish: ${msg}"
fi
