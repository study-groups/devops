/**
 * Login Form Component
 * Responsible for displaying login form and handling authentication
 */
import { appStore } from '/client/appState.js';
import { eventBus } from '/client/eventBus.js';

class LoginForm {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      idPrefix: options.idPrefix || 'core-',
      replaceExisting: options.replaceExisting || false,
      ...options
    };
    this.form = null;
    this.unsubscribeHandlers = [];
    
    // Check if we should create the form
    if (this.options.replaceExisting) {
      this.removeExistingForms();
    } else if (this.findExistingForm()) {
      console.log('Login form already exists, not creating a new one');
      return;
    }
    
    this.initialize();
  }
  
  findExistingForm() {
    return document.getElementById('login-form');
  }
  
  removeExistingForms() {
    const existingForm = this.findExistingForm();
    if (existingForm && existingForm.parentNode) {
      existingForm.parentNode.removeChild(existingForm);
    }
  }
  
  initialize() {
    // Create form element
    this.form = document.createElement('div');
    this.form.className = 'login-form';
    this.form.id = 'login-form';
    
    // Create unique IDs for form elements to avoid duplicates
    const usernameId = `${this.options.idPrefix}username`;
    const passwordId = `${this.options.idPrefix}password`;
    
    this.form.innerHTML = `
      <h2>Login</h2>
      <form>
        <div class="form-group">
          <label for="${usernameId}">Username</label>
          <input type="text" id="${usernameId}" name="username" required>
        </div>
        <div class="form-group">
          <label for="${passwordId}">Password</label>
          <input type="password" id="${passwordId}" name="password" required>
        </div>
        <div class="error-message" style="color: red; margin-top: 10px;"></div>
        <button type="submit" class="login-button">Login</button>
      </form>
    `;
    
    // Add form to container
    this.container.appendChild(this.form);
    
    // Add event listener for form submission
    const formElement = this.form.querySelector('form');
    formElement.addEventListener('submit', this.handleSubmit.bind(this));
    
    // Hide login form initially, let state dictate visibility
    this.form.style.display = 'none';

    let prevState = appStore.getState(); // Initialize previous state
    // Update visibility based on current auth state using appStore subscribe
    const unsubscribe = appStore.subscribe(() => {
        const newState = appStore.getState();
        const newIsAuthenticated = newState.auth.isAuthenticated;
        const oldIsAuthenticated = prevState.auth.isAuthenticated;
        
        if (newIsAuthenticated !== oldIsAuthenticated) {
            this.form.style.display = newIsAuthenticated ? 'none' : 'block';
        }
        prevState = newState; // Update previous state
    });

    // Initial visibility check
    if (!appStore.getState().auth.isAuthenticated) {
      this.updateVisibility(false);
    } else {
      this.updateVisibility(true);
    }

    // Update visibility based on current auth state using appStore subscribe
    // The subscription will call updateVisibility immediately with the current state
    const unsubscribe2 = appStore.subscribe((newState, prevState) => {
        const authState = newState.auth;
        this.updateVisibility(authState.isAuthenticated);
        this.updateErrorMessage(authState.error);
    });
    // Store the unsubscribe function to call it on destroy
    this.unsubscribeHandlers.push(unsubscribe2);
  }
  
  handleSubmit(event) {
    event.preventDefault();
    
    // Get form field values using the unique IDs
    const usernameId = `${this.options.idPrefix}username`;
    const passwordId = `${this.options.idPrefix}password`;
    
    const username = document.getElementById(usernameId).value;
    const password = document.getElementById(passwordId).value;
    
    if (!username || !password) {
      console.error('Username and password are required');
      return;
    }
    
    // Emit an event instead of calling handleLogin directly
    eventBus.emit('auth:loginRequested', { username, password });
    console.log(`[LoginForm] Emitted auth:loginRequested for user: ${username}`);
  }
  
  updateVisibility(isLoggedIn) {
    if (this.form) {
      this.form.style.display = isLoggedIn ? 'none' : 'flex';
    }
  }
  
  updateErrorMessage(errorMessage) {
    if (this.form) {
      const errorElement = this.form.querySelector('.error-message');
      if (errorElement) {
        errorElement.textContent = errorMessage || '';
      }
    }
  }
  
  destroy() {
    // Unsubscribe from authState changes
    this.unsubscribeHandlers.forEach(unsubscribe => unsubscribe());
    this.unsubscribeHandlers = []; // Clear handlers
    
    // Remove the form from DOM
    if (this.form && this.form.parentNode) {
      this.form.parentNode.removeChild(this.form);
    }
  }
}

export default LoginForm; 