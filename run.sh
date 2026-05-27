#!/usr/bin/env sh
set -eu

IMAGE_NAME="${IMAGE_NAME:-video-editing-system:latest}"
CONTAINER_NAME="${CONTAINER_NAME:-video-editing-system}"
HOST_PORT="${HOST_PORT:-3000}"
CONTAINER_PORT="${CONTAINER_PORT:-3000}"
EXECUTABLE="${EXECUTABLE:-video-editing-system-linux}"

if [ ! -f "$EXECUTABLE" ]; then
  echo "Missing executable: $EXECUTABLE"
  echo "Upload $EXECUTABLE to the same directory as Dockerfile and run.sh first."
  exit 1
fi

docker build -t "$IMAGE_NAME" .

if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  docker rm -f "$CONTAINER_NAME"
fi

docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -e PORT="$CONTAINER_PORT" \
  -p "$HOST_PORT:$CONTAINER_PORT" \
  "$IMAGE_NAME"

echo "Container started: $CONTAINER_NAME"
echo "Visit: http://localhost:$HOST_PORT"
