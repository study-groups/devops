# NodeHolder Organization - Tetra Integration

This directory contains infrastructure data exported from the NodeHolder DigitalOcean organization for use with Tetra deployment and management tools.

## Data Files

### servers.json
Complete server inventory with all relevant details:
- Server IDs, names, and creation dates
- All public IPs (including floating IPs as arrays)
- Private IPs
- Resource specs (memory, CPU, disk)
- Region information
- Floating IP indicators

**Example Query:**
```bash
# List all servers with floating IPs
jq '.[] | select(.has_floating_ip == true) | {name, public_ips}' servers.json

# Find a specific server
jq '.[] | select(.name == "nodeholder-qa")' servers.json

# List servers by region
jq 'group_by(.region) | map({region: .[0].region, count: length})' servers.json
```

### servers.env
Environment variables for all servers, ready to source:
- Public IPs: `$do1`, `$nodeholder_qa`, etc.
- Private IPs: `${name}_private`
- Floating IPs: `${name}_floating`

**Usage:**
```bash
source servers.env
ssh root@$nodeholder_qa
```

### deployment-targets.env
Tetra-specific deployment target variables (commented out by default):
- Primary IPs for all servers
- Floating IPs for production deployments
- QA environment pre-configured

**Example Usage:**
```bash
# Uncomment the servers you want to use
# export TETRA_NODEHOLDER_QA_IP=165.232.139.55

# Or source and use directly
export TETRA_QA_IP=165.232.139.55
tetra deploy --target qa
```

## Server Inventory

### Production Servers (with Floating IPs)
- **do4-n2** - San Francisco (sfo2)
  - Primary: 165.227.6.221
  - Floating: 68.183.248.67
  - 2 volumes attached

- **do3-fedora-nyc1** - New York (nyc1)
  - Primary: 159.89.85.73
  - Floating: 174.138.110.75
  - 1 volume attached

### QA/Testing Servers
- **nodeholder-qa** - San Francisco 3 (sfo3)
  - IP: 165.232.139.55
  - Latest Ubuntu (24.10)
  - Created: 2025-05-10

### Legacy/Development Servers
- **do1** - New York (nyc1) - 512MB (oldest server)
- **do4** - San Francisco (sfo2) - 1GB, 1 volume
- **do5** - San Francisco (sfo2) - 1GB
- **do6** - London (lon1) - 1GB
- **ghost-sfo2-01** - San Francisco (sfo2) - Ghost CMS, 1 volume

## Data Refresh

This data is derived from `~/nh/nodeholder/digocean.json`.

To refresh this data:
```bash
cd ~/nh/nodeholder
source init.sh
nh-export-tetra
```

Or manually:
```bash
source ~/nh/nodeholder/init.sh
nh_export_for_tetra
```

## Integration with Tetra

### Option 1: Source Environment Files
```bash
# In your Tetra deployment scripts
source ~/src/devops/tetra/orgs/nodeholder/servers.env

# Now you have access to all server IPs
echo "Deploying to $nodeholder_qa"
```

### Option 2: Query JSON Programmatically
```bash
# Get server IP in a script
QA_IP=$(jq -r '.[] | select(.name == "nodeholder-qa") | .public_ips[0]' \
    ~/src/devops/tetra/orgs/nodeholder/servers.json)
```

### Option 3: Use Deployment Targets
```bash
# Edit deployment-targets.env to uncomment desired targets
# Then source it in your Tetra config
source ~/src/devops/tetra/orgs/nodeholder/deployment-targets.env
```

## Data Validation

Validate the source data:
```bash
cd ~/nh/nodeholder
source init.sh
nh-validate
nh-groom
```

## Notes

- Servers with floating IPs have the `has_floating_ip` flag set to `true`
- The first IP in `public_ips` array is the primary/direct IP
- Additional IPs in the array are floating IPs
- Some older servers (e.g., do1) may not have private IPs
- All timestamps are in ISO 8601 format

## Related Documentation

- Source data: `~/nh/nodeholder/digocean.json`
- NH REPL: `~/nh/nodeholder/README.md`
- Validation logs: `~/nh/nodeholder/validate.log`
