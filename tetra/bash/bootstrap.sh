# grep -v means ignore
thisfile="${BASH_SOURCE[0]}"
tetra_dir="$(cd "$(dirname $thisfile)" && pwd)"

echo "In $thisfile"
echo "tetra_dir: $tetra_dir"
for f in $(ls $tetra_dir/*.sh | grep -v $thisfile); do source $f; done;
