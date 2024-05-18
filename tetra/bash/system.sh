tetra_system_status(){
  top -l 1 | grep PhysMem

}

tetra_system_swap_usage() {
  case "$(uname)" in
    "Darwin")
      echo "Swap usage on macOS:"
      vm_stat | awk '/free|speculative|swapins|swapouts/ {print $1, $2}'
      ;;
    "Linux")
      echo "Swap usage on Linux:"
      swapon --show
      ;;
    *)
      echo "Unsupported operating system"
      ;;
  esac
}


tetra_system_df(){
  df -h | grep -v -e snap \
                  -e tmp  \
                  -e udev \
                  -e cgmfs \
                  -e boot \
        | awk 'NR>1{$1=""; sub(/^ /,""); print}'

}

tetra_system_df_include_snaps(){
  df -h
}

