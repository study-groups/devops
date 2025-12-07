# SSH Key Management for DigitalOcean: The Bootstrap Problem

This is Part 1 of a series on managing SSH keys across DigitalOcean infrastructure using NodeHolder (nh) and Tetra's key manager (tkm).

## The Problem

You have DigitalOcean droplets. You want organized, rotatable SSH keys per environment (dev, staging, prod). But there's a chicken-and-egg problem:

- You want to deploy new keys to the server
- Deploying keys requires SSH access to the server
- You don't have SSH access until keys are deployed

## How DigitalOcean Droplet Creation Works

When you create a droplet, you select SSH keys from your DO account. Those public keys get injected into `/root/.ssh/authorized_keys` at creation time:

```bash
# What DO does at droplet creation:
echo "ssh-ed25519 AAAA... your-do-key" >> /root/.ssh/authorized_keys
```

This means `root` access works immediately with your DO-registered key. But only root - no other users exist yet.

## Two Types of Keys

**DO-registered keys** (account-level):
- Registered in your DigitalOcean account via web UI or `doctl compute ssh-key create`
- Injected into droplets at creation time
- Typically your personal key (`~/.ssh/id_ed25519`)
- Shared across all droplets you create
- The "master key" that gives you initial access

**TKM keys** (org/environment-level):
- Per-org, per-environment, per-user: `~/.ssh/pixeljam-arcade/dev_root`, `dev_dev`
- Created after droplets exist
- Need to be deployed to servers (pushed to `authorized_keys`)
- Isolated: revoking `dev_root` doesn't affect `prod_root`
- Support key rotation without affecting other environments

## The Bootstrap Flow

```
         DO Key                         TKM Keys
         (master)                       (per-env)
            |
            v
    Droplet created         -->    tkm gen all
    with DO key injected          (creates local keys)
            |                           |
            v                           v
    SSH works with DO key         Keys exist locally
            |                      but NOT on server
            v                           |
    tkm deploy all --key <DO_KEY>      |
            |__________________________|
            v
    TKM keys now on server
    Can revoke DO key if desired
```

## The Solution: Bootstrap Key Detection

NodeHolder includes helpers to find your DO-registered key locally:

```bash
# After creating new droplets
nh fetch                           # Gets infrastructure + SSH keys from DO
nh keys list                       # See DO-registered keys
nh keys match                      # Find which local keys match DO fingerprints

# Bootstrap tkm
org import nh ~/nh/myorg/digocean.json myorg
org switch myorg
tkm init && tkm gen all
tkm deploy all --key $(nh keys bootstrap)   # Uses DO key to push tkm keys

# After bootstrap, use tkm keys for daily access
ssh root@$dev                      # Uses ~/.ssh/<org>/dev_root automatically
ssh dev@$dev                       # Uses ~/.ssh/<org>/dev_dev
```

## How `nh keys bootstrap` Works

The command:
1. Reads SSH keys from `digocean.json` (fetched from DO API)
2. Extracts fingerprints of DO-registered keys
3. Scans local `~/.ssh/` for keys
4. Computes MD5 fingerprints of local keys
5. Returns the path to the first local key that matches a DO fingerprint

```bash
# Scripting usage - returns just the path
KEY=$(nh keys bootstrap)
tkm deploy all --key $KEY

# Verbose - explains what it found
nh keys bootstrap -v
```

## The Root vs App User Split

After bootstrap, each environment has two keys:

```
Server: dev (137.184.226.163)
─────────────────────────────

/root/.ssh/authorized_keys:
    ssh-ed25519 ... tkm_dev_root     # For: ssh root@$dev (admin tasks)

/home/dev/.ssh/authorized_keys:
    ssh-ed25519 ... tkm_dev_dev      # For: ssh dev@$dev (deploy, app work)
```

Why two users?
- `root`: System admin (apt, nginx config, user management)
- `dev/staging/prod`: App deployment (git pull, npm install, pm2 restart)

Day-to-day, you mostly use the app user. Root only for system changes.

## Data Flow Summary

```
DigitalOcean API (doctl)
        ↓
    nh fetch
        ↓
digocean.json (~/nh/<context>/)
        ↓
    org import nh
        ↓
tetra.toml ($TETRA_DIR/orgs/<name>/)
        ↓
    tkm (SSH key management)
        ↓
~/.ssh/<org>/ keys + ~/.ssh/config
```

## What's Next

Part 2 covers key management scenarios: lost laptop recovery, onboarding developers, key rotation, and emergency response to compromised keys.
