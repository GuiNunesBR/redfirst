#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "${BASH_SOURCE[0]}")/../stage.sh" f18-duplicate-email-accepted e2e-cadastro-nao-permite-cadastrar-um-e-mail-que-ja-existe-chromium
