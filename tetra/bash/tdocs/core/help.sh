#!/usr/bin/env bash

# TDOCS Help System - Uses TDS theme colors for consistency

# ============================================================================
# TDS Color Helpers (mirrors tds.sh pattern)
# ============================================================================

# Get color from palette - returns ANSI escape sequence
_tdocs_help_color() {
    local hex="$1"
    if [[ -z "$hex" ]]; then
        return
    fi
    # Use text_color if available (from TDS/color system)
    if declare -f text_color >/dev/null 2>&1; then
        text_color "$hex"
    fi
}

_tdocs_help_reset() {
    if declare -f reset_color >/dev/null 2>&1; then
        reset_color
    else
        printf '\033[0m'
    fi
}

# Print colored text inline (no newline)
_tdocs_c() {
    local hex="$1"
    local text="$2"
    _tdocs_help_color "$hex"
    printf "%s" "$text"
    _tdocs_help_reset
}

# Print action words cycling through VERBS palette
_tdocs_verbs() {
    local i=0
    for word in "$@"; do
        _tdocs_help_color "${VERBS_PRIMARY[$((i % 8))]}"
        printf "%s " "$word"
        ((i++))
    done
    _tdocs_help_reset
}

# Helper functions using TDS palettes
_tdocs_help_section() {
    _tdocs_c "${ENV_PRIMARY[0]}" "$1"
    echo
}

_tdocs_help_subsection() {
    _tdocs_c "${ENV_PRIMARY[1]}" "$1"
    echo
}

_tdocs_help_cmd() {
    local cmd="$1"
    local desc="$2"
    printf "  "
    _tdocs_c "${MODE_PRIMARY[0]}" "$(printf '%-20s' "$cmd")"
    printf " "
    _tdocs_c "${NOUNS_PRIMARY[6]}" "$desc"
    echo
}

_tdocs_help_example() {
    local comment="$1"
    local example="$2"
    printf "  "
    _tdocs_c "${NOUNS_PRIMARY[5]}" "# $comment"
    echo
    printf "  "
    _tdocs_c "${ENV_PRIMARY[2]}" "$example"
    echo
}

