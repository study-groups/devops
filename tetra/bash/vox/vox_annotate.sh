#!/usr/bin/env bash

# vox_annotate.sh - Annotation Storage CRUD Operations
#
# Manages phoneme annotations in $TETRA_DIR/vox/db/ following TCS 3.0 patterns
#
# Storage format: {timestamp}.vox.{kind}.{format}
#   - {ts}.vox.source.md          Original text
#   - {ts}.vox.cst.json           Chroma CST
#   - {ts}.vox.tokens.json        Fine-grained tokenization
#   - {ts}.vox.phonemes.json      Phoneme annotations
#   - {ts}.vox.prosody.json       Prosody (pitch, rhythm, emphasis)
#   - {ts}.vox.voice.{voice}.json Voice-specific overrides
#   - {ts}.vox.audio.{voice}.mp3  Generated audio
#   - {ts}.vox.spans.{voice}.json Audio-text alignment
#
# Usage:
#   vox_annotate create < text.md
#   vox_annotate read 1760229927 phonemes
#   vox_annotate update 1760229927 phonemes < updated.json
#   vox_annotate list

#==============================================================================
# CONFIGURATION
#==============================================================================

: "${VOX_SRC:=$TETRA_SRC/bash/vox}"
: "${VOX_DIR:=$TETRA_DIR/vox}"
: "${CHROMA_SRC:=$TETRA_SRC/bash/chroma}"

# Ensure db directory exists
VOX_DB_DIR="$VOX_DIR/db"
mkdir -p "$VOX_DB_DIR"

# Annotation kinds
declare -ga VOX_ANNOTATION_KINDS=(
    "source"      # Original text/markdown
    "cst"         # Chroma CST
    "tokens"      # Fine-grained tokens
    "phonemes"    # Phoneme breakdown
    "prosody"     # Prosody markers
    "voice"       # Voice-specific overrides (has voice suffix)
    "audio"       # Generated audio (has voice suffix)
    "spans"       # Audio-text alignment (has voice suffix)
)

# File extensions by kind
declare -gA VOX_KIND_EXT=(
    [source]="md"
    [cst]="json"
    [tokens]="json"
    [phonemes]="json"
    [prosody]="json"
    [voice]="json"
    [audio]="mp3"
    [spans]="json"
)

#==============================================================================
# PATH HELPERS
#==============================================================================

vox_annotate_generate_id() {
    date +%s
}

vox_annotate_path() {
    local doc_id="$1"
    local kind="$2"
    local voice="${3:-}"
    local ext="${VOX_KIND_EXT[$kind]:-json}"

    if [[ -n "$voice" ]]; then
        echo "$VOX_DB_DIR/${doc_id}.vox.${kind}.${voice}.${ext}"
    else
        echo "$VOX_DB_DIR/${doc_id}.vox.${kind}.${ext}"
    fi
}

vox_annotate_parse_filename() {
    local filename="$1"
    filename=$(basename "$filename")

    if [[ "$filename" =~ ^([0-9]+)\.vox\.([a-z]+)\.([a-z]+)\.([a-z0-9]+)$ ]]; then
        echo "${BASH_REMATCH[1]} ${BASH_REMATCH[2]} ${BASH_REMATCH[3]} ${BASH_REMATCH[4]}"
    elif [[ "$filename" =~ ^([0-9]+)\.vox\.([a-z]+)\.([a-z0-9]+)$ ]]; then
        echo "${BASH_REMATCH[1]} ${BASH_REMATCH[2]} '' ${BASH_REMATCH[3]}"
    else
        return 1
    fi
}

vox_annotate_list_ids() {
    find "$VOX_DB_DIR" -name "*.vox.*" -type f 2>/dev/null | \
        sed -E 's|.*/([0-9]+)\.vox\..*|\1|' | \
        sort -u
}

vox_annotate_exists() {
    local doc_id="$1"
    [[ -n $(find "$VOX_DB_DIR" -name "${doc_id}.vox.*" -type f 2>/dev/null | head -1) ]]
}

#==============================================================================
# CREATE OPERATIONS
#==============================================================================

