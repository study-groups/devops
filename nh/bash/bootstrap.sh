NH_DIR=${NH_DIR:-$HOME/nh}
NH_SRC=${NH_SRC:-$HOME/devops-study-group/nh}
echo " NH_DIR=$NH_DIR"
echo " NH_SRC=$NH_SRC"
for f in $(ls $NH_SRC/bash/*.sh | grep -v bootstrap.sh);
  do source $f;
done;

