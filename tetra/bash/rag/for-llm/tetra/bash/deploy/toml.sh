tetra_toml_generate_env() {
  local input="$1"
  local env="$2"

  awk -v env_section="[$env]" '
    function emit_export(line) {
      sub(/ *= */, "=", line)         # Remove spaces around =
      gsub(/"/, "", line)             # Remove quotes
      print "export " line
    }
    /^\[.*\]/ {
      in_common = 0
      in_env = 0
    }
    /^\[common\]/     { in_common = 1; next }
    $0 == env_section { in_env = 1; next }
    in_common && /^[A-Z_][A-Z0-9_]* *=/ { emit_export($0) }
    in_env    && /^[A-Z_][A-Z0-9_]* *=/ { emit_export($0) }
  ' "$input"
}
