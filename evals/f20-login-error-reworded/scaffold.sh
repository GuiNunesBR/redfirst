#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "${BASH_SOURCE[0]}")/../stage.sh" f20-login-error-reworded e2e-login-UI-Login-mostra-erro-com-credenciais-inválidas-chromium
