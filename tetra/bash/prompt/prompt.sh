# Prompt settings
ENABLE_GIT=true        # Enables Git branch display
SHOW_PYTHON=true       # Shows 'p' if Python is available
SHOW_NODE=true         # Shows 'n' if Node.js is available
SHOW_LOGTIME=true      # Shows logtime if LT_PROMPT_ENABLE is set
MULTILINE=false        # Set to true for a multi-line prompt

# Prompt codes for customization
tetra_prompt_show_codes() {
    cat <<EOF
# Reference only
promptUser="\u"
promptHostShort="\h"
promptHostFull="\H"
promptDirShort="\W"
promptDirFull="\w"
promptTime24="\t"
promptTime12="@"
promptTime24Full="\T"
promptDate="\d"
promptHistoryNum="!"
promptCmdNum="#"
promptRootOrUser="\$"
promptLastExit="?"
u="\u"
h="\h"
H="\H"
dir="\W"
dirFull="\w"
t24="\t"
t12="@"
t24full="\T"
date="\d"
historyNum="!"
cmdNum="#"
rootOrUser="\$"
lastExit="?"
EOF
}

# Check for Python and Node.js availability
tetra_prompt_check_python() {
    if command -v python >/dev/null 2>&1; then
        echo "p"   # Display 'p' if Python is present
    fi
}

tetra_prompt_check_node() {
    if command -v node >/dev/null 2>&1; then
        echo "n"   # Display 'n' if Node.js is present
    fi
}

# Get the current Git branch
tetra_prompt_git_branch() {
    if [[ "${ENABLE_GIT}" == "true" ]]; then
        git branch 2>/dev/null | grep "^\* " | colrm 1 2  # Get current git branch
    fi
}

# Display logtime if available
tetra_prompt_logtime() {
    if [[ "${SHOW_LOGTIME}" == "true" ]] && command -v _logtime-elapsed-hms >/dev/null 2>&1; then
        _logtime-elapsed-hms  # Display logtime if available
    fi
}

# Build the prompt dynamically based on configuration
tetra_prompt() {
    local logtime
    local status=""
    local git_branch
    local username="\u"
    local hostname="\h"
    local dirShort="[\W]"
    local dirLong="[\w]"

    logtime="$(tetra_prompt_logtime)"
    git_branch="$(tetra_prompt_git_branch)"

    [[ "${SHOW_PYTHON}" == "true" ]] && status+=$(tetra_prompt_check_python)
    [[ "${SHOW_NODE}" == "true" ]] && status+=$(tetra_prompt_check_node)

    if [[ -n "$status" ]]; then
        status="($status)"  # Wrap indicators in parentheses
    fi

    if [[ -n "$logtime" ]]; then
        logtime="[$logtime]"
    fi

    if [[ -n "$git_branch" ]]; then
        git_branch="($git_branch)"
    fi

    local COLOR_RESET='\[\e[0m\]'
    local COLOR_YELLOW='\[\e[0;38;5;228m\]'
    local COLOR_CYAN='\[\e[0;38;5;51m\]'
    
    # Multiline prompt construction
    if [[ "${MULTILINE}" == "true" ]]; then
        PS1="${COLOR_RESET}${logtime}$status${COLOR_CYAN}${dirLong}${COLOR_RESET}${git_branch}\n"
        PS1+="${COLOR_YELLOW}${username}${COLOR_RESET}@${hostname}: "
    else
        PS1="${COLOR_RESET}$status${logtime}${COLOR_YELLOW}${username}@${COLOR_RESET}${hostname}"
        PS1+="${COLOR_CYAN}${dirShort}${COLOR_RESET}${git_branch}: "
    fi
    if [[ "${MULTILINE}" == "tiny" ]]; then
        PS1="${COLOR_YELLOW}${username}${COLOR_RESET}@${hostname}: "
    fi 
}

# Activate the custom prompt dynamically
PROMPT_COMMAND="tetra_prompt"

# Define colors with 256-color support
tetra_prompt_colors() {
    # Reset
    NO_COLOR='\[\e[0m\]'
    
    # Standard Colors (using 256 color palette)
    local Red='\[\e[0;38;5;196m\]'    # Bright Red
    local Green='\[\e[0;38;5;46m\]'   # Bright Green
    local Yellow='\[\e[0;38;5;228m\]'  # Light Yellow
    local Blue='\[\e[0;38;5;33m\]'     # Bright Blue
    local Purple='\[\e[0;38;5;129m\]'  # Bright Purple
    local Cyan='\[\e[0;38;5;51m\]'     # Bright Cyan
    local White='\[\e[0;38;5;255m\]'   # Bright White
    
    # Bold Colors
    local BBlack='\[\e[1;30m\]'         # Bold Black
    local BRed='\[\e[1;31m\]'           # Bold Red
    local BGreen='\[\e[1;32m\]'         # Bold Green
    local BYellow='\[\e[1;33m\]'        # Bold Yellow
    local BBlue='\[\e[1;34m\]'          # Bold Blue
    local BPurple='\[\e[1;35m\]'        # Bold Purple
    local BCyan='\[\e[1;36m\]'          # Bold Cyan
    local BWhite='\[\e[1;37m\]'         # Bold White
    
    # Background Colors
    local On_Black='\[\e[40m\]'         # Background Black
    local On_Red='\[\e[41m\]'           # Background Red
    local On_Green='\[\e[42m\]'         # Background Green
    local On_Yellow='\[\e[43m\]'        # Background Yellow
    local On_Blue='\[\e[44m\]'          # Background Blue
    local On_Purple='\[\e[45m\]'        # Background Purple
    local On_Cyan='\[\e[46m\]'          # Background Cyan
    local On_White='\[\e[47m\]'         # Background White
}

# Call to set the colors
tetra_prompt_colors

# Activate the custom prompt
# Call in bootstrap.sh
#PROMPT_COMMAND="tetra_prompt"
