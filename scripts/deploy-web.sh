#!/usr/bin/env sh
# Rolls the Azure Container App onto a web image published by .github/workflows/web-image.yml.
# Usage: scripts/deploy-web.sh [git-sha]   (defaults to HEAD, which must be pushed and its image built)
# Uses `azd provision` rather than `az containerapp update`: this subscription's express Container Apps
# environment rejects the update call.
set -eu
sha="$(git rev-parse "${1:-HEAD}")"
image="ghcr.io/miflowe/sylvia-web:${sha}"
echo "Deploying ${image}"
azd env set WEB_IMAGE "$image"
azd provision --no-prompt
echo "Live at $(azd env get-value WEB_URL)"
