#!/bin/sh
set -eu
image=${1:?Usage: lite-release-smoke.sh IMAGE EXPECTED_VERSION}
version=${2:?Expected version required}
container="convertx-lite-smoke-$$"
volume="$container-data"
cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
  docker volume rm "$volume" >/dev/null 2>&1 || true
}
trap cleanup EXIT
docker run -d --name "$container" --mount "type=volume,source=$volume,target=/app/data" \
  -e HTTP_ALLOWED=true -e ACCOUNT_REGISTRATION=false -e AUTO_DELETE_EVERY_N_HOURS=0 "$image"
docker cp scripts/lite-release-smoke.ts "$container:/tmp/lite-release-smoke.ts"
if ! docker exec "$container" bun /tmp/lite-release-smoke.ts "$version"; then
  docker logs "$container"
  exit 1
fi
docker restart "$container" >/dev/null
docker exec "$container" bun /tmp/lite-release-smoke.ts "$version" restart
