#! /bin/sh

set -e

readonly service="$1"
readonly target="./services/${service}"

if [[ $# -eq 0 ]]; then
    echo "Missing service name"
    echo "Use: yarn deploy service"
    exit 1
fi;

if [[ ! -d "${target}" ]]; then
    echo "Invalid service name: [${service}]"
    exit 1
fi; 

echo "Deploying service [${service}]..."

sed 's/"workspace:/"/g' "${target}/package.json" > "${target}/dist/package.json"
cp .gcloudignore "${target}/dist"
cp "${target}/app.yaml" "${target}/dist/app.yaml"

gcloud app deploy "${target}/dist/app.yaml"
