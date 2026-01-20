#!/bin/bash
# Migration script: nginx to Caddy for dev.pixeljamarcade.com
# Run this on the server as root

set -e

echo "=== Migrating from nginx to Caddy ==="

# 1. Install Caddy
echo "[1/6] Installing Caddy..."
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update
apt install -y caddy

# 2. Create log directory
echo "[2/6] Creating log directory..."
mkdir -p /var/log/caddy
chown caddy:caddy /var/log/caddy

# 3. Convert htpasswd files for Caddy
echo "[3/6] Converting htpasswd files..."
mkdir -p /etc/caddy

# Convert nginx htpasswd to Caddy format
# Caddy uses bcrypt, nginx uses various formats
# We'll create placeholder files - you'll need to regenerate passwords

cat > /etc/caddy/dashboard_users << 'EOF'
# Caddy basic auth users for dashboard
# Generate password hash with: caddy hash-password
# Format: username $2a$14$hashedpassword
# Example: admin $2a$14$Zkx19XLiW6VYouLHR5NmfOFU0z2GTNmpkT/5qqR7hx4IjWJPDhjvG
EOF

cat > /etc/caddy/videos_users << 'EOF'
# Caddy basic auth users for videos
# Generate password hash with: caddy hash-password
# Format: username $2a$14$hashedpassword
EOF

echo "  NOTE: You need to regenerate passwords using 'caddy hash-password'"
echo "  Then add them to /etc/caddy/dashboard_users and /etc/caddy/videos_users"

# 4. Copy Caddyfile
echo "[4/6] Installing Caddyfile..."
# Assumes Caddyfile is in current directory or provide path
if [[ -f ./Caddyfile ]]; then
    cp ./Caddyfile /etc/caddy/Caddyfile
    echo "  Caddyfile copied to /etc/caddy/Caddyfile"
else
    echo "  WARNING: No Caddyfile found in current directory"
    echo "  Copy your Caddyfile to /etc/caddy/Caddyfile manually"
fi

# 5. Validate Caddyfile
echo "[5/6] Validating Caddyfile..."
caddy validate --config /etc/caddy/Caddyfile || {
    echo "ERROR: Caddyfile validation failed!"
    exit 1
}

# 6. Migration steps
echo "[6/6] Migration instructions:"
cat << 'EOF'

=== MANUAL STEPS REQUIRED ===

1. GENERATE PASSWORD HASHES:
   For each user in /etc/nginx/.htpasswd and /etc/nginx/htpasswd:

   $ caddy hash-password
   Enter password: ********

   Then add to /etc/caddy/dashboard_users or /etc/caddy/videos_users:
   username $2a$14$...hash...

2. STOP NGINX (will cause brief downtime):
   $ systemctl stop nginx
   $ systemctl disable nginx

3. START CADDY:
   $ systemctl enable caddy
   $ systemctl start caddy

4. VERIFY:
   $ systemctl status caddy
   $ curl -I https://dev.pixeljamarcade.com

5. MONITOR LOGS:
   $ journalctl -u caddy -f
   $ tail -f /var/log/caddy/*.log

=== KEY DIFFERENCES ===

- Caddy auto-obtains and renews TLS certificates
- No more certbot or manual cert management
- WebSocket proxying is automatic (no special config needed)
- Logs are in /var/log/caddy/

=== ROLLBACK ===

If something goes wrong:
   $ systemctl stop caddy
   $ systemctl start nginx

EOF

echo "=== Migration preparation complete ==="
