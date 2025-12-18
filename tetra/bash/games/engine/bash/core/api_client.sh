#!/usr/bin/env bash

# API Client - HTTP client for pbase-2600 (Arcade Token Machine)
# Endpoint: localhost:2600/*

# API Configuration
PBASE_HOST="${PBASE_HOST:-localhost}"
PBASE_PORT="${PBASE_PORT:-2600}"
PBASE_BASE_URL="http://${PBASE_HOST}:${PBASE_PORT}"
PBASE_TIMEOUT=2  # seconds

# ============================================================================
# CONNECTION CHECKS
# ============================================================================

# Check if pbase-2600 server is reachable
pbase_is_available() {
    # Try to connect with timeout
    if command -v nc &>/dev/null; then
        nc -z -w "$PBASE_TIMEOUT" "$PBASE_HOST" "$PBASE_PORT" 2>/dev/null
        return $?
    elif command -v timeout &>/dev/null; then
        timeout "$PBASE_TIMEOUT" bash -c "cat < /dev/null > /dev/tcp/$PBASE_HOST/$PBASE_PORT" 2>/dev/null
        return $?
    else
        # Fallback: try curl with short timeout
        curl -s --connect-timeout "$PBASE_TIMEOUT" -o /dev/null "$PBASE_BASE_URL/health" 2>/dev/null
        return $?
    fi
}

# ============================================================================
# HTTP HELPERS
# ============================================================================

# Make HTTP POST request to pbase-2600
# Args: endpoint, json_data, [auth_token]
# Returns: response body
pbase_post() {
    local endpoint="$1"
    local json_data="$2"
    local auth_token="$3"
    local url="${PBASE_BASE_URL}${endpoint}"

    if ! command -v curl &>/dev/null; then
        echo "Error: curl not found" >&2
        return 1
    fi

    local auth_header=""
    if [[ -n "$auth_token" ]]; then
        auth_header="-H \"Authorization: Bearer $auth_token\""
    fi

    local response
    response=$(curl -s \
        --connect-timeout "$PBASE_TIMEOUT" \
        --max-time $((PBASE_TIMEOUT * 2)) \
        -X POST \
        -H "Content-Type: application/json" \
        ${auth_header} \
        -d "$json_data" \
        "$url" 2>&1)

    local exit_code=$?

    if [[ $exit_code -ne 0 ]]; then
        echo "Error: pbase-2600 request failed (curl exit code: $exit_code)" >&2
        return 1
    fi

    echo "$response"
}

# Make HTTP GET request to pbase-2600
# Args: endpoint, [auth_token]
# Returns: response body
pbase_get() {
    local endpoint="$1"
    local auth_token="$2"
    local url="${PBASE_BASE_URL}${endpoint}"

    if ! command -v curl &>/dev/null; then
        echo "Error: curl not found" >&2
        return 1
    fi

    local auth_header=""
    if [[ -n "$auth_token" ]]; then
        auth_header="-H \"Authorization: Bearer $auth_token\""
    fi

    local response
    response=$(curl -s \
        --connect-timeout "$PBASE_TIMEOUT" \
        --max-time $((PBASE_TIMEOUT * 2)) \
        -X GET \
        ${auth_header} \
        "$url" 2>&1)

    local exit_code=$?

    if [[ $exit_code -ne 0 ]]; then
        echo "Error: pbase-2600 request failed (curl exit code: $exit_code)" >&2
        return 1
    fi

    echo "$response"
}

# ============================================================================
# JSON PARSING
# ============================================================================

