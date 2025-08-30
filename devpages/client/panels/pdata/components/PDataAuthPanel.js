import { PData } from '../../../../pdata/PData.js';
import { loadPanelConfig } from '../../../store/slices/panelSlice.js';

export function createPDataAuthPanel(config) {
    // Configuration from YAML
    const panelConfig = config.panelConfig || {};
    
    // Create panel container
    const panel = document.createElement('div');
    panel.className = 'pdata-auth-panel panel-container';
    panel.setAttribute('data-panel-id', panelConfig.id || 'pdata-auth-panel');

    // Internationalization support
    const locale = panelConfig.i18n?.defaultLocale || 'en';
    const translations = {
        en: {
            login: 'Login',
            register: 'Register',
            username: 'Username',
            password: 'Password',
            submit: 'Submit',
            error: 'Authentication Error'
        },
        // Add more translations as needed
    };

    // Render panel content
    function renderPanel() {
        panel.innerHTML = `
            <div class="panel-header">
                <h3>${panelConfig.name || 'PData Authentication'}</h3>
                <div class="panel-actions">
                    ${panelConfig.behavior?.closable ? '<button class="close-btn">×</button>' : ''}
                </div>
            </div>
            <div class="panel-content">
                <form id="auth-form">
                    <div class="form-group">
                        <label for="username">${translations[locale].username}</label>
                        <input 
                            type="text" 
                            id="username" 
                            name="username" 
                            required 
                            minlength="${panelConfig.validation?.passwordComplexity?.minLength || 3}"
                        >
                    </div>
                    <div class="form-group">
                        <label for="password">${translations[locale].password}</label>
                        <input 
                            type="password" 
                            id="password" 
                            name="password" 
                            required 
                            minlength="${panelConfig.validation?.passwordComplexity?.minLength || 8}"
                        >
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">${translations[locale].login}</button>
                        ${panelConfig.props?.allowRegistration ? 
                            `<button type="button" class="btn btn-secondary register-btn">${translations[locale].register}</button>` 
                            : ''
                        }
                    </div>
                    <div class="auth-error" style="display:none;"></div>
                </form>
            </div>
        `;

        // Authentication logic
        const form = panel.querySelector('#auth-form');
        const errorDisplay = panel.querySelector('.auth-error');
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = form.username.value;
            const password = form.password.value;

            try {
                // Initialize PData
                const pdata = new PData();
                
                // Attempt to create token
                const token = await pdata.createToken(username, password);
                
                if (token) {
                    // Store token securely
                    localStorage.setItem('authToken', token);
                    
                    // Dispatch panel mount event
                    panel.dispatchEvent(new CustomEvent('panel:authenticated', { 
                        detail: { username, token },
                        bubbles: true 
                    }));
                } else {
                    // Show error
                    errorDisplay.textContent = translations[locale].error;
                    errorDisplay.style.display = 'block';
                }
            } catch (error) {
                console.error('Authentication failed:', error);
                errorDisplay.textContent = translations[locale].error;
                errorDisplay.style.display = 'block';
            }
        });

        // Optional registration button
        if (panelConfig.props?.allowRegistration) {
            const registerBtn = panel.querySelector('.register-btn');
            registerBtn.addEventListener('click', () => {
                // Implement registration view or modal
                console.log('Registration clicked');
            });
        }

        // Close button functionality
        if (panelConfig.behavior?.closable) {
            const closeBtn = panel.querySelector('.close-btn');
            closeBtn.addEventListener('click', () => {
                panel.dispatchEvent(new CustomEvent('panel:close', { 
                    detail: { panelId: panelConfig.id },
                    bubbles: true 
                }));
            });
        }
    }

    // Initial render
    renderPanel();

    // Theme application
    if (panelConfig.theme) {
        panel.style.setProperty('--primary-color', panelConfig.theme.colorScheme.primary);
        panel.style.setProperty('--secondary-color', panelConfig.theme.colorScheme.secondary);
    }

    return panel;
}
