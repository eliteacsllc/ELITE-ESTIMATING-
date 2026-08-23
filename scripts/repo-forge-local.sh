#!/usr/bin/env bash
set -euo pipefail

command -v node >/dev/null
command -v npm >/dev/null

npm run verify
