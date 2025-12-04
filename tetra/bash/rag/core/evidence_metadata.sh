#!/usr/bin/env bash
# evidence_metadata.sh - Evidence metadata parsing and validation
#
# Requires bash 5.2+

: "${RAG_SRC:=$TETRA_SRC/bash/rag}"
: "${TETRA_SRC:?TETRA_SRC must be set}"

# Valid evidence types
declare -A EVIDENCE_TYPES=(
    [bug_investigation]="Evidence showing problematic code"
    [feature_implementation]="Code implementing desired functionality"
    [context_definition]="Core concepts, interfaces, types"
    [test_specification]="Tests showing expected behavior"
    [configuration]="Config files, settings, parameters"
    [documentation]="README, design docs, comments"
    [dependency]="Required context for understanding other evidence"
    [example]="Usage examples, patterns"
)

# Valid relevance levels
declare -A RELEVANCE_LEVELS=(
    [high]="Critical to understanding/solving the task"
    [medium]="Helpful context, not essential"
    [low]="Background information, peripheral"
)

# Parse YAML frontmatter from evidence file
# Returns associative array of metadata
parse_evidence_metadata() {
    local file="$1"

    if [[ ! -f "$file" ]]; then
        echo "Error: File not found: $file" >&2
        return 1
    fi

    # Extract YAML from <!--evidence ... --> block
    local yaml_content=""
    local in_block=false

    while IFS= read -r line; do
        if [[ "$line" =~ ^\<\!--evidence ]]; then
            in_block=true
            continue
        elif [[ "$line" =~ ^--\> ]] && [[ "$in_block" == true ]]; then
            break
        elif [[ "$in_block" == true ]]; then
            yaml_content+="$line"$'\n'
        fi
    done < "$file"

    if [[ -z "$yaml_content" ]]; then
        return 1
    fi

    # Parse YAML into associative array (simple parser for our needs)
    declare -gA EVIDENCE_META

    local current_key=""
    local in_multiline=false
    local multiline_content=""

    while IFS= read -r line; do
        # Skip empty lines
        [[ -z "$line" ]] && continue

        # Handle multiline values (|)
        if [[ "$line" =~ ^([a-z_]+):\ \|$ ]]; then
            current_key="${BASH_REMATCH[1]}"
            in_multiline=true
            multiline_content=""
            continue
        fi

        if [[ "$in_multiline" == true ]]; then
            # Check if line is indented (part of multiline)
            if [[ "$line" =~ ^[[:space:]]{2,}(.+)$ ]]; then
                # Remove leading spaces and append
                local content="${BASH_REMATCH[1]}"
                multiline_content+="$content"$'\n'
            else
                # End of multiline
                EVIDENCE_META["$current_key"]="${multiline_content%$'\n'}"
                in_multiline=false
                # Process current line as new key-value
            fi
        fi

        if [[ "$in_multiline" == false ]]; then
            # Handle array values [item1, item2]
            if [[ "$line" =~ ^([a-z_]+):\ \[(.+)\]$ ]]; then
                local key="${BASH_REMATCH[1]}"
                local array_content="${BASH_REMATCH[2]}"
                # Store as comma-separated string
                EVIDENCE_META["$key"]="$array_content"
            # Handle simple key: value
            elif [[ "$line" =~ ^([a-z_]+):\ (.+)$ ]]; then
                local key="${BASH_REMATCH[1]}"
                local value="${BASH_REMATCH[2]}"
                # Trim quotes if present
                value="${value#\"}"
                value="${value%\"}"
                EVIDENCE_META["$key"]="$value"
            fi
        fi
    done <<< "$yaml_content"

    # Handle last multiline if file ended
    if [[ "$in_multiline" == true ]]; then
        EVIDENCE_META["$current_key"]="${multiline_content%$'\n'}"
    fi

    return 0
}