vox_annotate_create() {
    local voice="${1:-}"
    local doc_id
    doc_id=$(vox_annotate_generate_id)

    local content
    content=$(cat)

    if [[ -z "$content" ]]; then
        echo "Error: No content provided" >&2
        return 1
    fi

    # Write source file
    local source_path
    source_path=$(vox_annotate_path "$doc_id" "source")
    echo "$content" > "$source_path"

    # Generate CST if chroma available
    if declare -F chroma_cst_parse &>/dev/null; then
        local cst_path
        cst_path=$(vox_annotate_path "$doc_id" "cst")
        echo "$content" | chroma_cst_parse > "$cst_path"
    fi

    # Generate tokens and phonemes if vox_g2p available
    if declare -F vox_g2p_full &>/dev/null; then
        local tokens_path phonemes_path
        tokens_path=$(vox_annotate_path "$doc_id" "tokens")
        phonemes_path=$(vox_annotate_path "$doc_id" "phonemes")

        local tokens_json
        tokens_json=$(echo "$content" | vox_g2p_full)
        echo "$tokens_json" > "$tokens_path"

        echo "$tokens_json" | jq '{
            version: "1.0",
            doc_id: "'"$doc_id"'",
            created: (now | todate),
            tokens: [.tokens[] | select(.type == "word") | {
                id: .pos.offset,
                word: .text,
                ipa: .ipa,
                duration_ms: .duration_ms,
                phonemes: .phonemes
            }]
        }' > "$phonemes_path"
    fi

    # Create empty prosody file
    local prosody_path
    prosody_path=$(vox_annotate_path "$doc_id" "prosody")
    cat > "$prosody_path" <<EOF
{
    "version": "1.0",
    "doc_id": "$doc_id",
    "created": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "global": {
        "rate": 1.0,
        "pitch_base_hz": 180,
        "volume": 1.0
    },
    "ranges": []
}
EOF

    # Create metadata
    _vox_annotate_write_meta "$doc_id" "$content"

    echo "$doc_id"
}

vox_annotate_create_from_file() {
    local file_path="$1"
    local voice="${2:-}"

    if [[ ! -f "$file_path" ]]; then
        echo "Error: File not found: $file_path" >&2
        return 1
    fi

    cat "$file_path" | vox_annotate_create "$voice"
}

