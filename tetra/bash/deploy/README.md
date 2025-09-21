# Interactive Deployment Script

## Overview

This interactive deployment script provides a guided, step-by-step approach to deploying the Pixeljam Arcade application from development to staging environments.

## Prerequisites

- Bash 4.0+
- `jq` (JSON processor)
- SSH access to staging server
- Git repository with appropriate branches

## Usage

### Full Deployment

```bash
./interactive_deploy.sh
```

This will run through all deployment phases interactively.

### Specific Phase Deployment

```bash
./interactive_deploy.sh ssh_connectivity
./interactive_deploy.sh env_preparation
./interactive_deploy.sh git_sync
./interactive_deploy.sh deployment_transfer
./interactive_deploy.sh deployment_execution
./interactive_deploy.sh post_deployment_checks
```

## Deployment Phases

1. **SSH Connectivity Setup**: Establish secure SSH connection
2. **Environment Preparation**: Create and modify staging environment
3. **Git Synchronization**: Sync repository branches
4. **Deployment Transfer**: Copy necessary files
5. **Deployment Execution**: Build and configure application
6. **Post-Deployment Checks**: Verify deployment success

## Interaction

For each step, you'll be prompted:
- `y`: Execute the step
- `n`: Skip the step
- `q`: Quit the deployment process

## Logging

Deployment logs are stored in `~/.tetra/deploy/logs/` with timestamped filenames.

## Customization

Edit `deploy_actions.json` to modify deployment steps or add new phases.