# Main help (minimal zen - under 30 lines)
tdocs_help_main() {
    echo
    _tdocs_help_section "tdocs - semantic document browser"
    echo
    _tdocs_help_subsection "Prompt Format:"
    # Build colored prompt example using TDS colors
    printf "  "
    _tdocs_c "${NOUNS_PRIMARY[6]}" "["
    _tdocs_c "${MODE_PRIMARY[1]}" "total"
    printf " "
    _tdocs_c "${MODE_PRIMARY[0]}" "{"
    _tdocs_c "${ENV_PRIMARY[1]}" "modules"
    _tdocs_c "${MODE_PRIMARY[0]}" "}"
    printf " "
    _tdocs_c "${NOUNS_PRIMARY[6]}" "("
    _tdocs_c "${ENV_PRIMARY[2]}" "type | intent"
    _tdocs_c "${NOUNS_PRIMARY[6]}" ")"
    _tdocs_c "${NOUNS_PRIMARY[6]}" "]"
    printf " "
    _tdocs_c "${NOUNS_PRIMARY[6]}" "["
    _tdocs_c "${VERBS_PRIMARY[3]}" "lifecycle"
    _tdocs_c "${NOUNS_PRIMARY[6]}" "]"
    printf " "
    _tdocs_c "${MODE_PRIMARY[1]}" "n"
    printf " >\n"
    echo

    cat <<EOF

$(_tdocs_help_subsection "Commands:")
$(_tdocs_help_cmd "ls|list [-l]" "list documents (detailed with -l)")
$(_tdocs_help_cmd "find <terms>" "find by module/type (e.g., find midi osc spec)")
$(_tdocs_help_cmd "search <query>" "full-text search indexed documents")
$(_tdocs_help_cmd "view|v <n>" "show doc #n from ls")
$(_tdocs_help_cmd "module <name>" "show module docs")

$(_tdocs_help_cmd "add <file>" "add metadata (smart defaults)")
$(_tdocs_help_cmd "scan" "index all unindexed documents")
$(_tdocs_help_cmd "doctor [--fix]" "check database health")
$(_tdocs_help_cmd "audit" "find docs without metadata")
$(_tdocs_help_cmd "review [wip|all]" "interactive doc review/organize")

$(_tdocs_help_cmd "filter module <m>" "scope to module")
$(_tdocs_help_cmd "filter type <t>" "filter by type")
$(_tdocs_help_cmd "filter lifecycle <l>" "filter by lifecycle (D/W/S/C/X)")
$(_tdocs_help_cmd "clear" "clear all filters")

$(_tdocs_help_cmd "r t a" "sort: relevance|time|alpha")

EOF

    _tdocs_help_subsection "Document Taxonomy:"
    echo "  Type (NOUN)      - what it IS:       spec, guide, investigation,"
    echo "                                        reference, plan, summary, scratch,"
    echo "                                        bug-fix, refactor"
    echo "  Intent (VERB)    - what it DOES:     define, instruct, analyze,"
    echo "                                        document, propose, track"
    echo "  Lifecycle        - maturity stage:"
    printf "    "; _tdocs_c "${VERBS_PRIMARY[0]}" "C"; echo " Canonical  - authoritative, system of record"
    printf "    "; _tdocs_c "${VERBS_PRIMARY[1]}" "S"; echo " Stable     - proven, reviewed, reliable"
    printf "    "; _tdocs_c "${VERBS_PRIMARY[2]}" "W"; echo " Working    - functional, active development [DEFAULT]"
    printf "    "; _tdocs_c "${VERBS_PRIMARY[3]}" "D"; echo " Draft      - work in progress, unreviewed"
    printf "    "; _tdocs_c "${VERBS_PRIMARY[4]}" "X"; echo " Archived   - superseded, do not use"
    echo
    _tdocs_help_subsection "Examples:"
    _tdocs_help_example "All modules, no filters" "[92 {*} ()] [W:183] 92 >"
    _tdocs_help_example "midi+osc modules, spec type" "[92 {midi osc} (spec)] [W:183] 64 >"
    _tdocs_help_example "midi module, spec|define, sorted by time" "[92 {midi} (spec | define)] [C:3 S:12] time:15 >"
    echo
    echo "Display format: filename  Lifecycle  type  intent  tags"
    echo
    printf "More: "; _tdocs_c "${MODE_PRIMARY[0]}" "help <topic>"; printf "  "; _tdocs_c "${NOUNS_PRIMARY[5]}" "review, lifecycle, taxonomy, filter, types, doctor"; echo
}

# Helper for inline command in heredoc (returns colored string)
_tdocs_inline_cmd() {
    _tdocs_c "${MODE_PRIMARY[0]}" "$1"
}

# Module command help
tdocs_help_module() {
    echo
    _tdocs_help_section "USAGE"
    printf "  "; _tdocs_inline_cmd "module"; echo " <module_name>"

    cat <<EOF

$(_tdocs_help_section "DESCRIPTION")
  Show all documentation for a specific module, including:
  - Completeness level (L0-L4)
  - Specifications
  - Examples
  - Standards implemented
  - Integration points

$(_tdocs_help_section "EXAMPLES")
$(_tdocs_help_example "View tubes module docs" "module tubes")
$(_tdocs_help_example "View tdocs module docs" "module tdocs")
$(_tdocs_help_example "View rag module docs" "module rag")

$(_tdocs_help_section "COMPLETENESS LEVELS")
  L0 - None      No documentation
  L1 - Minimal   Basic README
  L2 - Working   Functional with basic integration
  L3 - Complete  Full docs, tests, examples
  L4 - Exemplar  Gold standard, full integration

$(_tdocs_help_section "SEE ALSO")
  spec <module>    View module specification
  audit-specs      Check which modules have specs
EOF
}

