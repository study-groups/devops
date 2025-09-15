NH_DIR=${NH_DIR:-$HOME/nh}
echo " NH_DIR=$NH_DIR"
echo " NH_SRC=$NH_SRC"
for f in "$NH_SRC"/bash/*.sh; do
   if [[ -f "$f" && "$f" != *"/bootstrap.sh" && "$f" != *"/basetrace.sh" ]]; then
      source "$f"
   fi
done

#nh_load_env_vars

nh-make-short-vars(){ 
  nh_make_short_vars |  tee  /tmp/vars.env;
  source /tmp/vars.env
}

alias msv=nh-make-short-vars
