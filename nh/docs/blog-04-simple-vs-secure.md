# SSH Key Management: Simple vs Secure

This is Part 4 of a series on managing SSH keys across DigitalOcean infrastructure.

This post addresses a practical question: how much complexity do you actually need? The answer depends on your team size, security requirements, and tolerance for operational overhead.

## The Spectrum

```
Simple                                                    Secure
   |                                                        |
   v                                                        v
One key          Shared tkm keys       Per-dev keys     Hardware tokens
everywhere       per environment       per environment   + audit logs
```

Most teams should start simple and add complexity only when needed.

## Level 0: One Key Everywhere

**Setup**:
```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519
doctl compute ssh-key create mykey --public-key-file ~/.ssh/id_ed25519.pub
```

**Usage**:
```bash
ssh root@<any-server>   # Same key works everywhere
```

**Characteristics**:
- Single key in DO account
- Injected into all droplets at creation
- Used for all access (root and app users)
- Never rotated (realistically)

**When compromised**:
- Attacker has root on ALL servers
- Must replace key on every server manually
- No audit trail of which server was accessed

**Good for**:
- Solo developer
- Side projects
- Learning/experimentation

**Not good for**:
- Teams (no individual accountability)
- Production systems with uptime requirements
- Any compliance requirements

---

## Level 1: Shared TKM Keys Per Environment

**Setup**:
```bash
tkm init
tkm gen all
tkm deploy all --key ~/.ssh/id_ed25519
```

**Result**:
```
~/.ssh/myorg/
├── dev_root
├── dev_dev
├── staging_root
├── staging_dev
├── prod_root
└── prod_dev
```

**Usage**:
```bash
ssh root@$dev      # Uses dev_root
ssh dev@$dev       # Uses dev_dev
ssh root@$prod     # Uses prod_root (different key!)
```

**Characteristics**:
- Separate keys per environment
- Separate keys for root vs app user
- Shared among all team members
- Rotatable per environment

**When dev_root compromised**:
- Attacker has root on dev only
- Staging and prod unaffected
- Rotate just dev: `tkm rotate dev`

**When team member leaves**:
- Rotate all keys they had access to
- Or just remove their copy (if you trust they deleted it)

**Good for**:
- Small teams (2-5 people)
- Startups
- Projects where everyone needs similar access

**Not good for**:
- Teams needing individual accountability
- Compliance requiring per-user audit trails

---

## Level 2: Per-Developer Keys (Manual)

TKM doesn't directly support this yet, but you can implement it:

**Setup** (for each developer):
```bash
# Alice generates her key
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -C "alice@company"

# Admin adds to servers
ssh root@$dev "echo 'ssh-ed25519 AAAA... alice@company' >> /home/dev/.ssh/authorized_keys"
```

**Characteristics**:
- Each developer has unique key
- Keys added to specific servers/users
- Clear audit trail (key comment identifies user)
- More operational overhead

**When Alice's key compromised**:
- Only Alice's access affected
- Remove her key from servers
- Other developers unaffected

**When Alice leaves**:
```bash
# Remove from all servers
for host in $dev $staging $prod; do
    ssh root@$host "sed -i '/alice@company/d' /root/.ssh/authorized_keys"
    ssh root@$host "sed -i '/alice@company/d' /home/dev/.ssh/authorized_keys"
done
```

**Good for**:
- Medium teams (5-20 people)
- Need to know who accessed what
- Compliance requirements

**Not good for**:
- Rapid team changes
- Large teams (too much manual work)

---

## Level 3: Centralized Key Management

Beyond the scope of nh/tkm. Options include:

- **HashiCorp Vault**: SSH certificate authority
- **Teleport**: SSH with identity-aware access
- **AWS SSM / DO Console**: No SSH keys, browser-based access
- **Bastian hosts**: Single hardened entry point

**Characteristics**:
- Short-lived certificates instead of static keys
- Centralized audit logs
- Role-based access control
- Significant operational complexity

**Good for**:
- Large teams
- Strict compliance (SOC2, HIPAA, etc.)
- Multiple environments across cloud providers

---

## Practical Recommendations

### Solo Developer

```bash
# Just use your default key
ssh-keygen -t ed25519
doctl compute ssh-key create laptop --public-key-file ~/.ssh/id_ed25519.pub

# Create droplets, SSH just works
ssh root@$dev
```

Rotation: When you get a new laptop.

### Small Team (2-5)

```bash
# Use tkm with shared keys
tkm init && tkm gen all && tkm deploy all

# Share keys via secure channel (not email)
tar czf keys.tar.gz ~/.ssh/myorg/
# Transfer securely, new dev extracts and runs tkm config gen
```

Rotation: Quarterly, or when someone leaves.

### Growing Team (5-15)

```bash
# tkm for environment separation
tkm init && tkm gen all && tkm deploy all

# Plus per-developer keys for accountability
# Add each dev's pubkey to servers manually
# Or use tkm shared keys for app user, individual for root
```

Rotation: Monthly for shared keys. Immediately on offboarding.

### Compliance Requirements

Don't use static SSH keys. Look into:
- SSH certificate authorities
- Session recording
- Just-in-time access provisioning

---

## The 80/20 Rule

For most teams, Level 1 (shared tkm keys per environment) provides:
- 80% of the security benefit (environment isolation)
- 20% of the complexity (compared to full RBAC)

You get:
- Dev compromise doesn't affect prod
- Key rotation is possible and straightforward
- Clear separation of root vs app access
- Works with standard SSH tooling

You don't get:
- Individual accountability
- Audit trails per user
- Automatic key expiration

If you need those, you've outgrown static SSH keys.

---

## Migration Path

Starting simple and adding security later:

```
Month 1: One key everywhere (just ship)
    ↓
Month 3: tkm gen all (environment isolation)
    ↓
Month 6: Add per-dev keys for root access
    ↓
Year 2: Evaluate Vault/Teleport if team > 10
```

Don't over-engineer on day one. The `nh keys scenarios` command documents recovery procedures for each level, so you can handle incidents regardless of which model you're using.

---

## Summary

| Level | Keys | Rotation | Audit | Good For |
|-------|------|----------|-------|----------|
| 0 | 1 | Never | None | Solo dev |
| 1 | Per-env | Quarterly | By env | Small team |
| 2 | Per-dev | On offboard | By user | Medium team |
| 3 | Certificates | Automatic | Full | Enterprise |

Start at Level 0 or 1. Move up only when you have a specific problem that requires it.