# Spec command help
tdocs_help_spec() {
    echo
    _tdocs_help_section "USAGE"
    printf "  "; _tdocs_inline_cmd "spec"; echo " <module_name>"

    cat <<EOF

$(_tdocs_help_section "DESCRIPTION")
  View the specification document for a module.

  Specifications track:
  - Module architecture
  - Completeness level
  - Standards implemented (TCS, TAS, TRS, etc.)
  - Modules integrated with
  - API contracts

$(_tdocs_help_section "EXAMPLES")
$(_tdocs_help_example "View tubes specification" "spec tubes")
$(_tdocs_help_example "View tdocs specification" "spec tdocs")

$(_tdocs_help_section "SEE ALSO")
  module <name>    Show all module documentation
  audit-specs      List all module specifications
EOF
}

# Filter command help
tdocs_help_filter() {
    echo
    _tdocs_help_section "USAGE"
    printf "  "; _tdocs_inline_cmd "filter"; echo " [module|type|intent|lifecycle|level|temporal|clear] <value>"

    cat <<EOF

$(_tdocs_help_section "OPTIONS")
  module <name>     Filter by module (tdocs, rag, repl, etc.)
  type <t>          Filter by type (spec, guide, investigation, etc.)
  intent <i>        Filter by intent (define, instruct, analyze, etc.)
  lifecycle <l>     Filter by lifecycle (D, W, S, C, X)
  level <n>         Filter by completeness level (0-4)
  temporal          Show only temporal documents
  clear             Clear all filters

$(_tdocs_help_section "DESCRIPTION")
  Filters affect: ls, search, evidence commands
  Filters stack - you can apply multiple filters
  Current filters shown in prompt

$(_tdocs_help_section "EXAMPLES")
$(_tdocs_help_example "Show only specifications" "filter type specification")
$(_tdocs_help_example "Show docs that define things" "filter intent define")
$(_tdocs_help_example "Show canonical docs" "filter lifecycle C")
$(_tdocs_help_example "Show stable and canonical" "filter lifecycle S,C")
$(_tdocs_help_example "Show tubes module docs" "filter module tubes")
$(_tdocs_help_example "Combine filters" "filter type guide; filter lifecycle S")
$(_tdocs_help_example "Clear all filters" "filter clear")

$(_tdocs_help_section "SEE ALSO")
  help taxonomy    Complete taxonomy reference
  help types       Document types
EOF
}

# Demo command help
tdocs_help_demo() {
    echo
    _tdocs_help_section "USAGE"
    printf "  "; _tdocs_inline_cmd "demo"; echo " [slow|medium|fast]"

    cat <<EOF

$(_tdocs_help_section "DESCRIPTION")
  Run an interactive demonstration of TDOCS features:
  - Document discovery and initialization
  - Module-aware metadata
  - Type classification
  - Completeness levels
  - Search and filtering
  - RAG integration

$(_tdocs_help_section "EXAMPLES")
$(_tdocs_help_example "Run demo at default speed" "demo")
$(_tdocs_help_example "Run slower demo" "demo slow")
$(_tdocs_help_example "Run quick demo" "demo fast")

$(_tdocs_help_section "FEATURES SHOWN")
  • Document type auto-detection (specification, temporal, etc.)
  • Module completeness tracking (L0-L4)
  • Metadata fields (implements, integrates, completeness_level)
  • Filtering and search
  • Specification auditing
EOF
}

# Rank command help
tdocs_help_rank() {
    cat <<EOF
$(_tdocs_help_section "RANKING FORMULA")

  base (by type)      reference=1.0  guide=0.6  notes=0.3
  + length            0.01-0.02 for substantial docs (>500 words)
  + metadata          0.01 if well-tagged (3+ tags)
  + recency boost     0.05 * exp(-days/14) for fresh notes

Fresh notes get priority for ~2 weeks, then settle at base.
Timeless docs don't decay.

$(_tdocs_help_section "EXAMPLES")
  reference spec, timeless         → 1.05
  guide, timeless, well-tagged     → 0.63
  notes, created today             → 0.35 (boosted!)
  notes, 2 months old              → 0.30 (settled)

$(_tdocs_help_section "USAGE")
$(_tdocs_help_cmd "tdocs rank <file>" "Show ranking breakdown")
EOF
}

