thisfile=bootstrap.sh

# tetra relies on user supplied PEM keys and env configuration files
# TETRA_DIR is a global path containing organizational directories
# to keep track of keys and env setups specific to an organization
# and the sub systsems within.

tetra_log(){
   cat > /dev/null
}

# if TETRA_DIR is set, skip
# if not set it to $1 or default to ~/tetra
if [ -z "$TETRA_DIR" ]; then
    if [ -n "$1" ]; then
        TETRA_DIR="$1"
    else
        TETRA_DIR="$HOME/tetra"
    fi
fi

[ -z "$TETRA_DIR/tetra.env" ] && source $TETRA_DIR/tetra.env


# THIS IS BROKEN
tetra_src="$(cd "$(dirname $thisfile)" && pwd)"
echo tetra_source: $tetra_src
for f in $(ls $tetra_src/*.sh | grep -v $thisfile);
  do source $f;
done;


echo using $TETRA_DIR | tetra-log

for d in $TETRA_DIR/*/; do
    if [ -e "$d/tetra.sh" ]; then
        echo "sourcing $d" | tetra-log
        source "$d/tetra.sh"
    fi
done

[ -z "$TETRA_DIR/tetra.env" ] && source $TETRA_DIR/tetra.env
[ -f $TETRA_DIR/tetra.sh ] && source $TETRA_DIR/tetra.sh

cat <<EOF

  tetra_src: $tetra_src
  TETRA_DIR: $TETRA_DIR
  Tetra Bootstraping complete, tetra-logs to see more.

EOF
