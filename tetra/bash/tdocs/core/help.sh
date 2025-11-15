#!/usr/bin/env bash

# TDOCS Help System - Colored, concise help with subtle variations

# Load colors
if [[ -f "$TETRA_SRC/bash/color/color.sh" ]]; then
    source "$TETRA_SRC/bash/color/color.sh"
else
    # Fallback with subtle color variations
    TETRA_CYAN='\033[0;36m'         # Main commands
    TETRA_CYAN_DIM='\033[2;36m'     # Secondary info
    TETRA_YELLOW='\033[1;33m'       # Highlights
    TETRA_GREEN='\033[0;32m'        # Examples
    TETRA_GREEN_DIM='\033[2;32m'    # Example comments
    TETRA_BLUE='\033[1;34m'         # Section headers
    TETRA_BLUE_DIM='\033[0;34m'     # Subsections
    TETRA_GRAY='\033[0;90m'         # Muted text
    TETRA_NC='\033[0m'              # No color
fi

# Helper functions
_tdocs_help_section() {
    echo -e "${TETRA_BLUE}$1${TETRA_NC}"
}

_tdocs_help_subsection() {
    echo -e "${TETRA_BLUE_DIM}$1${TETRA_NC}"
}

_tdocs_help_cmd() {
    printf "  ${TETRA_CYAN}%-20s${TETRA_NC} ${TETRA_GRAY}%s${TETRA_NC}\n" "$1" "$2"
}

_tdocs_help_example() {
    echo -e "  ${TETRA_GREEN_DIM}# $1${TETRA_NC}"
    echo -e "  ${TETRA_GREEN}$2${TETRA_NC}"
}

# Main help (minimal zen - under 30 lines)
tdocs_help_main() {
    # Get prompt colors using TDS tokens
    local bracket_color=$(tdocs_prompt_color "tdocs.prompt.bracket" 2>/dev/null || echo "${TETRA_GRAY}")
    local brace_color=$(tdocs_prompt_color "tdocs.prompt.topic1" 2>/dev/null || echo "${TETRA_CYAN}")
    local count_color=$(tdocs_prompt_color "tdocs.prompt.count" 2>/dev/null || echo "${TETRA_CYAN}")
    local module_color=$(tdocs_prompt_color "tdocs.prompt.topic2" 2>/dev/null || echo "${TETRA_YELLOW}")
    local filter_color=$(tdocs_prompt_color "tdocs.prompt.level" 2>/dev/null || echo "${TETRA_GREEN}")
    local lifecycle_color=$(tdocs_prompt_color "tdocs.prompt.level" 2>/dev/null || echo "${TETRA_GREEN}")
    local reset=$(tdocs_prompt_reset 2>/dev/null || echo "${TETRA_NC}")

    cat <<EOF
$(_tdocs_help_section "tdocs - semantic document browser")

$(_tdocs_help_subsection "Prompt Format:")
  ${bracket_color}[${reset}${count_color}total${reset} ${brace_color}{${reset}${module_color}modules${reset}${brace_color}}${reset} ${bracket_color}(${reset}${filter_color}type | intent${reset}${bracket_color})${reset}${bracket_color}]${reset} ${bracket_color}[${reset}${lifecycle_color}lifecycle${reset}${bracket_color}]${reset} ${count_color}n${reset} >

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

$(_tdocs_help_subsection "Document Taxonomy:")
  Type (NOUN)      - what it IS:       spec, guide, investigation,
                                        reference, plan, summary, scratch,
                                        bug-fix, refactor
  Intent (VERB)    - what it DOES:     define, instruct, analyze,
                                        document, propose, track
  Lifecycle        - maturity stage:
    ${lifecycle_color}C${reset} Canonical  - authoritative, system of record
    ${lifecycle_color}S${reset} Stable     - proven, reviewed, reliable
    ${lifecycle_color}W${reset} Working    - functional, active development [DEFAULT]
    ${lifecycle_color}D${reset} Draft      - work in progress, unreviewed
    ${lifecycle_color}X${reset} Archived   - superseded, do not use

$(_tdocs_help_subsection "Examples:")
$(_tdocs_help_example "All modules, no filters" "[92 {*} ()] [W:183] 92 >")
$(_tdocs_help_example "midi+osc modules, spec type" "[92 {midi osc} (spec)] [W:183] 64 >")
$(_tdocs_help_example "midi module, spec|define, sorted by time" "[92 {midi} (spec | define)] [C:3 S:12] time:15 >")

Display format: filename  Lifecycle  type  intent  tags

More: $(echo -e "${TETRA_CYAN}help <topic>${TETRA_NC}")  $(echo -e "${TETRA_GRAY}review, lifecycle, taxonomy, filter, types, doctor${TETRA_NC}")
EOF
}

