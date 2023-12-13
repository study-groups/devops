tetra-status(){
    TETRA_REPO=$HOME/src/devops-study-group
    pushd $TETRA_REPO
    git pull
    popd
    source $TETRA_SRC/bootstrap.sh
    clear
    uptime | awk -F 'load average:' '{print "load (1, 5, 15m)" $2}'
    tetra-df
}

tetra-df(){
  df -h | grep -v -e snap \
                  -e tmp  \
                  -e udev \
                  -e cgmfs \
                  -e boot
}

tetra-df-snap(){
  df -h
}

