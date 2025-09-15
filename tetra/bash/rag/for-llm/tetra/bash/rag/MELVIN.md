# MELVIN API Specification
*RAG Tools API Agent for Multicursor and MULTICAT Operations*

## Overview

MELVIN is the API companion to the RAG Tools multicursor system. It provides RESTful endpoints for managing cursors, multicursor collections, and MULTICAT files, enabling integration with external systems and LLM workflows.

## Base URL
```
https://api.rag.tools/v1
```

## Authentication
```bash
# API key in header
curl -H "Authorization: Bearer YOUR_API_KEY" ...

# Or via environment variable
export MELVIN_API_KEY="your_api_key"
```

## Core Endpoints

### Cursors

#### Create Cursor
```bash
curl -X POST /api/v1/cursor \
  -H "Content-Type: application/json" \
  -d '{
    "file_path": "/path/to/file.js",
    "start_line": 10,
    "end_line": 25,
    "tags": ["auth", "bug"],
    "prompt": "Fix authentication logic"
  }'
```

**Response:**
```json
{
  "id": "c_1704976800_A1B2",
  "file_path": "/path/to/file.js",
  "dir_name": "/path/to",
  "filename": "file.js",
  "start_line": 10,
  "end_line": 25,
  "content": "// extracted code content",
  "tags": ["auth", "bug"],
  "prompt": "Fix authentication logic",
  "created": "2024-01-15T10:30:00Z",
  "updated": "2024-01-15T10:30:00Z"
}
```

#### List Cursors
```bash
# List all cursors
curl /api/v1/cursor

# Filter by tag
curl /api/v1/cursor?tags=auth,bug

# Filter by file
curl /api/v1/cursor?file=auth.js

# Search in content
curl /api/v1/cursor?q=authentication
```

#### Get Cursor
```bash
curl /api/v1/cursor/c_1704976800_A1B2
```

#### Update Cursor
```bash
curl -X PUT /api/v1/cursor/c_1704976800_A1B2 \
  -H "Content-Type: application/json" \
  -d '{
    "tags": ["auth", "critical", "fixed"],
    "prompt": "Fixed authentication logic"
  }'
```

#### Delete Cursor
```bash
curl -X DELETE /api/v1/cursor/c_1704976800_A1B2
```

### Multicursor Collections

#### Create Multicursor Collection
```bash
curl -X POST /api/v1/multicursor \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Authentication Bug Fixes",
    "description": "Collection of auth-related code sections",
    "tags": ["auth", "security"]
  }'
```

**Response:**
```json
{
  "id": "mc_1704976800_X1Y2",
  "title": "Authentication Bug Fixes",
  "description": "Collection of auth-related code sections",
  "cursors": [],
  "expanded": false,
  "tags": ["auth", "security"],
  "default_prompt": "Analyze this code collection",
  "created": "2024-01-15T10:30:00Z",
  "updated": "2024-01-15T10:30:00Z"
}
```

#### List Multicursor Collections
```bash
# List all collections
curl /api/v1/multicursor

# Filter by tag
curl /api/v1/multicursor?tags=auth

# Search in title/description
curl /api/v1/multicursor?q=authentication
```

#### Get Multicursor Collection
```bash
curl /api/v1/multicursor/mc_1704976800_X1Y2
```

#### Add Cursor to Collection
```bash
curl -X POST /api/v1/multicursor/mc_1704976800_X1Y2/cursor \
  -H "Content-Type: application/json" \
  -d '{
    "cursor_id": "c_1704976800_A1B2"
  }'
```

#### Remove Cursor from Collection
```bash
curl -X DELETE /api/v1/multicursor/mc_1704976800_X1Y2/cursor/c_1704976800_A1B2
```

#### List Cursors in Collection
```bash
curl /api/v1/multicursor/mc_1704976800_X1Y2/cursor
```

### MULTICAT Operations

#### Export Multicursor as MULTICAT
```bash
# Get as text
curl /api/v1/multicursor/mc_1704976800_X1Y2/export.mc

# Download as file
curl -O /api/v1/multicursor/mc_1704976800_X1Y2/export.mc
```

#### Import MULTICAT File
```bash
# Create multicursor from MULTICAT file
curl -X POST /api/v1/import \
  -F "file=@auth_fixes.mc" \
  -F "title=Imported Auth Fixes" \
  -F "blocks=1,3,7"  # Optional: specific blocks only
```

**Response:**
```json
{
  "multicursor_id": "mc_1704976900_Z3W4",
  "title": "Imported Auth Fixes",
  "cursors_created": 3,
  "cursor_ids": ["c_xxx", "c_yyy", "c_zzz"]
}
```

#### Convert Cursor to MULTICAT Block
```bash
curl /api/v1/cursor/c_1704976800_A1B2/export.mc
```

### Validation

#### Validate MULTICAT Format
```bash
curl -X POST /api/v1/validate \
  -F "file=@project.mc"
```

**Response:**
```json
{
  "valid": true,
  "blocks": 5,
  "warnings": ["Block 3: missing start_line metadata"],
  "errors": []
}
```

