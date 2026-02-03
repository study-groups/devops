#!/usr/bin/env bash
# tetra_qa.sh - Codebase indexer with run-based indexing and 4-stage answer resolution
#
# Commands:
#   tetra qa index [--rank A|B|C|D|all] [--modules mod1,mod2]
#   tetra qa ask "<question>"
#   tetra qa search <pattern>
#   tetra qa context [--rank A]
#   tetra qa status
#   tetra qa runs
#   tetra qa run <run-id>
#   tetra qa reindex
#   tetra qa cost [--day|--week|--total]

: "${TETRA_QA_SRC:=$TETRA_SRC/bash/tetra}"
: "${TETRA_QA_CHANNEL:=tetra}"

# Source ledger for token/cost tracking
source "$TETRA_SRC/bash/utils/ledger.sh"

# =============================================================================
# MODULE PRIORITY TABLE (Pareto ranking)
# =============================================================================

# Associative array: module -> rank (A=core, B=active, C=supporting, D=dormant)
declare -gA _TQA_MODULE_RANK=(
    [tetra]=A [qa]=A [rag]=A [org]=A [magicfind]=A
    [utils]=B [vox]=B [spaces]=B [deploy]=B [boot]=B
    [user]=C [tut]=C [terrain]=C [tsm]=C
)

