# Tetra Spaces - Quick Start

## List DigitalOcean Spaces with TES Resolution

### 1. Setup Configuration

**Edit `resources.toml`:**
```toml
[_config]
org_name = "pixeljam-arcade"
tes_version = "2.1"

[_config.storage]
backend = "digitalocean-spaces"
bucket = "pja-games"
endpoint = "https://sfo3.digitaloceanspaces.com"
region = "sfo3"
credentials_env = "DO_SPACES"
```

**Edit `secrets.env`:**
```bash
# DigitalOcean Spaces credentials
DO_SPACES_KEY=DO00GXQ243FCVDLQT9CF
DO_SPACES_SECRET=+kH1E4zhaaisTmKwQRoJS9nfDRK2j9ZOigXmm0PJygY
```

### 2. Compile Configuration

```bash
cd /Users/mricos/src/devops/tetra

# Compile resources.toml + secrets.env → tetra.toml
bash/org/compiler.sh compile pixeljam-arcade
```

This generates in `tetra.toml`:
```toml
[storage.spaces]
symbol = "@spaces"
backend = "digitalocean-spaces"
endpoint = "https://sfo3.digitaloceanspaces.com"
region = "sfo3"
default_bucket = "pja-games"
access_key = "DO00GXQ243FCVDLQT9CF"      # From DO_SPACES_KEY
secret_key = "+kH1E4zhaai..."             # From DO_SPACES_SECRET
```

### 3. List Files

```bash
# Set organization context
export TETRA_ORG=pixeljam-arcade

# List bucket root
bash/spaces/spaces.sh list pja-games

# List specific path
bash/spaces/spaces.sh list pja-games:games/
```

**Output:**
```
Listing: s3://pja-games/games/
Endpoint: https://sfo3.digitaloceanspaces.com

2025-10-10 14:30         5234  s3://pja-games/games/manifest.json
                         DIR   s3://pja-games/games/dino-run/
                         DIR   s3://pja-games/games/space-shooter/
```

### 4. Download File

```bash
# Download to stdout and pipe to jq
bash/spaces/spaces.sh get pja-games:games/manifest.json - | jq .

# Download to local file
bash/spaces/spaces.sh get pja-games:games/manifest.json ./local-games.json
```

### 5. Get Public URL

```bash
bash/spaces/spaces.sh url pja-games:games/manifest.json
# Output: https://pja-games.sfo3.digitaloceanspaces.com/games/manifest.json
```

## TES Resolution Flow

When you run:
```bash
bash/spaces/spaces.sh list pja-games:games/
```

**What happens:**

1. **Parse**: `pja-games:games/` → bucket=`pja-games`, path=`games/`

2. **TES Resolve**: Look up `[storage.spaces]` in:
   ```
   $TETRA_DIR/org/$TETRA_ORG/tetra.toml
   ```

3. **Extract Connector**:
   ```
   endpoint = https://sfo3.digitaloceanspaces.com
   region = sfo3
   access_key = DO00GXQ243FCVDLQT9CF
   secret_key = +kH1E4zhaai...
   bucket = pja-games
   ```

4. **Build Locator**: `s3://pja-games/games/`

5. **Execute Plan**:
   ```bash
   s3cmd ls s3://pja-games/games/ \
     --access_key=DO00GXQ243FCVDLQT9CF \
     --secret_key=+kH1E4z... \
     --host=sfo3.digitaloceanspaces.com \
     --host-bucket='%(bucket)s.sfo3.digitaloceanspaces.com' \
     --region=sfo3
   ```

## Prerequisites

```bash
# Install s3cmd
brew install s3cmd
```

## Common Commands

```bash
export TETRA_ORG=pixeljam-arcade

# List
bash/spaces/spaces.sh list pja-games:games/

# Download
bash/spaces/spaces.sh get pja-games:games.json - | jq .

# Upload
bash/spaces/spaces.sh put ./local.json pja-games:games.json

# Upload with 1-year cache
bash/spaces/spaces.sh put ./game.js pja-games:games/game.js \
  --add-header="Cache-Control: public, max-age=31536000"

# Sync local to Spaces
bash/spaces/spaces.sh sync ./local-games/ pja-games:games/

# Public URL
bash/spaces/spaces.sh url pja-games:games/manifest.json
```

## Troubleshooting

**Error: TETRA_ORG not set**
```bash
export TETRA_ORG=pixeljam-arcade
```

**Error: Organization config not found**
```bash
# Compile tetra.toml
bash/org/compiler.sh compile pixeljam-arcade
```

**Error: No [storage.spaces] section**
```bash
# Add storage config to resources.toml
# Then recompile
bash/org/compiler.sh quick pixeljam-arcade
```

**Access Denied**
```bash
# Check credentials
cat org/pixeljam-arcade/secrets.env | grep DO_SPACES
# Verify they're correct in DigitalOcean dashboard
```