_vox_annotate_write_meta() {
    local doc_id="$1"
    local content="$2"

    local meta_path="$VOX_DB_DIR/${doc_id}.vox.meta.json"
    local char_count=${#content}
    local word_count=$(echo "$content" | wc -w | tr -d ' ')
    local line_count=$(echo "$content" | wc -l | tr -d ' ')
    local hash=$(echo "$content" | shasum -a 256 | cut -d' ' -f1)

    cat > "$meta_path" <<EOF
{
    "version": "1.0",
    "doc_id": "$doc_id",
    "created": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "modified": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "source_hash": "$hash",
    "stats": {
        "characters": $char_count,
        "words": $word_count,
        "lines": $line_count
    },
    "voices": [],
    "annotations": {
        "source": true,
        "cst": $(declare -F chroma_cst_parse &>/dev/null && echo true || echo false),
        "tokens": $(declare -F vox_g2p_full &>/dev/null && echo true || echo false),
        "phonemes": $(declare -F vox_g2p_full &>/dev/null && echo true || echo false),
        "prosody": true
    }
}
EOF
}

#==============================================================================
# READ OPERATIONS
#==============================================================================

vox_annotate_read() {
    local doc_id="$1"
    local kind="$2"
    local voice="${3:-}"

    local path
    path=$(vox_annotate_path "$doc_id" "$kind" "$voice")

    if [[ ! -f "$path" ]]; then
        echo "Error: Annotation not found: $path" >&2
        return 1
    fi

    cat "$path"
}

vox_annotate_read_pretty() {
    local doc_id="$1"
    local kind="$2"
    local voice="${3:-}"

    vox_annotate_read "$doc_id" "$kind" "$voice" | jq .
}

vox_annotate_get_phoneme() {
    local doc_id="$1"
    local offset="$2"

    vox_annotate_read "$doc_id" "phonemes" | \
        jq --argjson off "$offset" '.tokens[] | select(.id == $off)'
}

vox_annotate_find_word() {
    local doc_id="$1"
    local word="$2"

    vox_annotate_read "$doc_id" "phonemes" | \
        jq --arg w "$word" '[.tokens[] | select(.word == $w)]'
}

vox_annotate_list_doc() {
    local doc_id="$1"

    if ! vox_annotate_exists "$doc_id"; then
        echo "Error: Document not found: $doc_id" >&2
        return 1
    fi

    echo "Document: $doc_id"
    echo "Location: $VOX_DB_DIR"
    echo ""
    echo "Annotations:"

    for file in "$VOX_DB_DIR/${doc_id}".vox.*; do
        [[ -f "$file" ]] || continue
        local basename=$(basename "$file")
        local size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
        printf "  %-40s %8s bytes\n" "$basename" "$size"
    done
}

#==============================================================================
# UPDATE OPERATIONS
#==============================================================================

vox_annotate_update() {
    local doc_id="$1"
    local kind="$2"
    local voice="${3:-}"

    local path
    path=$(vox_annotate_path "$doc_id" "$kind" "$voice")

    if [[ -f "$path" ]]; then
        cp "$path" "${path}.bak"
    fi

    cat > "$path"
    _vox_annotate_update_meta "$doc_id"
    echo "Updated: $path"
}

vox_annotate_update_phoneme() {
    local doc_id="$1"
    local offset="$2"
    local field="$3"
    local value="$4"

    local path
    path=$(vox_annotate_path "$doc_id" "phonemes")

    if [[ ! -f "$path" ]]; then
        echo "Error: Phonemes not found for doc: $doc_id" >&2
        return 1
    fi

    cp "$path" "${path}.bak"

    local tmp=$(mktemp)
    jq --argjson off "$offset" --arg field "$field" --argjson val "$value" '
        .tokens |= map(
            if .id == $off then
                .[$field] = $val
            else
                .
            end
        ) |
        .modified = (now | todate)
    ' "$path" > "$tmp" && mv "$tmp" "$path"

    _vox_annotate_update_meta "$doc_id"
}

vox_annotate_update_duration() {
    local doc_id="$1"
    local word_offset="$2"
    local phoneme_idx="$3"
    local duration="$4"

    local path
    path=$(vox_annotate_path "$doc_id" "phonemes")

    cp "$path" "${path}.bak"

    local tmp=$(mktemp)
    jq --argjson off "$word_offset" --argjson idx "$phoneme_idx" --argjson dur "$duration" '
        .tokens |= map(
            if .id == $off then
                .phonemes[$idx].duration_ms = $dur
            else
                .
            end
        ) |
        .modified = (now | todate)
    ' "$path" > "$tmp" && mv "$tmp" "$path"

    _vox_annotate_update_meta "$doc_id"
}

vox_annotate_update_ipa() {
    local doc_id="$1"
    local word_offset="$2"
    local new_ipa="$3"

    local path
    path=$(vox_annotate_path "$doc_id" "phonemes")

    cp "$path" "${path}.bak"

    local phonemes_json="[]"
    if declare -F _vox_g2p_parse_ipa &>/dev/null; then
        phonemes_json=$(_vox_g2p_parse_ipa "$new_ipa")
    fi

    local tmp=$(mktemp)
    jq --argjson off "$word_offset" --arg ipa "$new_ipa" --argjson ph "$phonemes_json" '
        .tokens |= map(
            if .id == $off then
                .ipa = $ipa |
                .phonemes = $ph |
                .duration_ms = ($ph | map(.duration_ms) | add)
            else
                .
            end
        ) |
        .modified = (now | todate)
    ' "$path" > "$tmp" && mv "$tmp" "$path"

    _vox_annotate_update_meta "$doc_id"
}

vox_annotate_add_prosody() {
    local doc_id="$1"
    local start="$2"
    local end="$3"
    local emphasis="${4:-normal}"
    local pitch_shift="${5:-1.0}"

    local path
    path=$(vox_annotate_path "$doc_id" "prosody")

    cp "$path" "${path}.bak"

    local tmp=$(mktemp)
    jq --argjson s "$start" --argjson e "$end" --arg emp "$emphasis" --argjson ps "$pitch_shift" '
        .ranges += [{
            start_offset: $s,
            end_offset: $e,
            emphasis: $emp,
            pitch_shift: $ps
        }] |
        .modified = (now | todate)
    ' "$path" > "$tmp" && mv "$tmp" "$path"

    _vox_annotate_update_meta "$doc_id"
}

_vox_annotate_update_meta() {
    local doc_id="$1"
    local meta_path="$VOX_DB_DIR/${doc_id}.vox.meta.json"

    if [[ -f "$meta_path" ]]; then
        local tmp=$(mktemp)
        jq '.modified = (now | todate)' "$meta_path" > "$tmp" && mv "$tmp" "$meta_path"
    fi
}

#==============================================================================
# DELETE OPERATIONS
#==============================================================================

vox_annotate_delete() {
    local doc_id="$1"
    local kind="$2"
    local voice="${3:-}"

    local path
    path=$(vox_annotate_path "$doc_id" "$kind" "$voice")

    if [[ ! -f "$path" ]]; then
        echo "Error: Annotation not found: $path" >&2
        return 1
    fi

    rm "$path"
    echo "Deleted: $path"
    _vox_annotate_update_meta "$doc_id"
}

vox_annotate_delete_doc() {
    local doc_id="$1"
    local force="${2:-}"

    if ! vox_annotate_exists "$doc_id"; then
        echo "Error: Document not found: $doc_id" >&2
        return 1
    fi

    local files=("$VOX_DB_DIR/${doc_id}".vox.*)
    local count=${#files[@]}

    if [[ "$force" != "--force" ]]; then
        echo "This will delete $count files for document $doc_id:"
        printf "  %s\n" "${files[@]}"
        echo ""
        read -rp "Continue? [y/N] " confirm
        [[ "$confirm" =~ ^[Yy] ]] || return 1
    fi

    rm -f "${files[@]}"
    echo "Deleted $count files for document $doc_id"
}

vox_annotate_clean_backups() {
    local doc_id="${1:-}"

    if [[ -n "$doc_id" ]]; then
        rm -f "$VOX_DB_DIR/${doc_id}".vox.*.bak
    else
        rm -f "$VOX_DB_DIR"/*.vox.*.bak
    fi

    echo "Cleaned backup files"
}

#==============================================================================
# VOICE OPERATIONS
#==============================================================================

vox_annotate_create_voice() {
    local doc_id="$1"
    local voice="$2"

    if ! vox_annotate_exists "$doc_id"; then
        echo "Error: Document not found: $doc_id" >&2
        return 1
    fi

    local path
    path=$(vox_annotate_path "$doc_id" "voice" "$voice")

    cat > "$path" <<EOF
{
    "version": "1.0",
    "doc_id": "$doc_id",
    "voice": "$voice",
    "created": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "modified": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "overrides": {
        "global": {
            "rate": 1.0,
            "pitch_shift": 1.0,
            "volume": 1.0
        },
        "phonemes": {},
        "words": {}
    }
}
EOF

    local meta_path="$VOX_DB_DIR/${doc_id}.vox.meta.json"
    if [[ -f "$meta_path" ]]; then
        local tmp=$(mktemp)
        jq --arg v "$voice" '.voices += [$v] | .voices |= unique' "$meta_path" > "$tmp" && mv "$tmp" "$meta_path"
    fi

    echo "Created voice override: $path"
}

vox_annotate_list_voices() {
    local doc_id="$1"

    find "$VOX_DB_DIR" -name "${doc_id}.vox.voice.*.json" -o \
                       -name "${doc_id}.vox.audio.*.mp3" -o \
                       -name "${doc_id}.vox.spans.*.json" 2>/dev/null | \
        sed -E 's/.*\.vox\.(voice|audio|spans)\.([^.]+)\..*/\2/' | \
        sort -u
}

#==============================================================================
# EXPORT & IMPORT
#==============================================================================

vox_annotate_export() {
    local doc_id="$1"
    local output="${2:-${doc_id}.vox.export.tar.gz}"

    if ! vox_annotate_exists "$doc_id"; then
        echo "Error: Document not found: $doc_id" >&2
        return 1
    fi

    local files=()
    for f in "$VOX_DB_DIR/${doc_id}".vox.*; do
        [[ -f "$f" ]] && files+=("$(basename "$f")")
    done

    if [[ ${#files[@]} -eq 0 ]]; then
        echo "Error: No files to export" >&2
        return 1
    fi

    (cd "$VOX_DB_DIR" && tar -czf "$output" "${files[@]}")

    echo "Exported ${#files[@]} files to: $output"
}

vox_annotate_import() {
    local archive="$1"
    local force="${2:-}"

    if [[ ! -f "$archive" ]]; then
        echo "Error: Archive not found: $archive" >&2
        return 1
    fi

    local files
    files=$(tar -tzf "$archive")
    local doc_id
    doc_id=$(echo "$files" | head -1 | sed -E 's/^([0-9]+)\.vox\..*/\1/')

    if vox_annotate_exists "$doc_id" && [[ "$force" != "--force" ]]; then
        echo "Document $doc_id already exists. Use --force to overwrite."
        return 1
    fi

    tar -xzf "$archive" -C "$VOX_DB_DIR"

    echo "Imported document: $doc_id"
    vox_annotate_list_doc "$doc_id"
}

vox_annotate_export_ssml() {
    local doc_id="$1"
    local voice="${2:-}"

    local source phonemes prosody
    source=$(vox_annotate_read "$doc_id" "source") || return 1
    phonemes=$(vox_annotate_read "$doc_id" "phonemes") || return 1
    prosody=$(vox_annotate_read "$doc_id" "prosody") || return 1

    local rate pitch
    rate=$(echo "$prosody" | jq -r '.global.rate // 1.0')
    pitch=$(echo "$prosody" | jq -r '.global.pitch_base_hz // 180')

    cat <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<speak version="1.1" xmlns="http://www.w3.org/2001/10/synthesis">
  <prosody rate="${rate}" pitch="${pitch}Hz">
EOF

    echo "$phonemes" | jq -r '.tokens[] | "<phoneme alphabet=\"ipa\" ph=\"\(.ipa)\">\(.word)</phoneme>"'

    cat <<EOF
  </prosody>
</speak>
EOF
}

vox_annotate_export_esto() {
    local doc_id="$1"

    local phonemes
    phonemes=$(vox_annotate_read "$doc_id" "phonemes") || return 1

    echo "# Generated from vox annotation $doc_id"
    echo "# $(date)"
    echo ""

    echo "$phonemes" | jq -r '
        .tokens[] |
        "# \(.word) [\(.ipa)]",
        (.phonemes | map("@phoneme \(.ipa) \(.duration_ms)ms") | join("\n")),
        "@pause 50ms",
        ""
    '
}

#==============================================================================
# VALIDATION
#==============================================================================

vox_annotate_validate() {
    local doc_id="$1"
    local errors=0

    echo "Validating document: $doc_id"
    echo ""

    local source_path
    source_path=$(vox_annotate_path "$doc_id" "source")
    if [[ -f "$source_path" ]]; then
        echo "✓ Source file exists"
    else
        echo "✗ Source file missing"
        ((errors++))
    fi

    local phonemes_path
    phonemes_path=$(vox_annotate_path "$doc_id" "phonemes")
    if [[ -f "$phonemes_path" ]]; then
        if jq -e . "$phonemes_path" &>/dev/null; then
            echo "✓ Phonemes JSON valid"

            local word_count token_count
            word_count=$(cat "$source_path" | wc -w | tr -d ' ')
            token_count=$(jq '.tokens | length' "$phonemes_path")

            if (( token_count == word_count )); then
                echo "✓ Word count matches ($word_count)"
            else
                echo "⚠ Word count mismatch: source=$word_count, phonemes=$token_count"
            fi

            local missing_ipa
            missing_ipa=$(jq '[.tokens[] | select(.ipa == null or .ipa == "")] | length' "$phonemes_path")
            if (( missing_ipa > 0 )); then
                echo "⚠ $missing_ipa words missing IPA"
            else
                echo "✓ All words have IPA"
            fi
        else
            echo "✗ Phonemes JSON invalid"
            ((errors++))
        fi
    else
        echo "⚠ Phonemes file missing (run G2P)"
    fi

    local prosody_path
    prosody_path=$(vox_annotate_path "$doc_id" "prosody")
    if [[ -f "$prosody_path" ]]; then
        if jq -e . "$prosody_path" &>/dev/null; then
            echo "✓ Prosody JSON valid"
        else
            echo "✗ Prosody JSON invalid"
            ((errors++))
        fi
    else
        echo "⚠ Prosody file missing"
    fi

    echo ""
    if (( errors > 0 )); then
        echo "Validation failed with $errors errors"
        return 1
    else
        echo "Validation passed"
        return 0
    fi
}

#==============================================================================
# LIST & QUERY
#==============================================================================

vox_annotate_list() {
    echo "VOX Annotations Database"
    echo "Location: $VOX_DB_DIR"
    echo ""

    local ids
    ids=$(vox_annotate_list_ids)

    if [[ -z "$ids" ]]; then
        echo "No documents found"
        return 0
    fi

    printf "%-12s %-20s %-8s %-8s %s\n" "ID" "CREATED" "WORDS" "VOICES" "SOURCE"
    printf "%s\n" "─────────────────────────────────────────────────────────────────"

    while read -r doc_id; do
        local meta_path="$VOX_DB_DIR/${doc_id}.vox.meta.json"
        local source_path=$(vox_annotate_path "$doc_id" "source")

        local created="" words="" voices="" source_preview=""

        if [[ -f "$meta_path" ]]; then
            created=$(jq -r '.created // ""' "$meta_path" | cut -d'T' -f1)
            words=$(jq -r '.stats.words // ""' "$meta_path")
            voices=$(jq -r '.voices | length' "$meta_path")
        fi

        if [[ -f "$source_path" ]]; then
            source_preview=$(head -c 30 "$source_path" | tr '\n' ' ')
            [[ ${#source_preview} -eq 30 ]] && source_preview+="..."
        fi

        printf "%-12s %-20s %-8s %-8s %s\n" \
            "$doc_id" "${created:-unknown}" "${words:-?}" "${voices:-0}" "$source_preview"
    done <<< "$ids"
}

vox_annotate_query() {
    local query_type="" query_value=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --word) query_type="word"; query_value="$2"; shift 2 ;;
            --ipa) query_type="ipa"; query_value="$2"; shift 2 ;;
            --voice) query_type="voice"; query_value="$2"; shift 2 ;;
            *) shift ;;
        esac
    done

    case "$query_type" in
        word)
            echo "Documents containing word: $query_value"
            for doc_id in $(vox_annotate_list_ids); do
                local path
                path=$(vox_annotate_path "$doc_id" "phonemes")
                if [[ -f "$path" ]] && jq -e --arg w "$query_value" '.tokens[] | select(.word == $w)' "$path" &>/dev/null; then
                    echo "  $doc_id"
                fi
            done
            ;;
        ipa)
            echo "Documents with IPA: $query_value"
            for doc_id in $(vox_annotate_list_ids); do
                local path
                path=$(vox_annotate_path "$doc_id" "phonemes")
                if [[ -f "$path" ]] && jq -e --arg i "$query_value" '.tokens[] | select(.ipa | contains($i))' "$path" &>/dev/null; then
                    echo "  $doc_id"
                fi
            done
            ;;
        voice)
            echo "Documents with voice: $query_value"
            for doc_id in $(vox_annotate_list_ids); do
                if [[ -f "$VOX_DB_DIR/${doc_id}.vox.voice.${query_value}.json" ]] || \
                   [[ -f "$VOX_DB_DIR/${doc_id}.vox.audio.${query_value}.mp3" ]]; then
                    echo "  $doc_id"
                fi
            done
            ;;
        *)
            echo "Usage: vox_annotate query --word <word> | --ipa <ipa> | --voice <voice>"
            ;;
    esac
}

