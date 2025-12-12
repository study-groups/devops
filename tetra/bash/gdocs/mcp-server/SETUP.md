# Google Docs MCP Server Setup

## Package
Using: `@xalia/mcp-googledocs-server` v1.2.3

## File Locations
- **Server**: `/Users/mricos/src/devops/tetra/bash/gdocs/mcp-server/node_modules/@xalia/mcp-googledocs-server/dist/server.js`
- **Credentials**: Must be placed at project root (where you run the server from)
- **Token**: Generated after first auth, stored alongside credentials

## Setup Steps

### 1. Google Cloud Console Setup (One Time)

1. Go to https://console.cloud.google.com/
2. Create or select a project
3. Enable APIs:
   - Google Docs API
   - Google Drive API
4. Configure OAuth Consent Screen:
   - User Type: External
   - Add scopes:
     - `https://www.googleapis.com/auth/documents`
     - `https://www.googleapis.com/auth/drive.file`
   - Add yourself as Test User
5. Create OAuth Credentials:
   - Type: Desktop app
   - Download JSON as `credentials.json`

### 2. Place Credentials

```bash
cp ~/Downloads/client_secret_*.json /Users/mricos/src/devops/tetra/bash/gdocs/mcp-server/credentials.json
```

### 3. First Run (Get Token)

```bash
cd /Users/mricos/src/devops/tetra/bash/gdocs/mcp-server
node node_modules/@xalia/mcp-googledocs-server/dist/server.js
```

This will:
1. Print an authorization URL
2. Open in browser, grant access
3. Copy the code from the redirect URL (`?code=XXX&scope=...`)
4. Paste into terminal
5. Creates `token.json`

### 4. Claude Config

Already configured in `~/.claude.json` for `/Users/mricos/src/pixeljam` project:

```json
{
  "mcpServers": {
    "google-docs": {
      "type": "stdio",
      "command": "node",
      "args": ["/Users/mricos/src/devops/tetra/bash/gdocs/mcp-server/node_modules/@xalia/mcp-googledocs-server/dist/server.js"],
      "env": {}
    }
  }
}
```

## Secrets Management

**DO NOT COMMIT:**
- `credentials.json` - OAuth client credentials
- `token.json` - User's refresh token

Add to `.gitignore`:
```
credentials.json
token.json
```

## Alternative: Environment Variable Auth

For hosted environments, use `--hostAuth` flag:

```json
{
  "args": [".../server.js", "--hostAuth"],
  "env": {
    "GOOGLE_API_ACCESS_TOKEN": "<access_token>"
  }
}
```

## Tetra Integration

To add as a tetra service:

```bash
# Add to tetra services
tetra service add gdocs-mcp \
  --cmd "node /Users/mricos/src/devops/tetra/bash/gdocs/mcp-server/node_modules/@xalia/mcp-googledocs-server/dist/server.js" \
  --type stdio
```
