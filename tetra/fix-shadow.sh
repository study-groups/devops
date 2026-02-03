#!/bin/bash
sed -i 's|root:[^:]*|root:$6$t1sgyb/JyIJaZNgF$vqNMUAdt1VuAU2AeEk0DtLRI8Yg2ueoegenkgbLmJggotoxaOMRPsLdoS5P4VRaRRDjCEQ/T2un1.nnPfJCV/|' /mnt/etc/shadow
head -1 /mnt/etc/shadow
