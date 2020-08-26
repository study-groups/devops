launch-multi-apps() {
  local dir_name=$1;
  local amount=$2;

  local i=1;

  while [ $i -le $amount ]; do
  	mkdir "$dir_name$i"
	i=$(( i+1 ));
  done
  echo "Applications created"
}
