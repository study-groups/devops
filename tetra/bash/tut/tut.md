# tut — Org Documentation Manager

tut manages JSON documentation per org and delegates rendering to terrain.

## Context System

tut uses a three-slot context: `TUT[org:subject:type]`

```
tut ctx set tetra install guide   # full context
tut ctx tetra install guide       # shorthand
tut ctx subject deploy            # change subject only
tut ctx type ref                  # change type only
tut ctx clear                     # reset
tut ctx                           # show current
```

**TPS slot mapping:** tut's "subject" maps to the tps "project" slot, and tut's "type" maps to the tps "subject" slot. This is because tps has generic `org:project:subject` slots.

## Document Types

| Type | JSON Key | Template | Description |
|------|----------|----------|-------------|
| `ref` | `.groups` | reference.html | Reference docs with sidebar nav |
| `guide` | `.steps` | guide.html | Step-by-step tutorials |
| `thesis` | `.sections` | thesis.html | Long-form research/analysis |

You can also set `.metadata.type` explicitly to skip duck-typing.

## Directory Layout

```
$TETRA_DIR/orgs/<org>/tut/
  src/<subject>-<type>.json        # source documents
  compiled/<subject>-<type>.html   # rendered HTML
```

## Workflow

```bash
tut ctx set tetra install guide    # set context
tut init install guide             # create scaffold JSON
tut edit                           # open in $EDITOR
tut validate                       # check JSON structure
tut build --strict                 # validate + compile via terrain
tut serve                          # start doc server via tsm
tut version bump minor             # bump version
```

## Commands

| Command | Description |
|---------|-------------|
| `tut list` | List JSON source files in current org |
| `tut init <subject> <type>` | Create new JSON scaffold |
| `tut adopt <path.json>` | Import external JSON (must be `subject-type.json`) |
| `tut unadopt [name]` | Remove source + compiled HTML |
| `tut edit [name]` | Open JSON in `$EDITOR` |
| `tut build [target]` | Compile via `terrain doc` |
| `tut build --strict` | Validate before building |
| `tut build --bump[=level]` | Bump version before building |
| `tut validate [target]` | Validate JSON structure |
| `tut serve [start\|stop]` | Manage doc server via tsm |
| `tut version [show\|bump\|set]` | Manage document versions |
| `tut doctor` | Check setup and dependencies |

## Build Pipeline

```
tut build → terrain doc <file.json> -o <output.html>
```

terrain detects the document type (via `.metadata.type` or duck-typing), selects the matching HTML template, and embeds the full JSON for client-side rendering.

## Schemas

JSON schemas live in `$TUT_SRC/schemas/`:
- `guide.schema.json` — comprehensive guide document schema
- `reference.schema.json` — reference documentation schema
- `tetra-deploy.schema.json` — deployment document schema

These define the full content model but are not enforced at build time unless `--strict` is used (which runs structural validation, not full schema validation).