#==============================================================================
# CLI INTERFACE
#==============================================================================

vox_annotate() {
    local cmd="${1:-help}"
    shift || true

    case "$cmd" in
        create|c)           vox_annotate_create "$@" ;;
        create-from-file|cf) vox_annotate_create_from_file "$@" ;;
        read|r)             vox_annotate_read "$@" ;;
        read-pretty|rp)     vox_annotate_read_pretty "$@" ;;
        get-phoneme|gp)     vox_annotate_get_phoneme "$@" ;;
        find-word|fw)       vox_annotate_find_word "$@" ;;
        update|u)           vox_annotate_update "$@" ;;
        update-phoneme|up)  vox_annotate_update_phoneme "$@" ;;
        update-duration|ud) vox_annotate_update_duration "$@" ;;
        update-ipa|ui)      vox_annotate_update_ipa "$@" ;;
        add-prosody|ap)     vox_annotate_add_prosody "$@" ;;
        delete|d)           vox_annotate_delete "$@" ;;
        delete-doc|dd)      vox_annotate_delete_doc "$@" ;;
        clean-backups|cb)   vox_annotate_clean_backups "$@" ;;
        create-voice|cv)    vox_annotate_create_voice "$@" ;;
        list-voices|lv)     vox_annotate_list_voices "$@" ;;
        export|e)           vox_annotate_export "$@" ;;
        import|i)           vox_annotate_import "$@" ;;
        export-ssml)        vox_annotate_export_ssml "$@" ;;
        export-esto)        vox_annotate_export_esto "$@" ;;
        validate|v)         vox_annotate_validate "$@" ;;
        list|ls)            vox_annotate_list ;;
        list-doc|ld)        vox_annotate_list_doc "$@" ;;
        query|q)            vox_annotate_query "$@" ;;
        help|--help|-h|*)
            cat <<'EOF'