# Types help
tdocs_help_types() {
    echo
    _tdocs_help_section "DOCUMENT TYPES (NOUNS)"
    echo
    # Print types with VERBS palette cycling
    local i=0
    local types=("specification" "standard" "reference" "guide" "example" "integration" "investigation" "bug-fix" "refactor" "plan" "summary" "scratch")
    local descs=("Formal specifications (authoritative)" "Standard/protocol definitions" "Reference material (lookup)" "How-to guides (instructional)" "Example/sample code" "Integration guides" "Analysis and research" "Bug fix documentation" "Refactoring notes" "Plans and roadmaps" "Summaries and overviews" "Scratch/temporary notes")
    for j in "${!types[@]}"; do
        printf "  "
        _tdocs_c "${VERBS_PRIMARY[$((i % 8))]}" "$(printf '%-14s' "${types[$j]}")"
        _tdocs_c "${NOUNS_PRIMARY[6]}" "${descs[$j]}"
        echo
        ((i++))
    done
    echo
    _tdocs_help_section "SEE ALSO"
    echo "  help taxonomy    Complete taxonomy reference"
}

# Doctor command help
tdocs_help_doctor() {
    echo
    _tdocs_help_section "USAGE"
    printf "  "; _tdocs_inline_cmd "doctor"; echo " [--fix] [--cleanup] [--reindex] [--summary]"

    cat <<EOF

$(_tdocs_help_section "DESCRIPTION")
  Check database health and fix common issues.

$(_tdocs_help_section "HEALTH CHECKS")
  • Stale entries      - .meta files where document no longer exists
  • Missing metadata   - .md files without database entries
  • Lifecycle issues   - Missing or invalid lifecycle values
  • Duplicates         - Same document in multiple .meta files
  • Database summary   - Indexed/unindexed counts + lifecycle breakdown

$(_tdocs_help_section "OPTIONS")
  --summary     Show counts only (no file lists)
  --fix         Auto-fix all detected issues
  --cleanup     Remove stale entries and duplicates
  --reindex     Recalculate all document ranks

$(_tdocs_help_section "EXAMPLES")
$(_tdocs_help_example "Run health check" "doctor")
$(_tdocs_help_example "Show summary only" "doctor --summary")
$(_tdocs_help_example "Fix all issues" "doctor --fix")
$(_tdocs_help_example "Clean and reindex" "doctor --cleanup --reindex")

$(_tdocs_help_section "SEE ALSO")
  scan      Index all unindexed documents
  audit     Find documents without metadata
EOF
}

# Lifecycle help
tdocs_help_lifecycle() {
    echo
    _tdocs_help_section "LIFECYCLE STAGES"
    echo

    # Print lifecycle stages with VERBS palette
    printf "  "; _tdocs_c "${VERBS_PRIMARY[0]}" "Canonical (C)"; echo "  - Authoritative, system of record"
    echo "    • The definitive source for this information"
    echo "    • Fully reviewed and approved"
    echo "    • Used as reference by other documents"
    echo "    • Rank multiplier: 1.6x"
    echo "    • RAG evidence weight: primary"
    echo

    printf "  "; _tdocs_c "${VERBS_PRIMARY[1]}" "Stable (S)"; echo "     - Proven, reviewed, reliable"
    echo "    • Tested and verified to work"
    echo "    • Reviewed by at least one other person"
    echo "    • Production-ready"
    echo "    • Rank multiplier: 1.3x"
    echo "    • RAG evidence weight: secondary"
    echo

    printf "  "; _tdocs_c "${VERBS_PRIMARY[2]}" "Working (W)"; echo "    - Functional, active development [DEFAULT]"
    echo "    • Currently works but may have rough edges"
    echo "    • Under active development"
    echo "    • May change frequently"
    echo "    • Rank multiplier: 1.0x"
    echo "    • RAG evidence weight: tertiary"
    echo

    printf "  "; _tdocs_c "${VERBS_PRIMARY[3]}" "Draft (D)"; echo "      - Work in progress, unreviewed"
    echo "    • Still being written"
    echo "    • Not yet tested or reviewed"
    echo "    • May be incomplete"
    echo "    • Rank multiplier: 0.8x"
    echo "    • RAG evidence weight: excluded"
    echo

    printf "  "; _tdocs_c "${VERBS_PRIMARY[4]}" "Archived (X)"; echo "   - Superseded, do not use"
    echo "    • Replaced by newer document"
    echo "    • Kept for historical reference only"
    echo "    • Should not be used for new work"
    echo "    • Rank multiplier: 0.1x"
    echo "    • RAG evidence weight: excluded"
    echo

    _tdocs_help_section "TYPICAL PROGRESSION"
    echo "  Draft → Working → Stable → Canonical"
    echo
    _tdocs_help_section "EXAMPLES"
    _tdocs_help_example "Show canonical docs" "filter lifecycle C"
    _tdocs_help_example "Show stable and canonical" "filter lifecycle S,C"
    _tdocs_help_example "Exclude archived docs" "ls --lifecycle D,W,S,C"
    echo
    _tdocs_help_section "SEE ALSO"
    echo "  help taxonomy    Complete taxonomy reference"
    echo "  doctor           Check for lifecycle issues"
}

