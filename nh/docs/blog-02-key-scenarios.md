# SSH Key Scenarios: Recovery, Rotation, and Emergency Response

This is Part 2 of a series on managing SSH keys across DigitalOcean infrastructure.

Part 1 covered the bootstrap problem - getting initial access to deploy managed keys. This post covers what happens after that: lost laptops, onboarding, rotation, and breaches.

## Scenario 1: Lost or Stolen Laptop

**Situation**: Your laptop is gone. You have a new machine. Old keys are compromised (assume the attacker has them). Servers still have old keys in `authorized_keys`.

**Threat Level**: HIGH - Act quickly.

### Recovery Steps

If you still have DO account access (web/mobile):

1. Generate new key on new laptop:
```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519
```

2. Add to DigitalOcean account:
   - Web: Settings → Security → SSH Keys → Add
   - Or: `doctl compute ssh-key create newlaptop --public-key-file ~/.ssh/id_ed25519.pub`

3. Use DO Console to access servers (no SSH required):
   - DigitalOcean Web → Droplet → Access → Launch Recovery Console
   - This gives you a root shell through your browser

4. In console, replace authorized_keys:
```bash
# Remove ALL old keys (they're compromised)
echo "ssh-ed25519 AAAA... your-new-key" > /root/.ssh/authorized_keys
```

5. Repeat for each server (dev, staging, prod)

6. SSH now works from new laptop:
```bash
ssh root@<server-ip>
```

### After Regaining Access

```bash
# Re-setup nh/tetra on new laptop
nh switch <context>
nh fetch
org switch <org>

# Regenerate ALL tkm keys (old ones are compromised)
tkm init
tkm revoke all      # Archives old keys locally
tkm gen all         # Generate fresh keys
tkm deploy all      # Push to servers (you have root now)

# Important: tkm deploy only ADDS keys, doesn't remove old ones
# Clean up old tkm keys from servers:
tkm remote clean dev root "tkm_"
tkm remote clean dev dev "tkm_"
# Repeat for staging, prod
```

### Prevention

- Enable 2FA on DigitalOcean account
- Consider passphrase on SSH keys
- Document recovery procedure before you need it

---

## Scenario 2: Onboarding a New Developer

**Situation**: New team member needs access to servers. You have working access. They have nothing.

### Simple Solution: Shared TKM Keys

Most small teams share the same tkm keys:

```bash
# On your machine, export keys
tar czf tkm-keys.tar.gz ~/.ssh/<org>/
# Secure transfer to new dev (not email!)
```

New dev imports:
```bash
tar xzf tkm-keys.tar.gz -C ~/
chmod 700 ~/.ssh/<org>
chmod 600 ~/.ssh/<org>/*

# Add SSH config
tkm config gen

# Test
ssh dev@$dev
```

### Current Workaround: Per-Developer Keys

If you want individual accountability:

1. New dev generates their key:
```bash
ssh-keygen -t ed25519
```

2. You add their pubkey to servers:
```bash
# They send you their pubkey
cat ~/.ssh/id_ed25519.pub

# You add it to app user on each server
ssh dev@$dev "echo 'ssh-ed25519 AAAA... alice' >> ~/.ssh/authorized_keys"

# For root access (if needed):
ssh root@$dev "echo 'ssh-ed25519 AAAA... alice' >> ~/.ssh/authorized_keys"
```

### Offboarding

```bash
# Remove their key from all servers
ssh root@$dev "sed -i '/alice/d' /root/.ssh/authorized_keys"
ssh root@$dev "sed -i '/alice/d' /home/dev/.ssh/authorized_keys"
# Repeat for staging, prod

# Or rotate shared keys if they had access:
tkm rotate all
```

---

## Scenario 3: Routine Key Rotation

**Situation**: Security policy requires periodic rotation, or a team member left.

### Using tkm rotate

```bash
# Rotate one environment
tkm rotate dev
# This does: revoke (archive old) → gen (new keys) → deploy (push to server)

# Rotate all environments
for env in dev staging prod; do
    tkm rotate $env
done
```

### What Happens

1. Old keys archived: `~/.ssh/<org>/dev_root.revoked.20241127_143022`
2. New keys generated: `~/.ssh/<org>/dev_root` (fresh)
3. New pubkeys ADDED to server `authorized_keys`

**Important**: Old keys still work until removed from server. `tkm deploy` only adds, doesn't remove.

### Complete Rotation

```bash
# After tkm rotate, clean up old keys on server
tkm remote clean dev root "tkm_"
tkm remote clean dev dev "tkm_"

# Or manually:
ssh root@$dev
# Edit /root/.ssh/authorized_keys - remove old tkm_ entries
# Edit /home/dev/.ssh/authorized_keys - remove old tkm_ entries
```

### Rotation Schedule

- Quarterly rotation: reasonable for most teams
- After any offboarding: mandatory
- After any security incident: immediate

---

