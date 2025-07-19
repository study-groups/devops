/**
 * Application Lifecycle Events
 * 
 * Defines all lifecycle events that components can subscribe to for coordinated initialization
 */

export const LifecycleEvents = {
  // Bootstrap phases
  BOOTSTRAP_START: 'lifecycle:bootstrap:start',
  BOOTSTRAP_CORE_SERVICES_READY: 'lifecycle:bootstrap:core-services-ready',
  BOOTSTRAP_DOM_VERIFIED: 'lifecycle:bootstrap:dom-verified', 
  BOOTSTRAP_AUTH_READY: 'lifecycle:bootstrap:auth-ready',
  BOOTSTRAP_UI_INFRASTRUCTURE_READY: 'lifecycle:bootstrap:ui-infrastructure-ready',
  BOOTSTRAP_FEATURES_READY: 'lifecycle:bootstrap:features-ready',
  BOOTSTRAP_COMPLETE: 'lifecycle:bootstrap:complete',
  
  // Application states
  APP_READY: 'lifecycle:app:ready',
  APP_INITIALIZED: 'lifecycle:app:initialized',
  APP_SHUTDOWN: 'lifecycle:app:shutdown',
  
  // Authentication lifecycle
  AUTH_CHECKING: 'lifecycle:auth:checking',
  AUTH_AUTHENTICATED: 'lifecycle:auth:authenticated',
  AUTH_UNAUTHENTICATED: 'lifecycle:auth:unauthenticated',
  AUTH_ERROR: 'lifecycle:auth:error',
  
  // UI lifecycle
  UI_SAFE_TO_MOUNT: 'lifecycle:ui:safe-to-mount',
  UI_SAFE_TO_API_CALL: 'lifecycle:ui:safe-to-api-call',
  UI_COMPONENTS_READY: 'lifecycle:ui:components-ready',
  
  // Component lifecycle
  COMPONENT_MOUNT_START: 'lifecycle:component:mount-start',
  COMPONENT_MOUNT_COMPLETE: 'lifecycle:component:mount-complete',
  COMPONENT_DESTROY_START: 'lifecycle:component:destroy-start',
  COMPONENT_DESTROY_COMPLETE: 'lifecycle:component:destroy-complete'
};

/**
 * Lifecycle phases in order
 */
export const LifecyclePhases = [
  'bootstrap-start',
  'core-services-ready', 
  'dom-verified',
  'auth-ready',
  'ui-infrastructure-ready',
  'features-ready',
  'bootstrap-complete',
  'app-ready'
];

/**
 * Event metadata for debugging and logging
 */
export const EventMetadata = {
  [LifecycleEvents.BOOTSTRAP_START]: {
    description: 'Application bootstrap process has started',
    dependencies: [],
    safe_for_api_calls: false
  },
  [LifecycleEvents.BOOTSTRAP_CORE_SERVICES_READY]: {
    description: 'Core services (store, logging, etc.) are initialized',
    dependencies: [LifecycleEvents.BOOTSTRAP_START],
    safe_for_api_calls: false
  },
  [LifecycleEvents.BOOTSTRAP_AUTH_READY]: {
    description: 'Authentication system is initialized and status checked',
    dependencies: [LifecycleEvents.BOOTSTRAP_CORE_SERVICES_READY],
    safe_for_api_calls: true
  },
  [LifecycleEvents.UI_SAFE_TO_API_CALL]: {
    description: 'Safe to make authenticated API calls',
    dependencies: [LifecycleEvents.BOOTSTRAP_AUTH_READY],
    safe_for_api_calls: true
  },
  [LifecycleEvents.APP_READY]: {
    description: 'Application is fully initialized and ready for user interaction',
    dependencies: [LifecycleEvents.BOOTSTRAP_COMPLETE],
    safe_for_api_calls: true
  }
}; 