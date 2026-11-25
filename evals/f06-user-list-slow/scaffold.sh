#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "${BASH_SOURCE[0]}")/../stage.sh" f06-user-list-slow e2e-usuarios-admin-cadastra-um-cliente-pelo-painel-chromium
