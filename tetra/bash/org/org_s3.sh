#!/usr/bin/env bash
# org_s3.sh - S3-compatible object storage (AWS S3, DO Spaces, MinIO, etc.)
#
# Commands:
#   org s3 list           List configured buckets and remote buckets
#   org s3 init <name>    Create bucket, configure [s3.<name>] in tetra.toml
#   org s3 status [name]  Show bucket connectivity status
#   org s3 test [name]    Upload/download test object
#
# Configuration:
#   [s3.logs]
#   bucket = "myorg-logs"
#   endpoint = "https://nyc3.digitaloceanspaces.com"  # omit for AWS
#   region = "nyc3"
#
# Credentials: AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY
#              or DO_SPACES_KEY/DO_SPACES_SECRET (auto-mapped)

# === HELPERS ===

# List all [s3.*] config names from tetra.toml
_org_s3_list_configs() {
    local toml
    toml=$(org_toml_path 2>/dev/null) || return 1
    grep -E '^\[s3\.[^\]]+\]' "$toml" 2>/dev/null | sed 's/\[s3\.//;s/\]//'
}

# Get s3 config for a specific name
# Usage: _org_s3_get_config <name>
# Sets: S3_BUCKET, S3_ENDPOINT, S3_REGION, S3_PREFIX
_org_s3_get_config() {
    local name="$1"
    local toml
    toml=$(org_toml_path 2>/dev/null) || return 1

    local in_section=0
    S3_BUCKET="" S3_ENDPOINT="" S3_REGION="us-east-1" S3_PREFIX=""

    while IFS= read -r line; do
        [[ "$line" =~ ^\[s3\.$name\] ]] && { in_section=1; continue; }
        [[ "$line" =~ ^\[.*\] ]] && { [[ $in_section -eq 1 ]] && break; in_section=0; }
        [[ $in_section -eq 0 ]] && continue

        if [[ "$line" =~ ^bucket[[:space:]]*=[[:space:]]*\"?([^\"]+)\"? ]]; then
            S3_BUCKET="${BASH_REMATCH[1]}"
        elif [[ "$line" =~ ^endpoint[[:space:]]*=[[:space:]]*\"?([^\"]+)\"? ]]; then
            S3_ENDPOINT="${BASH_REMATCH[1]}"
        elif [[ "$line" =~ ^region[[:space:]]*=[[:space:]]*\"?([^\"]+)\"? ]]; then
            S3_REGION="${BASH_REMATCH[1]}"
        elif [[ "$line" =~ ^prefix[[:space:]]*=[[:space:]]*\"?([^\"]+)\"? ]]; then
            S3_PREFIX="${BASH_REMATCH[1]}"
        fi
    done < "$toml"

    [[ -n "$S3_BUCKET" ]]
}

# Setup AWS CLI credentials (supports DO_SPACES_* or AWS_* vars)
_org_s3_setup_creds() {
    if [[ -z "$AWS_ACCESS_KEY_ID" && -n "$DO_SPACES_KEY" ]]; then
        export AWS_ACCESS_KEY_ID="$DO_SPACES_KEY"
        export AWS_SECRET_ACCESS_KEY="$DO_SPACES_SECRET"
    fi

    if [[ -z "$AWS_ACCESS_KEY_ID" || -z "$AWS_SECRET_ACCESS_KEY" ]]; then
        echo "Missing S3 credentials" >&2
        echo "Set: AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY or DO_SPACES_KEY/DO_SPACES_SECRET" >&2
        return 1
    fi
    export AWS_DEFAULT_REGION="${S3_REGION:-us-east-1}"
}

# Build aws s3 command with optional endpoint
_org_s3_cmd() {
    echo "aws s3${S3_ENDPOINT:+ --endpoint-url $S3_ENDPOINT}"
}

# === LIST ===

org_s3_list() {
    echo "S3 Buckets"
    echo ""

    # List configured buckets
    local configs
    configs=$(_org_s3_list_configs 2>/dev/null)

    if [[ -n "$configs" ]]; then
        echo "Configured:"
        while read -r name; do
            if _org_s3_get_config "$name"; then
                local provider="AWS"
                [[ "$S3_ENDPOINT" == *digitalocean* ]] && provider="DO"
                [[ "$S3_ENDPOINT" == *minio* ]] && provider="MinIO"
                printf "  %-12s %-25s %s\n" "$name" "$S3_BUCKET" "$provider"
            fi
        done <<< "$configs"
        echo ""
    fi

    # List remote buckets if credentials available
    if _org_s3_setup_creds 2>/dev/null; then
        # Use first config's endpoint or default
        local first_config
        first_config=$(echo "$configs" | head -1)
        if [[ -n "$first_config" ]]; then
            _org_s3_get_config "$first_config"
        fi

        echo "Remote${S3_ENDPOINT:+ ($S3_ENDPOINT)}:"
        local cmd
        cmd=$(_org_s3_cmd)
        $cmd ls 2>/dev/null | while read -r line; do
            local bucket_name="${line##* }"
            printf "  %s\n" "$bucket_name"
        done
    fi
}

# === INIT ===

org_s3_init() {
    local name="$1"
    local org_name="${2:-$(org_active 2>/dev/null)}"
    [[ "$org_name" == "$ORG_NO_ACTIVE" ]] && org_name=""

    if [[ -z "$name" ]]; then
        echo "Usage: org s3 init <name> [org]" >&2
        echo "Example: org s3 init logs" >&2
        return 1
    fi

    if [[ -z "$org_name" ]]; then
        echo "No active org. Specify org name or run: org switch <name>" >&2
        return 1
    fi

    local org_dir="$TETRA_DIR/orgs/$org_name"
    [[ ! -d "$org_dir" ]] && { echo "Org not found: $org_name" >&2; return 1; }

    echo "S3 Init: $name (org: $org_name)"
    echo ""

    if ! command -v aws &>/dev/null; then
        echo "AWS CLI not found. Install: brew install awscli" >&2
        return 1
    fi

    if ! _org_s3_setup_creds; then
        return 1
    fi

    # Provider selection
    echo "Provider:"
    echo "  1) DigitalOcean Spaces"
    echo "  2) AWS S3"
    echo "  3) Custom endpoint"
    echo -n "Select [1-3]: "
    read -r provider

    local endpoint="" region=""

    case "$provider" in
        1)
            echo ""
            echo "Region: 1)nyc3 2)sfo3 3)ams3 4)sgp1 5)fra1"
            echo -n "Select [1-5, default=1]: "
            read -r choice
            case "$choice" in
                2) endpoint="https://sfo3.digitaloceanspaces.com"; region="sfo3" ;;
                3) endpoint="https://ams3.digitaloceanspaces.com"; region="ams3" ;;
                4) endpoint="https://sgp1.digitaloceanspaces.com"; region="sgp1" ;;
                5) endpoint="https://fra1.digitaloceanspaces.com"; region="fra1" ;;
                *) endpoint="https://nyc3.digitaloceanspaces.com"; region="nyc3" ;;
            esac
            ;;
        2)
            echo -n "AWS region [us-east-1]: "
            read -r region
            [[ -z "$region" ]] && region="us-east-1"
            ;;
        3)
            echo -n "Endpoint URL: "
            read -r endpoint
            echo -n "Region: "
            read -r region
            ;;
        *)
            echo "Invalid selection" >&2
            return 1
            ;;
    esac

    echo -n "Bucket name [${org_name}-${name}]: "
    read -r bucket
    [[ -z "$bucket" ]] && bucket="${org_name}-${name}"

    echo ""
    echo "Creating: $bucket"
    [[ -n "$endpoint" ]] && echo "Endpoint: $endpoint"
    echo "Region:   $region"

    S3_ENDPOINT="$endpoint"
    S3_REGION="$region"

    local cmd
    cmd=$(_org_s3_cmd)

    if $cmd mb "s3://$bucket" ${region:+--region "$region"} 2>/dev/null; then
        echo "Created!"
    else
        if $cmd ls "s3://$bucket" &>/dev/null; then
            echo "Bucket exists"
        else
            echo "Failed to create bucket" >&2
            return 1
        fi
    fi

    # Write config
    local sections_dir="$org_dir/sections"
    mkdir -p "$sections_dir"

    local s3_file="$sections_dir/25-s3.toml"

    # Append to existing or create new
    if [[ ! -f "$s3_file" ]]; then
        echo "# S3-compatible object storage" > "$s3_file"
        echo "" >> "$s3_file"
    else
        echo "" >> "$s3_file"
    fi

    {
        echo "[s3.$name]"
        echo "bucket = \"$bucket\""
        [[ -n "$endpoint" ]] && echo "endpoint = \"$endpoint\""
        echo "region = \"$region\""
    } >> "$s3_file"

    echo ""
    echo "Added [s3.$name] to sections/25-s3.toml"
    echo "Run: org build"
}

