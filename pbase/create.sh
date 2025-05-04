PBVM_ROOT="$HOME/pj/pbvm"
mkdir -p $PBASE_DIR 
mkdir -p $PBASE_DIR/pocketbase
pbvm install
export PB_ROOT=$(realpath "$PBVM_ROOT/aliases/current")
export PB_EXE=$PB_ROOT/pocketbase
[ -z "$NVM_DIR" ] && echo "NVM_DIR not set" && return 1
source $NVM_DIR/nvm.sh
npm install -g pm2
envsubst < ./env/local.template | tee  $PBASE_DIR/local.env
envsubst < ./entrypoints/entrypoint.template  > ./entrypoints/pbase.sh
echo "using $(which node)"
echo "Created $PBASE_DIR/local.env"
echo "Created ./entrypoints/pbase.sh"

