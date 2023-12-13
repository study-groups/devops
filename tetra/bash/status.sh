tetra-status(){
    TETRA_REPO=$HOME/src/devops-study-group
    pushd $TETRA_REPO
    git pull
    popd
    source $TETRA_SRC/bootstrap.sh
    clear
    free -h | awk '/^Mem/ { \
        printf "Mem: %s/%s ", $3, $2 \
    } \
    /^Swap/ { \
        printf "Swap: %s/%s\n", $3, $2 \
    }'
    tetra-df
    uptime | awk -F 'load average:' '{print "load (1, 5, 15m)" $2}'


}

tetra-df(){
  df -h | grep -v -e snap \
                  -e tmp  \
                  -e udev \
                  -e cgmfs \
                  -e boot \
        | awk 'NR>1{$1=""; sub(/^ /,""); print}'

}

tetra-df-snap(){
  df -h
}

