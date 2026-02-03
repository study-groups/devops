#!/usr/bin/env bash
# deploy_help.sh - Help system and color definitions
#
# Functions: _deploy_help_colors, _deploy_help_section, _deploy_help_sub,
#            _deploy_help_cmd, _deploy_help_ex, deploy_help

# Help color definitions (TDS semantic colors)
_deploy_help_colors() {
    # Use TDS if available and fully initialized, fallback to ANSI
    # Suppress stderr to avoid "invalid arithmetic operator" errors from dot-notation keys
    if type tds_text_color &>/dev/null && declare -p TDS_COLOR_TOKENS &>/dev/null; then
        CLR_H1=$(tds_text_color "content.heading.h1" 2>/dev/null) || CLR_H1='\033[1;34m'
        CLR_H2=$(tds_text_color "content.heading.h2" 2>/dev/null) || CLR_H2='\033[0;36m'
        CLR_CMD=$(tds_text_color "action.primary" 2>/dev/null) || CLR_CMD='\033[0;33m'
        CLR_ARG=$(tds_text_color "action.secondary" 2>/dev/null) || CLR_ARG='\033[0;32m'
        CLR_DIM=$(tds_text_color "text.muted" 2>/dev/null) || CLR_DIM='\033[0;90m'
        CLR_OK=$(tds_text_color "status.success" 2>/dev/null) || CLR_OK='\033[0;32m'
        CLR_NC=$(reset_color 2>/dev/null) || CLR_NC='\033[0m'
    else
        CLR_H1='\033[1;34m'      # Blue bold - section headers
        CLR_H2='\033[0;36m'      # Cyan - subsections
        CLR_CMD='\033[0;33m'     # Yellow - commands
        CLR_ARG='\033[0;32m'     # Green - arguments
        CLR_DIM='\033[0;90m'     # Gray - descriptions
        CLR_OK='\033[0;32m'      # Green - success
        CLR_NC='\033[0m'         # Reset
    fi
}

_deploy_help_section() { echo -e "${CLR_H1}$1${CLR_NC}"; }
_deploy_help_sub() { echo -e "  ${CLR_H2}$1${CLR_NC}"; }
_deploy_help_cmd() { printf "  ${CLR_CMD}%-24s${CLR_NC} ${CLR_DIM}%s${CLR_NC}\n" "$1" "$2"; }
_deploy_help_ex() { echo -e "  ${CLR_DIM}#${CLR_NC} ${CLR_ARG}$1${CLR_NC}"; }

