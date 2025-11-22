#!/usr/bin/env bash

# MELVIN Knowledge Plugin: Tetra
# Tetra-specific conventions, patterns, and philosophy

# Load tetra-specific knowledge
melvin_load_tetra_knowledge() {
    # Add tetra-specific concepts to MELVIN_CONCEPTS
    MELVIN_CONCEPTS["strong_globals"]="TETRA_SRC must always be set - it's the foundation. Every module declares: : \"\${MOD_SRC:=\$TETRA_SRC/bash/modname}\" and : \"\${MOD_DIR:=\$TETRA_DIR/modname}\" with explicit exports."

    MELVIN_CONCEPTS["no_dotfiles"]="NEVER use . (dot) files in tetra. Configuration goes in TETRA_DIR, not hidden files. This is a core tetra principle."

    MELVIN_CONCEPTS["lazy_loading"]="Modules are registered in boot_modules.sh but not loaded until first use. Use tetra_register_module() and tetra_create_lazy_function() for lazy loading."

    MELVIN_CONCEPTS["dual_directory"]="Tetra separates code from state: TETRA_SRC is source code (read-only, git-tracked), TETRA_DIR is runtime data (read-write, ephemeral)."

    MELVIN_CONCEPTS["includes_guard"]="The : \"\${VAR:=default}\" pattern provides override guards - allows testing with different paths while having safe defaults."

    MELVIN_CONCEPTS["module_types"]="LIBRARY (includes.sh only), MODULE (has actions.sh), APP (has *_tui.sh), APP+MODULE (both actions and TUI)."

    MELVIN_CONCEPTS["boot_chain"]="Bootstrap: tetra.sh → bootloader.sh → boot_core.sh → boot_modules.sh. This chain must remain intact."

    MELVIN_CONCEPTS["bash_version"]="Tetra ALWAYS runs in bash 5.2+ and ALWAYS starts by sourcing ~/tetra/tetra.sh"

    MELVIN_CONCEPTS["module_structure"]="Standard structure: bash/modname/{includes.sh, modname.sh, actions.sh?, modname_repl.sh?, README.md}"

    MELVIN_CONCEPTS["tetra_self"]="The self module provides introspection, auditing, and maintenance. Use tetra-self for deep analysis when available."

    # Add tetra-specific pattern examples
    MELVIN_PATTERN_EXAMPLES["strong_globals"]="# In bash/mymod/includes.sh\n: \"\${MYMOD_SRC:=\$TETRA_SRC/bash/mymod}\"\n: \"\${MYMOD_DIR:=\$TETRA_DIR/mymod}\"\nexport MYMOD_SRC MYMOD_DIR"

    MELVIN_PATTERN_EXAMPLES["lazy_loading"]="# In bash/boot/boot_modules.sh\ntetra_register_module \"mymod\" \"\$TETRA_BASH/mymod\"\ntetra_create_lazy_function \"mymod_func\" \"mymod\""

    MELVIN_PATTERN_EXAMPLES["includes_pattern"]="# bash/modname/includes.sh\n: \"\${MOD_SRC:=\$TETRA_SRC/bash/modname}\"\n: \"\${MOD_DIR:=\$TETRA_DIR/modname}\"\nexport MOD_SRC MOD_DIR\nsource \"\$MOD_SRC/modname.sh\""

    # Enable tetra-self integration if available
    if [[ -n "$TETRA_SRC" ]] && [[ -f "$TETRA_SRC/bash/self/includes.sh" ]]; then
        # Source self module for deep integration
        if ! declare -f tetra_module_discover >/dev/null 2>&1; then
            source "$TETRA_SRC/bash/self/includes.sh" 2>/dev/null || true
        fi
        export MELVIN_HAS_SELF=1
    fi
}

