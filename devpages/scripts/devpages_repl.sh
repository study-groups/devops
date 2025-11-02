#!/usr/bin/env bash
# DevPages REPL - Interactive DevPages Maintenance Shell
# Serverside operations: build, test, env management, Digital Ocean Spaces

set -euo pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================

DEVPAGES_ROOT="${DEVPAGES_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
DEVPAGES_ENV_DIR="$DEVPAGES_ROOT/env"
DEVPAGES_HISTORY_FILE="${DEVPAGES_HISTORY_FILE:-$HOME/.devpages_repl_history}"

# Ensure history file exists
mkdir -p "$(dirname "$DEVPAGES_HISTORY_FILE")"
touch "$DEVPAGES_HISTORY_FILE"

# Enable history
HISTFILE="$DEVPAGES_HISTORY_FILE"
HISTSIZE=1000
HISTFILESIZE=2000
set -o history

# REPL State
REPL_RUNNING=true
REPL_PROMPT="devpages> "

# ============================================================================
# COLORS (Simple fallback-safe colors)
# ============================================================================

if [[ -t 1 ]]; then
    C_RESET="\033[0m"
    C_BOLD="\033[1m"
    C_DIM="\033[2m"
    C_RED="\033[31m"
    C_GREEN="\033[32m"
    C_YELLOW="\033[33m"
    C_BLUE="\033[34m"
    C_MAGENTA="\033[35m"
    C_CYAN="\033[36m"
    C_WHITE="\033[37m"
else
    C_RESET=""
    C_BOLD=""
    C_DIM=""
    C_RED=""
    C_GREEN=""
    C_YELLOW=""
    C_BLUE=""
    C_MAGENTA=""
    C_CYAN=""
    C_WHITE=""
fi

# ============================================================================
# COMPLETION GENERATOR
# ============================================================================

_devpages_generate_completions() {
    # Top-level commands
    cat <<'EOF'
help
h
env
build
dev
test
audit
spaces
status
info
exit
quit
q
EOF

    # Help topics
    cat <<'EOF'
help
env
build
test
audit
vars
variables
config
spaces
digitalocean
do
s3
EOF

    # Env subcommands
    cat <<'EOF'
list
ls
show
cat
create
edit
validate
diff
EOF

    # Environment file names (without .env)
    echo "local"
    echo "dev"
    echo "staging"
    echo "tetra-test"

    # Build/test/audit subcommands
    cat <<'EOF'
start
check
deps
ui
debug
report
size
imports
circular
circ
dead
EOF

    # Spaces subcommands
    cat <<'EOF'
check
vars
test
EOF
}

# ============================================================================
# HELP SYSTEM - Hierarchical Topics
# ============================================================================

_show_help_root() {
    cat <<'HELP'

╔═══════════════════════════════════════════════════════════╗
║        DevPages REPL - Serverside Maintenance             ║
╚═══════════════════════════════════════════════════════════╝

HELP
    echo -e "${C_BOLD}Main Topics:${C_RESET}"
    echo -e "  ${C_GREEN}help env${C_RESET}       Environment management (env.local, .env files)"
    echo -e "  ${C_GREEN}help build${C_RESET}     Build and development server"
    echo -e "  ${C_GREEN}help test${C_RESET}      Testing (Playwright E2E tests)"
    echo -e "  ${C_GREEN}help audit${C_RESET}     Code auditing and file size analysis"
    echo -e "  ${C_GREEN}help vars${C_RESET}      Environment variables reference"
    echo -e "  ${C_GREEN}help spaces${C_RESET}    Digital Ocean Spaces configuration"
    echo ""
    echo -e "${C_BOLD}Quick Commands:${C_RESET}"
    echo -e "  ${C_YELLOW}env list${C_RESET}       List all environment files"
    echo -e "  ${C_YELLOW}env show${C_RESET}       Show current env.local"
    echo -e "  ${C_YELLOW}env create${C_RESET}     Create new env.local interactively"
    echo -e "  ${C_YELLOW}build${C_RESET}          Start development server"
    echo -e "  ${C_YELLOW}test${C_RESET}           Run Playwright tests"
    echo -e "  ${C_YELLOW}audit${C_RESET}          Run codebase audit"
    echo -e "  ${C_YELLOW}status${C_RESET}         Show system status"
    echo -e "  ${C_YELLOW}!cmd${C_RESET}           Run shell command"
    echo ""
    echo -e "${C_BOLD}Navigation:${C_RESET}"
    echo -e "  ${C_CYAN}TAB${C_RESET}             Auto-complete commands and options"
    echo -e "  ${C_CYAN}Up/Down${C_RESET}         Navigate command history"
    echo -e "  ${C_CYAN}help${C_RESET}            Show this help"
    echo -e "  ${C_CYAN}help <topic>${C_RESET}    Show topic-specific help"
    echo -e "  ${C_CYAN}exit, quit${C_RESET}      Exit REPL"
    echo ""
}