# Module command help
tdocs_help_module() {
    cat <<EOF
$(_tdocs_help_section "USAGE")
  $(echo -e "${TETRA_CYAN}module${TETRA_NC}") <module_name>

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
    cat <<EOF
$(_tdocs_help_section "USAGE")
  $(echo -e "${TETRA_CYAN}spec${TETRA_NC}") <module_name>

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
    cat <<EOF
$(_tdocs_help_section "USAGE")
  $(echo -e "${TETRA_CYAN}filter${TETRA_NC}") [module|type|intent|lifecycle|level|temporal|clear] <value>

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
    cat <<EOF
$(_tdocs_help_section "USAGE")
  $(echo -e "${TETRA_CYAN}demo${TETRA_NC}") [slow|medium|fast]

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
    cat <<EOF
$(_tdocs_help_section "DOCUMENT TYPES (NOUNS)")

$(echo -e "${TETRA_CYAN}specification${TETRA_NC}")    Formal specifications (authoritative)
$(echo -e "${TETRA_CYAN}standard${TETRA_NC}")         Standard/protocol definitions
$(echo -e "${TETRA_CYAN}reference${TETRA_NC}")        Reference material (lookup)
$(echo -e "${TETRA_CYAN}guide${TETRA_NC}")            How-to guides (instructional)
$(echo -e "${TETRA_CYAN}example${TETRA_NC}")          Example/sample code
$(echo -e "${TETRA_CYAN}integration${TETRA_NC}")      Integration guides
$(echo -e "${TETRA_CYAN}investigation${TETRA_NC}")    Analysis and research
$(echo -e "${TETRA_CYAN}bug-fix${TETRA_NC}")          Bug fix documentation
$(echo -e "${TETRA_CYAN}refactor${TETRA_NC}")         Refactoring notes
$(echo -e "${TETRA_CYAN}plan${TETRA_NC}")             Plans and roadmaps
$(echo -e "${TETRA_CYAN}summary${TETRA_NC}")          Summaries and overviews
$(echo -e "${TETRA_CYAN}scratch${TETRA_NC}")          Scratch/temporary notes

$(_tdocs_help_section "SEE ALSO")
  help taxonomy    Complete taxonomy reference
EOF
}

# Doctor command help
tdocs_help_doctor() {
    cat <<EOF
$(_tdocs_help_section "USAGE")
  $(echo -e "${TETRA_CYAN}doctor${TETRA_NC}") [--fix] [--cleanup] [--reindex] [--summary]

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
    cat <<EOF
$(_tdocs_help_section "LIFECYCLE STAGES")

$(echo -e "${TETRA_CYAN}Canonical (C)${TETRA_NC}")  - Authoritative, system of record
  • The definitive source for this information
  • Fully reviewed and approved
  • Used as reference by other documents
  • Rank multiplier: 1.6x
  • RAG evidence weight: primary

$(echo -e "${TETRA_CYAN}Stable (S)${TETRA_NC}")     - Proven, reviewed, reliable
  • Tested and verified to work
  • Reviewed by at least one other person
  • Production-ready
  • Rank multiplier: 1.3x
  • RAG evidence weight: secondary

$(echo -e "${TETRA_CYAN}Working (W)${TETRA_NC}")    - Functional, active development [DEFAULT]
  • Currently works but may have rough edges
  • Under active development
  • May change frequently
  • Rank multiplier: 1.0x
  • RAG evidence weight: tertiary

$(echo -e "${TETRA_CYAN}Draft (D)${TETRA_NC}")      - Work in progress, unreviewed
  • Still being written
  • Not yet tested or reviewed
  • May be incomplete
  • Rank multiplier: 0.8x
  • RAG evidence weight: excluded

$(echo -e "${TETRA_CYAN}Archived (X)${TETRA_NC}")   - Superseded, do not use
  • Replaced by newer document
  • Kept for historical reference only
  • Should not be used for new work
  • Rank multiplier: 0.1x
  • RAG evidence weight: excluded

$(_tdocs_help_section "TYPICAL PROGRESSION")
  Draft → Working → Stable → Canonical

$(_tdocs_help_section "EXAMPLES")
$(_tdocs_help_example "Show canonical docs" "filter lifecycle C")
$(_tdocs_help_example "Show stable and canonical" "filter lifecycle S,C")
$(_tdocs_help_example "Exclude archived docs" "ls --lifecycle D,W,S,C")

$(_tdocs_help_section "SEE ALSO")
  help taxonomy    Complete taxonomy reference
  doctor           Check for lifecycle issues
EOF
}

# Colors help
tdocs_help_colors() {
    cat <<EOF
$(_tdocs_help_section "USAGE")
  $(echo -e "${TETRA_CYAN}colors${TETRA_NC}") [convert|assignments|pattern|swap|256|compare]

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