## Scenario 4: Key Compromise / Security Breach

**Situation**: You suspect or know a key is compromised. Attacker may have access right now.

**Threat Level**: CRITICAL - Act immediately.

### Immediate Actions

1. Identify which key(s) compromised:
   - Your DO bootstrap key? → All servers at risk
   - Just `dev_root`? → Only dev server root at risk
   - Shared tkm keys? → Assume all servers at risk

2. Emergency lockdown via DO Console:
   - DigitalOcean Web → Droplet → Access → Launch Recovery Console
   - Faster than trying to SSH race the attacker

3. In console, nuke authorized_keys:
```bash
# Remove ALL keys, add only your known-good key
echo "ssh-ed25519 AAAA... emergency-key" > /root/.ssh/authorized_keys
echo "ssh-ed25519 AAAA... emergency-key" > /home/dev/.ssh/authorized_keys
```

4. Repeat for ALL servers (assume lateral movement)

### After Lockdown

```bash
# Generate completely fresh keys
rm -rf ~/.ssh/<org>/           # Delete all old keys
tkm init
tkm gen all
tkm deploy all

# If DO key was compromised:
# - Remove old key from DO account (web UI)
# - Generate new key, add to DO
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519  # overwrites old
doctl compute ssh-key create emergency --public-key-file ~/.ssh/id_ed25519.pub
```

### Forensics

After the immediate threat is contained:

```bash
# Check auth logs
ssh root@$dev "grep 'Accepted' /var/log/auth.log | tail -50"

# Check for unauthorized access
ssh root@$dev "last -20"

# Check for persistence (cron, authorized_keys elsewhere)
ssh root@$dev "crontab -l"
ssh root@$dev "find /home -name authorized_keys"
```

---

## Scenario 5: Completely Locked Out

**Situation**: No SSH key works. Can't access server at all. Key mismatch, corrupted `authorized_keys`, or broken SSH daemon.

### Solution 1: DO Recovery Console (fastest)

1. DigitalOcean Web → Droplets → Select droplet
2. Access tab → Launch Recovery Console
3. Login as root (may need to reset root password first)
4. Fix authorized_keys:
```bash
echo "ssh-ed25519 AAAA... your-key" > /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
```

### Solution 2: DO Droplet Recovery Mode

1. Power off droplet (DO web UI)
2. Boot into recovery mode
3. Mount filesystem, fix authorized_keys
4. Reboot normally

### Solution 3: Snapshot + New Droplet (nuclear option)

If SSH daemon itself is broken:

1. Create snapshot of broken droplet
2. Create new droplet from snapshot
3. Select your SSH key during creation
4. New droplet has your key injected fresh
5. Fix any SSH config issues
6. Delete broken droplet

### Prevention

- Always have DO Console access (2FA on account)
- Keep at least one backup key registered with DO
- Test SSH access after any `sshd_config` changes
- Never remove all keys from `authorized_keys` remotely

---

## Scenario 6: Adding New Server to Existing Org

**Situation**: Adding a new droplet (e.g., new 'qa' environment). Existing org setup works.

### Steps

1. Create droplet with your DO key:
```bash
doctl compute droplet create myorg-qa01 \
  --image ubuntu-22-04-x64 \
  --size s-1vcpu-1gb \
  --region nyc1 \
  --ssh-keys $(doctl compute ssh-key list --format ID --no-header | head -1)
```

2. Refresh infrastructure data:
```bash
nh fetch
nh load
```

3. Update tetra.toml with new environment:
```bash
org edit
# Add [environments.qa] section with new IP
```

4. Generate keys for new environment:
```bash
tkm gen qa
# Creates: ~/.ssh/<org>/qa_root, qa_qa
```

5. Deploy keys to new server:
```bash
tkm deploy qa --key $(nh keys bootstrap)
```

6. Test:
```bash
ssh root@$qa
ssh qa@$qa
```

### Alternative: Re-import from nh

If your droplet naming follows the convention (has 'qa', 'dev', 'staging', 'prod' in name):

```bash
org import nh ~/nh/<context>/digocean.json <org>
# Will detect new environment automatically

org build <org>
tkm gen qa
tkm deploy qa
```

---

## Quick Reference

| Scenario | First Action | Key Command |
|----------|-------------|-------------|
| Lost laptop | DO Console | Replace `authorized_keys` manually |
| New developer | Share keys or add their pubkey | `tkm config gen` or manual |
| Rotation | tkm rotate | `tkm rotate <env>` |
| Compromised | DO Console immediately | Nuke and replace all keys |
| Locked out | DO Console | Reset `authorized_keys` |
| New server | Create with DO key | `tkm gen <env> && tkm deploy <env>` |

---

## Access These Scenarios from CLI

All scenarios are available via:

```bash
nh keys scenarios              # List all
nh keys scenarios lost-laptop  # Specific scenario
nh keys scenarios compromised  # Emergency procedures
```
