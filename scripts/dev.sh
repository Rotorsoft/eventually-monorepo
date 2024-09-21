#! /bin/sh

set -e

if [[ $# -eq 0 ]]; then
    echo "Missing service name!"
    echo "Usage: pnpm dev service-name [port]"
    exit 1
fi;

readonly service="$1"
readonly target="./services/${service}"

if [[ ! -d "${target}" ]]; then
    echo "Invalid service name: ${service}"
    exit 1
fi; 

readonly port="$2"

echo ">>> Running $service in development mode..."
PORT=${port} ts-node-dev --inspect=9229 --transpile-only --respawn -r tsconfig-paths/register ${target}/src/index.ts
