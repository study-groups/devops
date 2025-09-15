# Common settings
[common]
PD_DIR = "$HOME/pj/pd"
DO_SPACES_KEY = "DO00Zxxxxxxxxxxxxxxxxxxxx"
DO_SPACES_SECRET = "LRrHpxxxxxxxxxxxxxxxxxxxxxxxxxxx"
DO_SPACES_ENDPOINT = "https://sfo3.digitaloceanspaces.com"
DO_SPACES_BUCKET = "pja-games"
DO_SPACES_REGION = "sfo3"
AUDIT_BATCH_SIZE = 50
AUDIT_FLUSH_INTERVAL = 30000
AUDIT_BUCKET = "pja-logs"
APP_VERSION = "1.0.0"
LOG_DIR = "./logs"
LOG_MAX_FILE_SIZE = 10485760
LOG_MAX_FILES = 100
LOG_MAX_DISK_USAGE = 524288000
LOG_COMPRESSION = true

# Environments

[dev]
NODE_ENV = "development"
HOST = "137.184.226.163"
USER = "dev

[prod]
NODE_ENV = "production"
HOST = "64.23.151.249"
USER = "prod"

[staging]
NODE_ENV = "production"
HOST = "64.23.151.249"
USER = "staging"

[qa]
NODE_ENV = "development"
HOST = "146.190.151.245"
USER = "root"

