#!/usr/bin/env bash
set -euo pipefail

readonly COMPOSE_FILES=(
  "docker-compose.yml"
  "docker-compose.prod.yml"
)

usage() {
  cat <<EOF
Usage: ./deployment.sh [--registry <docker-registry>]

Builds the frontend, API, and database containers with the production overrides,
then optionally pushes the Laravel-tagged images to your registry before
running the stack.

Options:
  --registry  optional registry prefix (e.g. ghcr.io/your-team/luna)
EOF
  exit 1
}

registry=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --registry)
      shift
      registry="${1:-}"
      ;;
    -h|--help)
      usage
      ;;
    *)
      usage
      ;;
  esac
  shift
done

if [[ ! -f ".env.production" ]]; then
  echo "missing .env.production; create it from README manifest before deploying"
  exit 1
fi

echo "Using .env.production for production variables."

compose_args=()
for file in "${COMPOSE_FILES[@]}"; do
  compose_args+=("-f" "$file")
done

echo "Building images..."
docker compose "${compose_args[@]}" build

if [[ -n "$registry" ]]; then
  echo "Tagging and pushing images to $registry"
  SERVICES=("web" "api")
  for service in "${SERVICES[@]}"; do
    image_id=$(docker compose "${compose_args[@]}" images --format "{{.Repository}}:{{.Tag}}" "$service" | head -n1)
    if [[ -z "$image_id" ]]; then
      echo "Unable to determine image for $service"
      exit 1
    fi
    target="$registry-$service:latest"
    docker tag "$image_id" "$target"
    docker push "$target"
  done
fi

echo "Starting production stack..."
docker compose "${compose_args[@]}" up -d

echo "Deployment complete. Monitor api logs with:"
echo "  docker compose ${compose_args[*]} logs -f api"