# Ordered list per rank for deterministic indexing order
_tqa_modules_for_rank() {
    local tier="$1"
    local -a result=()
    case "$tier" in
        A)   result=(tetra qa rag org magicfind) ;;
        B)   result=(utils vox spaces deploy boot) ;;
        C)   result=(user tut terrain tsm) ;;
        D)   # Everything not in A/B/C — scan $TETRA_SRC/bash/
             local mod
             for dir in "$TETRA_SRC/bash"/*/; do
                 mod=$(basename "$dir")
                 [[ -v "_TQA_MODULE_RANK[$mod]" ]] && continue
                 result+=("$mod")
             done
             ;;
        all)
            result=($(_tqa_modules_for_rank A) $(_tqa_modules_for_rank B) \
                     $(_tqa_modules_for_rank C) $(_tqa_modules_for_rank D))
            ;;
    esac
    printf '%s\n' "${result[@]}"
}

# =============================================================================
# SIMILARITY (self-contained Jaccard, same algo as magicfind)
# =============================================================================

_tqa_tokenize() {
    local query="${1,,}"
    echo "$query" | tr -cs 'a-z0-9' '\n' | grep -E '^.{2,}$' | sort -u | tr '\n' ' '
}

_tqa_similarity() {
    local tokens1="$1"
    local tokens2="$2"
    local -a arr1 arr2
    read -ra arr1 <<< "$tokens1"
    read -ra arr2 <<< "$tokens2"

    [[ ${#arr1[@]} -eq 0 || ${#arr2[@]} -eq 0 ]] && { echo 0; return; }

    local -A set1 set2 union_set
    local t
    for t in "${arr1[@]}"; do set1[$t]=1; union_set[$t]=1; done
    for t in "${arr2[@]}"; do set2[$t]=1; union_set[$t]=1; done

    local intersection=0
    for t in "${!set1[@]}"; do
        [[ -v "set2[$t]" ]] && ((intersection++))
    done

    local union=${#union_set[@]}
    ((union > 0)) && echo $((intersection * 100 / union)) || echo 0
}

# =============================================================================
# INDEXER
# =============================================================================

# Extract Q&A pairs from a module and write to tetra channel
# Each module gets: function list, variable list, help text, file inventory
_tqa_index_module() {
    local mod="$1"
    local mod_src="$TETRA_SRC/bash/$mod"
    local channel_dir="$TETRA_DIR/qa/channels/$TETRA_QA_CHANNEL"

    [[ -d "$mod_src" ]] || { echo "  skip: $mod (no source dir)" >&2; return 1; }

    mkdir -p "$channel_dir"

    local ts files_count func_count line_count
    ts=$(date +%s)

    # Count files and lines
    local -a sh_files=()
    mapfile -t sh_files < <(find "$mod_src" -name '*.sh' -type f 2>/dev/null)
    files_count=${#sh_files[@]}
    [[ $files_count -eq 0 ]] && { echo "  skip: $mod (no .sh files)" >&2; return 1; }

    line_count=0
    for f in "${sh_files[@]}"; do
        local lc
        lc=$(wc -l < "$f")
        ((line_count += lc))
    done

    # Extract function names
    local -a funcs=()
    mapfile -t funcs < <(grep -h '^[a-zA-Z_][a-zA-Z0-9_]*()' "${sh_files[@]}" 2>/dev/null | sed 's/().*//' | sort -u)
    func_count=${#funcs[@]}

    # Generate Q&A pair: module overview
    local qa_id="${ts}-${mod}-overview"
    cat > "$channel_dir/${qa_id}.prompt" <<EOF
What does the $mod module do? What functions does it provide?
EOF
    cat > "$channel_dir/${qa_id}.answer" <<EOF
Module: $mod
Source: \$TETRA_SRC/bash/$mod
Files: $files_count .sh files, $line_count lines
Functions ($func_count): $(printf '%s ' "${funcs[@]}")
Rank: ${_TQA_MODULE_RANK[$mod]:-D}
EOF

    # Generate Q&A pair: file list
    qa_id="${ts}-${mod}-files"
    cat > "$channel_dir/${qa_id}.prompt" <<EOF
What files are in the $mod module?
EOF
    printf '%s\n' "${sh_files[@]}" | sed "s|$TETRA_SRC/||" > "$channel_dir/${qa_id}.answer"

    # Generate Q&A pair: function reference
    if [[ $func_count -gt 0 ]]; then
        qa_id="${ts}-${mod}-functions"
        cat > "$channel_dir/${qa_id}.prompt" <<EOF
What functions does $mod define? List all functions in the $mod module.
EOF
        printf '%s\n' "${funcs[@]}" > "$channel_dir/${qa_id}.answer"
    fi

    # Generate Q&A pairs for key functions (first 10 that have comments)
    local pair_count=0
    for func in "${funcs[@]}"; do
        [[ $pair_count -ge 10 ]] && break
        # Try to find function with preceding comment
        local func_file=""
        local func_comment=""
        for f in "${sh_files[@]}"; do
            local match
            match=$(grep -n "^${func}()" "$f" 2>/dev/null | head -1)
            if [[ -n "$match" ]]; then
                func_file="$f"
                local line_num="${match%%:*}"
                # Grab up to 3 comment lines above
                if ((line_num > 1)); then
                    local start=$((line_num - 3))
                    ((start < 1)) && start=1
                    func_comment=$(sed -n "${start},$((line_num-1))p" "$f" | grep '^#' | sed 's/^# *//')
                fi
                break
            fi
        done

        if [[ -n "$func_comment" ]]; then
            qa_id="${ts}-${mod}-fn-${func}"
            echo "How does ${func}() work in the $mod module?" > "$channel_dir/${qa_id}.prompt"
            {
                echo "Function: ${func}()"
                echo "Module: $mod"
                [[ -n "$func_file" ]] && echo "File: ${func_file#$TETRA_SRC/}"
                echo ""
                echo "$func_comment"
            } > "$channel_dir/${qa_id}.answer"
            ((pair_count++))
        fi
    done

    echo "  indexed: $mod ($files_count files, $func_count funcs, $((3 + pair_count)) QA pairs)"
}

