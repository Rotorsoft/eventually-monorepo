#! /bin/sh

set -e

data=$(jq -n \
    --arg tag "$NEXT_TAG" \
    --arg notes "$RELEASE_NOTES" \
    '{name: $tag, tag_name: $tag, body: $notes}')
if [[ ! $DRY_RUN -eq 1 ]]; then
    curl -u ${GIT_USERNAME}:${GITHUB_TOKEN} -H "Accept: application/vnd.github.v3+json" \
        https://api.github.com/repos/${GIT_REPO}/releases -d ${data}
else
    echo "github-release: ${data}"
fi    
