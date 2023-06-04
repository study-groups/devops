thisfile=bootstrap.sh

# tetra relies on user supplied PEM keys and env configuration files
# TETRA_DIR is a global path containing organizational directories
# to keep track of keys and env setups specific to an organization
# and the sub systsems within.

tetra-log(){
   #cat > /dev/null
   cat 
}

# if TETRA_DIR is set, skip
# if not set it to $1 or default to ~/tetra
if [ -z "$TETRA_DIR" ]; then
    echo "TETRA_DIR not set"
    return 1;
fi

[ -z "$TETRA_DIR/tetra.env" ] && source $TETRA_DIR/tetra.env


tetra_src=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
echo tetra_src: $tetra_src
for f in $(ls $tetra_src/*.sh | grep -v $thisfile);
  do source $f;
done;

echo using $TETRA_DIR | tetra-log

#for d in $TETRA_DIR/*/; do
#    if [ -e "$d/tetra.sh" ]; then
#        echo "sourcing $d" | tetra-log
#        source "$d/tetra.sh"
#    fi
#done
echo USING $TETRA_DIR
for file in $(find $TETRA_DIR -type f -name "tetra.sh"); do
    source "$file"
done


[ -z "$TETRA_DIR/tetra.env" ] && source $TETRA_DIR/tetra.env
[ -f $TETRA_DIR/tetra.sh ] && source $TETRA_DIR/tetra.sh

cat <<EOF

  tetra_src: $tetra_src
  TETRA_DIR: $TETRA_DIR
  Tetra Bootstraping complete, tetra-logs to see more.

EOF
