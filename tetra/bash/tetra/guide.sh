#!/usr/bin/env bash
# guide.sh - Color-coded terminal reference for tetra
#
# Usage: tetra guide [topic]
# Topics: (default), sections, envs, quickstart, commands

_tetra_guide() {
    local topic="${1:-pipeline}"

    local C="\033[0;36m" Y="\033[1;33m" G="\033[0;32m"
    local B="\033[1;34m" D="\033[0;90m" W="\033[1;37m" NC="\033[0m"

    case "$topic" in
        pipeline|overview|"")
            _tetra_guide_pipeline
            ;;
        sections|section)
            _tetra_guide_sections
            ;;
        envs|env|environments)
            _tetra_guide_envs
            ;;
        quickstart|quick|start)
            _tetra_guide_quickstart
            ;;
        commands|cmd|cmds)
            _tetra_guide_commands
            ;;
        help|h|--help|-h)
            _tetra_guide_help
            ;;
        *)
            echo "Unknown topic: $topic"
            echo ""
            _tetra_guide_help
            return 1
            ;;
    esac
}

_tetra_guide_help() {
    local C="\033[0;36m" Y="\033[1;33m" NC="\033[0m"
    echo -e "${Y}tetra guide${NC} [topic]"
    echo ""
    echo -e "  ${C}pipeline${NC}    Configuration pipeline overview (default)"
    echo -e "  ${C}sections${NC}    Section numbering and contents"
    echo -e "  ${C}envs${NC}        How environments work"
    echo -e "  ${C}quickstart${NC}  Step-by-step new org setup"
    echo -e "  ${C}commands${NC}    Common command reference"
}

_tetra_guide_pipeline() {
    local C="\033[0;36m" Y="\033[1;33m" G="\033[0;32m"
    local B="\033[1;34m" D="\033[0;90m" W="\033[1;37m" NC="\033[0m"

    echo -e "${W}THE TETRA CONFIGURATION PIPELINE${NC}"
    echo ""
    echo -e "  ${B}DigitalOcean API${NC}"
    echo -e "       ${D}|${NC}"
    echo -e "  ${C}Nodeholder${NC} (~/nh/)        Fetches infrastructure snapshots"
    echo -e "       ${D}|${NC}"
    echo -e "  ${Y}digocean.json${NC}             The bridge contract (JSON)"
    echo -e "       ${D}|${NC}"
    echo -e "  ${G}nhb_import${NC}                Converts JSON -> TOML partial"
    echo -e "       ${D}|${NC}"
    echo -e "  ${C}sections/${NC}                 Numbered partials (00-org, 10-infra, 20-storage...)"
    echo -e "       ${D}|${NC}"
    echo -e "  ${G}org build${NC}                 Assembles sections -> tetra.toml"
    echo -e "       ${D}|${NC}"
    echo -e "  ${Y}tetra.toml${NC}                Compiled single source of truth"
    echo -e "       ${D}|${NC}"
    echo -e "  ${G}org switch${NC}                Activates org, exports \$dev \$staging \$prod"
    echo ""
    echo -e "${W}KEY RULES${NC}"
    echo -e "  ${D}-${NC} Only ${G}nhb_import${NC} touches 10-infrastructure.toml"
    echo -e "  ${D}-${NC} Only ${G}org build${NC} writes tetra.toml"
    echo -e "  ${D}-${NC} Never edit tetra.toml directly"
}

_tetra_guide_sections() {
    local C="\033[0;36m" Y="\033[1;33m" G="\033[0;32m" D="\033[0;90m"
    local W="\033[1;37m" NC="\033[0m"

    echo -e "${W}SECTION NUMBERING${NC}"
    echo ""
    echo -e "  ${C}00-org.toml${NC}              ${D}[org]${NC} Organization identity (name, type)"
    echo -e "  ${C}10-infrastructure.toml${NC}   ${D}[env.*]${NC} Environments + SSH connectors"
    echo -e "                            ${D}Written by nhb_import, safe to re-import${NC}"
    echo -e "  ${C}20-storage.toml${NC}          ${D}[storage.*]${NC} S3/Spaces configuration"
    echo -e "  ${C}25-pdata.toml${NC}            ${D}[pdata]${NC} Project data organization"
    echo -e "  ${C}30-resources.toml${NC}        ${D}[resources.*]${NC} Application assets"
    echo -e "  ${C}40-services.toml${NC}         ${D}[services]${NC} Service definitions + ports"
    echo -e "  ${C}50-custom.toml${NC}           ${D}[notes]${NC} User customizations (never overwritten)"
    echo ""
    echo -e "${W}CONVENTION${NC}"
    echo -e "  ${D}-${NC} Numeric prefix = sort order (00 before 10 before 20)"
    echo -e "  ${D}-${NC} Gaps allow inserting new sections (15-dns.toml, 35-auth.toml)"
    echo -e "  ${D}-${NC} Only 10-infrastructure is auto-generated; all others are manual"
}