_show_help_env() {
    echo ""
    echo -e "${C_BOLD}${C_GREEN}Environment Management${C_RESET}"
    echo ""
    echo -e "${C_BOLD}Overview:${C_RESET}"
    echo "  DevPages uses environment-specific .env files in the env/ directory."
    echo "  The main workflow is creating env.local for local development."
    echo ""
    echo -e "${C_BOLD}Commands:${C_RESET}"
    echo -e "  ${C_YELLOW}env list${C_RESET}                List all environment files"
    echo -e "  ${C_YELLOW}env show [file]${C_RESET}         Show environment file contents"
    echo -e "  ${C_YELLOW}env create${C_RESET}              Create new env.local interactively"
    echo -e "  ${C_YELLOW}env edit [file]${C_RESET}         Edit environment file in \$EDITOR"
    echo -e "  ${C_YELLOW}env validate [file]${C_RESET}     Validate required variables"
    echo -e "  ${C_YELLOW}env diff <file1> <file2>${C_RESET} Compare two env files"
    echo ""
    echo -e "${C_BOLD}Environment Files:${C_RESET}"
    echo -e "  ${C_CYAN}env/local.env${C_RESET}      Local development (PORT 4000)"
    echo -e "  ${C_CYAN}env/dev.env${C_RESET}        Dev server (PORT 4001)"
    echo -e "  ${C_CYAN}env/staging.env${C_RESET}    Staging server (PORT 4002)"
    echo -e "  ${C_CYAN}env/tetra-test.env${C_RESET} Tetra service testing"
    echo ""
    echo -e "${C_BOLD}Examples:${C_RESET}"
    echo -e "  ${C_DIM}devpages>${C_RESET} env show"
    echo -e "  ${C_DIM}devpages>${C_RESET} env create"
    echo -e "  ${C_DIM}devpages>${C_RESET} env validate local"
    echo ""
}

_show_help_build() {
    echo ""
    echo -e "${C_BOLD}${C_GREEN}Build & Development Server${C_RESET}"
    echo ""
    echo -e "${C_BOLD}Overview:${C_RESET}"
    echo "  DevPages is an Express.js application with npm-based tooling."
    echo "  Development server runs on PORT specified in env file (default 4000)."
    echo ""
    echo -e "${C_BOLD}Commands:${C_RESET}"
    echo -e "  ${C_YELLOW}build${C_RESET}            Start development server (npm run dev)"
    echo -e "  ${C_YELLOW}build start${C_RESET}      Start production server"
    echo -e "  ${C_YELLOW}build check${C_RESET}      Check package dependencies"
    echo -e "  ${C_YELLOW}build deps${C_RESET}       Show dependency tree"
    echo ""
    echo -e "${C_BOLD}NPM Scripts:${C_RESET}"
    echo -e "  ${C_CYAN}npm run dev${C_RESET}        Start dev server with nodemon"
    echo -e "  ${C_CYAN}npm start${C_RESET}          Start production server"
    echo -e "  ${C_CYAN}npm install${C_RESET}        Install dependencies"
    echo ""
    echo -e "${C_BOLD}Environment:${C_RESET}"
    echo "  Before starting, ensure env.local is configured:"
    echo -e "    ${C_DIM}source ./env/local.env${C_RESET}"
    echo -e "    ${C_DIM}npm run dev${C_RESET}"
    echo ""
    echo -e "${C_BOLD}Examples:${C_RESET}"
    echo -e "  ${C_DIM}devpages>${C_RESET} build"
    echo -e "  ${C_DIM}devpages>${C_RESET} build check"
    echo ""
}

_show_help_test() {
    echo ""
    echo -e "${C_BOLD}${C_GREEN}Testing${C_RESET}"
    echo ""
    echo -e "${C_BOLD}Overview:${C_RESET}"
    echo "  DevPages uses Playwright for end-to-end testing."
    echo "  Tests run in Chromium with 30-second timeout."
    echo ""
    echo -e "${C_BOLD}Commands:${C_RESET}"
    echo -e "  ${C_YELLOW}test${C_RESET}             Run all Playwright tests"
    echo -e "  ${C_YELLOW}test ui${C_RESET}          Run tests in UI mode"
    echo -e "  ${C_YELLOW}test debug${C_RESET}       Run tests in debug mode"
    echo -e "  ${C_YELLOW}test report${C_RESET}      Show HTML test report"
    echo ""
    echo -e "${C_BOLD}Test Configuration:${C_RESET}"
    echo -e "  ${C_CYAN}Browser:${C_RESET}      Chromium only"
    echo -e "  ${C_CYAN}Timeout:${C_RESET}      30 seconds"
    echo -e "  ${C_CYAN}Reporter:${C_RESET}     HTML reporter"
    echo -e "  ${C_CYAN}Screenshots:${C_RESET}  On failure"
    echo ""
    echo -e "${C_BOLD}Test Files:${C_RESET}"
    echo -e "  Tests are located in ${C_CYAN}/tests/${C_RESET} directory"
    echo ""
    echo -e "${C_BOLD}Examples:${C_RESET}"
    echo -e "  ${C_DIM}devpages>${C_RESET} test"
    echo -e "  ${C_DIM}devpages>${C_RESET} test ui"
    echo ""
}

