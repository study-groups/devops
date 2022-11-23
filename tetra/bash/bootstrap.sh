# grep -v means ignore
thisfile=${BASH_SOURCE[0]}
realpath=$(readlink -f $thisfile)
dirname=$(dirname $realpath)
echo "In $thisfile"
echo "Dirname: $dirname"
for f in $(ls $dirname/*.sh | grep -v $thisfile); do source $f; done;
