#!/bin/bash
# Disable cloud-init completely
mount /dev/vda1 /mnt 2>/dev/null
touch /mnt/etc/cloud/cloud-init.disabled
# Also clear its semaphores so it doesn't use cached state
rm -rf /mnt/var/lib/cloud/instance/sem/*
# Ensure sshd config is correct
sed -i 's/disable_root: true/disable_root: false/' /mnt/etc/cloud/cloud.cfg.d/90-digitalocean.cfg
sed -i 's/PasswordAuthentication no/PasswordAuthentication yes/' /mnt/etc/ssh/sshd_config
sed -i 's/PasswordAuthentication no/PasswordAuthentication yes/' /mnt/etc/ssh/sshd_config.d/50-cloud-init.conf
# Verify
echo "=== cloud-init disabled ==="
ls -la /mnt/etc/cloud/cloud-init.disabled
echo "=== sshd config ==="
grep PasswordAuthentication /mnt/etc/ssh/sshd_config /mnt/etc/ssh/sshd_config.d/50-cloud-init.conf
echo "=== disable_root ==="
grep disable_root /mnt/etc/cloud/cloud.cfg.d/90-digitalocean.cfg
echo "=== shadow ==="
head -1 /mnt/etc/shadow | cut -c1-30
echo "=== authorized_keys ==="
wc -l /mnt/root/.ssh/authorized_keys
