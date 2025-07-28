# Config for deploying api-dev to staging
# Generated on $(date)

# === SOURCE ENVIRONMENT (for pulling .env file) ===
# Staging pulls the .env file from the Dev server.
ENV_SOURCE_HOST="dev.pixeljamarcade.com"
ENV_SOURCE_USER="dev"
ENV_SOURCE_PATH="~/src/pixeljam/pja/arcade/env/dev.env"

# === LOCAL & TARGET ENVIRONMENT ===
# Local temporary path on your machine to hold the env file during transfer.
LOCAL_ENV_FILE="/tmp/tetra-deploy/pixeljam-arcade-staging.env"

# Target server settings (staging)
REMOTE_HOST="pixeljamarcade.com"
REMOTE_USER="staging"
REPO_PATH="~/src/pixeljam"
REMOTE_ENV_FILE="~/src/pixeljam/pja/arcade/env/staging.env"

# Git branch settings
BRANCH="staging"
MERGE_BRANCH="api-dev"
PROJECT_SUBDIR="pja/arcade"
HARD_MERGE="true"

# Service settings
SERVICE1="nginx"
SERVICE2="arcade-staging"
