/**
 * Login Form Component
 * Responsible for displaying login form and handling authentication
 */
import * as authModule from '/client/core/auth.js';

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
        <button type="submit" class="login-button">Login</button>
      </form>
    `;
    
    // Add form to container
    this.container.appendChild(this.form);
    
    // Add event listener for form submission
    const formElement = this.form.querySelector('form');
    formElement.addEventListener('submit', this.handleSubmit.bind(this));
    
    // Update visibility based on current auth state
    const { isLoggedIn } = authModule.getLoginStatus();
    this.updateVisibility(isLoggedIn);
    
    // Subscribe to auth events
    this.subscribeToAuthEvents();
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
    
    // Attempt login
    authModule.login(username, password)
      .then(user => {
        console.log(`Login successful for user: ${user.username}`);
      })
      .catch(error => {
        console.error('Login failed:', error);
      });
  }
  
  updateVisibility(isLoggedIn) {
    if (this.form) {
      this.form.style.display = isLoggedIn ? 'none' : 'flex';
    }
  }
  
  subscribeToAuthEvents() {
    // Handle login events
    const loginUnsubscribe = authModule.onLogin(() => {
      this.updateVisibility(true);
    });
    
    // Handle logout events
    const logoutUnsubscribe = authModule.onLogout(() => {
      this.updateVisibility(false);
    });
    
    this.unsubscribeHandlers.push(loginUnsubscribe, logoutUnsubscribe);
  }
  
  destroy() {
    // Unsubscribe from all events
    this.unsubscribeHandlers.forEach(unsubscribe => unsubscribe());
    
    // Remove the form from DOM
    if (this.form && this.form.parentNode) {
      this.form.parentNode.removeChild(this.form);
    }
  }
}

export default LoginForm; 