# Tetra-specific concept explanations
melvin_explain_tetra_concept() {
    local concept="$1"

    case "$concept" in
        strong_globals)
            echo "🎓 Strong Globals: The Tetra Way"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo ""
            echo "TETRA_SRC is the bedrock - it MUST be set for anything to work."
            echo ""
            echo "Every module follows this pattern:"
            echo "  : \"\${MOD_SRC:=\$TETRA_SRC/bash/modname}\""
            echo "  : \"\${MOD_DIR:=\$TETRA_DIR/modname}\""
            echo "  export MOD_SRC MOD_DIR"
            echo ""
            echo "Why?"
            echo "  • MOD_SRC = source code location (read-only, in git)"
            echo "  • MOD_DIR = runtime data (read-write, ephemeral)"
            echo "  • Override guards (:) allow testing with custom paths"
            echo "  • Explicit exports make dependencies crystal clear"
            echo "  • Single source of truth prevents path confusion"
            echo ""
            melvin_find_tetra_examples "strong_globals"
            ;;

        no_dotfiles)
            echo "🚫 No Dotfiles Rule"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo ""
            echo "NEVER use . (dot) files. NEVER. NO .FILES."
            echo ""
            echo "If you find one, CHANGE IT immediately."
            echo ""
            echo "Why?"
            echo "  • Dotfiles hide problems"
            echo "  • Tetra values explicitness"
            echo "  • TETRA_DIR/ is for state, not ~/.config/"
            echo "  • Visible > Hidden"
            echo ""
            echo "✓ Use: \$TETRA_DIR/module/config.conf"
            echo "✗ Not: \$HOME/.module-config"
            ;;

        lazy_loading)
            echo "⏳ Lazy Loading Pattern"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo ""
            echo "Modules are registered but not loaded until first use."
            echo "This keeps shell startup fast."
            echo ""
            echo "In bash/boot/boot_modules.sh:"
            echo "  tetra_register_module \"modname\" \"\$TETRA_BASH/modname\""
            echo "  tetra_create_lazy_function \"modname_func\" \"modname\""
            echo ""
            echo "First call to modname_func() triggers module load."
            echo ""
            melvin_find_tetra_examples "lazy_loading"
            ;;

        *)
            # Use generic concept explanation
            melvin_explain_concept "$concept"
            ;;
    esac
}

# Find tetra-specific examples
melvin_find_tetra_examples() {
    local concept="$1"

    if [[ "$MELVIN_CONTEXT" != "tetra" ]]; then
        return 0
    fi

    case "$concept" in
        strong_globals)
            echo "Examples from tetra codebase:"
            find "$TETRA_SRC/bash" -name "includes.sh" -type f 2>/dev/null | head -5 | while read -r file; do
                local module=$(basename $(dirname "$file"))
                local line=$(grep -n "_SRC\|_DIR" "$file" 2>/dev/null | head -1 | cut -d: -f1)
                echo "  • bash/$module/includes.sh:${line:-?}"
            done
            echo ""
            ;;

        lazy_loading)
            if [[ -f "$TETRA_SRC/bash/boot/boot_modules.sh" ]]; then
                echo "Registered modules in boot_modules.sh:"
                grep -n "tetra_register_module" "$TETRA_SRC/bash/boot/boot_modules.sh" 2>/dev/null | head -5 | while read -r line; do
                    echo "  • $line"
                done
                echo ""
            fi
            ;;
    esac
}

# Analyze tetra health with insights
melvin_analyze_tetra_health() {
    if [[ "$MELVIN_CONTEXT" != "tetra" ]]; then
        return 0
    fi

    echo "🧠 MELVIN's Tetra Insights:"
    echo ""

    # Check for common issues
    local issues=()

    # Check for dotfiles (forbidden!)
    local dotfiles=$(find "$TETRA_SRC/bash" -name ".*" -type f 2>/dev/null | grep -v ".git" | head -5)
    if [[ -n "$dotfiles" ]]; then
        issues+=("⚠️  DOTFILES DETECTED! This violates tetra's no-dotfiles rule:")
        while read -r file; do
            issues+=("   ${file#$TETRA_SRC/}")
        done <<< "$dotfiles"
    fi

    # Check for modules missing strong globals
    for dir in "$TETRA_SRC/bash"/*; do
        [[ ! -d "$dir" ]] && continue
        local module=$(basename "$dir")
        [[ "$module" == "graveyard" ]] && continue

        if [[ -f "$dir/includes.sh" ]]; then
            local has_globals=$(grep -c "_SRC\|_DIR" "$dir/includes.sh" 2>/dev/null || echo 0)
            if [[ $has_globals -eq 0 ]]; then
                issues+=("⚠️  bash/$module/includes.sh missing strong globals")
            fi
        fi
    done

    # Report issues or give thumbs up
    if [[ ${#issues[@]} -gt 0 ]]; then
        for issue in "${issues[@]}"; do
            echo "$issue"
        done
        echo ""
        echo "💡 Run 'melvin ask' to learn about tetra patterns"
    else
        echo "✨ Tetra patterns look good!"
        echo ""
        echo "All modules following:"
        echo "  ✓ Strong globals pattern"
        echo "  ✓ No dotfiles rule"
        echo "  ✓ Proper structure"
    fi
}

# Register tetra knowledge domain
melvin_register_knowledge "tetra" "melvin_load_tetra_knowledge"

# Export functions
export -f melvin_load_tetra_knowledge
export -f melvin_explain_tetra_concept
export -f melvin_find_tetra_examples
export -f melvin_analyze_tetra_health
