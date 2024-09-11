for f in $(ls $SM_BASH/*.sh | grep -v bootstrap.sh);
  do source $f;
done;
