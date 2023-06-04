# tetra relies on user supplied PEM keys and env configuration files
# TETRA_DIR is a global path containing organizational directories
# to keep track of keys and env setups specific to an organization
# and the sub systsems within.

# Restart log
tetralog=$TETRA_DIR/log.txt

date > $tetralog

tetra-log(){
   # cat > /dev/null
   cat  >> $tetralog 
}

# if TETRA_DIR is set, skip
# if not set it to $1 or default to ~/tetra
if [ -z "$TETRA_DIR" ]; then
    echo "TETRA_DIR not set" 
    return 1;
fi

if [ -z "$TETRA_SRC" ]; then
    echo "TETRA_SRC not set"
    return 1;
fi

echo TETRA_SRC: $TETRA_SRC | tetra-log
echo TETRA_DIR: $TETRA_DIR | tetra-log
[ -z "$TETRA_DIR/tetra.env" ] && source $TETRA_DIR/tetra.env


for f in $(ls $TETRA_SRC/*.sh | grep -v bootstrap.sh);
  do source $f;
done;

for file in $(find $TETRA_DIR -type f -name "tetra.sh"); do
    echo "sourcing $file" | tetra-log
    source  "$file"
done

cat <<EOF
  TETRA_SRC: $TETRA_SRC
  TETRA_DIR: $TETRA_DIR
  Tetra Bootstraping complete, tetra-logs to see more.
EOF
