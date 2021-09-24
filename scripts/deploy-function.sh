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

echo "Deploying service [${service}] as cloud function..."

sed 's/"workspace:/"/g' "${target}/package.json" > "${target}/dist/package.json"
cp .gcloudignore "${target}/dist"

gcloud functions deploy "${service}" \
--runtime=nodejs14 \
--region=us-central1 \
--source="${target}/dist" \
--entry-point=express \
--trigger-http \
--env-vars-file="${target}/.env.yml"
