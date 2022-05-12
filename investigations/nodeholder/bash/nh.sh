dir="$(dirname "${BASH_SOURCE[0]}" )" 

nh-details(){
  printf "Following files create full nh-shell:\n\n"
  (ls $dir/nh-* ) | xargs wc
}

nh-source(){
  nh-details
  # don't "" when globbing 
  for file in $dir/* ; do  
    if [ -f "$file" ] ; then
      source "$file"
    fi
  done
}

nh-info(){
cat <<EOF
  type nh-source to load all nh-* functions.
  nh-app-running shows all running apps;
EOF
}

