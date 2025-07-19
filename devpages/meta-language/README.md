# DevPages Meta Language System

A comprehensive schema-driven system for managing Redux actions, events, and state in DevPages.

## 📁 Directory Structure

```
meta-language/
├── core/                      # Core schema and configuration
│   └── actionSchema.yaml      # Central action & event definitions
├── tools/                     # Validation and generation tools
│   ├── action-validator.js    # Validates actions have reducers
│   ├── schema-codegen.js      # Generates types, validators, docs
│   └── test-system.js         # Tests the entire system
├── eslint-rules/              # Custom ESLint rules
│   └── require-reducer.js     # Prevents dispatch without reducers
├── generated/                 # Generated meta files (copies)
│   ├── generated-actions.d.ts # TypeScript type definitions
│   ├── action-validators.js   # Runtime payload validators
│   └── generated-action-reference.md # API documentation
├── templates/                 # Code generation templates
└── docs/                      # Meta language documentation
    ├── META_LANGUAGE_GUIDE.md # Complete system guide
    └── PREVENTION_EXAMPLE.md   # How it prevents bugs
```

## 🚀 Quick Start

### Run the System Test
```bash
npm run test:meta-system
```

### Validate Actions
```bash
npm run validate-actions
```

### Generate Code & Types
```bash
npm run generate-types
```

### Full Validation
```bash
npm run validate-schema
```

## 📝 How It Works

### 1. Schema-First Development
Define all actions and events in `core/actionSchema.yaml`:

```yaml
domains:
  file:
    actions:
      FS_SET_TOP_DIRS:
        type: "dispatch"
        payload: "string[]"
        reducer_required: true
```

### 2. Automatic Generation
From the schema, the system generates:
- **TypeScript interfaces** → `client/types/generated-actions.d.ts`
- **Runtime validators** → `client/validation/action-validators.js`
- **API documentation** → `docs/generated-action-reference.md`

### 3. Static Validation
Tools check:
- ✅ Every action has a corresponding reducer
- ✅ Every event has active listeners
- ✅ Payload types match declarations
- ✅ No orphaned or undefined actions

### 4. Live Linting
ESLint rules catch problems in real-time:
- Dispatch calls without reducers
- Invalid action types
- Malformed payloads

## 🛡️ Prevention Layers

| Layer | When | Catches |
|-------|------|---------|
| **Schema Validation** | Pre-commit | Missing reducers, undefined actions |
| **ESLint Rules** | Development | Dispatch without handlers |
| **Type Generation** | Build time | Type mismatches, payload errors |
| **Runtime Validation** | Runtime | Malformed data, contract violations |

## 🔧 File Purposes

### Core Files
- **`core/actionSchema.yaml`** - Single source of truth for all actions/events
- **`tools/action-validator.js`** - Static analysis of codebase vs schema
- **`tools/schema-codegen.js`** - Code and documentation generator

### Generated Files
Generated files are created in **two locations**:
1. **`meta-language/generated/`** - Meta copies for organization
2. **`client/` directories** - Live files used by the application

### Documentation
- **`docs/META_LANGUAGE_GUIDE.md`** - Complete system documentation
- **`docs/PREVENTION_EXAMPLE.md`** - Real-world bug prevention example

## 🎯 Adding New Actions

### 1. Define in Schema
```yaml
domains:
  user:
    actions:
      USER_UPDATE_PROFILE:
        type: "dispatch"
        payload: "{ name: string, email: string }"
        reducer_required: true
```

### 2. Validate
```bash
npm run validate-actions
# ❌ Action 'USER_UPDATE_PROFILE' requires reducer but not found
```

### 3. Add Reducer
```javascript
case ActionTypes.USER_UPDATE_PROFILE:
  return { ...state, profile: action.payload };
```

### 4. Re-validate
```bash
npm run validate-actions
# ✅ All validations passed!
```

## 🔮 Future Features

### Templates System
The `templates/` directory will contain:
- Action creator templates
- Reducer boilerplate templates
- Component hook templates
- Test scaffolding templates

### Visual Documentation
- Mermaid flow diagrams
- State transition graphs
- Event propagation maps

### Advanced Validation
- Performance profiling
- Bundle size analysis
- Dead code detection

## 💡 Benefits

| Before | After |
|--------|-------|
| Silent runtime failures | Loud development-time failures |
| Manual type definitions | Auto-generated types |
| Scattered documentation | Central API reference |
| Inconsistent patterns | Enforced conventions |

## 🚨 Troubleshooting

### "Schema not found"
```bash
# Ensure schema exists
ls meta-language/core/actionSchema.yaml
```

### "Action requires reducer but not found"
```bash
# Check reducer file exists and has case
ls client/store/reducers/
grep -r "ACTION_NAME" client/store/reducers/
```

### "Generated files missing"
```bash
# Regenerate all files
npm run generate-types
```

---

**The meta language system transforms Redux from "easy to break" to "hard to break accidentally"** 🛡️✨ 