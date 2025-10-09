#!/usr/bin/env bash

# Enhanced function signatures with rich formatting
# Replacement for show_function_signatures() in input.sh

show_function_signatures_enhanced() {
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local mode="${MODES[$MODE_INDEX]}"
    local actions=($(get_actions))

    # Generate clean, working documentation
    {
        # Simple header with working colors using printf %b
        echo
        printf '%b' "\033[1;33mTView Action System\033[0m\n"
        echo "==================="
        echo

        # Context information
        printf '%b' "\033[1;36mActive Context:\033[0m $env\n"
        printf '%b' "\033[1;35mCurrent Mode:\033[0m $mode\n"
        printf '%b' "\033[2mScope:\033[0m This context defines available operations and resource scope\n"
        echo

        printf '%b' "\033[1;32mAvailable Transformations:\033[0m\n"
        echo "---------------------------"

        # Simple action listing that actually works
        for i in "${!actions[@]}"; do
            local action="${actions[$i]}"
            if [[ "$action" == *:* ]]; then
                local verb="${action%%:*}"
                local noun="${action##*:}"
                local result_type=$(get_result_type "$verb" "$noun" "$mode")
                local tag=$(get_mode_tag "$mode" "$verb" "$noun")

                # Current action highlighted, others dimmed
                if [[ $i -eq $ACTION_INDEX ]]; then
                    printf '%b' "\033[1;33m$((i+1)). $(render_action_verb_noun "$verb" "$noun") → @$result_type[$tag]\033[0m\n"
                else
                    printf '%b' "\033[2m$((i+1)). $(render_action_verb_noun "$verb" "$noun") → @$result_type[$tag]\033[0m\n"
                fi

                # Simple but informative descriptions
                echo
                case "$verb:$noun" in
                    "show:demo")
                        format_paragraph_text "\033[1;32mCore Function:\033[0m" "Renders active transformation context"
                        format_paragraph_text "\033[1;34mArchitecture:\033[0m" "Demonstrates E×M algebra through TUI"
                        format_paragraph_text "\033[1;35mVisual System:\033[0m" "Showcases color palette architecture"
                        ;;
                    "show:colors")
                        format_paragraph_text "\033[1;32mPalette System:\033[0m" "ENV/MODE/VERBS/NOUNS color organization"
                        format_paragraph_text "\033[1;34mDesign Tokens:\033[0m" "Semantic tokens for consistent styling"
                        format_paragraph_text "\033[1;35mColor Science:\033[0m" "RGB distance algorithms and WCAG compliance"
                        ;;
                    "show:input"|"show:tui")
                        format_paragraph_text "\033[1;32mInterface:\033[0m" "Complete input handling with gamepad/REPL modes"
                        format_paragraph_text "\033[1;34mNavigation:\033[0m" "e,d,f patterns + i/k controls + arrow keys"
                        format_paragraph_text "\033[1;35mEvents:\033[0m" "Component-based pub/sub with reactive components"
                        ;;
                    "configure:"*)
                        format_paragraph_text "\033[1;32mConfiguration:\033[0m" "verb×noun state editing interface"
                        format_paragraph_text "\033[1;34mIntegration:\033[0m" "Unified Module configuration patterns"
                        format_paragraph_text "\033[1;35mState Management:\033[0m" "Change detection and event publishing"
                        ;;
                    "test:"*)
                        format_paragraph_text "\033[1;32mValidation:\033[0m" "Transformation correctness testing"
                        format_paragraph_text "\033[1;34mIsolation:\033[0m" "Perfect Context isolation guarantees"
                        format_paragraph_text "\033[1;35mQuality:\033[0m" "Integration testing and verification"
                        ;;
                esac

                echo
            fi
        done

        echo
        printf '%b' "\033[1;33mTetra Architecture Foundations:\033[0m\n"
        echo "==============================="
        echo

        format_paragraph_text "\033[1;36mEnvironment:\033[0m" "Execution context determining available resources"
        format_paragraph_text "\033[1;35mModule:\033[0m" "Self-contained units with standardized interfaces"
        format_paragraph_text "\033[1;32mTransformation:\033[0m" "Type-safe operations with guaranteed consistency"
        format_paragraph_text "\033[1;34mContext Algebra:\033[0m" "Mathematical foundation for composable operations"
        format_paragraph_text "\033[1;31mVerb×Noun:\033[0m" "UI state mechanism for configuration editing"
        echo

        printf '%b' "\033[1;33mDesign Philosophy:\033[0m\n"
        echo "=================="
        echo

        printf "    "; apply_paragraph_brightness "• Universal interface through verb×noun interactions"; printf "\n"
        printf "    "; apply_paragraph_brightness "• Modular architecture with seamless capability integration"; printf "\n"
        printf "    "; apply_paragraph_brightness "• Event-driven design with automatic UI synchronization"; printf "\n"

    } | less -R

    # Clear screen after less exits
    clear_ui_content
}