#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "${BASH_SOURCE[0]}")/../stage.sh" f25-row-of-another-product e2e-produtos-admin-exclui-um-produto-pela-listagem-chromium
