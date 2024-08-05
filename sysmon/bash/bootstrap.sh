for f in $(ls $SM_SRC/*.sh | grep -v bootstrap.sh);
  do source $f;
done;
