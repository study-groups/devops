/**
 * SplashScreen.js
 *
 * A splash screen component displayed when the user is not authenticated.
 * It provides a login form and a clear visual state for logged-out users.
 */
import { authThunks } from '../slices/authSlice.js';

export class SplashScreen {
    constructor(dispatch) {
        this.dispatch = dispatch;
        this.element = null;
        this.init();
    }

    init() {
        this.createSplashScreen();
        this.setupEventListeners();
    }

    createSplashScreen() {
        this.element = document.createElement('div');
        this.element.id = 'splash-screen';
        this.element.innerHTML = `
            <div class="splash-container">
                <div class="splash-header">
                    <h1 class="splash-title">Welcome</h1>
                    <p class="splash-subtitle">Please log in to continue</p>
                </div>
                <div class="splash-login-form">
                    <div class="form-group">
                        <label for="splash-username">Username</label>
                        <input type="text" id="splash-username" placeholder="Enter your username">
                    </div>
                    <div class="form-group">
                        <label for="splash-password">Password</label>
                        <input type="password" id="splash-password" placeholder="Enter your password">
                    </div>
                    <button id="splash-login-btn" class="btn btn-primary">Log In</button>
                    <p id="splash-error" class="splash-error-message"></p>
                </div>
            </div>
        `;
        this.mount();
        this.applyStyles();
    }

    mount() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                document.body.appendChild(this.element);
            });
        } else {
            document.body.appendChild(this.element);
        }
    }

    setupEventListeners() {
        const loginButton = this.element.querySelector('#splash-login-btn');
        const usernameInput = this.element.querySelector('#splash-username');
        const passwordInput = this.element.querySelector('#splash-password');
        const errorP = this.element.querySelector('#splash-error');

        loginButton.addEventListener('click', async () => {
            const username = usernameInput.value;
            const password = passwordInput.value;
            errorP.textContent = "";

            if (!username || !password) {
                errorP.textContent = 'Please enter both username and password.';
                return;
            }

            try {
                await this.dispatch(authThunks.loginWithCredentials({ username, password }));
            } catch (error) {
                errorP.textContent = error.message || 'Login failed. Please check your credentials.';
            }
        });
    }

    destroy() {
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
    }

    applyStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #splash-screen {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: #f8f9fa;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                font-family: system-ui, -apple-system, sans-serif;
            }
            .splash-container {
                background-color: white;
                padding: 40px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                text-align: center;
                width: 100%;
                max-width: 400px;
            }
            .splash-title {
                font-size: 28px;
                font-weight: 600;
                color: #333;
                margin-bottom: 8px;
            }
            .splash-subtitle {
                font-size: 16px;
                color: #666;
                margin-bottom: 24px;
            }
            .splash-login-form .form-group {
                margin-bottom: 16px;
                text-align: left;
            }
            .splash-login-form label {
                display: block;
                margin-bottom: 4px;
                font-weight: 500;
                color: #555;
            }
            .splash-login-form input {
                width: 100%;
                padding: 10px;
                border: 1px solid #ccc;
                border-radius: 4px;
                box-sizing: border-box; /* Important */
            }
            .splash-login-form .btn {
                width: 100%;
                padding: 12px;
                font-size: 16px;
                margin-top: 8px;
            }
            .splash-error-message {
                color: var(--color-danger, #dc3545);
                margin-top: 16px;
                min-height: 1.2em;
            }
        `;
        document.head.appendChild(style);
    }
} 