# Colors help
tdocs_help_colors() {
    echo
    _tdocs_help_section "USAGE"
    printf "  "; _tdocs_inline_cmd "colors"; echo " [convert|assignments|pattern|swap|256|compare]"

    cat <<EOF

$(_tdocs_help_section "DESCRIPTION")
  Color explorer for TDS 24-bit to 256-color conversion and semantic
  category palette management.

$(_tdocs_help_section "COMMANDS")
  tokens              Show all design tokens with live color rendering ★
  convert             Show 24-bit to 256-color conversion for all palettes
  assignments         Show current palette assignments for categories
  pattern <category>  Show 8-color pattern (type|intent|grade|category)
  swap <cat> <pal>    Swap palette for category (runtime only)
  256                 Show all 256 ANSI colors
  compare <c1> <c2>   Compare two colors (hex or 256 code)

$(_tdocs_help_section "SEMANTIC CATEGORIES")
  type        What the document IS (spec, guide, investigation, etc.)
  intent      What the document DOES (define, instruct, analyze, etc.)
  lifecycle   Maturity stage (D=Draft, W=Working, S=Stable, C=Canonical, X=Archived)
  category    Core vs Other classification

$(_tdocs_help_section "PALETTES")
  env       ENV_PRIMARY - Environment colors (greens, cyans)
  mode      MODE_PRIMARY - Mode colors (blues, grays)
  verbs     VERBS_PRIMARY - Action colors (reds, oranges)
  nouns     NOUNS_PRIMARY - Object colors (purples, magentas)

$(_tdocs_help_section "EXAMPLES")
$(_tdocs_help_example "Show all design tokens (recommended!)" "colors tokens")
$(_tdocs_help_example "Show color conversions" "colors convert")
$(_tdocs_help_example "Show type category pattern" "colors pattern type")
$(_tdocs_help_example "Swap type to use env palette" "colors swap type env")
$(_tdocs_help_example "Compare two colors" "colors compare FF5733 196")
EOF
}

# Taxonomy help - comprehensive reference
tdocs_help_review() {
    cat <<EOF
$(_tdocs_help_section "tdocs review - interactive document organization")

$(_tdocs_help_subsection "Usage:")
  review [wip|all]

$(_tdocs_help_subsection "Description:")
Interactive document review and organization tool. Navigate through
documents one-by-one with preview, and choose actions like archive,
formalize, move, or delete.

$(_tdocs_help_subsection "Modes:")
  wip    Review WIP documents only (PLAN, STATUS, REFACTOR, etc.) [default]
  all    Review ALL markdown files in the repository

$(_tdocs_help_subsection "Actions:")
  [a] Archive    Move to archive with date/module structure
  [f] Formalize  Add tdocs metadata frontmatter
  [m] Move       Relocate to different directory
  [k] Keep       Leave as-is
  [d] Delete     Remove file permanently
  [n] Next       Skip to next document
  [p] Prev       Go back to previous document
  [v] View       View full document in pager
  [q] Quit       Exit review session

$(_tdocs_help_subsection "Features:")
  • TDS-rendered markdown preview with proper wrapping
  • Date and age display (e.g., "2025-10-30 (15 days ago)")
  • Auto-detected document type and module
  • Suggested archive paths based on date and module
  • Bi-directional navigation (next/prev)

$(_tdocs_help_subsection "Examples:")
$(_tdocs_help_example "Review WIP documents" "review")
$(_tdocs_help_example "Review all markdown files" "review all")
$(_tdocs_help_example "List WIP documents without interaction" "review-list")
$(_tdocs_help_example "Batch archive COMPLETE documents" "review-batch '(COMPLETE)'")

$(_tdocs_help_subsection "Related Commands:")
  review-list [pattern]   List WIP documents with statistics
  review-batch [pattern]  Batch archive matching documents (DANGEROUS)

See also: ${TETRA_CYAN}help lifecycle${TETRA_NC} for document lifecycle stages
EOF
}

