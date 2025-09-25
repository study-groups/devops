#!/usr/bin/env bash

# LEARN Module - Educational actions that explain the TView system
# Self-referential demonstrations of E × M + A = R formula

# Standard interface: return actions for given environment
get_actions() {
    local env="$1"

    case "$env" in
        "DEMO")
            echo "explain_formula:Explain E×M+A=R"
            echo "show_structure:Show Demo Structure"
            echo "demonstrate_context:Demonstrate Context"
            echo "refresh:Refresh"
            ;;
        "LOCAL")
            echo "explain_action_def:Explain ACTION_DEF"
            echo "show_separation:Show Interface/Content Split"
            echo "demonstrate_nouns:Demonstrate Noun Resolution"
            echo "refresh:Refresh"
            ;;
        "REMOTE")
            echo "explain_linear_algebra:Explain Mathematical Model"
            echo "show_group_actions:Show Group Actions"
            echo "demonstrate_composition:Demonstrate Action Composition"
            echo "refresh:Refresh"
            ;;
        *)
            echo "help:Help"
            echo "refresh:Refresh"
            ;;
    esac
}

# Standard interface: execute action for given environment
execute_action() {
    local action_id="$1"
    local env="$2"
    local runtime_context="${3:-}"

    case "$action_id" in
        "explain_formula")
            explain_formula_action "$env"
            ;;
        "show_structure")
            show_structure_action "$env"
            ;;
        "demonstrate_context")
            demonstrate_context_action "$env"
            ;;
        "explain_action_def")
            explain_action_def_action "$env"
            ;;
        "show_separation")
            show_separation_action "$env"
            ;;
        "demonstrate_nouns")
            demonstrate_nouns_action "$env"
            ;;
        "explain_linear_algebra")
            explain_linear_algebra_action "$env"
            ;;
        "show_group_actions")
            show_group_actions_action "$env"
            ;;
        "demonstrate_composition")
            demonstrate_composition_action "$env"
            ;;
        "refresh")
            refresh_learn_module "$env"
            ;;
        *)
            echo "LEARN action '$action_id' not implemented"
            ;;
    esac
}

# DEMO:LEARN Actions

explain_formula_action() {
    local env="$1"

    clear
    echo "🧮 E × M + A = R Formula Explained"
    echo "=================================="
    echo ""
    echo "You are currently experiencing this formula in action!"
    echo ""
    echo "📍 E (Environment): $env"
    echo "   The context where actions execute"
    echo ""
    echo "🔧 M (Mode): LEARN"
    echo "   The operational mode (educational in this case)"
    echo ""
    echo "⚡ A (Action): explain_formula"
    echo "   The operation you just selected"
    echo ""
    echo "📊 R (Result): This explanation you're reading!"
    echo "   The output produced by executing A in context E×M"
    echo ""
    echo "🔄 The Formula in Practice:"
    echo "   $env × LEARN + explain_formula = This Educational Content"
    echo ""
    echo "💡 Key Insight:"
    echo "   Different environments (DEMO, LOCAL, REMOTE) can provide"
    echo "   different contexts for the same action, creating different"
    echo "   results even with the same Mode and Action."
    echo ""
    echo "Try switching environments (e/E keys) to see how context changes!"
    echo ""
    # No blocking read - return to interface immediately
}

show_structure_action() {
    local env="$1"

    clear
    echo "🏗️  Demo Structure Overview"
    echo "=========================="
    echo ""
    echo "This toy model is organized to demonstrate separation of concerns:"
    echo ""
    echo "📁 demo/"
    echo "├── 📂 tui/              # Interface System (How to display)"
    echo "│   ├── colors.sh        # Color definitions and themes"
    echo "│   ├── layout.sh        # 4-line header, screen regions"
    echo "│   ├── input.sh         # Key handling, gamepad/REPL modes"
    echo "│   └── render.sh        # Drawing functions, screen updates"
    echo "├── 📂 tview/            # Content System (What to display)"
    echo "│   ├── actions.sh       # ACTION_DEF registry, E×M+A logic"
    echo "│   ├── workflows.sh     # STEP_DEF registry, state machines"
    echo "│   └── 📂 modules/      # Mode-specific implementations"
    echo "│       ├── learn/       # LEARN mode (educational)"
    echo "│       ├── build/       # BUILD mode (construction)"
    echo "│       └── test/        # TEST mode (validation)"
    echo "└── 📂 docs/             # Architecture Documentation"
    echo "    ├── formula.md       # E×M+A=R explanation"
    echo "    ├── action-def.md    # ACTION_DEF specification"
    echo "    └── ... more docs"
    echo ""
    echo "🧩 Interface vs Content:"
    echo "   TUI handles layout, colors, navigation"
    echo "   TView handles business logic, action execution"
    echo ""
    echo "🎯 Current Context: $env:LEARN"
    echo "   You're in the LEARN module, experiencing its structure demo"
    echo ""
    # No blocking read - return to interface immediately
}

