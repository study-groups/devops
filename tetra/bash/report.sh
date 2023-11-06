# must be in reports dir
tetra_report_encrypt(){
   tar ca audit.txt summary.html | \
   tetra_encrypt_stdio  > \
   report_$(date +%s).tar.enc
}

tetra_report_decrypt(){
   cat $1 | tetra_decrypt_stdio |tar xv
}
