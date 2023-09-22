#!/bin/bash

echo "Stopping containers..."
docker stop postgres

echo "Removing containers..."
docker rm postgres

echo "Pruning container data..."
docker container prune -f
rm -r ./data

echo "Starting Postgres..."
docker run \
    --name postgres \
    -p 5432:5432 \
    -d \
    -e POSTGRES_DB=postgres -e POSTGRES_USER=postgres -e POSTGRES_HOST_AUTH_METHOD=trust \
    -e PGDATA=/var/lib/postgresql/data/pgdata \
    -v $PWD/data:/var/lib/postgresql/data/pgdata \
    postgres:12.3-alpine

echo "Have a nice day!"