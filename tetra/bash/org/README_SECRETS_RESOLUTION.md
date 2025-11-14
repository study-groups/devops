# Tetra Secrets Resolution

## Overview

Tetra uses a Terraform-style approach for managing configuration and secrets:

```
Source Files          →  Generated Config        →  Resolved Runtime
~/nh/org/             →  $TETRA_DIR/orgs/org/    →  (in-memory)
├── digocean.json        ├── tetra.toml              Variables expanded
├── mapping.json         ├── resources.toml          at runtime via eval
└── secrets.env          └── secrets.env
```

## File Roles

### Source Files (Checked into git)
- `~/nh/{org}/digocean.json` - Infrastructure topology from DigitalOcean API
- `~/nh/{org}/mapping.json` - Environment mappings
- `~/nh/{org}/resources.toml` - Resource definitions

### Configuration Files (Generated, with placeholders)
- `$TETRA_DIR/orgs/{org}/tetra.toml` - Generated config with `${VAR}` placeholders
- `$TETRA_DIR/orgs/{org}/resources.toml` - Resource configs

### Secret Files (NEVER git, chmod 600)
- `$TETRA_DIR/orgs/{org}/secrets.env` - Actual credentials
- Contains: `DO_SPACES_KEY`, `DO_SPACES_SECRET`, etc.

## Resolution Patterns

### Pattern 1: Compile-Time Resolution (Current)
The compiler generates `tetra.toml` with placeholders like `${DO_SPACES_KEY}`.
Modules resolve these at runtime using `eval`:

```bash
# In spaces.sh _spaces_resolve()
access_key=$(grep '^access_key' "$toml_file" | cut -d'=' -f2 | tr -d ' "')
secret_key=$(grep '^secret_key' "$toml_file" | cut -d'=' -f2 | tr -d ' "')

# Expand environment variables
access_key=$(eval echo "$access_key")
secret_key=$(eval echo "$secret_key")
```

### Pattern 2: Runtime envsubst (Alternative)
Generate a fully resolved file on-demand:

```bash
# Load secrets and generate resolved config
source "$TETRA_DIR/orgs/$org/secrets.env"
envsubst < "$TETRA_DIR/orgs/$org/tetra.toml" > /tmp/tetra-resolved.toml
```

## Workflow

### 1. Initial Setup
```bash
# Fetch infrastructure data
cd ~/nh/pixeljam-arcade
doctl compute droplet list --output json > digocean.json

# Create secrets (NEVER commit)
cat > $TETRA_DIR/orgs/pixeljam-arcade/secrets.env << 'EOF'
DO_SPACES_KEY=DO00GXQ243FCVDLQT9CF
DO_SPACES_SECRET=+kH1E4zhaaisTmKwQRoJS9nfDRK2j9ZOigXmm0PJygY
EOF

chmod 600 $TETRA_DIR/orgs/pixeljam-arcade/secrets.env
```

### 2. Compile Configuration
```bash
# Generate tetra.toml from source files
cd $TETRA_SRC/bash/org
./compiler.sh compile pixeljam-arcade

# This creates tetra.toml with placeholders:
# access_key = "${DO_SPACES_KEY}"
# secret_key = "${DO_SPACES_SECRET}"
```

### 3. Runtime Usage
```bash
# Load secrets into environment
source $TETRA_DIR/orgs/pixeljam-arcade/secrets.env

# Use modules (they resolve secrets automatically)
export TETRA_ORG=pixeljam-arcade
spaces_list pja-games
```

## Security Model

### What Gets Committed (Source Control)
✅ `~/nh/{org}/digocean.json` - Infrastructure topology
✅ `~/nh/{org}/mapping.json` - Environment mappings
✅ `~/nh/{org}/resources.toml` - Resource definitions
✅ `$TETRA_SRC/bash/spaces/spaces.sh` - Module code

### What's Generated (Local Only)
⚠️  `$TETRA_DIR/orgs/{org}/tetra.toml` - Config with placeholders
⚠️  Can be committed IF it only has `${VAR}` placeholders

### What's NEVER Committed (Secrets)
❌ `$TETRA_DIR/orgs/{org}/secrets.env` - Actual credentials
❌ Any file with resolved secret values

## .gitignore Rules

```gitignore
# Tetra secrets (NEVER commit)
**/secrets.env
**/tetra.toml.resolved
**/tetra.toml.env

# Tetra working files
**/.tetra/
**/tetra-resolved.toml
```

## Best Practices

1. **Always use placeholders in committed config**
   - Use `${DO_SPACES_KEY}` not `DO00GXQ243FCVDLQT9CF`

2. **Protect secrets.env**
   ```bash
   chmod 600 $TETRA_DIR/orgs/*/secrets.env
   ```

3. **Load secrets in shell init**
   ```bash
   # In ~/.bashrc or tetra.sh
   if [[ -f "$TETRA_DIR/orgs/$TETRA_ORG/secrets.env" ]]; then
       source "$TETRA_DIR/orgs/$TETRA_ORG/secrets.env"
   fi
   ```

4. **Validate before use**
   ```bash
   if [[ -z "$DO_SPACES_KEY" ]]; then
       echo "Error: Secrets not loaded"
       return 1
   fi
   ```

## Debugging

### Check if secrets are loaded
```bash
echo "DO_SPACES_KEY=${DO_SPACES_KEY:0:10}..."
```

### Check if TOML has placeholders
```bash
grep 'access_key' $TETRA_DIR/orgs/pixeljam-arcade/tetra.toml
# Should show: access_key = "${DO_SPACES_KEY}"
```

### Test resolution
```bash
source $TETRA_DIR/orgs/pixeljam-arcade/secrets.env
test_val='${DO_SPACES_KEY}'
echo "$(eval echo "$test_val")"
# Should show: DO00GXQ243FCVDLQT9CF
```

## Comparison with Terraform

| Terraform | Tetra |
|-----------|-------|
| `.tf` files | `tetra.toml` (with placeholders) |
| `terraform.tfvars` | `secrets.env` |
| `terraform apply` | `compiler.sh compile` + `source secrets.env` |
| `terraform.tfstate` | (in-memory resolution) |
| `.gitignore: *.tfstate` | `.gitignore: secrets.env` |

## Migration from Hardcoded Secrets

If your `tetra.toml` has hardcoded secrets, migrate to placeholders:

```bash
# 1. Backup current config
cp $TETRA_DIR/orgs/pixeljam-arcade/tetra.toml{,.backup}

# 2. Extract secrets
grep 'access_key\|secret_key' $TETRA_DIR/orgs/pixeljam-arcade/tetra.toml

# 3. Replace with placeholders
sed -i '' 's/access_key = "DO[^"]*"/access_key = "${DO_SPACES_KEY}"/g' \
    $TETRA_DIR/orgs/pixeljam-arcade/tetra.toml

sed -i '' 's/secret_key = "[^"]*"/secret_key = "${DO_SPACES_SECRET}"/g' \
    $TETRA_DIR/orgs/pixeljam-arcade/tetra.toml

# 4. Ensure secrets.env exists
cat > $TETRA_DIR/orgs/pixeljam-arcade/secrets.env << 'EOF'
DO_SPACES_KEY=DO00GXQ243FCVDLQT9CF
DO_SPACES_SECRET=+kH1E4zhaaisTmKwQRoJS9nfDRK2j9ZOigXmm0PJygY
EOF

chmod 600 $TETRA_DIR/orgs/pixeljam-arcade/secrets.env
```
