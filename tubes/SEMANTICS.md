# Tubes Semantics: Task vs Flow

## Task (preferred)
- Unit of work with a concrete objective and scope.
- Durable identity (branch: `tubes/task/<slug>`).
- Owns configuration and artifacts under `$TUBES_DIR/<task-type>/<task>/`.
- Commands are expressed **for a task** (`/run compile`, `llm-apply`, `llm-commit`).

## Flow
- Execution graph describing how steps run (e.g., for Go: `llm-ask`, `llm-apply`, `compile`, `test`, `llm-commit`, `llm-reset`).
- Attached to a **task**; a task may host one or more flows.
- Non-durable identity; flows evolve within the task lifecycle.

## Policy
- Prefer **task** first: name work, branch on task, commit to task.
- Bind flows to the active task; flows annotate commits as `flow:<name>` when needed.
