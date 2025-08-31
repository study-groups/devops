import express from 'express';
import path from 'path';
import fs from 'fs/promises';

const router = express.Router();

// Simple bundle definitions
const CSS_BUNDLES = {
    core: [
        'client/styles/reset.css',
        'client/styles/preview/core.css', // Added for unified loading
        'client/styles/design-system.css',    // LEGACY: Load first so ui-system can override
        'client/styles/typography.css',
        'client/styles/components-base.css',
        'client/styles/utilities.css',
        'client/styles/icons.css',
        'client/styles/ui-system.css'         // NEW: Load last to ensure proper override
    ],
    layout: [
        'client/layout/workspace-layout.css',
        'client/styles/top-bar-minimal.css',
        'client/components/auth-display.css',
        'client/styles/resizable.css'
    ],
    features: [
        'client/log/log-layout.css',
        'client/log/log-header.css',
        'client/log/log-entries.css',
        'client/log/log-controls.css',
        'client/log/log-filters.css',
        'client/log/log-tokens.css',
        'client/log/log-menu.css',
        'client/log/log-utilities.css',
        'client/file-browser/file-browser.css',
        'client/dom-inspector/domInspector-core.css',
        'client/components/context-manager.css',
        'client/styles/splash-screen.css',
        'client/styles/viewControls.css'
    ],
    panels: [
        'client/settings/core/settings.css',
        'client/settings/panels/css-design/DesignTokensPanel.css',
        'client/settings/panels/context/ContextManagerPanel.css',
        'client/settings/panels/preview/PreviewSettingsPanel.css',
        'client/settings/panels/themes/ThemeSelectorPanel.css',
        'client/settings/panels/icons/IconsPanel.css',
        'client/panels/styles/BasePanel.css',
        'client/panels/styles/EditorPanel.css',
        'client/panels/styles/PreviewPanel.css',
        'client/panels/styles/JavaScriptPanel.css',
        'client/panels/styles/HtmlPanel.css',
        'client/sidebar/panels/PublishedSummaryPanel.css',
        'client/styles/panels/scrollbars.css',
        'client/styles/subpanel.css',
        'client/styles/components/panel-manager-header.css',
        'client/styles/panel-system.css'
    ]
};

async function bundleFiles(files) {
    const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
    const content = [];
    
    for (const file of files) {
        try {
            const filePath = path.join(projectRoot, file);
            const fileContent = await fs.readFile(filePath, 'utf8');
            content.push(`/* ${file} */\n${fileContent}\n`);
        } catch (error) {
            console.warn(`CSS bundle: Could not read ${file}:`, error.message);
        }
    }
    
    return content.join('\n');
}

// Bundle routes
router.get('/bundles/core.bundle.css', async (req, res) => {
    try {
        const content = await bundleFiles(CSS_BUNDLES.core);
        res.set('Content-Type', 'text/css');
        res.send(content);
    } catch (error) {
        res.status(500).send('/* Bundle error */');
    }
});

router.get('/bundles/layout.bundle.css', async (req, res) => {
    try {
        const content = await bundleFiles(CSS_BUNDLES.layout);
        res.set('Content-Type', 'text/css');
        res.send(content);
    } catch (error) {
        res.status(500).send('/* Bundle error */');
    }
});

router.get('/bundles/features.bundle.css', async (req, res) => {
    try {
        const content = await bundleFiles(CSS_BUNDLES.features);
        res.set('Content-Type', 'text/css');
        res.send(content);
    } catch (error) {
        res.status(500).send('/* Bundle error */');
    }
});

router.get('/bundles/panels.bundle.css', async (req, res) => {
    try {
        const content = await bundleFiles(CSS_BUNDLES.panels);
        res.set('Content-Type', 'text/css');
        res.send(content);
    } catch (error) {
        res.status(500).send('/* Bundle error */');
    }
});

export default router;