_tetra_guide_envs() {
    local C="\033[0;36m" Y="\033[1;33m" G="\033[0;32m" D="\033[0;90m"
    local W="\033[1;37m" NC="\033[0m"

    echo -e "${W}ENVIRONMENTS${NC}"
    echo ""
    echo -e "  ${C}[env.local]${NC}    Local development machine (no SSH)"
    echo -e "  ${C}[env.dev]${NC}      Development server"
    echo -e "  ${C}[env.staging]${NC}  QA / staging server"
    echo -e "  ${C}[env.prod]${NC}     Production server"
    echo ""
    echo -e "${W}FIELDS${NC}"
    echo -e "  ${Y}host${NC}         IP address or hostname"
    echo -e "  ${Y}auth_user${NC}    SSH user for key deployment (usually root)"
    echo -e "  ${Y}work_user${NC}    SSH user for operations (matches env name)"
    echo -e "  ${Y}private_ip${NC}   Private network IP (if available)"
    echo -e "  ${Y}domain${NC}       DNS name (prod=base, others=env.base)"
    echo ""
    echo -e "${W}SHELL VARIABLES${NC} (after org switch)"
    echo -e "  ${G}\$dev${NC}         = dev server IP      ${D}ssh root@\$dev${NC}"
    echo -e "  ${G}\$staging${NC}     = staging server IP   ${D}ssh root@\$staging${NC}"
    echo -e "  ${G}\$prod${NC}        = prod server IP      ${D}ssh root@\$prod${NC}"
    echo ""
    echo -e "${W}DETECTION${NC}"
    echo -e "  Droplet tags/names are auto-detected:"
    echo -e "  ${D}prod, production${NC} -> prod"
    echo -e "  ${D}staging, qa${NC}      -> staging"
    echo -e "  ${D}dev, development${NC} -> dev"
    echo -e "  Override with ${C}env-map.conf${NC} next to digocean.json"
}

_tetra_guide_quickstart() {
    local C="\033[0;36m" Y="\033[1;33m" G="\033[0;32m" D="\033[0;90m"
    local W="\033[1;37m" NC="\033[0m"

    echo -e "${W}QUICKSTART: New Org Setup${NC}"
    echo ""
    echo -e "  ${Y}1.${NC} Initialize tetra (first time only)"
    echo -e "     ${G}tetra init${NC}"
    echo -e "     ${G}tetra install all${NC}"
    echo ""
    echo -e "  ${Y}2.${NC} Create org structure"
    echo -e "     ${G}org init myorg${NC}"
    echo ""
    echo -e "  ${Y}3.${NC} Import infrastructure ${D}(if you have digocean.json)${NC}"
    echo -e "     ${G}nhb_import ~/nh/myorg/digocean.json myorg${NC}"
    echo ""
    echo -e "  ${Y}4.${NC} Edit other sections"
    echo -e "     ${G}\$EDITOR \$TETRA_DIR/orgs/myorg/sections/20-storage.toml${NC}"
    echo ""
    echo -e "  ${Y}5.${NC} Build and activate"
    echo -e "     ${G}org build myorg${NC}"
    echo -e "     ${G}org switch myorg${NC}"
    echo ""
    echo -e "  ${Y}6.${NC} Deploy keys and services"
    echo -e "     ${G}tkm init && tkm gen all${NC}"
    echo -e "     ${G}tkm deploy all${NC}"
}

_tetra_guide_commands() {
    local C="\033[0;36m" Y="\033[1;33m" G="\033[0;32m" D="\033[0;90m"
    local W="\033[1;37m" NC="\033[0m"

    echo -e "${W}COMMON COMMANDS${NC}"
    echo ""
    echo -e "${Y}ORGANIZATION${NC}"
    echo -e "  ${G}org list${NC}                 List all orgs"
    echo -e "  ${G}org init${NC} <name>          Create org from template"
    echo -e "  ${G}org build${NC} [name]         Assemble sections -> tetra.toml"
    echo -e "  ${G}org switch${NC} <name>        Activate org"
    echo -e "  ${G}org sections${NC} [name]      List source section files"
    echo -e "  ${G}org view${NC}                 View active tetra.toml"
    echo -e "  ${G}org get${NC} <path>           Get value (e.g. env.dev.host)"
    echo ""
    echo -e "${Y}INFRASTRUCTURE${NC}"
    echo -e "  ${G}nhb_import${NC} <json> <org>  Import digocean.json"
    echo -e "  ${G}nhb_list${NC} <json>          Preview droplets (dry run)"
    echo -e "  ${G}nhb_status${NC}               Show Nodeholder availability"
    echo ""
    echo -e "${Y}TETRA${NC}"
    echo -e "  ${G}tetra status${NC}             Show loaded modules + paths"
    echo -e "  ${G}tetra doctor${NC}             Health check"
    echo -e "  ${G}tetra config${NC}             Show toggles"
    echo -e "  ${G}tetra init${NC}               Create ~/tetra/ skeleton"
    echo -e "  ${G}tetra install${NC} <runtime>  Install nvm|bun|python|all"
    echo -e "  ${G}tetra guide${NC} [topic]      This reference"
    echo ""
    echo -e "${Y}SERVICES${NC}"
    echo -e "  ${G}tsm start${NC} <service>      Start a service"
    echo -e "  ${G}tsm stop${NC} <service>       Stop a service"
    echo -e "  ${G}tsm list${NC}                 List running services"
}

export -f _tetra_guide _tetra_guide_help
export -f _tetra_guide_pipeline _tetra_guide_sections
export -f _tetra_guide_envs _tetra_guide_quickstart _tetra_guide_commands
