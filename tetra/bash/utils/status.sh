tetra_status(){
echo "  TETRA_SRC: $TETRA_SRC"
echo "  TETRA_DIR: $TETRA_DIR"
echo "  tetra_remote: ${TETRA_REMOTE_USER:-}@${TETRA_REMOTE:-}:${TETRA_REMOTE_DIR:-}"
if [[ -n "${TETRA_BOOT_TIME_MS:-}" ]]; then
    echo "  boot_time: ${TETRA_BOOT_TIME_MS}ms"
fi
}

tetra_status_long(){
echo "  Tetra detected $OSTYPE." > /dev/stderr
echo "  BASH_VERSION: $BASH_VERSION" > /dev/stderr
echo "  PATH: $PATH" > /dev/stderr
echo ""
echo "All TETRA_ environment variables"
tetra_env
}

tetra_boot_stats(){
    echo "=== Tetra Boot Statistics ==="
    echo ""
    if [[ -n "${TETRA_BOOT_TIME_MS:-}" ]]; then
        echo "Boot time: ${TETRA_BOOT_TIME_MS}ms (${TETRA_BOOT_TIME_NS}ns)"
    else
        echo "Boot time: Not available (boot profiling not enabled)"
    fi
    echo ""
    echo "Module load status:"
    for module in $(echo "${!TETRA_MODULE_LOADED[@]}" | tr ' ' '\n' | sort); do
        local status="${TETRA_MODULE_LOADED[$module]}"
        local loaded_text="[NOT LOADED]"
        [[ "$status" == "true" ]] && loaded_text="[LOADED]"
        printf "  %-15s %s\n" "$module" "$loaded_text"
    done
    echo ""
    echo "Registered modules: ${#TETRA_MODULE_LOADERS[@]}"
    echo "Loaded modules: $(echo "${TETRA_MODULE_LOADED[@]}" | grep -o true | wc -l | tr -d ' ')"
}
