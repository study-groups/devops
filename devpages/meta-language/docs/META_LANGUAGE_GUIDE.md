# DevPages Meta Language for Actions & Events

A comprehensive system to prevent Redux/state management issues through schema-driven development, static analysis, and code generation.

## **🎯 Problem Solved**

**Before**: Silent failures when actions are dispatched but no reducers handle them
**After**: Loud failures at development time with clear guidance

## **📁 File Structure**

```
├── client/meta/
│   └── actionSchema.yaml           # Central schema defining all actions & events
├── tools/
│   ├── action-validator.js         # Validates actions have reducers
│   ├── schema-codegen.js          # Generates types & validators
│   ├── eslint-rules/
│   │   └── require-reducer.js     # ESLint rule for dispatch calls
│   └── test-system.js             # Test the entire system
├── client/types/
│   └── generated-actions.d.ts     # Generated TypeScript types
├── client/validation/
│   └── action-validators.js       # Generated runtime validators
└── docs/
    └── generated-action-reference.md # Generated documentation
```

## **🚀 Quick Start**

### 1. Test the System
```bash
npm run test:meta-system
```

### 2. Validate Your Actions
```bash
npm run validate-actions
```

### 3. Generate Types & Docs
```bash
npm run generate-types
```

### 4. Run Complete Validation
```bash
npm run validate-schema
```

## **📝 Schema Format**

### Action Definition
```yaml
domains:
  file:
    description: "File system operations"
    state_shape:
      availableTopLevelDirs: "string[]"
      currentPathname: "string | null"
    
    actions:
      FS_SET_TOP_DIRS:
        type: "dispatch"              # many-to-one
        payload: "string[]"
        reducer_required: true        # Enforces reducer existence
        description: "Set available directories"
        events:                       # Optional: events to emit after
          - "file:dirsLoaded"
```

### Event Definition  
```yaml
    events:
      "file:dirsLoaded":
        type: "event"                 # many-to-many
        payload: "{ dirs: string[] }"
        listeners:                    # Components that should listen
          - "PathManagerComponent"
          - "FileBrowserPanel"
        description: "Directories loaded successfully"
```

### Cross-Domain Flows
```yaml
flows:
  user_login_flow:
    description: "Complete login process"
    steps:
      - action: "AUTH_LOGIN_SUCCESS"
        domain: "auth"
      - event: "auth:loginSuccess"
        triggers:
          - action: "FS_SET_TOP_DIRS" 
            domain: "file"
```

## **🛡️ Prevention Layers**

### 1. Schema Validation (Static)
- **When**: Pre-commit, CI/CD
- **Catches**: Missing reducers, undefined actions, orphaned events
- **Command**: `npm run validate-actions`

### 2. ESLint Rules (Development)
- **When**: Real-time in editor
- **Catches**: Dispatch calls without reducers
- **Integration**: Add to `.eslintrc.js`

### 3. Type Generation (IntelliSense)
- **When**: Build time
- **Provides**: TypeScript interfaces, payload types
- **Command**: `npm run generate-types`

### 4. Runtime Validation (Optional)
- **When**: Development/staging
- **Catches**: Malformed payloads, type mismatches
- **Usage**: Import generated validators

## **💡 Workflow**

### Adding a New Action
```yaml
# 1. Define in schema first
domains:
  user:
    actions:
      USER_UPDATE_PROFILE:
        type: "dispatch"
        payload: "{ name: string, email: string }"
        reducer_required: true
```

```bash
# 2. Validate (will fail initially)
npm run validate-actions
# ❌ Action 'USER_UPDATE_PROFILE' requires reducer but not found
```

```javascript
// 3. Add reducer case
case ActionTypes.USER_UPDATE_PROFILE:
  return {
    ...state,
    profile: action.payload
  };
```

```bash
# 4. Validate again
npm run validate-actions
# ✅ All validations passed!
```

### Adding an Event Flow
```yaml
# 1. Define event
events:
  "user:profileUpdated":
    type: "event"
    payload: "{ userId: string, profile: object }"
    listeners:
      - "ProfileComponent"
      - "NotificationService"
```

```javascript
// 2. Emit event in reducer
case ActionTypes.USER_UPDATE_PROFILE:
  // Update state
  const newState = { ...state, profile: action.payload };
  
  // Emit event
  eventBus.emit('user:profileUpdated', {
    userId: state.userId,
    profile: action.payload
  });
  
  return newState;
```

## **🔧 Advanced Features**

### Custom Validation Rules
```yaml
validation:
  rules:
    - name: "payload_size_limit"
      description: "Payloads should be under 1KB"
      type: "custom"
    - name: "no_nested_dispatches"
      description: "Don't dispatch actions from reducers"
      type: "static_analysis"
```

### Auto-Generated Code
- **Action Creators**: Type-safe action factories
- **Reducer Boilerplate**: Switch cases with proper typing
- **Event Emitters**: Consistent event emission patterns
- **Component Props**: State slice interfaces

### Visual Documentation
```bash
npm run generate-flow-diagram
# Generates Mermaid diagrams showing complete data flow
```

## **🚨 Common Issues & Solutions**

### "Action not found in schema"
```bash
# Add action to schema first
vim client/meta/actionSchema.yaml
npm run validate-actions
```

### "Reducer required but not found"
```bash
# Check reducer file exists and has case statement
ls client/store/reducers/
grep -r "ACTION_NAME" client/store/reducers/
```

### "Event has no listeners"
```bash
# Either add listeners or mark as internal event
grep -r "eventName" client/components/
```

## **📊 Metrics & Monitoring**

### Development Metrics
- Action coverage (actions with reducers)
- Event usage (events with active listeners)
- Type safety (generated vs manual types)

### Runtime Metrics (Optional)
- Dispatch frequency per action
- Event propagation timing
- Payload size tracking

## **🔮 Future Enhancements**

### Smart Code Generation
- Infer payload types from usage
- Generate reducer boilerplate
- Auto-complete action creators

### Visual Debugging
- Action flow visualization
- State change timeline
- Event propagation graphs

### Performance Analysis
- Action performance profiling
- Memory usage tracking
- Bundle size impact

---

## **✅ Benefits Summary**

| Aspect | Before | After |
|--------|--------|-------|
| **Debugging** | Runtime silent failures | Development-time loud failures |
| **Documentation** | Scattered, incomplete | Central, auto-generated |
| **Type Safety** | Manual, error-prone | Generated, guaranteed |
| **Consistency** | Varies by developer | Enforced by schema |
| **Onboarding** | Steep learning curve | Clear data flow documentation |
| **Refactoring** | Risky, manual verification | Safe, tool-assisted |

**🎯 The meta language transforms Redux from "easy to break accidentally" to "hard to break at all"** 