demonstrate_context_action() {
    local env="$1"

    clear
    echo "🎯 Context Switching Demonstration"
    echo "================================="
    echo ""
    echo "Context = Environment × Mode"
    echo ""
    echo "📊 Available Contexts:"
    echo ""
    echo "   ENVIRONMENTS    MODES      CONTEXTS"
    echo "   ============    =====      ========"
    echo "   DEMO         ×  LEARN  →  DEMO:LEARN    (Tutorial context)"
    echo "   DEMO         ×  BUILD  →  DEMO:BUILD    (Example creation)"
    echo "   DEMO         ×  TEST   →  DEMO:TEST     (Validation demos)"
    echo "   LOCAL        ×  LEARN  →  LOCAL:LEARN   (Local education)"
    echo "   LOCAL        ×  BUILD  →  LOCAL:BUILD   (Local construction)"
    echo "   LOCAL        ×  TEST   →  LOCAL:TEST    (Local testing)"
    echo "   REMOTE       ×  LEARN  →  REMOTE:LEARN  (Remote education)"
    echo "   REMOTE       ×  BUILD  →  REMOTE:BUILD  (Remote construction)"
    echo "   REMOTE       ×  TEST   →  REMOTE:TEST   (Remote testing)"
    echo ""
    echo "🔍 Current Context: $env:LEARN"
    echo ""
    echo "Each context provides different actions:"
    echo "  - DEMO contexts: Simple, educational examples"
    echo "  - LOCAL contexts: Development-focused actions"
    echo "  - REMOTE contexts: Advanced, real-world scenarios"
    echo ""
    echo "🎮 Try This:"
    echo "  1. Press 'e' to cycle through environments"
    echo "  2. Press 'd' to cycle through modes"
    echo "  3. Press 'a' to see how actions change with context"
    echo "  4. Press 'l' on different actions to see different results"
    echo ""
    echo "This is the E×M+A=R formula in interactive action!"
    echo ""
    # No blocking read - return to interface immediately
}

# LOCAL:LEARN Actions

explain_action_def_action() {
    local env="$1"

    clear
    echo "⚙️  ACTION_DEF Structure Explained"
    echo "================================="
    echo ""
    echo "An ACTION_DEF separates 'verb' (what to do) from 'nouns' (context):"
    echo ""
    echo "🔧 Example ACTION_DEF (this very action!):"
    echo ""
    echo "declare -A EXPLAIN_ACTION_DEF_ACTION=("
    echo "  [\"verb\"]=\"explain_action_structure\""
    echo "  [\"nouns_creation\"]=\"topic=action_def,depth=detailed\""
    echo "  [\"nouns_runtime\"]=\"env=\\${CURRENT_ENV},user=\\${USER}\""
    echo "  [\"environments\"]=\"DEMO,LOCAL,REMOTE\""
    echo "  [\"display\"]=\"Explain ACTION_DEF\""
    echo "  [\"description\"]=\"Educational explanation of ACTION_DEF\""
    echo ")"
    echo ""
    echo "🎯 Linear Algebra Model: verb × nouns"
    echo ""
    echo "   Verb Matrix:    [explain_action_structure]  (1×1 operation)"
    echo "   Nouns Vector:   [topic, depth, env, user]ᵀ  (4×1 context)"
    echo "   Result:         explanation content"
    echo ""
    echo "🕐 Noun Resolution Timing:"
    echo "   Creation Time:  topic=\"action_def\", depth=\"detailed\""
    echo "   Runtime:        env=\"$env\", user=\"$(whoami)\""
    echo ""
    echo "💡 Benefits:"
    echo "   - Same verb works in different environments"
    echo "   - Context (nouns) resolved when needed"
    echo "   - Reusable, composable, testable"
    echo ""
    # No blocking read - return to interface immediately
}

