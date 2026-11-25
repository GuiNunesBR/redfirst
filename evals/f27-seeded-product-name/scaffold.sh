#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "${BASH_SOURCE[0]}")/../stage.sh" f27-seeded-product-name api-produtos-admin-cadastra-produto-e-consulta-pelo-id-api
