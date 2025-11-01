# 🚀 Action Registry - Get Started in 60 Seconds

## Four Ways to Learn

### 1️⃣ **Watch the Demo** (2 minutes) ⭐ EASIEST

Watch a live demonstration without any interaction:

```bash
bash $TETRA_SRC/bash/actions/demo.sh
```

This shows you everything automatically:
- How to load the system
- What actions look like with colors
- How to create your own action
- How to execute actions

**Perfect for first-time users - just sit back and watch!**

---

### 2️⃣ **Interactive Tutorial** (10-15 minutes)

Learn by doing with the step-by-step interactive tutorial:

```bash
bash $TETRA_SRC/bash/actions/TUTORIAL.sh
```

The tutorial will guide you through:
- Discovering actions
- Executing actions
- Creating your own custom module
- Understanding TES-capable actions

**Requires: `~/tetra/tetra.sh` to exist**

---

### 3️⃣ **Quick Test** (30 seconds)

Run automated tests to verify the system works:

```bash
bash $TETRA_SRC/bash/actions/test_actions.sh
```

This runs 7 automated tests and confirms everything is operational.

---

### 4️⃣ **Manual Quick Start** (2 minutes)

Try it yourself right now:

```bash
# 1. Setup
source ~/tetra/tetra.sh
source $TETRA_SRC/bash/actions/registry.sh
source $TETRA_SRC/bash/actions/executor.sh

# 2. Load a module
source $TETRA_SRC/bash/org/includes.sh

# 3. Discover actions
action_list org | head -10

# 4. Get action details
action_info org.validate.toml

# 5. Execute an action
action_register "demo" "test" "Test action" "" "no"
demo_test() { echo "✅ Action system works!"; }
action_exec demo.test
```

---

## Documentation

| File | Description | Use When |
|------|-------------|----------|
| `QUICKSTART.md` | Quick reference commands | You know what you want to do |
| `README.md` | Complete documentation | You want to understand the system |
| `TUTORIAL.sh` | Interactive hands-on learning | First time using the system |
| `GET_STARTED.md` | This file | Just getting started |

---

## Cheat Sheet

### Discovery
```bash
action_list [module]              # List actions
action_info module.action         # Show details
```

### Execution
```bash
action_exec module.action [args]           # Local action
action_exec module.action @endpoint [args] # TES action
```

### Create Your Own
```bash
# 1. Register
action_register "mymod" "dostuff" "Do stuff" "" "no"

# 2. Implement
mymod_dostuff() {
    echo "Doing stuff..."
}

# 3. Execute
action_exec mymod.dostuff
```

---

## What's Available Right Now?

Run these to see what's already registered:

```bash
action_list org    # 27 organization management actions
action_list rag    # 6 RAG/AI query actions
action_list tsm    # 9 service management actions
```

**Total: 42 actions across 3 modules!**

---

## Next Steps

After you've tried the basics:

1. **Read the full docs**: `less $TETRA_SRC/bash/actions/README.md`
2. **Explore TES endpoints**: See how `@dev`, `@staging`, `@prod` work
3. **Learn about TTS transactions**: Read `docs/TTS_TETRA_TRANSACTION_STANDARD.md`
4. **Build your own module**: Follow the custom module example in the tutorial

---

## Quick Examples

### Example 1: List and execute org actions
```bash
source ~/tetra/tetra.sh
source $TETRA_SRC/bash/org/includes.sh
action_list org
```

### Example 2: Create a simple custom action
```bash
source $TETRA_SRC/bash/actions/registry.sh
source $TETRA_SRC/bash/actions/executor.sh

action_register "hello" "world" "Say hello" "[name]" "no"
hello_world() { echo "Hello, ${1:-World}!"; }
action_exec hello.world "Tetra"
```

### Example 3: Check TES capability
```bash
if action_is_tes_capable org.compile.toml; then
    echo "This action needs an @endpoint"
fi
```

---

## Troubleshooting

**Q: "Command not found: action_list"**
A: Run `source $TETRA_SRC/bash/actions/registry.sh`

**Q: "Action not found: module.action"**
A: Load the module first: `source $TETRA_SRC/bash/MODULE/includes.sh`

**Q: "Colors not showing"**
A: Load TDS: `source $TETRA_SRC/bash/tds/tds.sh`

---

## That's It!

You're ready to go. Pick one of the three options above and start exploring!

**Recommended**: Run the interactive tutorial:
```bash
bash $TETRA_SRC/bash/actions/TUTORIAL.sh
```

Happy hacking! 🎉
