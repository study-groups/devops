# Deploy - Deployment Orchestration

Multi-target deployment orchestration with environment-specific configuration, build pipeline, and runtime artifact generation.

## Quick Start

```bash
# Source tetra first
source ~/tetra/tetra.sh

# Generate environment file
tetra_runtime_generate_env env.meta.toml production

# Build project
deploy_build . production

# Deploy to Spaces
deploy_to_spaces ./dist mybucket www/

# Deploy to remote server
deploy_to_remote user@server.com /app production

# Check deployment status
deploy_check_status user@server.com myapp
```

## Core Concepts

### Environment Configuration
- TOML-based canonical configuration (`env.meta.toml`)
- Environment-specific .env generation
- Template-based entrypoint generation
- Systemd service file generation

### Deployment Targets
- **Local** - Build and test locally
- **Spaces** - DigitalOcean Spaces (CDN/static hosting)
- **Remote** - SSH deployment to servers
- **S3** - AWS S3 compatible storage

## Commands

### Artifact Generation
- `tetra_runtime_generate_env <toml> <env> [output]` - Generate .env file
- `tetra_runtime_generate_entrypoint <toml> <env> <dir> [template]` - Generate entrypoint script
- `tetra_runtime_generate_service <toml> <env> <dir> [template]` - Generate systemd service

### Build Pipeline
- `deploy_build <dir> <env>` - Build project for environment
- `deploy_build_local <dir>` - Build for local development
- `deploy_build_remote <host> <dir> <env>` - Build on remote server

### Deployment
- `deploy_to_spaces <build_dir> <bucket> <path>` - Deploy to Spaces
- `deploy_to_remote <host> <dir> <env>` - Deploy to remote server
- `deploy_to_s3 <build_dir> <bucket> <path>` - Deploy to S3

### Status & Management
- `deploy_check_status <host> <service>` - Check deployment status
- `deploy_restart <host> <service>` - Restart deployed service
- `deploy_rollback <host> <service>` - Rollback deployment

## REPL Mode

```bash
# Launch interactive REPL
deploy_repl

deploy> generate env production
deploy> build . production
deploy> deploy spaces ./dist mybucket www/
deploy> status user@server.com myapp
deploy> help
deploy> quit
```

## Configuration

### Environment TOML

Example `env.meta.toml`:

```toml
[production]
NODE_ENV = "production"
PORT = "3000"
API_URL = "https://api.example.com"

[development]
NODE_ENV = "development"
PORT = "3001"
API_URL = "http://localhost:8000"
```

### Deployment Config

Example `deploy.config.sh`:

```bash
PROJECT_DIR="/app"
SERVICE_NAME="myapp"
BUILD_CMD="npm run build"
DEPLOY_USER="deploy"
```

## Module Structure

- `includes.sh` - Module entry point, sets MOD_SRC/MOD_DIR
- `actions.sh` - TCS-compliant actions for TUI integration
- `deploy.sh` - Main deployment orchestration
- `deploy_repl.sh` - Interactive REPL
- `build.sh` - Build pipeline
- `runtime.sh` - Runtime artifact generation
- `do-spaces.sh` - DigitalOcean Spaces deployment

## Integration

Works seamlessly with:
- **Spaces** module - DigitalOcean Spaces deployment
- **Org** module - Multi-environment configuration
- **TSM** module - Process management on remote servers
- **Env** module - Environment variable management

## See Also

- `action_interface.sh` - Action interface specification
- `orchestrator.sh` - Deployment orchestration
- `transfer.sh` - File transfer utilities
- Spaces module for object storage deployment
