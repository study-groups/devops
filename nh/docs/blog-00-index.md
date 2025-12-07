# NodeHolder Technical Documentation

Welcome to the NodeHolder technical blog. This series covers SSH key management for DigitalOcean infrastructure using NodeHolder (nh) and Tetra's key manager (tkm).

## The Series

### [Part 1: The Bootstrap Problem](blog-01-bootstrap-problem.md)

The chicken-and-egg problem of deploying SSH keys: you need access to deploy keys, but you need keys to get access. Covers:

- How DigitalOcean droplet creation works
- DO-registered keys vs TKM keys
- The bootstrap flow
- Using `nh keys bootstrap` to find your DO key locally

### [Part 2: Key Scenarios](blog-02-key-scenarios.md)

What to do when things go wrong (or right). Six scenarios with step-by-step procedures:

1. Lost or stolen laptop
2. Onboarding a new developer
3. Routine key rotation
4. Key compromise / security breach
5. Completely locked out
6. Adding a new server

### [Part 3: Architecture](blog-03-architecture.md)

How NodeHolder and Tetra fit together. Covers:

- The data pipeline from DO API to SSH config
- Why nh and tetra are separate tools
- File locations and directory structure
- The `digocean.json` bridge contract
- Security boundaries between tools

### [Part 4: Simple vs Secure](blog-04-simple-vs-secure.md)

Choosing the right level of complexity. Covers:

- Level 0: One key everywhere
- Level 1: Shared TKM keys per environment
- Level 2: Per-developer keys
- Level 3: Centralized key management
- Practical recommendations by team size
- Migration path as you grow

## Quick Start

```bash
# 1. Configure doctl
doctl auth init --context myorg

# 2. Fetch infrastructure
nh create myorg
nh switch myorg
nh fetch

# 3. Import to Tetra
org import nh ~/nh/myorg/digocean.json myorg
org switch myorg

# 4. Setup SSH keys
tkm init
tkm gen all
tkm deploy all --key $(nh keys bootstrap)

# 5. Use
ssh root@$dev
ssh dev@$dev
```

## CLI Reference

### NodeHolder (nh)

```bash
nh status           # Current context and stats
nh switch <ctx>     # Switch context, load variables
nh fetch            # Fetch from DigitalOcean API
nh servers          # List servers with IPs
nh keys             # DO-registered SSH key helpers
nh keys scenarios   # Recovery procedures
```

### Tetra org

```bash
org status          # Active organization
org switch <name>   # Switch org, export $dev/$staging/$prod
org import nh       # Import from digocean.json
org env             # List environments
```

### Tetra tkm

```bash
tkm status          # Current keys
tkm doctor          # Health check
tkm gen <env|all>   # Generate keys
tkm deploy <env>    # Push keys to server
tkm rotate <env>    # Revoke + gen + deploy
tkm test            # Test SSH connectivity
```

## Scenario Quick Reference

| Situation | Command |
|-----------|---------|
| Lost laptop | `nh keys scenarios lost-laptop` |
| New team member | `nh keys scenarios new-dev` |
| Rotate keys | `nh keys scenarios rotate` |
| Key compromised | `nh keys scenarios compromised` |
| Can't SSH at all | `nh keys scenarios locked-out` |
| New server | `nh keys scenarios new-server` |

## Source

- NodeHolder: `~/src/devops/nh`
- Tetra: `~/src/devops/tetra`
