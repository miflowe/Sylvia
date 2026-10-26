#!/usr/bin/env sh
# Rolls the Azure Container App onto a web image published by .github/workflows/web-image.yml.
# Usage: scripts/deploy-web.sh [git-sha]   (defaults to the current HEAD, which must be pushed and built)
set -eu
sha="${1:-$(git rev-parse HEAD)}"
image="ghcr.io/miflowe/sylvia-web:${sha}"
rg="$(azd env get-value AZURE_RESOURCE_GROUP)"
app="$(azd env get-value WEB_APP_NAME)"

echo "Deploying ${image} to ${app}"
az containerapp ingress update -g "$rg" -n "$app" --target-port 3000 -o none
az containerapp update -g "$rg" -n "$app" --image "$image" -o none
# Remember the image so the next `azd provision` doesn't roll back to the placeholder.
azd env set WEB_IMAGE "$image"
echo "Live at $(azd env get-value WEB_URL)"
