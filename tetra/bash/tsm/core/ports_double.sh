#!/usr/bin/env bash

# TSM Port Double-Entry Accounting
# System A: Registry (declared ports)
# System B: Runtime scanner (actual ports)

# === PORT REGISTRY (System A) ===

# Initialize port registry
tsm_init_port_registry() {
    local registry="$TSM_PORTS_DIR/registry.tsv"
    mkdir -p "$(dirname "$registry")"

    if [[ ! -f "$registry" ]]; then
        echo -e "tsm_id\tname\tdeclared_port\tactual_port\tpid\ttimestamp" > "$registry"
    fi
}

# Register declared port
tsm_register_port() {
    local tsm_id="$1"
    local name="$2"
    local declared_port="$3"
    local pid="$4"

    local registry="$TSM_PORTS_DIR/registry.tsv"
    tsm_init_port_registry

    # Add entry with declared port, actual will be updated later
    echo -e "$tsm_id\t$name\t$declared_port\tnone\t$pid\t$(date +%s)" >> "$registry"
}

# Update actual scanned port
tsm_update_actual_port() {
    local tsm_id="$1"
    local actual_port="$2"

    local registry="$TSM_PORTS_DIR/registry.tsv"
    [[ ! -f "$registry" ]] && return 1

    local tmp="${registry}.tmp"

    awk -v id="$tsm_id" -v port="$actual_port" '
        BEGIN {FS=OFS="\t"}
        NR==1 {print; next}
        $1==id {$4=port}
        {print}
    ' "$registry" > "$tmp" && mv "$tmp" "$registry"
}

# Deregister port when process stops
tsm_deregister_port() {
    local tsm_id="$1"

    local registry="$TSM_PORTS_DIR/registry.tsv"
    [[ ! -f "$registry" ]] && return 0

    local tmp="${registry}.tmp"

    awk -v id="$tsm_id" 'BEGIN {FS=OFS="\t"} NR==1 || $1!=id {print}' "$registry" > "$tmp" && mv "$tmp" "$registry"
}

# === RUNTIME PORT SCANNER (System B) ===

# Scan actual listening ports
tsm_scan_actual_ports() {
    if command -v lsof >/dev/null 2>&1; then
        lsof -iTCP -sTCP:LISTEN -n -P 2>/dev/null | awk 'NR>1 {print $2, $9}' | sed 's/.*://' | sed 's/\*://' | grep -E '^[0-9]+ [0-9]+$'
    else
        # Fallback to netstat (less reliable for PID matching)
        netstat -tlnp 2>/dev/null | awk '/LISTEN/ {print $7, $4}' | sed 's/\// /' | sed 's/.*://' | grep -E '^[0-9]+ [0-9]+$'
    fi
}

# === PORT RECONCILIATION ===

# Reconcile declared vs actual ports
tsm_reconcile_ports() {
    echo "🔍 Port Accounting Reconciliation"
    echo "=================================="

    local registry="$TSM_PORTS_DIR/registry.tsv"
    if [[ ! -f "$registry" ]]; then
        echo "No port registry found"
        return 0
    fi

    # Load TSM registry (System A)
    declare -A tsm_by_pid
    declare -A tsm_by_port

    while IFS=$'\t' read -r tsm_id name declared_port actual_port pid timestamp; do
        [[ "$tsm_id" == "tsm_id" ]] && continue  # Skip header
        tsm_by_pid[$pid]="$tsm_id:$name:$declared_port:$actual_port"
        [[ "$declared_port" != "none" ]] && tsm_by_port[$declared_port]="$tsm_id:$name:$pid"
    done < "$registry"

    # Scan actual ports (System B)
    declare -A actual_ports
    while read -r pid port; do
        actual_ports[$pid]=$port
    done < <(tsm_scan_actual_ports)

    # Compare and report
    local correct=0
    local mismatches=0
    local orphans=0

    echo ""
    echo "📊 TSM-Managed Processes:"
    for pid in "${!tsm_by_pid[@]}"; do
        IFS=':' read -r tsm_id name declared_port stored_actual <<< "${tsm_by_pid[$pid]}"
        local actual_port="${actual_ports[$pid]:-none}"

        if [[ "$declared_port" == "$actual_port" ]]; then
            echo "  ✅ TSM ID $tsm_id: $name (declared=$declared_port, actual=$actual_port)"
            ((correct++))
        elif [[ "$declared_port" == "none" && "$actual_port" == "none" ]]; then
            echo "  ✅ TSM ID $tsm_id: $name (no port)"
            ((correct++))
        elif [[ "$actual_port" == "none" ]]; then
            echo "  ⚠️  TSM ID $tsm_id: $name - DECLARED port $declared_port but NOTHING listening"
            ((mismatches++))
        else
            echo "  ❌ TSM ID $tsm_id: $name - PORT MISMATCH (declared=$declared_port, actual=$actual_port)"
            ((mismatches++))
        fi
    done

    echo ""
    echo "🔓 System Ports Not in TSM Registry:"
    for pid in "${!actual_ports[@]}"; do
        if [[ -z "${tsm_by_pid[$pid]:-}" ]]; then
            local port="${actual_ports[$pid]}"
            local cmd=$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")
            echo "  🔓 PID $pid: $cmd listening on port $port (not managed by TSM)"
            ((orphans++))
        fi
    done

    echo ""
    echo "📈 Summary:"
    echo "  ✅ Correct: $correct"
    echo "  ❌ Mismatches: $mismatches"
    echo "  🔓 Orphan ports: $orphans"

    [[ $mismatches -eq 0 ]]
}

# Show declared ports from registry
tsm_show_declared_ports() {
    local registry="$TSM_PORTS_DIR/registry.tsv"
    if [[ ! -f "$registry" ]]; then
        echo "No port registry found"
        return 0
    fi

    echo "📋 TSM Port Registry (Declared Ports):"
    echo ""
    column -t -s $'\t' "$registry"
}

# Show actual listening ports
tsm_show_actual_ports() {
    echo "🔍 Actual Listening Ports:"
    echo ""
    printf "%-8s %-8s %-20s %s\n" "PID" "PORT" "PROCESS" "COMMAND"
    printf "%-8s %-8s %-20s %s\n" "---" "----" "-------" "-------"

    while read -r pid port; do
        local process=$(ps -p "$pid" -o comm= 2>/dev/null | tr -d ' ' || echo "unknown")
        local cmd=$(ps -p "$pid" -o args= 2>/dev/null | head -c 40 || echo "unknown")
        printf "%-8s %-8s %-20s %s\n" "$pid" "$port" "$process" "$cmd"
    done < <(tsm_scan_actual_ports | sort -n -k2)
}

export -f tsm_init_port_registry
export -f tsm_register_port
export -f tsm_update_actual_port
export -f tsm_deregister_port
export -f tsm_scan_actual_ports
export -f tsm_reconcile_ports
export -f tsm_show_declared_ports
export -f tsm_show_actual_ports
