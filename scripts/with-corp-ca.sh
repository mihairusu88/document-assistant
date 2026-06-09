#!/usr/bin/env bash
# Run a command with the corporate (Zscaler) root CAs trusted by Node.
#
# On the corporate network, Node's bundled CA store doesn't include the Zscaler
# MITM root, so outbound HTTPS from Node (OpenAI, Qdrant, …) fails with
# "unable to get local issuer certificate" / "Connection error". This exports
# the system keychain CAs and points NODE_EXTRA_CA_CERTS at them (adds trust;
# does NOT disable TLS verification). Off-network it's a harmless no-op.
#
# Usage:  bash scripts/with-corp-ca.sh next dev
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CA="$ROOT/.certs/corp-ca.pem"

if [ ! -f "$CA" ] && command -v security >/dev/null 2>&1; then
  mkdir -p "$ROOT/.certs"
  security find-certificate -a -p /Library/Keychains/System.keychain > "$CA" 2>/dev/null || true
  security find-certificate -a -p /System/Library/Keychains/SystemRootCertificates.keychain >> "$CA" 2>/dev/null || true
fi

[ -f "$CA" ] && export NODE_EXTRA_CA_CERTS="$CA"

exec "$@"
