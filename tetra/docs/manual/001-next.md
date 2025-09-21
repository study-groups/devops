# Next Steps - Systemd Integration and Testing

## Immediate Testing Required

The new systemd daemon integration and TSM service management system needs comprehensive testing on Linux environments to ensure all components work together correctly.

## High Priority: Linux Environment Testing

### 1. **Systemd Integration Tests**
Test the complete systemd service workflow on Linux:

```bash
tests/test_systemd_integration.sh
```

**Test Coverage Needed:**
- tetra-daemon executable startup and environment loading
- Service discovery from services/enabled/ directory
- Automatic service startup via TSM integration
- Daemon monitoring loop and health checks
- Graceful shutdown and service cleanup
- systemd user service security restrictions

### 2. **TSM Service Management Tests**
Test the nginx-style service enable/disable system:

```bash
tests/test_tsm_service_management.sh
```

**Test Coverage Needed:**
- Service definition creation with tsm save
- Enable/disable functionality with symlinks
- Service persistence across daemon restarts
- Service configuration validation
- Error handling for missing services

### 3. **Environment Management Tests**
Create test suite for the new `tetra env` command system:

```bash
tests/test_tetra_env_management.sh
```

**Test Coverage Needed:**
- Environment promotion workflow (dev → staging → prod)
- Automatic adaptations (domains, paths, NODE_ENV, security)
- Validation and diff functionality
- Error handling for missing files and invalid environments
- Backup creation during promotion

### 4. **TKM Deploy Integration Tests**
Create test suite for the enhanced TKM local command center:

```bash
tests/test_tkm_deploy_integration.sh
```

**Test Coverage Needed:**
- Environment file deployment to mock servers
- Service restart coordination
- Status tracking and synchronization checks
- SSH key integration with deployment
- Error handling for connectivity issues

### 5. **TSM Environment Detection Tests**
Create test suite for updated TSM environment handling:

```bash
tests/test_tsm_environment_detection.sh
```

**Test Coverage Needed:**
- Auto-detection of dev.env (new default)
- Environment override functionality
- Service registry integration
- Entrypoint script handling with environments
- Backward compatibility verification

### 6. **End-to-End Workflow Tests**
Create comprehensive integration test:

```bash
tests/test_complete_deployment_workflow.sh
```

**Test Coverage Needed:**
- Complete workflow: create dev.env → promote → deploy → verify
- Service template deployment
- Nginx configuration generation
- Multi-environment coordination
- Rollback scenarios

### 7. **Template Validation Tests**
Create test suite for service templates:

```bash
tests/test_service_templates.sh
```

**Test Coverage Needed:**
- SystemD service file validation
- Nginx configuration syntax checking
- Environment-specific template generation
- Security setting verification
- Template variable substitution

## Testing Strategy

### Mock Environment Setup
Create isolated test environments that simulate:
- Local development machine
- Dev server (SSH accessible)
- Staging server (shared with prod)
- Production server (maximum security)

### Test Data
Generate sample environment files and configurations:
- Realistic dev.env with common variables
- Staging/prod variants with security adaptations
- Service configurations for each environment
- SSH key pairs for testing deployment

### Validation Criteria
- **Environment promotion** preserves data integrity
- **Automatic adaptations** apply correctly
- **Security hardening** progresses appropriately
- **Service deployments** work across environments
- **Error handling** provides clear feedback
- **Status tracking** reports accurate synchronization

## Implementation Priority

1. **Systemd integration tests** (highest priority - requires Linux environment)
2. **TSM service management tests** (core daemon functionality)
3. **Environment management tests** (tetra.toml system)
4. **TKM deploy tests** (deployment verification)
5. **TSM environment detection** (backward compatibility)
6. **Template validation** (configuration integrity)
7. **End-to-end workflow** (complete system verification)

## Success Metrics

- **Systemd daemon** starts automatically and loads enabled services
- **Service persistence** survives reboots via systemd integration
- **TSM service management** enables/disables services correctly
- All environment promotions work without data loss
- Automatic adaptations apply correctly in all scenarios
- Local command center successfully deploys to all environments
- Service templates generate valid configurations
- Complete workflow executes without manual intervention
- Error conditions are handled gracefully with clear messaging

## Post-Testing Actions

Once testing is complete:
1. **Update documentation** with any discovered edge cases
2. **Create troubleshooting guides** based on test failures
3. **Implement additional safety checks** identified during testing
4. **Document production deployment procedures**
5. **Create operator runbooks** for common scenarios

The testing phase will validate that the Tetra Way implementation is production-ready and provide confidence for real-world deployment scenarios.