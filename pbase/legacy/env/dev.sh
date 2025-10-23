#HOME=/home/dev
#PBASE_USER=dev
PBASE_USER=root
PBASE_ROOT=$HOME/pj/pbase
PBASE_SRC=$HOME/src/pixeljam/pbase
cat $PBASE_SRC/env/default.env | envsubst
