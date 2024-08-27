NH_DIR=${NH_DIR:-$HOME/nh}
echo " NH_DIR=$NH_DIR"
echo " NH_SRC=$NH_SRC"
for f in $(ls $NH_SRC/bash/*.sh | grep -v bootstrap.sh);
  do source $f;
done;
nh_ip_load_env_vars
nh_make_short_vars |  tee  /tmp/vars.env
source /tmp/vars.env
