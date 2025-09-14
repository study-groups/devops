package modules

import (
	"encoding/json"
	"time"
)

// ModuleStatus represents the current state of a module
type ModuleStatus int

const (
	StatusStopped ModuleStatus = iota
	StatusStarting
	StatusRunning
	StatusStopping
	StatusError
)

func (s ModuleStatus) String() string {
	switch s {
	case StatusStopped:
		return "stopped"
	case StatusStarting:
		return "starting"
	case StatusRunning:
		return "running"
	case StatusStopping:
		return "stopping"
	case StatusError:
		return "error"
	default:
		return "unknown"
	}
}

// ModuleInfo contains metadata about a module
type ModuleInfo struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Version     string                 `json:"version"`
	Status      ModuleStatus           `json:"status"`
	Config      map[string]interface{} `json:"config"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
	LastError   string                 `json:"last_error,omitempty"`
}

// Module defines the standard interface for all Tubes modules
type Module interface {
	// Core lifecycle methods
	Init(config map[string]interface{}) error
	Start() error
	Stop() error
	Delete() error
	
	// Status and information
	Status() ModuleStatus
	Info() ModuleInfo
	
	// Configuration management
	GetConfig() map[string]interface{}
	UpdateConfig(config map[string]interface{}) error
	
	// Health check
	Health() error
}

// BaseModule provides default implementations for common module functionality
type BaseModule struct {
	info   ModuleInfo
	status ModuleStatus
	config map[string]interface{}
}

// NewBaseModule creates a new base module
func NewBaseModule(id, name, description, version string) *BaseModule {
	return &BaseModule{
		info: ModuleInfo{
			ID:          id,
			Name:        name,
			Description: description,
			Version:     version,
			Status:      StatusStopped,
			Config:      make(map[string]interface{}),
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		},
		status: StatusStopped,
		config: make(map[string]interface{}),
	}
}

// Init initializes the base module with configuration
func (bm *BaseModule) Init(config map[string]interface{}) error {
	bm.config = config
	bm.info.Config = config
	bm.info.UpdatedAt = time.Now()
	return nil
}

// Status returns the current status
func (bm *BaseModule) Status() ModuleStatus {
	return bm.status
}

// Info returns module information
func (bm *BaseModule) Info() ModuleInfo {
	bm.info.Status = bm.status
	return bm.info
}

// GetConfig returns the current configuration
func (bm *BaseModule) GetConfig() map[string]interface{} {
	return bm.config
}

// UpdateConfig updates the module configuration
func (bm *BaseModule) UpdateConfig(config map[string]interface{}) error {
	bm.config = config
	bm.info.Config = config
	bm.info.UpdatedAt = time.Now()
	return nil
}

// SetStatus updates the module status
func (bm *BaseModule) SetStatus(status ModuleStatus) {
	bm.status = status
	bm.info.Status = status
	bm.info.UpdatedAt = time.Now()
}

// SetError sets an error status and message
func (bm *BaseModule) SetError(err error) {
	bm.status = StatusError
	bm.info.Status = StatusError
	bm.info.LastError = err.Error()
	bm.info.UpdatedAt = time.Now()
}

// ClearError clears the error status
func (bm *BaseModule) ClearError() {
	bm.info.LastError = ""
	bm.info.UpdatedAt = time.Now()
}

// ModuleManager manages all active modules
type ModuleManager struct {
	modules map[string]Module
}

// NewModuleManager creates a new module manager
func NewModuleManager() *ModuleManager {
	return &ModuleManager{
		modules: make(map[string]Module),
	}
}

// Register registers a module with the manager
func (mm *ModuleManager) Register(module Module) {
	info := module.Info()
	mm.modules[info.ID] = module
}

// Unregister removes a module from the manager
func (mm *ModuleManager) Unregister(id string) {
	delete(mm.modules, id)
}

// Get returns a module by ID
func (mm *ModuleManager) Get(id string) (Module, bool) {
	module, exists := mm.modules[id]
	return module, exists
}

// List returns all registered modules
func (mm *ModuleManager) List() []ModuleInfo {
	var infos []ModuleInfo
	for _, module := range mm.modules {
		infos = append(infos, module.Info())
	}
	return infos
}

// StartAll starts all registered modules
func (mm *ModuleManager) StartAll() error {
	for _, module := range mm.modules {
		if err := module.Start(); err != nil {
			return err
		}
	}
	return nil
}

// StopAll stops all registered modules
func (mm *ModuleManager) StopAll() error {
	for _, module := range mm.modules {
		if err := module.Stop(); err != nil {
			return err
		}
	}
	return nil
}

// GetStatus returns status of all modules
func (mm *ModuleManager) GetStatus() map[string]ModuleStatus {
	status := make(map[string]ModuleStatus)
	for id, module := range mm.modules {
		status[id] = module.Status()
	}
	return status
}

// ToJSON converts module info to JSON
func (info ModuleInfo) ToJSON() (string, error) {
	data, err := json.MarshalIndent(info, "", "  ")
	if err != nil {
		return "", err
	}
	return string(data), nil
}