# tetra-deploy.toml v2 Specification

File-centric deployment configuration format.

## Design Principles

1. **Files first** - what gets deployed is primary
2. **Composable** - small pieces combine into pipelines
3. **Inheritable** - environments extend each other
4. **Tab-complete friendly** - names are completable at every level

## Syntax

```bash
deploy <target>[:<pipeline>] <env>
deploy <target>:{file1,file2} <env>    # ad-hoc file set
deploy <target> --watch <env>          # rebuild on change
deploy <target> --dry-run <env>        # preview
deploy rollback <target> <env> [n]     # restore version
```

## Sections

### [target]
Core target identity.

```toml
[target]
name = "docs"              # target name (matches directory)
source = "dist/"           # local source directory
cwd = "/home/{{user}}/app" # remote working directory
```

### [env.<name>]
Environment-specific settings.

```toml
[env.prod]
ssh = "root@prod.example.com"
user = "appuser"              # remote user for file ownership
domain = "app.example.com"    # optional, for templates
confirm = true                # require confirmation
notify = "slack:#deploys"     # post-deploy notification

[env.dev]
inherit = "prod"              # inherit all settings
ssh = "root@dev.example.com"  # override specific values
confirm = false
sync.delete = true            # env-specific sync override
```

### [files]
Named file patterns, relative to `source`.

```toml
[files]
all = "*.html"                    # glob pattern
gdocs = "gdocs-guide.html"        # single file
assets = "assets/**"              # recursive glob

[files.guides]                    # file group
include = ["gdocs", "deploy"]     # combine named sets
exclude = ["*.draft.html"]        # minus pattern
```

### [build]
Commands that create/transform files.

```toml
[build]
pre = "npm install"               # runs before any build

[build.all]
command = "npm run build"

[build.gdocs]
command = "tut build gdocs-guide --out dist/"
watch = "src/gdocs/**"            # trigger rebuild
skip_if = "dist/gdocs.html"       # skip if output newer
```

### [sync]
File transfer configuration.

```toml
[sync]
method = "rsync"                  # rsync | scp | s3 | gcp
options = "-avz --checksum"       # method-specific options
chown = "www-data:www-data"       # remote ownership
chmod = "755"                     # remote permissions
delete = false                    # true = mirror, false = additive
backup = true                     # keep .bak before overwrite
exclude = [".git", "node_modules"]
```

### [pipeline]
Named sequences of operations.

```toml
[pipeline]
default = ["build:all", "build:index", "sync"]
gdocs = ["build:gdocs", "sync"]
quick = ["sync"]                  # skip build
full = ["clean", "build:all", "test", "sync"]
```

Pipeline steps:
- `build:<name>` - run named build
- `sync` - transfer files
- `clean` - remove build artifacts
- `test` - run tests
- `notify` - send notification
- Custom commands with `cmd:` prefix

### [alias]
Short names for pipelines.

```toml
[alias]
g = "gdocs"      # deploy docs:g prod
q = "quick"
a = "all"
```

### [hooks]
Lifecycle events.

```toml
[hooks]
pre_build = "echo 'Starting build...'"
post_build = "npm run verify"
pre_sync = "ssh {{ssh}} 'mkdir -p {{cwd}}'"
post_sync = "curl -X POST {{webhook}}"
on_error = "notify-failure {{error}}"
on_success = "notify-success"
```

### [history]
Version management.

```toml
[history]
keep = 5                          # versions to retain
path = "{{cwd}}/.versions"        # storage location
```

## Template Variables

Available in commands and paths:

| Variable | Description |
|----------|-------------|
| `{{ssh}}` | user@host for current env |
| `{{user}}` | remote user |
| `{{cwd}}` | remote working directory |
| `{{source}}` | local source directory |
| `{{files}}` | current file set (in sync) |
| `{{env}}` | environment name |
| `{{name}}` | target name |
| `{{domain}}` | domain if set |
| `{{timestamp}}` | ISO timestamp |

## File Resolution

1. `deploy docs prod` → `files.all` (default)
2. `deploy docs:gdocs prod` → `files.gdocs`
3. `deploy docs:guides prod` → `files.guides` (expanded)
4. `deploy docs:{a,b} prod` → ad-hoc set from files.a + files.b

## Completion

```bash
deploy <tab>              # targets
deploy docs <tab>         # pipelines/aliases: gdocs quick g q
deploy docs:<tab>         # files: all gdocs deploy org
deploy docs:g<tab>        # gdocs guides
deploy docs:gdocs <tab>   # envs: prod dev
```

## Implementation Priority

1. **Phase 1**: Parse new format, run pipelines
2. **Phase 2**: File groups, aliases, completion
3. **Phase 3**: History/rollback, hooks
4. **Phase 4**: Watch mode, notifications
