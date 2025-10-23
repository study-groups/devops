pbase_info(){
    echo "PB_EXE=$PB_EXE"
}

pbase_create_pbase_exe() {

    if [ -z "$PB_EXE" ]; then
        echo "Error: PB_EXE is not set."
        echo "Please run pbase_init first."
        return 1
    fi

    local PBASE_HOST=${PBASE_HOST:-localhost}
    local PBASE_PORT=${PBASE_PORT:-8090}
    local PB_DATA=${PB_DATA:-pb_data}
    export PBASE_EXE="$PB_EXE --dir=$PB_DATA --http=${PBASE_HOST}:${PBASE_PORT}"
    echo $PBASE_EXE
}

pbase_create_entrypoint() {
    cat <<EOF
#!/bin/bash


# PB_EXE=$PB_EXE
# PB_DATA=$PB_DATA
# PB_PUBLIC=$PB_PUBLIC
# PBASE_HOST=$PBASE_HOST
# PBASE_PORT=$PBASE_PORT

"${PB_EXE}" serve \\
  --dir=${PB_DATA} \\
  --publicDir=${PB_PUBLIC} \\
  --http="${PBASE_HOST}:${PBASE_PORT}" --dev
EOF

}

# Main pbase dispatcher
pbase() {
    case "$1" in
        repl)
            source "$PBASE_SRC/bash/pbase_repl.sh"
            pbase_repl
            ;;
        info)
            pbase_info
            ;;
        *)
            cat <<EOF
Usage: pbase <command>

Commands:
  repl         Start interactive REPL
  info         Show pbase environment

For pdata service management, use: pdata <command>
For pdata administration, use: admin <command>
EOF
            ;;
    esac
}