_show_help_audit() {
    echo ""
    echo -e "${C_BOLD}${C_GREEN}Code Auditing${C_RESET}"
    echo ""
    echo -e "${C_BOLD}Overview:${C_RESET}"
    echo "  DevPages includes comprehensive auditing tools for code quality,"
    echo "  file size analysis, dependency checks, and convention enforcement."
    echo ""
    echo -e "${C_BOLD}Commands:${C_RESET}"
    echo -e "  ${C_YELLOW}audit${C_RESET}            Run interactive audit system"
    echo -e "  ${C_YELLOW}audit size${C_RESET}       Show file sizes by directory"
    echo -e "  ${C_YELLOW}audit imports${C_RESET}    Validate import statements"
    echo -e "  ${C_YELLOW}audit circular${C_RESET}   Check for circular dependencies"
    echo -e "  ${C_YELLOW}audit dead${C_RESET}       Find dead code"
    echo ""
    echo -e "${C_BOLD}Audit Tools:${C_RESET}"
    echo -e "  ${C_CYAN}npm run audit${C_RESET}              Interactive audit menu"
    echo -e "  ${C_CYAN}npm run validate-imports${C_RESET}   Import validation"
    echo ""
    echo -e "${C_BOLD}File Size Analysis:${C_RESET}"
    echo "  Shows largest files by:"
    echo "    - Total directory size"
    echo "    - Individual file size"
    echo "    - File type distribution"
    echo ""
    echo -e "${C_BOLD}Examples:${C_RESET}"
    echo -e "  ${C_DIM}devpages>${C_RESET} audit"
    echo -e "  ${C_DIM}devpages>${C_RESET} audit size"
    echo ""
}

_show_help_vars() {
    echo ""
    echo -e "${C_BOLD}${C_GREEN}Environment Variables Reference${C_RESET}"
    echo ""
    echo -e "${C_BOLD}Required Variables:${C_RESET}"
    echo ""
    echo -e "  ${C_CYAN}PORT${C_RESET}"
    echo "    Application server port (4000=local, 4001=dev, 4002=staging)"
    echo -e "    Example: ${C_DIM}export PORT=4000${C_RESET}"
    echo ""
    echo -e "  ${C_CYAN}PD_DIR${C_RESET}"
    echo "    PData directory for data storage (required)"
    echo -e "    Example: ${C_DIM}export PD_DIR=\$HOME/nh/mr/pd${C_RESET}"
    echo ""
    echo -e "  ${C_CYAN}NODE_ENV${C_RESET}"
    echo "    Node environment (development, production, staging)"
    echo -e "    Example: ${C_DIM}export NODE_ENV=development${C_RESET}"
    echo ""
    echo -e "${C_BOLD}Digital Ocean Spaces (S3-Compatible):${C_RESET}"
    echo ""
    echo -e "  ${C_CYAN}DO_SPACES_KEY${C_RESET}"
    echo "    Digital Ocean Spaces access key"
    echo -e "    Example: ${C_DIM}export DO_SPACES_KEY=DO00...${C_RESET}"
    echo ""
    echo -e "  ${C_CYAN}DO_SPACES_SECRET${C_RESET}"
    echo "    Digital Ocean Spaces secret key (expires: check comment)"
    echo -e "    Example: ${C_DIM}export DO_SPACES_SECRET=+kH1...${C_RESET}"
    echo ""
    echo -e "  ${C_CYAN}DO_SPACES_ENDPOINT${C_RESET}"
    echo "    Spaces endpoint URL"
    echo -e "    Example: ${C_DIM}export DO_SPACES_ENDPOINT=https://devpages.sfo3.digitaloceanspaces.com${C_RESET}"
    echo ""
    echo -e "  ${C_CYAN}DO_SPACES_BUCKET${C_RESET}"
    echo "    Bucket name"
    echo -e "    Example: ${C_DIM}export DO_SPACES_BUCKET=devpages${C_RESET}"
    echo ""
    echo -e "  ${C_CYAN}DO_SPACES_REGION${C_RESET}"
    echo "    Region code"
    echo -e "    Example: ${C_DIM}export DO_SPACES_REGION=sfo3${C_RESET}"
    echo ""
    echo -e "${C_BOLD}Optional Variables:${C_RESET}"
    echo ""
    echo -e "  ${C_CYAN}PDATA_SECRET${C_RESET}"
    echo "    PData encryption secret (default: gridranger)"
    echo ""
    echo -e "  ${C_CYAN}SESSION_SECRET${C_RESET}"
    echo "    Express session secret (change in production!)"
    echo ""
    echo -e "  ${C_CYAN}TETRA_PORT${C_RESET}"
    echo "    Optional Tetra service port (default: 4444)"
    echo ""
    echo -e "${C_BOLD}See Also:${C_RESET}"
    echo -e "  ${C_YELLOW}help spaces${C_RESET}    Digital Ocean Spaces setup"
    echo -e "  ${C_YELLOW}env create${C_RESET}     Create env.local with prompts"
    echo ""
}