# === STATUS ===

org_s3_status() {
    local name="$1"

    if [[ -z "$name" ]]; then
        # Show all configured buckets
        local configs
        configs=$(_org_s3_list_configs 2>/dev/null)

        if [[ -z "$configs" ]]; then
            echo "No S3 buckets configured"
            echo "Run: org s3 init <name>"
            return 0
        fi

        echo "S3 Status"
        echo ""

        while read -r cfg_name; do
            _org_s3_status_one "$cfg_name"
        done <<< "$configs"
    else
        _org_s3_status_one "$name"
    fi
}

_org_s3_status_one() {
    local name="$1"

    if ! _org_s3_get_config "$name"; then
        echo "$name: not configured"
        return 1
    fi

    printf "%-12s " "$name"

    if ! _org_s3_setup_creds 2>/dev/null; then
        echo "NO CREDS"
        return 1
    fi

    local cmd
    cmd=$(_org_s3_cmd)

    if $cmd ls "s3://$S3_BUCKET" &>/dev/null; then
        local count
        count=$($cmd ls "s3://$S3_BUCKET/" --recursive 2>/dev/null | wc -l | tr -d ' ')
        echo "$S3_BUCKET ($count files)"
    else
        echo "$S3_BUCKET FAILED"
        return 1
    fi
}