# Main index command
# Usage: _tetra_qa_index [--rank A|B|C|D|all] [--modules mod1,mod2]
_tetra_qa_index() {
    local tier="A"
    local -a explicit_modules=()

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --rank) tier="$2"; shift 2 ;;
            --modules) IFS=',' read -ra explicit_modules <<< "$2"; shift 2 ;;
            *) shift ;;
        esac
    done

    local -a modules=()
    if [[ ${#explicit_modules[@]} -gt 0 ]]; then
        modules=("${explicit_modules[@]}")
    else
        mapfile -t modules < <(_tqa_modules_for_rank "$tier")
    fi

    if [[ ${#modules[@]} -eq 0 ]]; then
        echo "No modules to index for rank $tier" >&2
        return 1
    fi

    # Create run
    local run_id
    run_id=$(date +%Y%m%d-%H%M%S)
    local run_dir="$TETRA_DIR/qa/channels/$TETRA_QA_CHANNEL/runs/$run_id"
    mkdir -p "$run_dir"

    local started
    started=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

    echo "Indexing ${#modules[@]} modules (rank $tier) — run $run_id"
    echo ""

    local indexed_count=0
    local -a indexed_modules=()
    for mod in "${modules[@]}"; do
        if _tqa_index_module "$mod"; then
            ((indexed_count++))
            indexed_modules+=("$mod")
        fi
    done

    local finished
    finished=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

    # Count total QA pairs in channel
    local channel_dir="$TETRA_DIR/qa/channels/$TETRA_QA_CHANNEL"
    local qa_count=0
    qa_count=$(ls "$channel_dir"/*.prompt 2>/dev/null | wc -l | tr -d ' ')

    # Write run metadata
    local modules_json
    modules_json=$(printf '%s\n' "${indexed_modules[@]}" | jq -R . | jq -s .)
    jq -nc \
        --arg run_id "$run_id" \
        --arg started "$started" \
        --arg finished "$finished" \
        --argjson modules "$modules_json" \
        --arg rank "$tier" \
        --argjson qa_total "$qa_count" \
        --argjson modules_indexed "$indexed_count" \
        '{run_id:$run_id, started:$started, finished:$finished,
          modules_indexed:$modules, rank:$rank,
          queries_total:$qa_total, modules_count:$modules_indexed,
          answered_by:{index_hit:0, magicfind_cache:0, local_context:0, llm_api:0},
          tokens:{input:0, output:0, total:0},
          cost:{estimated_usd:0, model:"none", rates:{}}}' \
        > "$run_dir/run.json"

    echo ""
    echo "Run $run_id complete: $indexed_count modules, $qa_count QA pairs total"
}

# =============================================================================
# 4-STAGE QUERY RESOLUTION
# =============================================================================

# Stage 1: Scan .prompt files in tetra channel for Jaccard match
_tqa_tier1_index_hit() {
    local question="$1"
    local channel_dir="$TETRA_DIR/qa/channels/$TETRA_QA_CHANNEL"
    local q_tokens
    q_tokens=$(_tqa_tokenize "$question")

    local best_file="" best_score=0

    for f in "$channel_dir"/*.prompt; do
        [[ -f "$f" ]] || continue
        local stored
        stored=$(<"$f")
        local s_tokens
        s_tokens=$(_tqa_tokenize "$stored")
        local score
        score=$(_tqa_similarity "$q_tokens" "$s_tokens")

        if ((score > best_score)); then
            best_score=$score
            best_file="$f"
        fi
    done

    if ((best_score >= 70)); then
        local answer_file="${best_file%.prompt}.answer"
        if [[ -f "$answer_file" ]]; then
            echo "[Stage 1: index hit, ${best_score}% match, 0 tokens, \$0]" >&2
            cat "$answer_file"
            return 0
        fi
    fi
    return 1
}

# Stage 2: magicfind cache lookup
_tqa_tier2_magicfind() {
    local question="$1"

    # Check if magicfind is loaded
    if ! declare -f _mf_db_find_similar &>/dev/null; then
        return 1
    fi

    local match_ts
    match_ts=$(_mf_db_find_similar "$question" 70)
    if [[ -n "$match_ts" ]]; then
        local result
        result=$(_mf_db_get "$match_ts" "result")
        if [[ -n "$result" ]]; then
            echo "[Stage 2: magicfind cache, 0 tokens, \$0]" >&2
            echo "$result"
            return 0
        fi
    fi
    return 1
}

# Stage 3: Local context assembly (grep + file ranking)
_tqa_tier3_local_context() {
    local question="$1"
    local -a keywords=()
    read -ra keywords <<< "$(_tqa_tokenize "$question")"

    [[ ${#keywords[@]} -eq 0 ]] && return 1

    # Search source files for keyword matches
    local -A file_scores=()
    for kw in "${keywords[@]}"; do
        local -a hits=()
        mapfile -t hits < <(grep -rl --include='*.sh' "$kw" "$TETRA_SRC/bash/" 2>/dev/null | head -20)
        for f in "${hits[@]}"; do
            local rel="${f#$TETRA_SRC/}"
            file_scores[$rel]=$(( ${file_scores[$rel]:-0} + 1 ))
        done
    done

    [[ ${#file_scores[@]} -eq 0 ]] && return 1

    # Sort by score, take top 5
    local -a ranked=()
    for f in "${!file_scores[@]}"; do
        ranked+=("${file_scores[$f]}:$f")
    done
    mapfile -t ranked < <(printf '%s\n' "${ranked[@]}" | sort -t: -k1 -rn | head -5)

    local context=""
    local total_bytes=0
    for entry in "${ranked[@]}"; do
        local score="${entry%%:*}"
        local file="${entry#*:}"
        local full="$TETRA_SRC/$file"
        [[ -f "$full" ]] || continue
        local bytes
        bytes=$(wc -c < "$full")
        # Cap at ~32k bytes total to keep context reasonable
        ((total_bytes + bytes > 32000)) && break
        ((total_bytes += bytes))
        context+="--- $file (relevance: $score) ---"$'\n'
        context+=$(<"$full")
        context+=$'\n\n'
    done

    local tokens
    tokens=$(_ledger_estimate_tokens "$total_bytes")

    echo "[Stage 3: local context, ${#ranked[@]} files, ~$tokens tokens, \$0 (session)]" >&2
    echo "Based on source files matching your query:"
    echo ""
    for entry in "${ranked[@]}"; do
        local score="${entry%%:*}"
        local file="${entry#*:}"
        printf "  [%s matches] %s\n" "$score" "$file"
    done
    echo ""
    echo "Context assembled: ~$tokens tokens from $total_bytes bytes"
    echo "Use 'tetra qa context' to export full context for a Claude session."
    return 0
}

# Stage 4: LLM API call with context stuffing
_tqa_tier4_llm_query() {
    local question="$1"

    # Gather context
    local -a keywords=()
    read -ra keywords <<< "$(_tqa_tokenize "$question")"

    local -A file_scores=()
    for kw in "${keywords[@]}"; do
        local -a hits=()
        mapfile -t hits < <(grep -rl --include='*.sh' "$kw" "$TETRA_SRC/bash/" 2>/dev/null | head -20)
        for f in "${hits[@]}"; do
            local rel="${f#$TETRA_SRC/}"
            file_scores[$rel]=$(( ${file_scores[$rel]:-0} + 1 ))
        done
    done

    local -a ranked=()
    for f in "${!file_scores[@]}"; do
        ranked+=("${file_scores[$f]}:$f")
    done
    mapfile -t ranked < <(printf '%s\n' "${ranked[@]}" | sort -t: -k1 -rn | head -8)

    # Get model from qa engine config or default
    local model
    model=$(_get_qa_engine 2>/dev/null || echo "gpt-4o-latest")

    local ctx_window
    ctx_window=$(_ledger_context_window "$model")
    : "${ctx_window:=128000}"
    # Reserve 4k for output, use 80% of remainder
    local max_input_tokens=$(( (ctx_window - 4000) * 80 / 100 ))
    local max_bytes=$(( max_input_tokens * 4 ))

    local context=""
    local total_bytes=0
    for entry in "${ranked[@]}"; do
        local file="${entry#*:}"
        local full="$TETRA_SRC/$file"
        [[ -f "$full" ]] || continue
        local bytes
        bytes=$(wc -c < "$full")
        ((total_bytes + bytes > max_bytes)) && break
        ((total_bytes += bytes))
        context+="--- $file ---"$'\n'
        context+=$(<"$full")
        context+=$'\n\n'
    done

    local input_tokens
    input_tokens=$(_ledger_estimate_tokens "$total_bytes")
    local output_estimate=1000

    _ledger_show_estimate "$input_tokens" "$output_estimate" "$model"

    # Use qq to send the query with context
    local full_prompt="Given this codebase context, answer the question.

CONTEXT:
$context

QUESTION: $question"

    # Check if qa modules are loaded
    if [[ "${QA_MODULES_LOADED:-false}" != "true" ]]; then
        source "$TETRA_SRC/bash/qa/qa.sh"
        qa_source_modules
        export QA_MODULES_LOADED=true
    fi

    echo "[Stage 4: LLM API ($model), ~$input_tokens input tokens]" >&2

    _qq_channel "$TETRA_QA_CHANNEL" "$full_prompt"
    local rc=$?

    # Log to ledger
    _ledger_log "${model%%/*}" "$model" "$input_tokens" "$output_estimate" "tetra-qa-ask"

    return $rc
}

# Main ask command — 4-stage resolution
_tetra_qa_ask() {
    local question="$*"
    [[ -z "$question" ]] && { echo "Usage: tetra qa ask \"<question>\"" >&2; return 1; }

    # Stage 1: Index hit
    _tqa_tier1_index_hit "$question" && return 0

    # Stage 2: Magicfind cache
    _tqa_tier2_magicfind "$question" && return 0

    # Stage 3: Local context
    _tqa_tier3_local_context "$question" && return 0

    # Stage 4: LLM API
    _tqa_tier4_llm_query "$question"
}

# =============================================================================
# SEARCH
# =============================================================================

_tetra_qa_search() {
    local pattern="$1"
    [[ -z "$pattern" ]] && { echo "Usage: tetra qa search <pattern>" >&2; return 1; }

    local channel_dir="$TETRA_DIR/qa/channels/$TETRA_QA_CHANNEL"
    [[ -d "$channel_dir" ]] || { echo "No index. Run: tetra qa index" >&2; return 1; }

    grep -l "$pattern" "$channel_dir"/*.prompt "$channel_dir"/*.answer 2>/dev/null |
    while read -r f; do
        local base="${f%.*}"
        local ext="${f##*.}"
        local id
        id=$(basename "$base")
        local prompt=""
        [[ -f "${base}.prompt" ]] && prompt=$(head -n 1 "${base}.prompt")
        printf "%-40s [%s] %s\n" "$id" "$ext" "${prompt:0:60}"
    done
}

# =============================================================================
# CONTEXT EXPORT
# =============================================================================

_tetra_qa_context() {
    local tier="A"
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --rank) tier="$2"; shift 2 ;;
            *) shift ;;
        esac
    done

    local -a modules=()
    mapfile -t modules < <(_tqa_modules_for_rank "$tier")

    echo "# Tetra Codebase Context (Rank $tier)"
    echo ""
    echo "Modules: ${modules[*]}"
    echo ""

    local total_bytes=0
    for mod in "${modules[@]}"; do
        local mod_src="$TETRA_SRC/bash/$mod"
        [[ -d "$mod_src" ]] || continue

        echo "## Module: $mod"
        echo ""

        local -a sh_files=()
        mapfile -t sh_files < <(find "$mod_src" -name '*.sh' -type f 2>/dev/null | sort)

        for f in "${sh_files[@]}"; do
            local rel="${f#$TETRA_SRC/}"
            local bytes
            bytes=$(wc -c < "$f")
            ((total_bytes += bytes))
            echo "### $rel"
            echo '```bash'
            cat "$f"
            echo '```'
            echo ""
        done
    done

    local tokens
    tokens=$(_ledger_estimate_tokens "$total_bytes")
    echo "---"
    echo "Total: $total_bytes bytes, ~$tokens tokens" >&2
}

# =============================================================================
# STATUS & RUNS
# =============================================================================

_tetra_qa_status() {
    local channel_dir="$TETRA_DIR/qa/channels/$TETRA_QA_CHANNEL"
    local runs_dir="$channel_dir/runs"

    echo "tetra qa status"
    echo ""

    if [[ ! -d "$channel_dir" ]]; then
        echo "  No index. Run: tetra qa index"
        return 0
    fi

    local qa_count=0
    qa_count=$(ls "$channel_dir"/*.prompt 2>/dev/null | wc -l | tr -d ' ')
    echo "  QA pairs: $qa_count"
    echo "  Channel:  $TETRA_QA_CHANNEL"
    echo "  Path:     $channel_dir"
    echo ""

    # Last run
    if [[ -d "$runs_dir" ]]; then
        local last_run
        last_run=$(ls -1d "$runs_dir"/*/ 2>/dev/null | sort | tail -1)
        if [[ -n "$last_run" && -f "$last_run/run.json" ]]; then
            local run_id
            run_id=$(jq -r '.run_id' "$last_run/run.json")
            local mods
            mods=$(jq -r '.modules_indexed | join(", ")' "$last_run/run.json")
            local finished
            finished=$(jq -r '.finished' "$last_run/run.json")
            echo "  Last run: $run_id"
            echo "  Modules:  $mods"
            echo "  Finished: $finished"
        fi
    fi

    local run_count=0
    [[ -d "$runs_dir" ]] && run_count=$(ls -1d "$runs_dir"/*/ 2>/dev/null | wc -l | tr -d ' ')
    echo "  Runs:     $run_count"
}

_tetra_qa_runs() {
    local runs_dir="$TETRA_DIR/qa/channels/$TETRA_QA_CHANNEL/runs"
    [[ -d "$runs_dir" ]] || { echo "No runs. Run: tetra qa index" >&2; return 1; }

    printf "%-18s %-6s %-5s %s\n" "RUN ID" "RANK" "MODS" "FINISHED"
    for d in "$runs_dir"/*/; do
        [[ -f "$d/run.json" ]] || continue
        jq -r '[.run_id, (.rank // .tier), (.modules_count|tostring), .finished] | join("\t")' "$d/run.json" |
        while IFS=$'\t' read -r id rank mods finished; do
            printf "%-18s %-6s %-5s %s\n" "$id" "$rank" "$mods" "$finished"
        done
    done
}

_tetra_qa_run_detail() {
    local run_id="$1"
    [[ -z "$run_id" ]] && { echo "Usage: tetra qa run <run-id>" >&2; return 1; }

    local run_file="$TETRA_DIR/qa/channels/$TETRA_QA_CHANNEL/runs/$run_id/run.json"
    [[ -f "$run_file" ]] || { echo "Run not found: $run_id" >&2; return 1; }

    jq . "$run_file"
}

# =============================================================================
# REINDEX
# =============================================================================

_tetra_qa_reindex() {
    local channel_dir="$TETRA_DIR/qa/channels/$TETRA_QA_CHANNEL"

    if [[ -d "$channel_dir" ]]; then
        # Remove indexed QA pairs but keep runs
        find "$channel_dir" -maxdepth 1 -name '*.prompt' -delete 2>/dev/null
        find "$channel_dir" -maxdepth 1 -name '*.answer' -delete 2>/dev/null
        find "$channel_dir" -maxdepth 1 -name '*.metadata.json' -delete 2>/dev/null
        echo "Cleared existing index entries."
    fi

    _tetra_qa_index "$@"
}

# =============================================================================
# COST (delegates to ledger)
# =============================================================================

_tetra_qa_cost() {
    _ledger_init
    _ledger_summary "${1:---total}"
}

# =============================================================================
# TESTORG FIXTURE MANAGEMENT
# =============================================================================

: "${NH_DIR:=$HOME/nh}"

_tetra_qa_testorg() {
    local action="${1:-status}"
    shift 2>/dev/null || true

    local fixture_src="$TETRA_SRC/tests/startup/fixtures/testorg-digocean.json"
    local target_dir="$NH_DIR/testorg"
    local target_file="$target_dir/digocean.json"

    case "$action" in
        install)
            if [[ ! -f "$fixture_src" ]]; then
                echo "Error: Fixture not found: $fixture_src" >&2
                return 1
            fi

            if [[ ! -d "$NH_DIR" ]]; then
                echo "NH_DIR does not exist: $NH_DIR"
                echo -n "Create it? [Y/n]: "
                read -r response
                if [[ "$response" =~ ^[Nn]$ ]]; then
                    echo "Cancelled"
                    return 1
                fi
                mkdir -p "$NH_DIR"
            fi

            mkdir -p "$target_dir"
            cp "$fixture_src" "$target_file"
            echo "Installed: $target_file"
            echo ""
            echo "Fixture: 3 droplets (dev/qa/prod), RFC 5737 test IPs"
            echo "Domain:  testorg.example.com"
            echo ""
            echo "Next: nhb_list $target_file"
            ;;

        remove)
            if [[ ! -d "$target_dir" ]]; then
                echo "testorg not installed at $target_dir"
                return 0
            fi

            if [[ -f "$target_file" ]]; then
                rm -rf "$target_dir"
                echo "Removed: $target_dir"
            else
                echo "Warning: $target_dir exists but has no digocean.json"
                echo "Remove manually if needed: rm -rf $target_dir"
                return 1
            fi
            ;;

        status)
            echo "Testorg Fixture"
            echo ""
            echo "Source:  $fixture_src"
            if [[ -f "$fixture_src" ]]; then
                echo "         (present in repo)"
            else
                echo "         (MISSING)"
            fi
            echo ""
            echo "NH_DIR:  $NH_DIR"
            echo "Target:  $target_file"
            if [[ -f "$target_file" ]]; then
                local droplets
                droplets=$(jq -c '.[] | select(.Droplets) | .Droplets | length' "$target_file" 2>/dev/null)
                echo "         (installed, $droplets droplets)"
            else
                echo "         (not installed)"
                echo ""
                echo "Install: tetra qa testorg install"
            fi
            ;;

        *)
            echo "Usage: tetra qa testorg [install|remove|status]"
            return 1
            ;;
    esac
}

# =============================================================================
# TEST RUNNER
# =============================================================================

_tetra_qa_run_tests() {
    local suite="${1:-all}"
    local test_dir="$TETRA_SRC/tests/startup"

    case "$suite" in
        all)         bash "$test_dir/run-all.sh" ;;
        nh-bridge|nhb)    bash "$test_dir/test-nh-bridge.sh" ;;
        org-build|build)  bash "$test_dir/test-org-build.sh" ;;
        org-parity|parity) bash "$test_dir/test-org-parity.sh" ;;
        init|lifecycle)    bash "$test_dir/test-init-lifecycle.sh" ;;
        *)
            echo "Unknown suite: $suite"
            echo "Available: all, nh-bridge, org-build, org-parity, init"
            return 1
            ;;
    esac
}