vox_annotate - Annotation Storage CRUD Operations

Usage: vox_annotate <command> [options]

CREATE:
  create                  Create annotation from stdin
  create-from-file FILE   Create annotation from file

READ:
  read ID KIND [VOICE]    Read annotation to stdout
  read-pretty ID KIND     Read with jq formatting
  get-phoneme ID OFFSET   Get phoneme for word at offset
  find-word ID WORD       Find all phonemes for word

UPDATE:
  update ID KIND [VOICE]  Update annotation from stdin
  update-phoneme ID OFF FIELD VALUE
  update-duration ID WORD_OFF PH_IDX DUR
  update-ipa ID OFF IPA
  add-prosody ID START END [EMPHASIS] [PITCH]

DELETE:
  delete ID KIND [VOICE]  Delete specific annotation
  delete-doc ID [--force] Delete all annotations for doc
  clean-backups [ID]      Remove .bak files

VOICE:
  create-voice ID VOICE   Create voice override file
  list-voices ID          List voices for document

EXPORT & IMPORT:
  export ID [OUTPUT]      Export to tar.gz
  import ARCHIVE [--force]
  export-ssml ID [VOICE]  Export to SSML format
  export-esto ID          Export to esto format

VALIDATE:
  validate ID             Check annotation integrity

LIST & QUERY:
  list                    List all documents
  list-doc ID             List annotations for document
  query --word|--ipa|--voice VALUE

Examples:
  echo "Hello world" | vox_annotate create
  vox_annotate read 1760229927 phonemes | jq .
  vox_annotate list
EOF
            ;;
    esac
}

#==============================================================================
# EXPORTS
#==============================================================================

export -f vox_annotate
export -f vox_annotate_generate_id vox_annotate_path vox_annotate_parse_filename
export -f vox_annotate_list_ids vox_annotate_exists
export -f vox_annotate_create vox_annotate_create_from_file
export -f vox_annotate_read vox_annotate_read_pretty
export -f vox_annotate_get_phoneme vox_annotate_find_word
export -f vox_annotate_update vox_annotate_update_phoneme
export -f vox_annotate_update_duration vox_annotate_update_ipa
export -f vox_annotate_add_prosody
export -f vox_annotate_delete vox_annotate_delete_doc vox_annotate_clean_backups
export -f vox_annotate_create_voice vox_annotate_list_voices
export -f vox_annotate_export vox_annotate_import
export -f vox_annotate_export_ssml vox_annotate_export_esto
export -f vox_annotate_validate
export -f vox_annotate_list vox_annotate_list_doc vox_annotate_query
