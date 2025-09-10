#!/usr/bin/env bash
# Tubes MULTIDIFF helper functions


tubes_mc(){
  mc -r $(cat tubes.files )
}

tubes_build() {
    go mod tidy
    go build -o tubes ./cmd/tubes 2> ./build-error.txt
    TUBES_BUILD_ERROR=$?

    if [ "$TUBES_BUILD_ERROR" -ne 0 ]; then
      echo "Build failed with error code: $TUBES_BUILD_ERROR"
      echo "Fix this error." > ./build-next.txt
      cat ./build-error.txt >> ./build-next.txt
      tubes_mc >> ./build-next.txt 
    fi

}

tubes_run() {
    if [[ ! -x ./tubes ]]; then
        tubes_build
    fi
    ./tubes "$@"
}

tubes_clean() {
    rm -f ./tubes
}

tubes_mdiff_help() {
    cat <<'EOF'
[tubes_mdiff_*] commands

  tubes_mdiff_from_git [--cached] [<pathspec>...]
      Convert git diff (-U0) to MULTIDIFF; prints to stdout.
  tubes_mdiff_gen [--cached] [<pathspec>...]
      Save MULTIDIFF to ./patches/<epoch>.multipatch.
  tubes_mdiff_apply <patch.multipatch>
      Apply a MULTIDIFF file to the working tree.
EOF
}

tubes_mdiff_from_git() {
    ./tubes_multidiff.sh from-git "$@"
}

tubes_mdiff_gen() {
    local cached=""
    if [[ "${1-}" == "--cached" ]]; then cached="--cached"; shift; fi
    local dir=patches; mkdir -p "$dir"
    local out="${dir}/$(date +%s).multipatch"
    ./tubes_multidiff.sh from-git $cached "$@" > "$out" || {
        rm -f "$out"; echo "no changes"; return 2; }
    if [[ ! -s "$out" ]]; then rm -f "$out"; echo "empty multipatch"; return 2; fi
    echo "$out"
}

tubes_mdiff_apply() {
    local mp=${1-}
    if [[ -z "$mp" || ! -f "$mp" ]]; then
        echo "usage: tubes_mdiff_apply <patch.multipatch>"; return 2; fi
    ./tubes_multidiff.sh apply "$mp"
}