show_separation_action() {
    local env="$1"

    clear
    echo "🔀 Interface/Content Separation"
    echo "=============================="
    echo ""
    echo "The TView system cleanly separates concerns:"
    echo ""
    echo "📺 TUI System (Interface):"
    echo "   ├── 🎨 How to display information"
    echo "   ├── 🎮 How to handle user input"
    echo "   ├── 🌈 Color schemes and themes"
    echo "   └── 📐 Layout and positioning"
    echo ""
    echo "🧠 TView System (Content):"
    echo "   ├── 🔍 What actions are available"
    echo "   ├── ⚡ How to execute actions"
    echo "   ├── 🔄 Business logic and workflows"
    echo "   └── 💾 State management"
    echo ""
    echo "🤝 Communication Interface:"
    echo ""
    echo "   TUI → TView:  get_actions(), execute_action()"
    echo "   TView → TUI:  render_content(), render_status()"
    echo ""
    echo "🎯 Current Demonstration:"
    echo "   - TUI: Handling your keystrokes, displaying this text"
    echo "   - TView: Generated this content, executing this action"
    echo "   - Interface: This action runs in $env environment"
    echo ""
    echo "💪 Benefits:"
    echo "   ✅ Change UI without touching business logic"
    echo "   ✅ Change business logic without touching UI"
    echo "   ✅ Test each system independently"
    echo "   ✅ Multiple interfaces (terminal, web, mobile)"
    echo ""
    # No blocking read - return to interface immediately
}

demonstrate_nouns_action() {
    local env="$1"

    clear
    echo "🏷️  Noun Resolution Demonstration"
    echo "================================"
    echo ""
    echo "Watch how nouns get resolved at different times:"
    echo ""
    echo "📅 Creation Time Nouns (static, known at definition):"
    echo "   demonstration_type = \"noun_resolution\""
    echo "   complexity_level = \"intermediate\""
    echo "   format = \"interactive\""
    echo ""
    echo "⏰ Runtime Nouns (dynamic, resolved during execution):"
    echo "   current_environment = \"$env\""
    echo "   current_user = \"$(whoami)\""
    echo "   current_time = \"$(date '+%H:%M:%S')\""
    echo "   working_directory = \"$(pwd)\""
    echo "   hostname = \"$(hostname -s)\""
    echo ""
    echo "🔄 Resolution Process:"
    echo "   1. Action selected: demonstrate_nouns"
    echo "   2. Creation nouns: Already resolved (demonstration_type, etc.)"
    echo "   3. Runtime nouns: Resolved now (environment=$env, user=$(whoami))"
    echo "   4. Combined context: creation + runtime nouns"
    echo "   5. Verb executed: demonstrate_noun_resolution(combined_context)"
    echo ""
    echo "🎯 Environment Impact:"
    echo "   Same action in different environments resolves different contexts:"
    echo "   - DEMO: Educational examples, safe operations"
    echo "   - LOCAL: Development context, local resources"
    echo "   - REMOTE: Production context, remote resources"
    echo ""
    echo "This enables one ACTION_DEF to work across all environments!"
    echo ""
    # No blocking read - return to interface immediately
}

# REMOTE:LEARN Actions

explain_linear_algebra_action() {
    local env="$1"

    clear
    echo "📐 Mathematical Foundations"
    echo "=========================="
    echo ""
    echo "TView is built on linear algebra concepts:"
    echo ""
    echo "🔢 Group Action: A acting on X"
    echo "   φ: A × X → X"
    echo "   Where A = actions, X = system states"
    echo ""
    echo "📊 Matrix Operations:"
    echo ""
    echo "   Environment Vector:    E = [DEMO, LOCAL, REMOTE]ᵀ"
    echo "   Mode Vector:           M = [LEARN, BUILD, TEST]ᵀ"
    echo "   Context Matrix:        C = E × Mᵀ (3×3 matrix)"
    echo ""
    echo "        LEARN  BUILD  TEST"
    echo "   DEMO   L₁     B₁    T₁"
    echo "   LOCAL  L₂     B₂    T₂"
    echo "   REMOTE L₃     B₃    T₃    ← You are here (L₃)"
    echo ""
    echo "⚡ Action Vector Space:"
    echo "   Actions = linear combinations of basis operations"
    echo "   Basis = {create, read, update, delete, execute}"
    echo "   Complex actions = α·create + β·update + γ·execute"
    echo ""
    echo "🔄 State Transformations:"
    echo "   Navigation: S₁ → S₂ (changing context)"
    echo "   Execution:  S → R   (applying action)"
    echo "   Composition: A₁ ∘ A₂ (chaining actions)"
    echo ""
    echo "🎯 Current State:"
    echo "   S = ($env, LEARN, explain_linear_algebra, context)"
    echo "   This action transforms your understanding state!"
    echo ""
    # No blocking read - return to interface immediately
}

