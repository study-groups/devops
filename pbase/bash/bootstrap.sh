[ -z "$PBASE_SRC" ] && echo PBASE_SRC not set && return 1

for f in $(ls $PBASE_SRC/bash/*.sh | grep -v bootstrap.sh);
  do source $f;
done;
