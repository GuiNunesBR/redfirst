#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "${BASH_SOURCE[0]}")/../stage.sh" f02-user-submit-test-id e2e-usuarios-admin-cadastra-um-cliente-pelo-painel-chromium
