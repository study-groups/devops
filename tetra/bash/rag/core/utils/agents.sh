#!/usr/bin/env bash
# agents.sh - Unified agent profile management for RAG module
#
# Agent profiles define how to format MULTICAT output for different LLMs.
# They contain instructions, examples, and formatting rules for specific agents/endpoints.

# Get agent directories
get_agent_directories() {
  local sys_dir="${TETRA_SRC:-$(dirname "${BASH_SOURCE[0]}")/../..}/bash/rag/agents"
  local user_dir="${TETRA_DIR:-$HOME/.tetra}/rag/agents"

  echo "$sys_dir"
  echo "$user_dir"
}

# Load an agent profile
load_agent_profile() {
  local profile_name="$1"

  if [[ -z "$profile_name" ]]; then
    echo "Error: Agent profile name required" >&2
    return 1
  fi

  # Get directories
  local dirs
  mapfile -t dirs < <(get_agent_directories)
  local sys_dir="${dirs[0]}"
  local user_dir="${dirs[1]}"

  # Try user directory first, then system directory
  local user_profile="$user_dir/$profile_name.conf"
  local system_profile="$sys_dir/$profile_name.conf"

  if [[ -f "$user_profile" ]]; then
    source "$user_profile"
    echo "Loaded agent profile: $user_profile" >&2
    return 0
  elif [[ -f "$system_profile" ]]; then
    source "$system_profile"
    echo "Loaded agent profile: $system_profile" >&2
    return 0
  else
    echo "Warning: Agent profile not found for '$profile_name'" >&2
    return 1
  fi
}

# List all available agent profile names (for completion)
list_agent_names() {
  local dirs
  mapfile -t dirs < <(get_agent_directories)
  local sys_dir="${dirs[0]}"
  local user_dir="${dirs[1]}"

  local -A seen
  local profiles=()

  # System profiles
  if [[ -d "$sys_dir" ]]; then
    for conf in "$sys_dir"/*.conf; do
      [[ -f "$conf" ]] || continue
      local name=$(basename "$conf" .conf)
      if [[ -z "${seen[$name]:-}" ]]; then
        profiles+=("$name")
        seen["$name"]=1
      fi
    done
  fi

  # User profiles (override system)
  if [[ -d "$user_dir" ]]; then
    for conf in "$user_dir"/*.conf; do
      [[ -f "$conf" ]] || continue
      local name=$(basename "$conf" .conf)
      if [[ -z "${seen[$name]:-}" ]]; then
        profiles+=("$name")
        seen["$name"]=1
      fi
    done
  fi

  printf "%s\n" "${profiles[@]}" | sort -u
}

# List available agent profiles with descriptions (CLI display)
list_available_agents() {
  local format="${1:-cli}"  # cli, simple, or full

  local dirs
  mapfile -t dirs < <(get_agent_directories)
  local sys_dir="${dirs[0]}"
  local user_dir="${dirs[1]}"

  if [[ "$format" == "cli" ]]; then
    echo "Available Agent Profiles"
    echo "════════════════════════════════════════════════════════════"
    echo ""
    echo "Agent profiles define instructions and formatting for LLMs."
    echo ""
  elif [[ "$format" == "simple" ]]; then
    echo "Available Agent Profiles:"
    echo "─────────────────────────────────────────────────────────"
    echo ""
  fi

  local found=0

  # System profiles
  if [[ -d "$sys_dir" ]]; then
    for conf in "$sys_dir"/*.conf; do
      [[ -f "$conf" ]] || continue
      found=1
      local name=$(basename "$conf" .conf)
      local desc=$(grep '^AGENT_DESCRIPTION=' "$conf" 2>/dev/null | cut -d'"' -f2)

      if [[ "$format" == "cli" ]]; then
        printf "  %-20s %s\n" "$name" "${desc:-(system profile)}"
        printf "  └─ %s\n" "${conf/$HOME/~}"
        echo ""
      elif [[ "$format" == "simple" ]]; then
        printf "  %-20s %s\n" "$name" "${desc:-(system)}"
        printf "  └─ %s\n" "${conf/$HOME/~}"
      else
        echo "Profile: $name"
        echo "  Description: ${desc:-(system profile)}"
        echo "  Path: $conf"
        echo ""
      fi
    done
  fi

  # User profiles
  if [[ -d "$user_dir" ]]; then
    for conf in "$user_dir"/*.conf; do
      [[ -f "$conf" ]] || continue
      found=1
      local name=$(basename "$conf" .conf)
      local desc=$(grep '^AGENT_DESCRIPTION=' "$conf" 2>/dev/null | cut -d'"' -f2)

      if [[ "$format" == "cli" ]]; then
        printf "  %-20s %s\n" "$name" "${desc:-(user profile)}"
        printf "  └─ %s\n" "${conf/$HOME/~}"
        echo ""
      elif [[ "$format" == "simple" ]]; then
        printf "  %-20s %s\n" "$name" "${desc:-(user)}"
        printf "  └─ %s\n" "${conf/$HOME/~}"
      else
        echo "Profile: $name"
        echo "  Description: ${desc:-(user profile)}"
        echo "  Path: $conf"
        echo ""
      fi
    done
  fi

  if [[ $found -eq 0 ]]; then
    echo "  No agent profiles found."
    echo ""
    echo "  System directory: $sys_dir"
    echo "  User directory:   $user_dir"
    echo ""
  fi

  # Usage hints based on format
  if [[ "$format" == "cli" ]]; then
    echo "Usage:"
    echo "  rag set agent <name>               Use specific agent profile"
    echo "  rag list agents                    List all agent profiles"
    echo ""
  elif [[ "$format" == "simple" ]]; then
    echo ""
    echo "Usage: rag set agent <name>"
  fi
}

# Validate that an agent profile exists
validate_agent() {
  local profile_name="$1"

  local dirs
  mapfile -t dirs < <(get_agent_directories)
  local sys_dir="${dirs[0]}"
  local user_dir="${dirs[1]}"

  [[ -f "$sys_dir/$profile_name.conf" ]] || [[ -f "$user_dir/$profile_name.conf" ]]
}

# Get agent profile description
get_agent_description() {
  local profile_name="$1"

  local dirs
  mapfile -t dirs < <(get_agent_directories)
  local sys_dir="${dirs[0]}"
  local user_dir="${dirs[1]}"

  local user_profile="$user_dir/$profile_name.conf"
  local system_profile="$sys_dir/$profile_name.conf"

  if [[ -f "$user_profile" ]]; then
    grep '^AGENT_DESCRIPTION=' "$user_profile" 2>/dev/null | cut -d'"' -f2
  elif [[ -f "$system_profile" ]]; then
    grep '^AGENT_DESCRIPTION=' "$system_profile" 2>/dev/null | cut -d'"' -f2
  else
    echo "(profile not found)"
  fi
}
