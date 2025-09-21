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

# Enhanced TOML parser with variable resolution and secret injection
tetra_toml_generate_env_enhanced() {
    local toml_file="$1"
    local environment="$2"

    if [[ ! -f "$toml_file" ]]; then
        echo "Error: TOML file not found: $toml_file" >&2
        return 1
    fi

    local temp_dir="/tmp/tetra-toml-$$"
    mkdir -p "$temp_dir"

    # Step 1: Extract sections to temporary files
    awk -v temp_dir="$temp_dir" '
        BEGIN { section = "" }
        /^\[([^\]]+)\]/ {
            section = $0
            gsub(/^\[|\]$/, "", section)
            gsub(/\./, "_", section)  # Convert dots to underscores for filenames
            next
        }
        section != "" && /^[a-zA-Z_][a-zA-Z0-9_]* *= *.*/ {
            print $0 > temp_dir "/" section ".section"
        }
    ' "$toml_file"

    # Step 2: Build variable resolution map
    local var_map="$temp_dir/variables.map"
    if [[ -f "$temp_dir/variables.section" ]]; then
        # Convert variables section to key=value format
        sed 's/ *= */=/' "$temp_dir/variables.section" | \
        sed 's/"//g' > "$var_map"
    else
        touch "$var_map"
    fi

    # Step 3: Build infrastructure resolution map
    local infra_map="$temp_dir/infrastructure.map"
    if [[ -f "$temp_dir/infrastructure.section" ]]; then
        sed 's/ *= */=/' "$temp_dir/infrastructure.section" | \
        sed 's/"//g' > "$infra_map"
    else
        touch "$infra_map"
    fi

    # Step 4: Process environment section with variable resolution
    local env_section_file="$temp_dir/environments_${environment}.section"

    if [[ ! -f "$env_section_file" ]]; then
        echo "Error: Environment section [$environment] not found in $toml_file" >&2
        rm -rf "$temp_dir"
        return 1
    fi

    # Step 5: Resolve variables and generate exports
    while IFS='=' read -r key value; do
        [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]] && continue

        # Remove surrounding quotes
        value="${value//\"/}"

        # Resolve ${variables.*} references
        while [[ "$value" =~ \$\{variables\.([^}]+)\} ]]; do
            local var_name="${BASH_REMATCH[1]}"
            local var_value

            if var_value=$(grep "^${var_name}=" "$var_map" 2>/dev/null | cut -d'=' -f2-); then
                value="${value/\${variables.${var_name}}/$var_value}"
            else
                echo "Warning: Undefined variable reference: \${variables.${var_name}}" >&2
                break
            fi
        done

        # Resolve ${infrastructure.*} references
        while [[ "$value" =~ \$\{infrastructure\.([^}]+)\} ]]; do
            local infra_name="${BASH_REMATCH[1]}"
            local infra_value

            if infra_value=$(grep "^${infra_name}=" "$infra_map" 2>/dev/null | cut -d'=' -f2-); then
                value="${value/\${infrastructure.${infra_name}}/$infra_value}"
            else
                echo "Warning: Undefined infrastructure reference: \${infrastructure.${infra_name}}" >&2
                break
            fi
        done

        # Handle secret injection for var.* values
        if [[ "$value" =~ ^var\.(.+)$ ]]; then
            local secret_var="${BASH_REMATCH[1]}"

            # Try to get from environment variable
            if [[ -n "${!secret_var:-}" ]]; then
                value="${!secret_var}"
                echo "✓ Injected secret from \$${secret_var}" >&2
            else
                echo "⚠️  Secret placeholder: $value (set \$${secret_var} environment variable)" >&2
                value="PLACEHOLDER_${secret_var}_HERE"
            fi
        fi

        # Convert to uppercase for environment variable name
        local env_var_name
        env_var_name=$(echo "$key" | tr '[:lower:]' '[:upper:]')

        echo "export ${env_var_name}=\"${value}\""

    done < <(sed 's/ *= */=/' "$env_section_file")

    # Cleanup
    rm -rf "$temp_dir"
}
