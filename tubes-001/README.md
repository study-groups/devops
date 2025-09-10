# Tubes TUI

Layout: `header` | `col1|col2` | `cli` | `status` | `footer`

## Commands
- `/mode self`  — project tree (left), source view (right)
- `/mode tasks` — `$TUBES_DIR/<tube-task-types>` (left), module view (right)
- `/open <path>` — open file in right column (relative to mode root)
- `/resize col +10` — increase left column width by 10%
- `/resize band status +1` — increase status height by 1 row
- `/run compile|test|llm-ask|llm-apply|llm-commit|llm-reset`
- `/help`

Environment: set `TUBES_DIR` to the tasks root when using `tasks` mode.

Build:
