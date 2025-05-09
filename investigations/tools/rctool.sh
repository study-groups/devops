##########################################################################
# enctool-
#  encryption tool for managing TLS certs, etc.
##########################################################################
enctool-cert()
{
    certbot certonly --manual \
        --preferred-challenges=dns-01 \
        --agree-tos -d ./*."$1" # pass domainname.com

}

##########################################################################
# rctool-
#   reseller club api for mananging domain names from a distance.
##########################################################################
rctool-help() {
    echo "
rctool is collection of Bash scripts to manipulate DNS
entries via Reseller Club API:

https://manage.resellerclub.com/kb/node/1106

You are using RC_USERID = $RC_USERID
You are using RC_APIKEY = $RC_APIKEY
"
}

# https://securecert.myorderbox.com/

rctool-active-dns(){
http "https://test.httpapi.com/api/dns/activate.xml?auth-userid=$RC_USERID&api-key=$RC_APIKEY&order-id=$1"
}
# A RECORDS
###########
rctool-a-list() {
    # https://manage.resellerclub.com/kb/node/1106
    http "https://test.httpapi.com/api/dns/manage/\
search-records.json?auth-userid=$RC_USERID&api-key=$RC_APIKEY&\
domain-name=$1&type=A&no-of-records=50&page-no=1"
}

rctool-a-domain-host-ip(){
  # @ means no host label in DNS, eg, 'the' domain name
  local export domain="$1"
  local export host="${2:-@}"
  #rctool-a-list  $domain > /tmp/arecs
  cat /tmp/arecs | jq '.[]' | jq 'select(.host=='"$host"').value' 2> /dev/null
}

rctool-a-add() {
    # https://manage.resellerclub.com/kb/node/1106
    http "https://test.httpapi.com/api/dns/manage/\
add-ipv4-record.json?\
ttl=7200&\
auth-userid=$RC_USERID&api-key=$RC_APIKEY&\
domain-name=$1&host=$2&value=$3"

}

# TXT
#####
rctool-txt-list() {
    http "https://test.httpapi.com/api/dns/manage/search-records.json?\
auth-userid=$RC_USERID&api-key=$RC_APIKEY&\
domain-name=$1&type=TXT&no-of-records=50&page-no=1"
}

rctool-txt-add() {
    http "https://test.httpapi.com/\
api/dns/manage/add-txt-record.json?\
auth-userid=$RC_USERID&api-key=$RC_APIKEY&\
host=$1&domain-name=$2&value=$3"
}

rctool-txt-update() {
    http "https://test.httpapi.com/api/\
dns/manage/update-txt-record.json?\
auth-userid=$RC_USERID&api-key=$RC_APIKEY&\
host=$1&domain-name=$2&value=$3"
}

rctool-txt-delete() {
    http "https://test.httpapi.com/\
api/dns/manage/delete-txt-record.json?\
auth-userid=$RC_USERID&api-key=$RC_APIKEY&\
host=$1&domain-name=$2&value=$3"
}

# CNAME example, map webpage.nodeholder.com
# host=website
# domain-name=nodeholder.com
# value=nodeholder.gitlab.io
rctool-cname-add(){
http "https://test.httpapi.com/api/dns/manage/\
add-cname-record.json?\
ttl=7200&\
auth-userid=$RC_USERID&api-key=$RC_APIKEY&\
host=$1&domain-name=$2&value=$3"
}

rctool-cname-list() {
    http "https://test.httpapi.com/api/\
dns/manage/search-records.json?\
auth-userid=$RC_USERID&api-key=$RC_APIKEY&\
domain-name=$1&type=CNAME&no-of-records=50&page-no=1"
}
