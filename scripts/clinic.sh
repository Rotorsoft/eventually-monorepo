#! /bin/sh

set -e

readonly usage="Usage: pnpm clinic [doctor|flame|bubbleprof|heapprofiler] service-name [port=3000]"

profiler="$1"
case $profiler in 
    "doctor"|"flame"|"bubbleprof"|"heapprofiler")
        ;;
    *)
        echo "Invalid profiler: ${profiler}"
        echo $usage;
        exit 1;;
esac;

if [[ $# -lt 2 ]]; then
    echo "Missing service name!"
    echo $usage;
    exit 1
fi;

readonly service="$2"
readonly target="./services/${service}"

if [[ ! -d "${target}" ]]; then
    echo "Invalid service name: ${service}";
    echo $usage;
    exit 1
fi; 

readonly port="$3"

echo ">>> Building $service..."
tsc --build ${target}

echo ">>> Profiling $service with $profiler..."
PORT=${port} LOG_LEVEL="info" clinic ${profiler} -- node ${target}/dist

#PORT=${port} clinic doctor --on-port 'autocannon localhost:$PORT' -- node ${target}/dist
#PORT=${port} clinic flame --on-port 'autocannon localhost:$PORT' -- node ${target}/dist
#PORT=${port} clinic bubbleprof --on-port 'autocannon localhost:$PORT' -- node ${target}/dist
#PORT=${port} clinic heapprofiler --on-port 'autocannon localhost:$PORT' -- node ${target}/dist
