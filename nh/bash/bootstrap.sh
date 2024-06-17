if [ -z "$NH_DIR" ]; then
    if [ -n "$1" ]; then
        NH_DIR="$1"
    else
        NH_DIR="$HOME/nh"
    fi
fi

for f in $(ls $NH_BASH/*.sh | grep -v bootstrap.sh);
  do source $f;
done;

echo " NH_DIR=$NH_DIR"
echo " NH_BASH=$NH_BASH"
