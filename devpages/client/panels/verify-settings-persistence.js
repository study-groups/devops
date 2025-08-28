(function(global) {
    // Import the generic verification function
    const { verifyStatePersistence } = global.APP.verifyStatePersistence || {};

    // Verify settings slice persistence
    function verifySettingsPersistence() {
        return verifyStatePersistence({
            sliceName: 'settings',
            storageKey: 'settings',
            relevantFields: [
                'preview.cssFiles', 
                'preview.activeCssFiles', 
                'preview.enableRootCss', 
                'preview.bundleCss', 
                'preview.cssPrefix',
                'preview.renderMode',
                'preview.cssInjectionMode',
                'publish.mode',
                'publish.bundleCss',
                'currentContext',
                'selectedOrg'
            ],
            modifyState: (store) => {
                // Example modification - toggle a boolean setting
                const currentState = store.getState().settings;
                return {
                    type: 'settings/updateSetting',
                    payload: {
                        key: 'preview.enableRootCss',
                        value: !currentState.preview.enableRootCss
                    }
                };
            }
        });
    }

    // Expose to global scope
    if (global.APP) {
        global.APP.verifySettingsPersistence = verifySettingsPersistence;
    }

    // Auto-run verification
    verifySettingsPersistence();
})(typeof window !== 'undefined' ? window : global);
