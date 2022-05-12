mkdir /root/newsusers.bak
cp /etc/passwd /etc/shadow /etc/group /etc/gshadow /root/newsusers.bak

cat /root/move/passwd.mig >> /etc/passwd
cat /root/move/group.mig >> /etc/group
cat /root/move/shadow.mig >> /etc/shadow

/bin/cp gshadow.mig /etc/gshadow