#### Validate Cursor Data
```bash
curl -X POST /api/v1/validate/cursor \
  -H "Content-Type: application/json" \
  -d '{
    "file_path": "/nonexistent/file.js",
    "start_line": 10,
    "end_line": 5
  }'
```

## Advanced Operations

### Batch Operations

#### Create Multiple Cursors
```bash
curl -X POST /api/v1/cursor/batch \
  -H "Content-Type: application/json" \
  -d '{
    "cursors": [
      {
        "file_path": "/path/to/auth.js",
        "start_line": 10,
        "end_line": 25,
        "tags": ["auth"]
      },
      {
        "file_path": "/path/to/auth.js", 
        "start_line": 50,
        "end_line": 75,
        "tags": ["auth"]
      }
    ],
    "multicursor": {
      "title": "Auth Functions",
      "auto_add": true
    }
  }'
```

### Search and Discovery

#### Search Across All Data
```bash
curl "/api/v1/search?q=authentication&type=all"
curl "/api/v1/search?q=bug&type=cursor"
curl "/api/v1/search?q=critical&type=multicursor"
```

#### Get Related Cursors
```bash
# Find cursors in same file
curl "/api/v1/cursor/c_1704976800_A1B2/related?type=file"

# Find cursors with similar tags
curl "/api/v1/cursor/c_1704976800_A1B2/related?type=tags"
```

### LLM Integration

#### Generate Context for LLM
```bash
curl /api/v1/multicursor/mc_1704976800_X1Y2/context
```

**Response:**
```json
{
  "context": "# Authentication Bug Fixes\n\n## file.js (10-25)\n\n```javascript\n// code content\n```\n\n",
  "prompt": "Analyze this code collection",
  "metadata": {
    "total_cursors": 3,
    "total_lines": 45,
    "files": ["auth.js", "user.js"]
  }
}
```

#### Apply LLM Transformations
```bash
curl -X POST /api/v1/multicursor/mc_1704976800_X1Y2/transform \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Fix the authentication bugs in this code",
    "model": "claude-3",
    "response_format": "multicat"
  }'
```

## Webhook Integration

### Register Webhooks
```bash
curl -X POST /api/v1/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/melvin-webhook",
    "events": ["cursor.created", "multicursor.updated"],
    "secret": "your_webhook_secret"
  }'
```

### Webhook Events
- `cursor.created` - New cursor created
- `cursor.updated` - Cursor metadata updated  
- `cursor.deleted` - Cursor deleted
- `multicursor.created` - New collection created
- `multicursor.updated` - Collection modified
- `multicursor.deleted` - Collection deleted

## Client Libraries

### Bash Integration Functions
```bash
# Source the API helpers
source "$RAG_TOOLS_DIR/rag_melvin.sh"

# Use API functions
melvin_cursor_create file.js 10 25 "auth,bug"
melvin_multicursor_create "Bug Fixes"
melvin_sync_local_to_api
melvin_sync_api_to_local
```

### Example Workflows

#### Local to API Sync
```bash
# Create local cursor
cursor_id=$(rag_cursor_create auth.js 10 25)

# Sync to API
melvin_cursor_push $cursor_id

# Create multicursor locally and sync
mc_id=$(rag_mcursor_create "Auth Fixes")
rag_mcursor_add $mc_id $cursor_id
melvin_multicursor_push $mc_id
```

#### API to Local Import
```bash
# Import from API
melvin_multicursor_pull mc_api_123

# Or import specific cursors
melvin_cursor_pull c_api_456
```

## Error Responses

All errors follow this format:
```json
{
  "error": {
    "code": "CURSOR_NOT_FOUND",
    "message": "Cursor with ID c_invalid not found",
    "details": {
      "cursor_id": "c_invalid",
      "suggestions": ["c_1704976800_A1B2", "c_1704976801_B2C3"]
    }
  }
}
```

### Common Error Codes
- `CURSOR_NOT_FOUND` - Cursor ID not found
- `MULTICURSOR_NOT_FOUND` - Multicursor ID not found  
- `INVALID_FILE_PATH` - File path doesn't exist or not accessible
- `INVALID_LINE_RANGE` - start_line > end_line or out of file bounds
- `MULTICAT_PARSE_ERROR` - Invalid MULTICAT format
- `VALIDATION_FAILED` - Request validation failed
- `RATE_LIMIT_EXCEEDED` - Too many requests

## Rate Limits

- **Free tier**: 100 requests/hour
- **Pro tier**: 1000 requests/hour  
- **Enterprise**: Unlimited

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704980400
```

## Local Development

### Running MELVIN Locally
```bash
# Clone the MELVIN API server
git clone https://github.com/rag-tools/melvin-api
cd melvin-api

# Start local server
docker-compose up -d
# or
npm start

# Local API will be available at:
export MELVIN_BASE_URL="http://localhost:8080/v1"
```

### Testing with Local RAG Tools
```bash
# Test connection
curl $MELVIN_BASE_URL/health

# Create test cursor
rag_cursor_create test.js 1 10
melvin_cursor_push $cursor_id
```

---

**MELVIN** - *Making Every Line Very Intelligently Navigable*

For more information, visit: https://docs.rag.tools/melvin