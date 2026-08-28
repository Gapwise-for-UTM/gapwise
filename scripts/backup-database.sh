#!/usr/bin/env bash
set -euo pipefail

umask 077

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "SUPABASE_DB_URL must be set at runtime." >&2
  exit 2
fi

for command_name in supabase sha256sum; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Required command not found: $command_name" >&2
    exit 2
  fi
done

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
out_dir="${1:-backups/gapwise-${stamp}}"

if [[ -e "$out_dir" ]]; then
  if [[ ! -d "$out_dir" ]] || [[ -n "$(find "$out_dir" -mindepth 1 -maxdepth 1 -print -quit)" ]]; then
    echo "Refusing to overwrite non-empty destination: $out_dir" >&2
    exit 2
  fi
else
  mkdir -p "$out_dir"
fi
chmod 700 "$out_dir"

roles="$out_dir/roles.sql"
schema="$out_dir/schema.sql"
data="$out_dir/data.sql"
checksums="$out_dir/SHA256SUMS"
evidence="$out_dir/EVIDENCE.md"

cleanup_on_failure() {
  status=$?
  if (( status != 0 )); then
    echo "Backup failed. Partial files may exist in: $out_dir" >&2
  fi
  exit "$status"
}
trap cleanup_on_failure EXIT

echo "Creating logical database backup in: $out_dir"
echo "Connection credentials will not be printed or stored by this script."

supabase db dump --db-url "$SUPABASE_DB_URL" -f "$roles" --role-only
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$schema"
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$data" --use-copy --data-only \
  -x "storage.buckets_vectors" \
  -x "storage.vector_indexes"

(
  cd "$out_dir"
  sha256sum roles.sql schema.sql data.sql > SHA256SUMS
)

cat > "$evidence" <<EOF
# Gapwise backup / restore evidence

- Backup UTC: ${stamp}
- Core main SHA: TODO
- Latest migration identifier: TODO
- Source project label/ref: TODO (non-secret only)
- Off-site encrypted artifact label/location: TODO (no key/credential)
- Dump integrity: TODO (\`sha256sum --check SHA256SUMS\`)
- Restore drill UTC: TODO
- Disposable target label/ref: TODO
- Restore result: TODO
- RLS/policy/function verification: TODO
- Encrypted application restore verification: TODO
- Operator: TODO
- Disposable target cleanup: TODO
- Plaintext working-copy cleanup/protection: TODO

## SHA-256

\`\`\`text
$(cat "$checksums")
\`\`\`

Do not add connection strings, passwords, tokens, OAuth secrets, KEKs/DEKs, or user data to this file.
EOF

chmod 600 "$roles" "$schema" "$data" "$checksums" "$evidence"
trap - EXIT

printf 'Backup complete: %s\n' "$out_dir"
printf 'Next: verify checksums, encrypt the entire bundle, move the encrypted artifact off-site, then perform the documented disposable-target restore drill.\n'