show_group_actions_action() {
    local env="$1"

    clear
    echo "🎭 Group Actions in Practice"
    echo "==========================="
    echo ""
    echo "The TView action system forms a mathematical group:"
    echo ""
    echo "🔄 Group Properties:"
    echo ""
    echo "   1️⃣ Closure: Composing actions yields actions"
    echo "      navigate_to_demo ∘ explain_formula → demo_explanation"
    echo ""
    echo "   2️⃣ Associativity: (A₁∘A₂)∘A₃ = A₁∘(A₂∘A₃)"
    echo "      Order of grouping doesn't matter"
    echo ""
    echo "   3️⃣ Identity: refresh action (no-op transformation)"
    echo "      state ∘ refresh = state"
    echo ""
    echo "   4️⃣ Inverses: Some actions have rollbacks"
    echo "      deploy ∘ rollback = previous_state"
    echo ""
    echo "🔢 Cyclic Subgroups:"
    echo ""
    echo "   Environment Navigation: DEMO → LOCAL → REMOTE → DEMO"
    echo "   Mode Navigation: LEARN → BUILD → TEST → LEARN"
    echo "   (Both isomorphic to Z/3Z)"
    echo ""
    echo "🎯 Action Composition Example:"
    echo "   navigate_to_local ∘ switch_to_build ∘ create_action"
    echo "   = \"Create action in LOCAL:BUILD context\""
    echo ""
    echo "🧮 Current Group Element:"
    echo "   You're at group element ($env, LEARN) in the action space"
    echo "   This element has specific actions available to it"
    echo ""
    echo "The math ensures predictable, composable behavior!"
    echo ""
    # No blocking read - return to interface immediately
}

demonstrate_composition_action() {
    local env="$1"

    clear
    echo "🔗 Action Composition Demonstration"
    echo "=================================="
    echo ""
    echo "Actions can be composed in multiple ways:"
    echo ""
    echo "📝 Sequential Composition (A₁ ∘ A₂):"
    echo "   explain_formula → show_structure → demonstrate_context"
    echo "   Each action's output becomes next action's input"
    echo ""
    echo "⚡ Parallel Composition (A₁ ⊕ A₂):"
    echo "   test_connection ⊕ validate_config ⊕ check_permissions"
    echo "   Independent actions executed simultaneously"
    echo ""
    echo "❓ Conditional Composition (A₁ ⊗ P):"
    echo "   deploy_if_tests_pass = deploy ⊗ (tests_status == \"passed\")"
    echo "   Action executed only if predicate is true"
    echo ""
    echo "🎯 Live Composition Example:"
    echo "   This demonstration is composed of multiple sub-actions:"
    echo ""
    echo "   demonstrate_composition ="
    echo "     clear_screen ∘"
    echo "     render_title ∘"
    echo "     explain_sequential ∘"
    echo "     explain_parallel ∘"
    echo "     explain_conditional ∘"
    echo "     show_live_example ∘"
    echo "     wait_for_user_input"
    echo ""
    echo "🔄 Environment Context:"
    echo "   In $env: Composition focuses on mathematical clarity"
    echo "   In LOCAL: Composition would focus on practical examples"
    echo "   In DEMO: Composition would focus on simple tutorials"
    echo ""
    echo "This is linear algebra in action - operations composing to"
    echo "create more complex behaviors while maintaining structure!"
    echo ""
    # No blocking read - return to interface immediately
}

# Module refresh
refresh_learn_module() {
    local env="$1"

    echo "🔄 Refreshing LEARN module for $env environment..."
    echo ""
    echo "Reloading educational content..."
    echo "Updating context-sensitive examples..."
    echo "Verifying mathematical demonstrations..."
    echo ""
    echo "✅ LEARN module refreshed!"
    sleep 2
}