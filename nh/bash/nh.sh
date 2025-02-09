NH_JSON=$NH_DIR/json
nh_help(){

  cat <<EOF

  nh_
    functions for gathering information about infrastructure
    at Digtial Ocean. Edit and source ./init.sh to get started.

EOF
}

nh_unset(){
    for func in $(compgen -A function nh_); do
        unset -f "$func"
    done
}

nh_make_dir(){
  local dir=$1
  mkdir -p $dir
  mkdir -p $dir/json 
}