_show_help_spaces() {
    echo ""
    echo -e "${C_BOLD}${C_GREEN}Digital Ocean Spaces Configuration${C_RESET}"
    echo ""
    echo -e "${C_BOLD}Overview:${C_RESET}"
    echo "  DevPages uses Digital Ocean Spaces for S3-compatible cloud storage."
    echo "  Required for media file uploads and storage."
    echo ""
    echo -e "${C_BOLD}Commands:${C_RESET}"
    echo -e "  ${C_YELLOW}spaces check${C_RESET}     Check Spaces configuration"
    echo -e "  ${C_YELLOW}spaces vars${C_RESET}      Show required Spaces variables"
    echo -e "  ${C_YELLOW}spaces test${C_RESET}      Test Spaces connectivity"
    echo ""
    echo -e "${C_BOLD}Setup Steps:${C_RESET}"
    echo ""
    echo -e "  1. ${C_BOLD}Create Spaces API Key${C_RESET}"
    echo "     - Go to: https://cloud.digitalocean.com/account/api/tokens"
    echo "     - Generate New Token → Spaces Keys"
    echo "     - Select \"All Buckets\" scope"
    echo "     - Note expiration date (mark in env file comment)"
    echo ""
    echo -e "  2. ${C_BOLD}Configure Environment${C_RESET}"
    echo "     Add to env.local:"
    echo -e "       ${C_DIM}export DO_SPACES_KEY=DO00...${C_RESET}"
    echo -e "       ${C_DIM}export DO_SPACES_SECRET=+kH1...  # expires: YYYY-MM-DD${C_RESET}"
    echo -e "       ${C_DIM}export DO_SPACES_ENDPOINT=https://devpages.sfo3.digitaloceanspaces.com${C_RESET}"
    echo -e "       ${C_DIM}export DO_SPACES_BUCKET=devpages${C_RESET}"
    echo -e "       ${C_DIM}export DO_SPACES_REGION=sfo3${C_RESET}"
    echo ""
    echo -e "  3. ${C_BOLD}Verify Setup${C_RESET}"
    echo -e "     ${C_DIM}devpages>${C_RESET} spaces check"
    echo ""
    echo -e "${C_BOLD}API Endpoints:${C_RESET}"
    echo -e "  ${C_CYAN}/api/save${C_RESET}          Upload to Spaces"
    echo -e "  ${C_CYAN}/server/routes/spaces.js${C_RESET}    Spaces routes"
    echo -e "  ${C_CYAN}/server/routes/mediaProxy.js${C_RESET} Media proxy"
    echo ""
    echo -e "${C_BOLD}Security Notes:${C_RESET}"
    echo -e "  ${C_RED}⚠${C_RESET}  Spaces keys have expiration dates"
    echo -e "  ${C_RED}⚠${C_RESET}  Never commit credentials to version control"
    echo -e "  ${C_RED}⚠${C_RESET}  Use .gitignore for env.local"
    echo ""
    echo -e "${C_BOLD}Current Status:${C_RESET}"
    if [[ -n "${DO_SPACES_KEY:-}" ]]; then
        echo -e "  ${C_GREEN}✓${C_RESET} DO_SPACES_KEY configured"
    else
        echo -e "  ${C_RED}✗${C_RESET} DO_SPACES_KEY not set"
    fi
    if [[ -n "${DO_SPACES_SECRET:-}" ]]; then
        echo -e "  ${C_GREEN}✓${C_RESET} DO_SPACES_SECRET configured"
    else
        echo -e "  ${C_RED}✗${C_RESET} DO_SPACES_SECRET not set"
    fi
    if [[ -n "${DO_SPACES_ENDPOINT:-}" ]]; then
        echo -e "  ${C_GREEN}✓${C_RESET} DO_SPACES_ENDPOINT configured"
    else
        echo -e "  ${C_RED}✗${C_RESET} DO_SPACES_ENDPOINT not set"
    fi
    echo ""
}

