#!/usr/bin/env bash

# Modal Popup System
# Display modal dialogs for errors and confirmations

# Show modal error with acknowledgment required
show_modal_error() {
    local action="$1"
    local error_msg="${2:-Unknown error}"
    local action_name="${action//:/_}"

    # Get action details
    local can=$(get_action_can "$action")
    local cannot=$(get_action_cannot "$action")

    # Modal dimensions
    local width=60
    local term_width=${COLUMNS:-80}
    local padding=$(( (term_width - width) / 2 ))
    [[ $padding -lt 0 ]] && padding=0

    # Build modal content
    local modal=""
    modal+="$(printf '%*s' $padding '')┌$(printf '%*s' $((width-2)) '' | tr ' ' '─')┐\n"
    modal+="$(printf '%*s' $padding '')│$(printf ' %-*s' $((width-2)) ' ✗ Action Failed')│\n"
    modal+="$(printf '%*s' $padding '')├$(printf '%*s' $((width-2)) '' | tr ' ' '─')┤\n"
    modal+="$(printf '%*s' $padding '')│$(printf ' %-*s' $((width-2)) " Action: $action")│\n"
    modal+="$(printf '%*s' $padding '')│$(printf ' %-*s' $((width-2)) " State:  error")│\n"
    modal+="$(printf '%*s' $padding '')│$(printf ' %-*s' $((width-2)) "")│\n"
    modal+="$(printf '%*s' $padding '')│$(printf ' %-*s' $((width-2)) " Error: $error_msg")│\n"
    modal+="$(printf '%*s' $padding '')│$(printf ' %-*s' $((width-2)) "")│\n"
    modal+="$(printf '%*s' $padding '')│$(printf ' %-*s' $((width-2)) " This action CANNOT:")│\n"
    modal+="$(printf '%*s' $padding '')│$(printf ' %-*s' $((width-2)) "  • $cannot")│\n"
    modal+="$(printf '%*s' $padding '')│$(printf ' %-*s' $((width-2)) "")│\n"
    modal+="$(printf '%*s' $padding '')│$(printf ' %-*s' $((width-2)) " This action CAN:")│\n"
    modal+="$(printf '%*s' $padding '')│$(printf ' %-*s' $((width-2)) "  • $can")│\n"
    modal+="$(printf '%*s' $padding '')│$(printf ' %-*s' $((width-2)) "")│\n"
    modal+="$(printf '%*s' $padding '')│$(printf ' %-*s' $((width-2)) " [Press Enter to acknowledge]")│\n"
    modal+="$(printf '%*s' $padding '')└$(printf '%*s' $((width-2)) '' | tr ' ' '─')┘\n"

    echo -e "$modal"
}

# Show modal success (brief notification)
show_modal_success() {
    local action="$1"
    local message="${2:-Action completed successfully}"

    local width=50
    local term_width=${COLUMNS:-80}
    local padding=$(( (term_width - width) / 2 ))
    [[ $padding -lt 0 ]] && padding=0

    local modal=""
    modal+="$(printf '%*s' $padding '')┌$(printf '%*s' $((width-2)) '' | tr ' ' '─')┐\n"
    modal+="$(printf '%*s' $padding '')│$(printf ' %-*s' $((width-2)) ' ✓ Success')│\n"
    modal+="$(printf '%*s' $padding '')├$(printf '%*s' $((width-2)) '' | tr ' ' '─')┤\n"
    modal+="$(printf '%*s' $padding '')│$(printf ' %-*s' $((width-2)) " $action")│\n"
    modal+="$(printf '%*s' $padding '')│$(printf ' %-*s' $((width-2)) " $message")│\n"
    modal+="$(printf '%*s' $padding '')└$(printf '%*s' $((width-2)) '' | tr ' ' '─')┘\n"

    echo -e "$modal"
}

# Show modal info (general purpose)
show_modal_info() {
    local title="$1"
    local message="$2"

    local width=50
    local term_width=${COLUMNS:-80}
    local padding=$(( (term_width - width) / 2 ))
    [[ $padding -lt 0 ]] && padding=0

    local modal=""
    modal+="$(printf '%*s' $padding '')┌$(printf '%*s' $((width-2)) '' | tr ' ' '─')┐\n"
    modal+="$(printf '%*s' $padding '')│$(printf ' %-*s' $((width-2)) " $title")│\n"
    modal+="$(printf '%*s' $padding '')├$(printf '%*s' $((width-2)) '' | tr ' ' '─')┤\n"
    modal+="$(printf '%*s' $padding '')│$(printf ' %-*s' $((width-2)) " $message")│\n"
    modal+="$(printf '%*s' $padding '')└$(printf '%*s' $((width-2)) '' | tr ' ' '─')┘\n"

    echo -e "$modal"
}
