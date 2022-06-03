#! /bin/sh

set -e

msg="chore(release): ${NEXT_TAG} [skip ci]"
if [[ ! $DRY_RUN -eq 1 ]]; then
    echo "${RELEASE_NOTES}\n $(cat ./CHANGELOG.md)" > ./CHANGELOG.md
    npm --no-git-tag-version version ${NEXT_VERSION} --workspace ${PACKAGE}
    git add -A .
    HUSKY=0 git commit -am ${msg}
    git tag -a ${NEXT_TAG} HEAD -m ${msg}
    HUSKY=0 git push --follow-tags origin HEAD:refs/heads/master
else
    echo "log-commit-tag: ${msg} -> v${NEXT_VERSION}"    
fi