_show_help() {
    local topic="${1:-}"

    case "$topic" in
        env|environment)
            _show_help_env
            ;;
        build|dev|development)
            _show_help_build
            ;;
        test|testing)
            _show_help_test
            ;;
        audit|auditing)
            _show_help_audit
            ;;
        vars|variables|config)
            _show_help_vars
            ;;
        spaces|digitalocean|do|s3)
            _show_help_spaces
            ;;
        "")
            _show_help_root
            ;;
        *)
            echo -e "${C_RED}Unknown help topic:${C_RESET} $topic"
            echo "Try: help env, help build, help test, help audit, help vars, help spaces"
            ;;
    esac
}

# ============================================================================
# ENV COMMANDS
# ============================================================================

_cmd_env() {
    local subcmd="${1:-list}"
    shift || true

    case "$subcmd" in
        list|ls)
            echo -e "\n${C_BOLD}Environment Files:${C_RESET}\n"
            for envfile in "$DEVPAGES_ENV_DIR"/*.env; do
                if [[ -f "$envfile" ]]; then
                    local basename=$(basename "$envfile")
                    local size=$(wc -c < "$envfile")
                    printf "  ${C_CYAN}%-20s${C_RESET} (%d bytes)\n" "$basename" "$size"
                fi
            done
            echo ""
            ;;
        show|cat)
            local file="${1:-local.env}"
            [[ "$file" != *.env ]] && file="${file}.env"
            local fullpath="$DEVPAGES_ENV_DIR/$file"

            if [[ -f "$fullpath" ]]; then
                echo -e "\n${C_BOLD}$file:${C_RESET}\n"
                cat "$fullpath"
                echo ""
            else
                echo -e "${C_RED}Error:${C_RESET} File not found: $fullpath"
            fi
            ;;
        create)
            _create_env_local
            ;;
        edit)
            local file="${1:-local.env}"
            [[ "$file" != *.env ]] && file="${file}.env"
            local fullpath="$DEVPAGES_ENV_DIR/$file"

            ${EDITOR:-vi} "$fullpath"
            echo -e "${C_GREEN}✓${C_RESET} Edited $file"
            ;;
        validate)
            local file="${1:-local.env}"
            [[ "$file" != *.env ]] && file="${file}.env"
            _validate_env_file "$DEVPAGES_ENV_DIR/$file"
            ;;
        diff)
            local file1="${1:-local.env}"
            local file2="${2:-dev.env}"
            [[ "$file1" != *.env ]] && file1="${file1}.env"
            [[ "$file2" != *.env ]] && file2="${file2}.env"

            echo -e "\n${C_BOLD}Comparing $file1 vs $file2:${C_RESET}\n"
            diff -u "$DEVPAGES_ENV_DIR/$file1" "$DEVPAGES_ENV_DIR/$file2" || true
            echo ""
            ;;
        *)
            echo -e "${C_RED}Unknown env subcommand:${C_RESET} $subcmd"
            echo "Try: env list, env show, env create, env edit, env validate"
            ;;
    esac
}

_create_env_local() {
    local envfile="$DEVPAGES_ENV_DIR/local.env"

    echo -e "\n${C_BOLD}${C_CYAN}Create env.local${C_RESET}\n"

    if [[ -f "$envfile" ]]; then
        echo -e "${C_YELLOW}Warning:${C_RESET} $envfile already exists"
        read -p "Overwrite? (y/N) " -n 1 -r
        echo ""
        [[ ! $REPLY =~ ^[Yy]$ ]] && return
    fi

    echo -e "Enter values (press Enter for defaults):\n"

    # PORT
    read -p "PORT [4000]: " port
    port="${port:-4000}"

    # PD_DIR
    read -p "PD_DIR [\$HOME/nh/mr/pd]: " pd_dir
    pd_dir="${pd_dir:-\$HOME/nh/mr/pd}"

    # NODE_ENV
    read -p "NODE_ENV [development]: " node_env
    node_env="${node_env:-development}"

    # PDATA_SECRET
    read -p "PDATA_SECRET [gridranger]: " pdata_secret
    pdata_secret="${pdata_secret:-gridranger}"

    echo ""
    echo -e "${C_BOLD}Digital Ocean Spaces (optional - press Enter to skip):${C_RESET}"
    echo ""

    read -p "DO_SPACES_KEY: " do_key
    read -p "DO_SPACES_SECRET: " do_secret
    read -p "DO_SPACES_ENDPOINT [https://devpages.sfo3.digitaloceanspaces.com]: " do_endpoint
    do_endpoint="${do_endpoint:-https://devpages.sfo3.digitaloceanspaces.com}"
    read -p "DO_SPACES_BUCKET [devpages]: " do_bucket
    do_bucket="${do_bucket:-devpages}"
    read -p "DO_SPACES_REGION [sfo3]: " do_region
    do_region="${do_region:-sfo3}"

    # Write file
    cat > "$envfile" <<EOF
export PORT=$port
export PD_DIR=$pd_dir
export NODE_ENV=$node_env
export PDATA_SECRET=$pdata_secret
export NAME=devpages
EOF

    if [[ -n "$do_key" ]]; then
        cat >> "$envfile" <<EOF
export DO_SPACES_KEY=$do_key
export DO_SPACES_SECRET=$do_secret
export DO_SPACES_ENDPOINT=$do_endpoint
export DO_SPACES_BUCKET=$do_bucket
export DO_SPACES_REGION=$do_region
EOF
    fi

    echo ""
    echo -e "${C_GREEN}✓${C_RESET} Created $envfile"
    echo ""
}

_validate_env_file() {
    local envfile="$1"

    if [[ ! -f "$envfile" ]]; then
        echo -e "${C_RED}✗${C_RESET} File not found: $envfile"
        return 1
    fi

    echo -e "\n${C_BOLD}Validating $(basename "$envfile"):${C_RESET}\n"

    # Source the file in a subshell to extract variables
    local vars
    vars=$(bash -c "source '$envfile' 2>/dev/null && env" | grep -E '^(PORT|PD_DIR|NODE_ENV|DO_SPACES_|PDATA_SECRET)=' || true)

    # Check required vars
    local required=("PORT" "PD_DIR" "NODE_ENV")
    local optional=("DO_SPACES_KEY" "DO_SPACES_SECRET" "DO_SPACES_ENDPOINT" "DO_SPACES_BUCKET" "DO_SPACES_REGION" "PDATA_SECRET")

    for var in "${required[@]}"; do
        if echo "$vars" | grep -q "^${var}="; then
            local value=$(echo "$vars" | grep "^${var}=" | cut -d= -f2-)
            echo -e "  ${C_GREEN}✓${C_RESET} $var = ${C_DIM}$value${C_RESET}"
        else
            echo -e "  ${C_RED}✗${C_RESET} $var ${C_RED}(required)${C_RESET}"
        fi
    done

    echo ""
    echo -e "${C_BOLD}Optional:${C_RESET}\n"

    for var in "${optional[@]}"; do
        if echo "$vars" | grep -q "^${var}="; then
            local value=$(echo "$vars" | grep "^${var}=" | cut -d= -f2-)
            # Mask secrets
            if [[ "$var" == *SECRET* ]] || [[ "$var" == *KEY* && "$var" != "DO_SPACES_ENDPOINT" ]]; then
                echo -e "  ${C_GREEN}✓${C_RESET} $var = ${C_DIM}***${C_RESET}"
            else
                echo -e "  ${C_GREEN}✓${C_RESET} $var = ${C_DIM}$value${C_RESET}"
            fi
        else
            echo -e "  ${C_DIM}○${C_RESET} $var ${C_DIM}(not set)${C_RESET}"
        fi
    done

    echo ""
}

# ============================================================================
# BUILD COMMANDS
# ============================================================================

_cmd_build() {
    local subcmd="${1:-start}"

    case "$subcmd" in
        start|"")
            echo -e "${C_CYAN}Starting development server...${C_RESET}\n"
            cd "$DEVPAGES_ROOT"
            npm run dev
            ;;
        check)
            echo -e "\n${C_BOLD}Checking dependencies...${C_RESET}\n"
            cd "$DEVPAGES_ROOT"
            npm list --depth=0
            ;;
        deps)
            echo -e "\n${C_BOLD}Dependency tree:${C_RESET}\n"
            cd "$DEVPAGES_ROOT"
            npm list
            ;;
        *)
            echo -e "${C_RED}Unknown build subcommand:${C_RESET} $subcmd"
            echo "Try: build, build check, build deps"
            ;;
    esac
}

# ============================================================================
# TEST COMMANDS
# ============================================================================

_cmd_test() {
    local subcmd="${1:-run}"

    cd "$DEVPAGES_ROOT"

    case "$subcmd" in
        run|"")
            echo -e "${C_CYAN}Running tests...${C_RESET}\n"
            npm test
            ;;
        ui)
            echo -e "${C_CYAN}Running tests in UI mode...${C_RESET}\n"
            npx playwright test --ui
            ;;
        debug)
            echo -e "${C_CYAN}Running tests in debug mode...${C_RESET}\n"
            npx playwright test --debug
            ;;
        report)
            echo -e "${C_CYAN}Opening test report...${C_RESET}\n"
            npx playwright show-report
            ;;
        *)
            echo -e "${C_RED}Unknown test subcommand:${C_RESET} $subcmd"
            echo "Try: test, test ui, test debug, test report"
            ;;
    esac
}

# ============================================================================
# AUDIT COMMANDS
# ============================================================================

_cmd_audit() {
    local subcmd="${1:-interactive}"

    cd "$DEVPAGES_ROOT"

    case "$subcmd" in
        interactive|"")
            echo -e "${C_CYAN}Running interactive audit...${C_RESET}\n"
            npm run audit
            ;;
        size)
            echo -e "\n${C_BOLD}File sizes by directory:${C_RESET}\n"
            du -sh client/* server/* 2>/dev/null | sort -hr | head -20
            echo ""
            echo -e "${C_BOLD}Largest files:${C_RESET}\n"
            find client server -type f -exec ls -lh {} \; 2>/dev/null | sort -k5 -hr | head -20 | awk '{print $5, $9}'
            echo ""
            ;;
        imports)
            echo -e "${C_CYAN}Validating imports...${C_RESET}\n"
            npm run validate-imports
            ;;
        circular|circ)
            echo -e "${C_CYAN}Checking circular dependencies...${C_RESET}\n"
            echo "Note: Install madge for circular dependency detection"
            echo "  npm install -g madge"
            echo "  madge --circular --extensions js ."
            ;;
        dead)
            echo -e "${C_CYAN}Finding dead code...${C_RESET}\n"
            echo "Note: Use npm run audit for dead code analysis"
            ;;
        *)
            echo -e "${C_RED}Unknown audit subcommand:${C_RESET} $subcmd"
            echo "Try: audit, audit size, audit imports"
            ;;
    esac
}

# ============================================================================
# SPACES COMMANDS
# ============================================================================

_cmd_spaces() {
    local subcmd="${1:-check}"

    case "$subcmd" in
        check)
            echo -e "\n${C_BOLD}Digital Ocean Spaces Configuration:${C_RESET}\n"

            if [[ -n "${DO_SPACES_KEY:-}" ]]; then
                echo -e "  ${C_GREEN}✓${C_RESET} DO_SPACES_KEY = ${C_DIM}${DO_SPACES_KEY:0:10}...${C_RESET}"
            else
                echo -e "  ${C_RED}✗${C_RESET} DO_SPACES_KEY not set"
            fi

            if [[ -n "${DO_SPACES_SECRET:-}" ]]; then
                echo -e "  ${C_GREEN}✓${C_RESET} DO_SPACES_SECRET = ${C_DIM}***${C_RESET}"
            else
                echo -e "  ${C_RED}✗${C_RESET} DO_SPACES_SECRET not set"
            fi

            if [[ -n "${DO_SPACES_ENDPOINT:-}" ]]; then
                echo -e "  ${C_GREEN}✓${C_RESET} DO_SPACES_ENDPOINT = ${C_DIM}$DO_SPACES_ENDPOINT${C_RESET}"
            else
                echo -e "  ${C_RED}✗${C_RESET} DO_SPACES_ENDPOINT not set"
            fi

            if [[ -n "${DO_SPACES_BUCKET:-}" ]]; then
                echo -e "  ${C_GREEN}✓${C_RESET} DO_SPACES_BUCKET = ${C_DIM}$DO_SPACES_BUCKET${C_RESET}"
            else
                echo -e "  ${C_RED}✗${C_RESET} DO_SPACES_BUCKET not set"
            fi

            if [[ -n "${DO_SPACES_REGION:-}" ]]; then
                echo -e "  ${C_GREEN}✓${C_RESET} DO_SPACES_REGION = ${C_DIM}$DO_SPACES_REGION${C_RESET}"
            else
                echo -e "  ${C_RED}✗${C_RESET} DO_SPACES_REGION not set"
            fi

            echo ""
            ;;
        vars)
            _show_help_vars
            ;;
        test)
            echo -e "${C_YELLOW}Note:${C_RESET} Spaces connectivity testing requires server to be running"
            echo "Start server and test /api/save endpoint"
            ;;
        *)
            echo -e "${C_RED}Unknown spaces subcommand:${C_RESET} $subcmd"
            echo "Try: spaces check, spaces vars, spaces test"
            ;;
    esac
}

# ============================================================================
# STATUS COMMAND
# ============================================================================

_cmd_status() {
    echo -e "\n${C_BOLD}${C_CYAN}DevPages Status${C_RESET}\n"

    echo -e "${C_BOLD}Project:${C_RESET}"
    echo -e "  Root: ${C_DIM}$DEVPAGES_ROOT${C_RESET}"
    echo ""

    echo -e "${C_BOLD}Environment:${C_RESET}"
    if [[ -f "$DEVPAGES_ENV_DIR/local.env" ]]; then
        echo -e "  ${C_GREEN}✓${C_RESET} env/local.env exists"

        # Check if sourced
        if [[ -n "${PORT:-}" ]]; then
            echo -e "  ${C_GREEN}✓${C_RESET} Environment loaded (PORT=$PORT)"
        else
            echo -e "  ${C_YELLOW}○${C_RESET} Not sourced (run: ${C_DIM}source ./env/local.env${C_RESET})"
        fi
    else
        echo -e "  ${C_RED}✗${C_RESET} env/local.env not found (run: ${C_DIM}env create${C_RESET})"
    fi
    echo ""

    echo -e "${C_BOLD}Dependencies:${C_RESET}"
    if [[ -d "$DEVPAGES_ROOT/node_modules" ]]; then
        echo -e "  ${C_GREEN}✓${C_RESET} node_modules installed"
    else
        echo -e "  ${C_RED}✗${C_RESET} node_modules missing (run: ${C_DIM}npm install${C_RESET})"
    fi
    echo ""

    echo -e "${C_BOLD}Tools:${C_RESET}"
    echo -e "  Node: ${C_DIM}$(node --version 2>/dev/null || echo 'not found')${C_RESET}"
    echo -e "  NPM:  ${C_DIM}$(npm --version 2>/dev/null || echo 'not found')${C_RESET}"
    echo ""
}

# ============================================================================
# INPUT PROCESSOR
# ============================================================================

_devpages_repl_process_input() {
    local input="$1"

    # Empty input
    [[ -z "$input" ]] && return 0

    # Shell command (starts with !)
    if [[ "$input" == !* ]]; then
        eval "${input:1}"
        return 0
    fi

    # Parse command
    local cmd="${input%% *}"
    local args="${input#* }"
    [[ "$args" == "$cmd" ]] && args=""

    case "$cmd" in
        # Help
        help|h|\?)
            _show_help $args
            ;;

        # Environment
        env)
            _cmd_env $args
            ;;

        # Build
        build|dev)
            _cmd_build $args
            ;;

        # Test
        test)
            _cmd_test $args
            ;;

        # Audit
        audit)
            _cmd_audit $args
            ;;

        # Spaces
        spaces)
            _cmd_spaces $args
            ;;

        # Status
        status|info)
            _cmd_status
            ;;

        # Exit
        exit|quit|q)
            return 1  # Signal exit
            ;;

        # Unknown
        *)
            echo -e "${C_RED}Unknown command:${C_RESET} $cmd"
            echo "Type 'help' for available commands, or press TAB for completions"
            ;;
    esac

    return 0  # Continue REPL
}

# ============================================================================
# PROMPT BUILDER
# ============================================================================

_devpages_repl_build_prompt() {
    # Simple static prompt for now
    REPL_PROMPT="${C_CYAN}devpages${C_RESET}> "
}

# ============================================================================
# MAIN REPL LOOP
# ============================================================================

_repl_main() {
    # Welcome banner
    cat <<'EOF'

╔═══════════════════════════════════════════════════════════╗
║        DevPages REPL - Serverside Maintenance             ║
╚═══════════════════════════════════════════════════════════╝

EOF
    echo -e "${C_BOLD}Takeover Mode:${C_RESET} Direct commands (no shell pass-through)"
    echo ""
    echo -e "${C_BOLD}Quick Start:${C_RESET}"
    echo "  env list       List environment files"
    echo "  env create     Create env.local interactively"
    echo "  status         Show system status"
    echo "  help           Show all commands"
    echo ""
    echo -e "${C_BOLD}Navigation:${C_RESET}"
    echo "  TAB            Auto-complete commands"
    echo "  Up/Down        Command history"
    echo "  Ctrl-D         Exit REPL"
    echo ""

    # Main loop
    while $REPL_RUNNING; do
        # Build prompt
        _devpages_repl_build_prompt

        # Read input with readline support
        local input
        read -e -p "$(echo -e "$REPL_PROMPT")" input || {
            # Ctrl-D pressed
            echo ""
            break
        }

        # Add to history if non-empty
        if [[ -n "$input" ]]; then
            history -s "$input"
        fi

        # Process input
        _devpages_repl_process_input "$input" || {
            # Exit requested
            REPL_RUNNING=false
        }
    done

    echo ""
    echo -e "${C_DIM}Goodbye!${C_RESET}"
    echo ""
}

# ============================================================================
# ENTRY POINT
# ============================================================================

# If script is sourced, export functions
if [[ "${BASH_SOURCE[0]}" != "${0}" ]]; then
    export -f _devpages_repl_process_input
    export -f _devpages_repl_build_prompt
    export -f _devpages_generate_completions
    export -f _show_help
    export -f _cmd_env
    export -f _cmd_build
    export -f _cmd_test
    export -f _cmd_audit
    export -f _cmd_spaces
    export -f _cmd_status
else
    # Script is executed directly
    _repl_main
fi
