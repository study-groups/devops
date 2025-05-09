source init.sh
export PORT=${1:-$PBASE_PORT}
ENTRYPOINT=./entrypoints/pbase.sh
pb start ./entrypoints/pbase.sh pbase