tdocs_help_taxonomy() {
    cat <<EOF
$(_tdocs_help_section "DOCUMENT TAXONOMY")

$(_tdocs_help_subsection "Type (NOUN) - What it IS")
  specification, standard, reference    Authoritative definitions
  guide, example, integration           Instructional material
  investigation, bug-fix, refactor      Analysis and changes
  plan, summary, scratch                Planning and notes

$(_tdocs_help_subsection "Intent (VERB) - What it DOES")
  define      Defines concepts, APIs, interfaces
  instruct    Step-by-step instructions
  analyze     Analysis and insights
  document    Records events, decisions
  propose     Proposes changes, features
  explain     Explains how things work
  review      Reviews code or design
  track       Tracks progress or issues

$(_tdocs_help_subsection "Lifecycle - Maturity Stage")
  Canonical (C)   Authoritative, system of record (1.6x rank)
  Stable (S)      Proven, reviewed, reliable (1.3x rank)
  Working (W)     Functional, active development (1.0x rank) [DEFAULT]
  Draft (D)       Work in progress, unreviewed (0.8x rank)
  Archived (X)    Superseded, do not use (0.1x rank)

$(_tdocs_help_subsection "Module - Domain")
  tdocs, rag, repl, tubes, midi, etc.

$(_tdocs_help_section "COMMON COMBINATIONS")
  specification + define + Canonical    Authoritative API definition
  guide + instruct + Stable             Proven how-to guide
  investigation + analyze + Working     Active analysis
  plan + propose + Draft                Draft proposal

$(_tdocs_help_section "EXAMPLES")
$(_tdocs_help_example "View canonical specs" "filter type specification lifecycle C")
$(_tdocs_help_example "View stable guides" "filter type guide lifecycle S")
$(_tdocs_help_example "View working documents" "filter lifecycle W")

$(_tdocs_help_section "SEE ALSO")
  help types     Document types reference
  help filter    Filtering options
EOF
}

# Help router
tdocs_help_topic() {
    local topic="$1"

    case "$topic" in
        module)
            tdocs_help_module
            ;;
        spec)
            tdocs_help_spec
            ;;
        filter)
            tdocs_help_filter
            ;;
        demo)
            tdocs_help_demo
            ;;
        rank)
            tdocs_help_rank
            ;;
        types)
            tdocs_help_types
            ;;
        taxonomy)
            tdocs_help_taxonomy
            ;;
        lifecycle)
            tdocs_help_lifecycle
            ;;
        doctor)
            tdocs_help_doctor
            ;;
        colors)
            tdocs_help_colors
            ;;
        review)
            tdocs_help_review
            ;;
        "")
            tdocs_help_main
            ;;
        *)
            echo -e "${TETRA_CYAN}Help topic: $topic${TETRA_NC}"
            echo "No detailed help available. Try: help [lifecycle|doctor|taxonomy|types|filter|rank|module|colors|review]"
            return 1
            ;;
    esac
}

# Export functions
export -f tdocs_help_main
export -f tdocs_help_module
export -f tdocs_help_review
export -f tdocs_help_spec
export -f tdocs_help_filter
export -f tdocs_help_demo
export -f tdocs_help_rank
export -f tdocs_help_types
export -f tdocs_help_taxonomy
export -f tdocs_help_lifecycle
export -f tdocs_help_doctor
export -f tdocs_help_colors
export -f tdocs_help_topic