# Validate evidence metadata
validate_evidence_metadata() {
    declare -n meta=$1

    local errors=()

    # Required fields
    if [[ -z "${meta[evidence_id]:-}" ]]; then
        errors+=("Missing required field: evidence_id")
    fi

    if [[ -z "${meta[source_uri]:-}" ]]; then
        errors+=("Missing required field: source_uri")
    fi

    if [[ -z "${meta[span]:-}" ]]; then
        errors+=("Missing required field: span")
    fi

    # Validate evidence_type
    if [[ -n "${meta[evidence_type]:-}" ]]; then
        if [[ ! -v EVIDENCE_TYPES[${meta[evidence_type]}] ]]; then
            errors+=("Invalid evidence_type: ${meta[evidence_type]}")
        fi
    fi

    # Validate relevance
    if [[ -n "${meta[relevance]:-}" ]]; then
        if [[ ! -v RELEVANCE_LEVELS[${meta[relevance]}] ]]; then
            errors+=("Invalid relevance: ${meta[relevance]}")
        fi
    fi

    # Validate span format
    if [[ -n "${meta[span]:-}" ]]; then
        local span="${meta[span]}"
        if [[ ! "$span" =~ ^(full|lines=[0-9]+:[0-9]+|lines=[0-9]+:EOF|bytes=[0-9]+:[0-9]+|bytes=[0-9]+:EOF)$ ]]; then
            errors+=("Invalid span format: $span")
        fi
    fi

    # Report errors
    if [[ ${#errors[@]} -gt 0 ]]; then
        for error in "${errors[@]}"; do
            echo "  ✗ $error" >&2
        done
        return 1
    fi

    return 0
}

# Create evidence metadata block
create_evidence_metadata() {
    local evidence_id="$1"
    local source_uri="$2"
    local span="$3"
    local content_digest="$4"
    local evidence_type="${5:-context_definition}"
    local relevance="${6:-medium}"
    local justification="${7:-}"
    local tags="${8:-}"
    local relates_to="${9:-}"
    local context_note="${10:-}"

    local timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

    cat <<EOF
<!--evidence
evidence_id: $evidence_id
evidence_type: $evidence_type
source_uri: $source_uri
span: $span
content_digest: $content_digest
relevance: $relevance
tags: [$tags]
relates_to: [$relates_to]
justification: |
  $justification
added: $timestamp
-->
EOF
}

# Update evidence metadata in file
update_evidence_metadata() {
    local file="$1"
    local field="$2"
    local value="$3"

    if [[ ! -f "$file" ]]; then
        echo "Error: File not found: $file" >&2
        return 1
    fi

    # Parse existing metadata
    parse_evidence_metadata "$file" || {
        echo "Error: Could not parse metadata from $file" >&2
        return 1
    }

    # Update field
    EVIDENCE_META["$field"]="$value"

    # Reconstruct metadata block
    local meta_block="<!--evidence"$'\n'

    # Ordered fields
    local -a field_order=(
        evidence_id evidence_type source_uri span content_digest
        relevance tags relates_to supersedes
        justification context_note
        added last_used
    )

    for key in "${field_order[@]}"; do
        if [[ -v EVIDENCE_META[$key] ]]; then
            local val="${EVIDENCE_META[$key]}"

            # Handle arrays
            if [[ "$key" == "tags" || "$key" == "relates_to" || "$key" == "supersedes" ]]; then
                if [[ "$val" != "["* ]]; then
                    val="[$val]"
                fi
                meta_block+="$key: $val"$'\n'
            # Handle multiline
            elif [[ "$key" == "justification" || "$key" == "context_note" ]]; then
                if [[ -n "$val" ]]; then
                    meta_block+="$key: |"$'\n'
                    # Indent each line
                    while IFS= read -r line; do
                        meta_block+="  $line"$'\n'
                    done <<< "$val"
                fi
            else
                meta_block+="$key: $val"$'\n'
            fi
        fi
    done

    meta_block+="-->"

    # Replace metadata block in file
    local temp_file="${file}.tmp"
    local in_block=false
    local block_replaced=false

    {
        while IFS= read -r line; do
            if [[ "$line" =~ ^\<\!--evidence ]]; then
                in_block=true
                echo "$meta_block"
                block_replaced=true
                continue
            elif [[ "$line" =~ ^--\> ]] && [[ "$in_block" == true ]]; then
                in_block=false
                continue
            elif [[ "$in_block" == false ]]; then
                echo "$line"
            fi
        done < "$file"
    } > "$temp_file"

    if [[ "$block_replaced" == true ]]; then
        mv "$temp_file" "$file"
        return 0
    else
        rm -f "$temp_file"
        echo "Error: Could not find metadata block to update" >&2
        return 1
    fi
}

# Get metadata field value
get_evidence_field() {
    local file="$1"
    local field="$2"

    parse_evidence_metadata "$file" || return 1

    echo "${EVIDENCE_META[$field]:-}"
}

# List all evidence types
list_evidence_types() {
    echo "Evidence Types"
    echo "═══════════════════════════════════════════════════════════"
    echo ""

    for type in "${!EVIDENCE_TYPES[@]}"; do
        printf "%-25s %s\n" "$type" "${EVIDENCE_TYPES[$type]}"
    done | sort
}

# Check if file has metadata
has_metadata() {
    local file="$1"
    grep -q "^<!--evidence" "$file" 2>/dev/null
}

# Get evidence summary from file
get_evidence_summary() {
    local file="$1"

    if ! has_metadata "$file"; then
        echo "No metadata"
        return 1
    fi

    parse_evidence_metadata "$file" || return 1

    local id="${EVIDENCE_META[evidence_id]:-?}"
    local type="${EVIDENCE_META[evidence_type]:-unknown}"
    local relevance="${EVIDENCE_META[relevance]:-?}"
    local tags="${EVIDENCE_META[tags]:-}"
    local justification="${EVIDENCE_META[justification]:-}"

    # Truncate justification to first line
    justification="${justification%%$'\n'*}"
    [[ ${#justification} -gt 60 ]] && justification="${justification:0:57}..."

    printf "[%s] %s (rel:%s) - %s" "$id" "$type" "$relevance" "$justification"
    [[ -n "$tags" ]] && printf " #%s" "${tags//,/ #}"
    printf "\n"
}

# Export functions
export -f parse_evidence_metadata
export -f validate_evidence_metadata
export -f create_evidence_metadata
export -f update_evidence_metadata
export -f get_evidence_field
export -f list_evidence_types
export -f has_metadata
export -f get_evidence_summary
