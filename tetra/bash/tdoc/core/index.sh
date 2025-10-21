#!/usr/bin/env bash

# TDOC Index System
# Fast JSON indexes for document queries

# Initialize .tdoc directories
tdoc_index_init() {
    # Create .tdoc in main docs directory
    mkdir -p "$TETRA_SRC/docs/.tdoc"

    # Create .tdoc in module docs directories
    for module_docs in "$TETRA_SRC/bash"/*/docs; do
        [[ -d "$module_docs" ]] && mkdir -p "$module_docs/.tdoc"
    done
}

# Rebuild all indexes from database
tdoc_index_rebuild() {
    echo "Rebuilding tdoc indexes..."

    local core_docs=()
    local other_docs=()

    # Iterate through database
    for meta_file in "$TDOC_DB_DIR"/*.meta; do
        [[ ! -f "$meta_file" ]] && continue

        local meta=$(cat "$meta_file")
        local category=$(echo "$meta" | grep -o '"category": "[^"]*"' | cut -d'"' -f4)

        if [[ "$category" == "core" ]]; then
            core_docs+=("$meta")
        else
            other_docs+=("$meta")
        fi
    done

    # Build global index
    local index_file="$TETRA_SRC/docs/.tdoc/index.json"
    {
        echo "{"
        echo "  \"core\": ["
        local first=true
        for doc in "${core_docs[@]}"; do
            [[ "$first" == false ]] && echo ","
            first=false
            echo "    $doc"
        done
        echo "  ],"
        echo "  \"other\": ["
        first=true
        for doc in "${other_docs[@]}"; do
            [[ "$first" == false ]] && echo ","
            first=false
            echo "    $doc"
        done
        echo "  ]"
        echo "}"
    } > "$index_file"

    echo "Global index rebuilt: $index_file"

    # Build module-specific indexes
    _tdoc_rebuild_module_indexes

    echo "Index rebuild complete"
}

# Rebuild indexes for module docs directories
_tdoc_rebuild_module_indexes() {
    for module_dir in "$TETRA_SRC/bash"/*/; do
        local module=$(basename "$module_dir")
        local docs_dir="$module_dir/docs"

        [[ ! -d "$docs_dir" ]] && continue

        local module_docs=()

        # Find docs for this module in database
        for meta_file in "$TDOC_DB_DIR"/*.meta; do
            [[ ! -f "$meta_file" ]] && continue

            if grep -q "\"module\": \"$module\"" "$meta_file" 2>/dev/null; then
                module_docs+=("$(cat "$meta_file")")
            fi
        done

        # Write module index
        if [[ ${#module_docs[@]} -gt 0 ]]; then
            local index_file="$docs_dir/.tdoc/index.json"
            {
                echo "{"
                echo "  \"module\": \"$module\","
                echo "  \"documents\": ["
                local first=true
                for doc in "${module_docs[@]}"; do
                    [[ "$first" == false ]] && echo ","
                    first=false
                    echo "    $doc"
                done
                echo "  ]"
                echo "}"
            } > "$index_file"
        fi
    done
}

# Show index status
tdoc_index_status() {
    echo "TDOC Index Status"
    echo "───────────────────────────────────────"
    echo ""

    # Global index
    local global_index="$TETRA_SRC/docs/.tdoc/index.json"
    if [[ -f "$global_index" ]]; then
        local core_count=$(grep -c '"category": "core"' "$global_index" 2>/dev/null || echo "0")
        local other_count=$(grep -c '"category": "other"' "$global_index" 2>/dev/null || echo "0")
        echo "Global Index: $global_index"
        echo "  Core documents: $core_count"
        echo "  Other documents: $other_count"
    else
        echo "Global Index: Not found (run 'tdoc index --rebuild')"
    fi

    echo ""

    # Module indexes
    local module_count=0
    for index_file in "$TETRA_SRC/bash"/*/docs/.tdoc/index.json; do
        [[ ! -f "$index_file" ]] && continue

        local module=$(basename $(dirname $(dirname $(dirname "$index_file"))))
        local doc_count=$(grep -c '"timestamp"' "$index_file" 2>/dev/null || echo "0")

        echo "Module: $module ($doc_count docs)"
        ((module_count++))
    done

    [[ $module_count -eq 0 ]] && echo "No module indexes found"

    echo ""
    echo "Database: $TDOC_DB_DIR"
    local db_count=$(find "$TDOC_DB_DIR" -name "*.meta" 2>/dev/null | wc -l | tr -d ' ')
    echo "  Metadata files: $db_count"
}