deploy_help() {
    local topic="${1:-}"
    _deploy_help_colors

    case "$topic" in
        context)
            _deploy_help_section "CONTEXT MODE (stateful)"
            echo ""
            _deploy_help_cmd "target <name>" "Set current target (shows in prompt)"
            _deploy_help_cmd "target ." "Use CWD as target"
            _deploy_help_cmd "env <name>" "Set current env"
            _deploy_help_cmd "deploy" "Deploy with context (confirms)"
            _deploy_help_cmd "info" "Show current context"
            _deploy_help_cmd "clear" "Clear context"
            echo ""
            _deploy_help_sub "Workflow:"
            _deploy_help_ex "deploy target docs   # prompt: [org:docs:?]"
            _deploy_help_ex "deploy env dev       # prompt: [org:docs:dev]"
            _deploy_help_ex "deploy               # confirm and deploy"
            ;;
        direct)
            _deploy_help_section "DIRECT MODE"
            echo ""
            _deploy_help_cmd "<env>" "Deploy CWD to environment"
            _deploy_help_cmd "<target> <env>" "Deploy named target"
            _deploy_help_cmd "push [-n] <args>" "Explicit push (same as above)"
            _deploy_help_cmd "show <target> <env>" "Show resolved config"
            echo ""
            _deploy_help_sub "Examples:"
            _deploy_help_ex "deploy docs prod        # target to prod"
            _deploy_help_ex "deploy dev              # CWD to dev"
            _deploy_help_ex "deploy -n docs staging  # dry run"
            ;;
        history)
            _deploy_help_section "HISTORY"
            echo ""
            _deploy_help_cmd "history" "Show last 20 deployments"
            _deploy_help_cmd "history <n>" "Show last n deployments"
            _deploy_help_cmd "history -v" "Verbose (user, branch, commit)"
            _deploy_help_cmd "history -v <n>" "Verbose, last n"
            echo ""
            _deploy_help_sub "Logged metrics:"
            echo -e "  ${CLR_DIM}timestamp, target, env, action, status, duration${CLR_NC}"
            echo -e "  ${CLR_DIM}user, git branch, git commit${CLR_NC}"
            ;;
        targets)
            _deploy_help_section "TARGETS"
            echo ""
            _deploy_help_sub "Named targets:"
            echo -e "  ${CLR_DIM}\$TETRA_DIR/orgs/<org>/targets/<name>.toml${CLR_NC}"
            echo -e "  ${CLR_DIM}\$TETRA_DIR/orgs/<org>/targets/<name>/tetra-deploy.toml${CLR_NC}"
            echo ""
            _deploy_help_sub "CWD mode:"
            echo -e "  ${CLR_DIM}./tetra-deploy.toml or deploy target .${CLR_NC}"
            echo ""
            _deploy_help_cmd "list" "List available targets"
            ;;
        vars|variables)
            _deploy_help_section "TEMPLATE VARIABLES"
            echo ""
            _deploy_help_cmd "{{ssh}}" "user@host"
            _deploy_help_cmd "{{host}}" "IP/hostname"
            _deploy_help_cmd "{{user}}" "work user"
            _deploy_help_cmd "{{auth_user}}" "SSH login user"
            _deploy_help_cmd "{{work_user}}" "app owner"
            _deploy_help_cmd "{{remote}}" "remote path"
            _deploy_help_cmd "{{cwd}}" "alias for remote"
            _deploy_help_cmd "{{domain}}" "domain string"
            _deploy_help_cmd "{{env}}" "environment name"
            _deploy_help_cmd "{{name}}" "target name"
            _deploy_help_cmd "{{local}}" "local directory"
            ;;
        modes)
            _deploy_help_section "MODES"
            echo ""
            _deploy_help_sub "Standalone:"
            echo -e "  ${CLR_DIM}SSH config in target TOML ([env.<env>] has ssh key)${CLR_NC}"
            echo ""
            _deploy_help_sub "Org-integrated:"
            echo -e "  ${CLR_DIM}SSH from org module (no ssh in target TOML)${CLR_NC}"
            echo ""
            echo -e "  ${CLR_DIM}Mode is auto-detected per target.${CLR_NC}"
            ;;
        doctor)
            _deploy_help_section "DOCTOR"
            echo ""
            _deploy_help_cmd "doctor" "Show deploy module status"
            _deploy_help_cmd "doctor reload" "Reload deploy module"
            _deploy_help_cmd "doctor complete" "Show completion diagnostics"
            _deploy_help_cmd "doctor complete <target>" "Show target's pipelines/aliases"
            ;;
        taxonomy)
            _deploy_help_section "DEPLOY TAXONOMY"
            echo ""
            _deploy_help_sub "Hierarchy:"
            echo -e "  ${CLR_H1}ORG${CLR_NC} ${CLR_DIM}─────────────${CLR_NC} Organization container (nodeholder, acme)"
            echo -e "   ${CLR_DIM}└─${CLR_NC} ${CLR_H2}TARGET${CLR_NC} ${CLR_DIM}──────${CLR_NC} Deployable unit (docs, api, web)"
            echo -e "       ${CLR_DIM}└─${CLR_NC} ${CLR_CMD}PIPELINE${CLR_NC} ${CLR_DIM}──${CLR_NC} Workflow sequence (default, quick, gdocs)"
            echo -e "           ${CLR_DIM}└─${CLR_NC} ${CLR_ARG}ITEMS${CLR_NC} ${CLR_DIM}────${CLR_NC} File selection filter ({gdocs}, {!index})"
            echo ""
            _deploy_help_sub "Concepts:"
            echo -e "  ${CLR_H2}TARGET${CLR_NC}     ${CLR_DIM}A deployable project with its own tetra-deploy.toml${CLR_NC}"
            echo -e "             ${CLR_DIM}Contains: source files, build rules, push config${CLR_NC}"
            echo ""
            echo -e "  ${CLR_CMD}PIPELINE${CLR_NC}   ${CLR_DIM}Named sequence of steps: [\"build:all\", \"push\"]${CLR_NC}"
            echo -e "             ${CLR_DIM}Defines WHAT operations run and in what order${CLR_NC}"
            echo ""
            echo -e "  ${CLR_ARG}ITEMS${CLR_NC}      ${CLR_DIM}Filter for WHICH files the pipeline operates on${CLR_NC}"
            echo -e "             ${CLR_DIM}Affects both build steps AND push file selection${CLR_NC}"
            echo ""
            echo -e "  ${CLR_OK}ENV${CLR_NC}        ${CLR_DIM}Target environment: prod, dev, staging${CLR_NC}"
            echo -e "             ${CLR_DIM}Provides: SSH connection, domain, settings${CLR_NC}"
            echo ""
            _deploy_help_sub "Steps (pipeline components):"
            echo -e "  ${CLR_CMD}build:X${CLR_NC}    ${CLR_DIM}Run build command for file set X${CLR_NC}"
            echo -e "  ${CLR_CMD}push${CLR_NC}       ${CLR_DIM}Transfer files to remote server${CLR_NC}"
            echo -e "  ${CLR_CMD}pre${CLR_NC}        ${CLR_DIM}Pre-build hook (runs once before any build)${CLR_NC}"
            echo ""
            _deploy_help_sub "Item Modifiers:"
            echo -e "  ${CLR_ARG}{gdocs}${CLR_NC}    ${CLR_DIM}Include: only these items${CLR_NC}"
            echo -e "  ${CLR_ARG}{!index}${CLR_NC}   ${CLR_DIM}Exclude: all EXCEPT these${CLR_NC}"
            echo -e "  ${CLR_ARG}{@guides}${CLR_NC}  ${CLR_DIM}Group: expand to [files.guides].include list${CLR_NC}"
            echo -e "  ${CLR_ARG}~gdocs${CLR_NC}     ${CLR_DIM}Shorthand: same as {gdocs}${CLR_NC}"
            echo ""
            _deploy_help_sub "Address Format:"
            echo -e "  ${CLR_H1}[org:]${CLR_NC}${CLR_H2}target${CLR_NC}${CLR_DIM}:${CLR_NC}${CLR_CMD}[pipeline]${CLR_NC}${CLR_DIM}:${CLR_NC}${CLR_ARG}[{items}]${CLR_NC} ${CLR_OK}env${CLR_NC}"
            echo ""
            _deploy_help_sub "Examples:"
            echo -e "  ${CLR_H2}docs${CLR_NC}${CLR_DIM}:${CLR_NC}${CLR_CMD}quick${CLR_NC} ${CLR_OK}prod${CLR_NC}              ${CLR_DIM}# target:pipeline${CLR_NC}"
            echo -e "  ${CLR_H2}docs${CLR_NC}${CLR_DIM}:${CLR_NC}${CLR_ARG}{gdocs}${CLR_NC} ${CLR_OK}prod${CLR_NC}            ${CLR_DIM}# target:{items}${CLR_NC}"
            echo -e "  ${CLR_H2}docs${CLR_NC}${CLR_DIM}:${CLR_NC}${CLR_CMD}quick${CLR_NC}${CLR_DIM}:${CLR_NC}${CLR_ARG}{gdocs}${CLR_NC} ${CLR_OK}prod${CLR_NC}      ${CLR_DIM}# target:pipeline:{items}${CLR_NC}"
            echo -e "  ${CLR_H1}nodeholder${CLR_NC}${CLR_DIM}:${CLR_NC}${CLR_H2}docs${CLR_NC}${CLR_DIM}:${CLR_NC}${CLR_CMD}quick${CLR_NC} ${CLR_OK}prod${CLR_NC}    ${CLR_DIM}# org:target:pipeline${CLR_NC}"
            echo -e "  ${CLR_H1}nodeholder${CLR_NC}${CLR_DIM}:${CLR_NC}${CLR_H2}docs${CLR_NC}${CLR_DIM}:${CLR_NC}${CLR_ARG}{gdocs}${CLR_NC} ${CLR_OK}prod${CLR_NC}  ${CLR_DIM}# org:target:{items}${CLR_NC}"
            echo -e "  ${CLR_H1}nodeholder${CLR_NC}${CLR_DIM}:${CLR_NC}${CLR_H2}docs${CLR_NC}${CLR_DIM}:${CLR_NC}${CLR_CMD}quick${CLR_NC}${CLR_DIM}:${CLR_NC}${CLR_ARG}{gdocs}${CLR_NC} ${CLR_OK}prod${CLR_NC}  ${CLR_DIM}# full address${CLR_NC}"
            ;;
        dry-run|template)
            _deploy_help_section "DRY-RUN OUTPUT TEMPLATE"
            echo ""
            echo -e "${CLR_DIM}────────────────────────────────────────${CLR_NC}"
            echo -e "${CLR_H1}Deploy${CLR_NC} ${CLR_H2}\${TARGET[name]}${CLR_NC}:${CLR_CMD}\${PIPELINE}${CLR_NC} ${CLR_DIM}→${CLR_NC} ${CLR_OK}\${ENV}${CLR_NC}"
            echo -e "${CLR_DIM}Files${CLR_NC}  ${CLR_ARG}\${ITEMS_OVERRIDE}${CLR_NC}"
            echo -e "${CLR_WARN}[DRY RUN]${CLR_NC}"
            echo -e "${CLR_DIM}────────────────────────────────────────${CLR_NC}"
            echo ""
            echo -e "  ${CLR_DIM}[skip]${CLR_NC} build:all ${CLR_DIM}(items specified → build each item)${CLR_NC}"
            echo ""
            echo -e "  ${CLR_CMD}[pre]${CLR_NC} \${BUILD[pre]}"
            echo -e "        ${CLR_DIM}↳ Runs once before first build${CLR_NC}"
            echo ""
            echo -e "  ${CLR_CMD}[build:\${ITEM}]${CLR_NC} \${BUILD[\${ITEM}.command]}"
            echo -e "        ${CLR_DIM}↳ Runs for each item in ITEMS_OVERRIDE${CLR_NC}"
            echo ""
            echo -e "  ${CLR_CMD}[build:index]${CLR_NC} \${BUILD[index.command]}"
            echo -e "        ${CLR_DIM}↳ Always runs (navigation)${CLR_NC}"
            echo ""
            echo -e "  ${CLR_CMD}[push]${CLR_NC} \${ENV[ssh]}:\${TARGET[cwd]}/"
            echo -e "    ${CLR_ARG}\${FILES[\${ITEM}]}${CLR_NC}              ${CLR_DIM}\${SIZE}${CLR_NC}"
            echo -e "    ${CLR_DIM}─────────────────────────────────────${CLR_NC}"
            echo -e "    ${CLR_DIM}\${FILE_COUNT} files              \${TOTAL_SIZE}${CLR_NC}"
            echo ""
            echo -e "${CLR_DIM}────────────────────────────────────────${CLR_NC}"
            echo -e "${CLR_OK}Done${CLR_NC} ${CLR_DIM}(\${DURATION}s)${CLR_NC}"
            echo ""
            _deploy_help_sub "Variable Sources (from TOML):"
            echo -e "  ${CLR_H2}TARGET[name]${CLR_NC}     ${CLR_DIM}[target] name = \"docs\"${CLR_NC}"
            echo -e "  ${CLR_H2}TARGET[cwd]${CLR_NC}      ${CLR_DIM}[target] cwd = \"/home/{{user}}/docs\"${CLR_NC}"
            echo -e "  ${CLR_CMD}PIPELINE${CLR_NC}         ${CLR_DIM}[pipeline] default = [\"build:all\", \"push\"]${CLR_NC}"
            echo -e "  ${CLR_ARG}FILES[gdocs]${CLR_NC}     ${CLR_DIM}[files] gdocs = \"gdocs-guide.html\"${CLR_NC}"
            echo -e "  ${CLR_CMD}BUILD[gdocs]${CLR_NC}     ${CLR_DIM}[build.gdocs] command = \"tut build...\"${CLR_NC}"
            echo -e "  ${CLR_OK}ENV[ssh]${CLR_NC}         ${CLR_DIM}[env.prod] ssh = \"root@1.2.3.4\"${CLR_NC}"
            ;;
        items)
            _deploy_help_section "ITEMS"
            echo ""
            _deploy_help_sub "File Selection Syntax:"
            _deploy_help_cmd "docs:gdocs" "Pipeline: run gdocs pipeline"
            _deploy_help_cmd "docs:{gdocs,deploy}" "Items: build+push specific items"
            _deploy_help_cmd "docs:~gdocs" "Shorthand: same as {gdocs}"
            _deploy_help_cmd "docs:{!index}" "Exclude: all except index"
            _deploy_help_cmd "docs:{@guides}" "Group: use [files.guides] list"
            _deploy_help_cmd "docs:>" "Push-only: skip all builds"
            _deploy_help_cmd "docs:>{gdocs}" "Push-only: specific files"
            echo ""
            _deploy_help_sub "Combined Syntax:"
            _deploy_help_cmd "docs:quick:{gdocs}" "Pipeline + items filter"
            _deploy_help_cmd "docs:quick:~gdocs" "Pipeline + shorthand"
            _deploy_help_cmd "docs:full -index" "Pipeline, exclude via flag"
            echo ""
            _deploy_help_sub "Behavior:"
            echo -e "  ${CLR_DIM}• {items} affects both build AND push steps${CLR_NC}"
            echo -e "  ${CLR_DIM}• build:all is replaced with build:<item> for each item${CLR_NC}"
            echo -e "  ${CLR_DIM}• build:index always runs (for navigation)${CLR_NC}"
            echo ""
            _deploy_help_sub "TOML Structure:"
            echo -e "  ${CLR_DIM}[files]${CLR_NC}"
            echo -e "  ${CLR_DIM}gdocs = \"gdocs-guide.html\"${CLR_NC}"
            echo -e "  ${CLR_DIM}deploy = \"deploy-ref.html\"${CLR_NC}"
            echo -e "  ${CLR_DIM}[files.guides]${CLR_NC}"
            echo -e "  ${CLR_DIM}include = [\"gdocs\", \"deploy\", \"org\"]${CLR_NC}"
            echo ""
            _deploy_help_sub "Examples:"
            _deploy_help_ex "deploy docs:{gdocs} prod         # build gdocs, push gdocs"
            _deploy_help_ex "deploy docs:~gdocs prod          # same, shorter"
            _deploy_help_ex "deploy docs:{!index,!tut} prod   # all except index,tut"
            _deploy_help_ex "deploy docs:{@guides} prod       # items from guides group"
            _deploy_help_ex "deploy docs:> prod               # just push, no build"
            _deploy_help_ex "deploy docs:>{gdocs} prod        # just push gdocs"
            ;;
        aliases)
            _deploy_help_section "ALIASES"
            echo ""
            _deploy_help_sub "Commands:"
            _deploy_help_cmd "o" "org"
            _deploy_help_cmd "t" "target"
            _deploy_help_cmd "e" "env"
            _deploy_help_cmd "i" "info"
            _deploy_help_cmd "c" "clear"
            _deploy_help_cmd "p" "push"
            _deploy_help_cmd "s" "show"
            _deploy_help_cmd "ls" "list"
            _deploy_help_cmd "hist" "history"
            _deploy_help_cmd "doc" "doctor"
            _deploy_help_cmd "h" "help"
            echo ""
            _deploy_help_sub "Subcommands:"
            _deploy_help_cmd "doctor r" "doctor reload"
            ;;
        *)
            # Main categorical help
            _deploy_help_section "deploy - deployment system"
            echo ""
            _deploy_help_sub "Quick Start:"
            _deploy_help_cmd "list" "List available targets"
            _deploy_help_cmd "<target> <env>" "Deploy target to env"
            _deploy_help_cmd "history" "Show recent deployments"
            echo ""
            _deploy_help_sub "Context Mode:"
            _deploy_help_cmd "set <org> <tgt> <env>" "Set all three at once"
            _deploy_help_cmd "target <name>" "Set target"
            _deploy_help_cmd "env <name>" "Set env"
            _deploy_help_cmd "deploy" "Deploy (confirms)"
            _deploy_help_cmd "info | clear" "Show/clear context"
            echo ""
            _deploy_help_sub "All Commands:"
            echo -e "  ${CLR_CMD}Context${CLR_NC}   ${CLR_DIM}set org target env info clear${CLR_NC}"
            echo -e "  ${CLR_CMD}Items${CLR_NC}     ${CLR_DIM}items run${CLR_NC}"
            echo -e "  ${CLR_CMD}Deploy${CLR_NC}    ${CLR_DIM}push show list${CLR_NC}"
            echo -e "  ${CLR_CMD}Monitor${CLR_NC}   ${CLR_DIM}history doctor${CLR_NC}"
            echo ""
            _deploy_help_sub "Help Topics:"
            echo -e "  ${CLR_ARG}taxonomy${CLR_NC} ${CLR_ARG}dry-run${CLR_NC} ${CLR_ARG}items${CLR_NC} ${CLR_ARG}context${CLR_NC} ${CLR_ARG}direct${CLR_NC} ${CLR_ARG}history${CLR_NC} ${CLR_ARG}targets${CLR_NC} ${CLR_ARG}vars${CLR_NC} ${CLR_ARG}modes${CLR_NC} ${CLR_ARG}aliases${CLR_NC}"
            ;;
    esac
}

# =============================================================================
# EXPORTS
# =============================================================================

