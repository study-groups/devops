[ -z "$PBASE_SRC" ] && echo "ERROR: PBASE_SRC not set" && return 1

# Source all bash modules except bootstrap.sh itself
for f in $(ls $PBASE_SRC/bash/*.sh 2>/dev/null | grep -v bootstrap.sh); do
    source "$f"
done
