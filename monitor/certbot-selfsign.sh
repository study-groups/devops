#!/bin/bash
i=1
for x in ${@}; do
  echo "$i: $x"
  ((i++))
done

domain="${6}"
outdir="/etc/letsencrypt/live"
[ ! -d $outdir ] && mkdir $outdir
[ ! -d "$outdir/$domain" ] && mkdir "$outdir/$domain"

read
openssl req -x509 \
    -newkey rsa:4096 \
    -nodes \
    -keyout $outdir/$domain/privkey.pem \
    -out $outdir/$domain/fullchain.pem \
    -days 365 \
    -subj "/CN=$domain"
read
echo
echo
