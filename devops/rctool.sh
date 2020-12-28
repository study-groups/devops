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

# A RECORDS
###########
rctool-a-list() {
    # https://manage.resellerclub.com/kb/node/1106
    http "https://test.httpapi.com/api/dns/manage/\
search-records.json?auth-userid=$RC_USERID&api-key=$RC_APIKEY&\
domain-name=$1&type=A&no-of-records=50&page-no=1"
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
auth-userid=$RC_USERID&api-key=$RC_APIKEY&\
host=$1&domain-name=$2&value=$3"
}

rctool-cname-list() {
    http "https://test.httpapi.com/api/\
dns/manage/search-records.json?\
auth-userid=$RC_USERID&api-key=$RC_APIKEY&\
domain-name=$1&type=CNAME&no-of-records=50&page-no=1"
}
