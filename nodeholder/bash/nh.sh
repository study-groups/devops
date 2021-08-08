dir="$(dirname "${BASH_SOURCE[0]}" )" 
echo $dir
(ls ./nh-* ) | xargs wc
