# apt-get purge nginx nginx-common

# migrate-services
dest="root@159.65.106.21"
#dest="root@$IP"
sync="rsync -azv"

dir=/etc/nginx/sites-available/
$sync $dir $dest:$dir

dir=/etc/nginx/sites-enabled/
$sync $dir $dest:$dir

# made by certbot first time
dir=/etc/letsencrypt/
$sync $dir $dest:$dir
