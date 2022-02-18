# apt-get purge nginx nginx-common

dest="root@159.65.106.21"
sync="rsync -azv"

dir=/etc/nginx/sites-available/
$sync $dir $dest:$dir

dir=/etc/nginx/sites-enabled/
$sync $dir $dest:$dir

# made by certbot first time
dir=/etc/letsencrypt/
$sync $dir $dest:$dir
