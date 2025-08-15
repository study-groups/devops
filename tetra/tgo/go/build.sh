#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# remove conflicting sources
rm -f api.go render.go ui.go fs.go state.go input.go

# optional garbage
rm -f *~ *.bak *.orig

echo "Remaining Go sources:"
ls -1 *.go || true

go mod tidy
go build -o ./tgo
echo "Built ./tgo"

