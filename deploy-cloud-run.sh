#!/usr/bin/env bash
set -euo pipefail

if (( $# < 1 || $# > 2 )); then
    printf 'Uso: %s PROJECT_ID [REGIONE]\n' "$0" >&2
    exit 2
fi

project=$1
region=${2:-europe-west8}
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

gcloud run deploy nota \
    --project="$project" \
    --region="$region" \
    --source=. \
    --execution-environment=gen2 \
    --cpu=2 \
    --memory=4Gi \
    --cpu-throttling \
    --no-cpu-boost \
    --min=0 \
    --max=1 \
    --concurrency=1 \
    --timeout=3600 \
    --use-http2 \
    --invoker-iam-check \
    --no-allow-unauthenticated
