#!/bin/bash

echo "Stopping firestore emulator..."
docker stop firestore-emulator

echo "Removing container..."
docker rm firestore-emulator

echo "Building image..."
docker buildx build --platform linux/arm64 -t firestore-emulator .

echo "Starting firestore emulator..."
docker run --name firestore-emulator -p 8080:8080 -d \
  -e FIRESTORE_PROJECT_ID=test-project-id \
  -e FIRESTORE_EMULATOR_HOST=0.0.0.0 \
  firestore-emulator

echo "Have a nice day!"