# =============================================================================
# MAIN DISPATCHER
# =============================================================================

_tetra_qa() {
    local cmd="${1:-help}"
    shift 2>/dev/null || true

    case "$cmd" in
        index)      _tetra_qa_index "$@" ;;
        ask)        _tetra_qa_ask "$@" ;;
        search)     _tetra_qa_search "$@" ;;
        context)    _tetra_qa_context "$@" ;;
        status|s)   _tetra_qa_status ;;
        runs)       _tetra_qa_runs ;;
        run)        _tetra_qa_run_detail "$@" ;;
        reindex)    _tetra_qa_reindex "$@" ;;
        cost)       _tetra_qa_cost "$@" ;;
        testorg)    _tetra_qa_testorg "$@" ;;
        test|tests) _tetra_qa_run_tests "$@" ;;
        help|h|--help|-h)
            cat <<'EOF'
tetra qa — Codebase indexer with 4-stage answer resolution

COMMANDS
  index [--rank A|B|C|D|all]   Index modules at given priority rank
  index --modules qa,rag,org   Index specific modules
  ask "<question>"             4-stage query resolution
  search <pattern>             Grep tetra channel
  context [--rank A]           Dump index as markdown for Claude sessions
  status                       Index stats, last run summary
  runs                         List all runs with stats
  run <run-id>                 Show specific run details
  reindex                      Clear index, re-run
  cost [--day|--week|--total]  Cost summary from ledger
  testorg install|remove|status  Manage testorg fixture in $NH_DIR
  test [suite]                   Run startup tests (all|nh-bridge|org-build|org-parity|init)