# Parse JSON field (simple extraction, no jq required)
# Args: json_string, field_name
# Returns: field value
pbase_parse_json_field() {
    local json="$1"
    local field="$2"

    # Try jq if available (most accurate)
    if command -v jq &>/dev/null; then
        echo "$json" | jq -r ".$field" 2>/dev/null
        return $?
    fi

    # Fallback: regex extraction (works for simple cases)
    # Matches: "field": "value" or "field": value
    if [[ "$json" =~ \"$field\"[[:space:]]*:[[:space:]]*\"([^\"]*)\" ]]; then
        echo "${BASH_REMATCH[1]}"
        return 0
    elif [[ "$json" =~ \"$field\"[[:space:]]*:[[:space:]]*([^,}\]]+) ]]; then
        local value="${BASH_REMATCH[1]}"
        # Trim whitespace
        value=$(echo "$value" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        echo "$value"
        return 0
    fi

    return 1
}

# Check if JSON indicates success
pbase_is_success() {
    local json="$1"

    local success=$(pbase_parse_json_field "$json" "success")
    [[ "$success" == "true" ]]
}

# ============================================================================
# PBASE-2600 ENDPOINTS (Token Machine)
# ============================================================================

# Dispense tokens (create user)
# Args: name, type, org
# Returns: JSON response
pbase_dispense_token() {
    local name="$1"
    local type="${2:-provisional}"
    local org="${3:-tetra}"

    # Build JSON payload
    local json_payload=$(cat <<EOF
{
  "name": "$name",
  "type": "$type",
  "org": "$org"
}
EOF
)

    pbase_post "/token/dispense" "$json_payload"
}

# Validate token (check session)
# Args: access_token, session_id
# Returns: JSON response
pbase_validate_token() {
    local access_token="$1"
    local session_id="$2"

    local json_payload=$(cat <<EOF
{
  "session_id": "$session_id"
}
EOF
)

    pbase_post "/token/validate" "$json_payload" "$access_token"
}

# Check token balance
# Args: access_token
# Returns: JSON response
pbase_get_balance() {
    local access_token="$1"

    pbase_get "/token/balance" "$access_token"
}

# Spend tokens (start game session)
# Args: access_token, game, org, tokens
# Returns: JSON response
pbase_spend_tokens() {
    local access_token="$1"
    local game="$2"
    local org="${3:-tetra}"
    local tokens="${4:-1}"

    local json_payload=$(cat <<EOF
{
  "game": "$game",
  "org": "$org",
  "tokens": $tokens
}
EOF
)

    pbase_post "/token/spend" "$json_payload" "$access_token"
}

# Save game state
# Args: access_token, game, state_key, state_data_json
# Returns: JSON response
pbase_save_state() {
    local access_token="$1"
    local game="$2"
    local state_key="$3"
    local state_data="$4"

    local json_payload=$(cat <<EOF
{
  "game": "$game",
  "state_key": "$state_key",
  "state_data": $state_data
}
EOF
)

    pbase_post "/state/save" "$json_payload" "$access_token"
}

# Load game state
# Args: access_token, game, state_key
# Returns: JSON response
pbase_load_state() {
    local access_token="$1"
    local game="$2"
    local state_key="$3"

    pbase_get "/state/load?game=$game&state_key=$state_key" "$access_token"
}

# Health check
pbase_health() {
    pbase_get "/health"
}

# ============================================================================
# HIGH-LEVEL INTEGRATED FUNCTIONS
# ============================================================================

# Create user with pbase-2600 integration
# Falls back to local-only if pbase unavailable
# Args: name, type, org
# Returns: user_object (mix of local + pbase data)
pbase_create_user_integrated() {
    local name="$1"
    local type="${2:-provisional}"
    local org="${3:-tetra}"

    # Check pbase-2600 availability
    if ! pbase_is_available; then
        echo "Warning: pbase-2600 not available at $PBASE_HOST:$PBASE_PORT" >&2
        echo "Creating local-only account (multiplayer disabled)" >&2
        echo '{"success": false, "error": "pbase-2600 unavailable", "local_only": true}'
        return 1
    fi

    # Call pbase-2600
    local response
    response=$(pbase_dispense_token "$name" "$type" "$org" 2>&1)
    local exit_code=$?

    if [[ $exit_code -ne 0 ]]; then
        echo "Warning: pbase-2600 request failed" >&2
        echo '{"success": false, "error": "pbase-2600 request failed", "local_only": true}'
        return 1
    fi

    # Check response
    if pbase_is_success "$response"; then
        echo "$response"
        return 0
    else
        local error=$(pbase_parse_json_field "$response" "error")
        echo "Warning: pbase-2600 returned error: $error" >&2
        echo '{"success": false, "error": "'"$error"'", "local_only": true}'
        return 1
    fi
}

# Export functions
export -f pbase_is_available pbase_post pbase_get
export -f pbase_parse_json_field pbase_is_success
export -f pbase_dispense_token pbase_validate_token pbase_get_balance
export -f pbase_spend_tokens pbase_save_state pbase_load_state pbase_health
export -f pbase_create_user_integrated