# === TEST ===

org_s3_test() {
    local name="${1:-$(_org_s3_list_configs 2>/dev/null | head -1)}"

    if [[ -z "$name" ]]; then
        echo "Usage: org s3 test <name>" >&2
        return 1
    fi

    echo "S3 Test: $name"
    echo ""

    if ! _org_s3_get_config "$name"; then
        echo "Not configured: $name" >&2
        return 1
    fi

    if ! _org_s3_setup_creds; then
        return 1
    fi

    local cmd
    cmd=$(_org_s3_cmd)

    local test_file="/tmp/org-s3-test-$$"
    local test_key="tetra-test/$(date +%s).txt"

    echo "Bucket: $S3_BUCKET"
    echo ""

    echo "Test from $(hostname) at $(date -Iseconds)" > "$test_file"

    echo -n "1. Upload... "
    if $cmd cp "$test_file" "s3://$S3_BUCKET/$test_key" &>/dev/null; then
        echo "OK"
    else
        echo "FAILED"; rm -f "$test_file"; return 1
    fi

    echo -n "2. Download... "
    local dl_file="/tmp/org-s3-test-dl-$$"
    if $cmd cp "s3://$S3_BUCKET/$test_key" "$dl_file" &>/dev/null; then
        echo "OK"
    else
        echo "FAILED"; rm -f "$test_file"; return 1
    fi

    echo -n "3. Verify... "
    if diff -q "$test_file" "$dl_file" &>/dev/null; then
        echo "OK"
    else
        echo "MISMATCH"; rm -f "$test_file" "$dl_file"; return 1
    fi

    echo -n "4. Cleanup... "
    $cmd rm "s3://$S3_BUCKET/$test_key" &>/dev/null
    echo "OK"

    rm -f "$test_file" "$dl_file"
    echo ""
    echo "All tests passed!"
}

# === SUBCOMMAND ROUTER ===

org_s3() {
    local subcmd="${1:-list}"
    shift 2>/dev/null || true

    case "$subcmd" in
        list|ls)      org_s3_list "$@" ;;
        init|add)     org_s3_init "$@" ;;
        status)       org_s3_status "$@" ;;
        test)         org_s3_test "$@" ;;
        help|--help|-h)
            echo "org s3 - S3-compatible object storage"
            echo ""
            echo "Commands:"
            echo "  list              List configured and remote buckets"
            echo "  init <name>       Create bucket, add [s3.<name>] config"
            echo "  status [name]     Show connectivity status"
            echo "  test <name>       Upload/download test"
            echo ""
            echo "Config format in tetra.toml:"
            echo "  [s3.logs]"
            echo "  bucket = \"myorg-logs\""
            echo "  endpoint = \"https://nyc3.digitaloceanspaces.com\""
            echo "  region = \"nyc3\""
            ;;
        *)
            echo "Unknown: $subcmd (try: org s3 help)" >&2
            return 1
            ;;
    esac
}
