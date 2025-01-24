NH_DIR=${NH_DIR:-$HOME/nh}
echo " NH_DIR=$NH_DIR"
echo " NH_SRC=$NH_SRC"
for f in $(ls $NH_SRC/bash/*.sh | grep -v bootstrap.sh | grep -v basetrace.sh);
   do  source $f;
done;


nh-make-short-vars(){ 
  nh_make_short_vars |  tee  /tmp/vars.env;
  source /tmp/vars.env
}

alias msv=nh-make-short-vars