RANKS (module priority)
  A  tetra, qa, rag, org, magicfind       (core)
  B  utils, vox, spaces, deploy, boot     (active)
  C  user, tut, terrain, tsm              (supporting)
  D  everything else                      (dormant)

STAGES (answer resolution)
  1. Index hit (Jaccard >= 70%, free)
  2. Magicfind cache (free)
  3. Local context assembly (session cost)
  4. LLM API with context stuffing (tracked cost)
EOF
            ;;
        *)
            echo "Unknown: tetra qa $cmd" >&2
            echo "Run 'tetra qa help' for usage." >&2
            return 1
            ;;
    esac
}

# =============================================================================
# EXPORTS
# =============================================================================

export TETRA_QA_CHANNEL
export -f _tetra_qa _tetra_qa_index _tetra_qa_ask _tetra_qa_search
export -f _tetra_qa_context _tetra_qa_status _tetra_qa_runs _tetra_qa_run_detail
export -f _tetra_qa_reindex _tetra_qa_cost
export -f _tqa_modules_for_rank _tqa_index_module
export -f _tqa_tokenize _tqa_similarity
export -f _tqa_tier1_index_hit _tqa_tier2_magicfind _tqa_tier3_local_context _tqa_tier4_llm_query
export -f _tetra_qa_testorg _tetra_qa_run_tests
