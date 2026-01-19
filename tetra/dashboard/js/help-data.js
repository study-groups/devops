/**
 * Help content database for Admin panel
 * Structure: { category: { title, sections: [{ title, content, concepts? }] } }
 */

window.HELP_DATA = {
    overview: {
        title: 'Overview',
        sections: [
            {
                title: 'Tetra Console',
                content: 'The Tetra Console is a multi-panel dashboard for managing tetra instances. It uses iframes to isolate each panel, with a shared message bus for communication.',
                keywords: ['console', 'dashboard', 'panel', 'iframe']
            },
            {
                title: 'Admin Panel Purpose',
                content: 'This admin panel is for administering both local and remote tetra instances.',
                list: [
                    '<strong>Local:</strong> Manage captures, view timings, check API health on your dev machine',
                    '<strong>Remote:</strong> When env is set to prod/staging, commands are executed via SSH to the remote host defined in <code>tetra.toml</code>'
                ],
                keywords: ['admin', 'local', 'remote', 'ssh']
            }
        ]
    },

    health: {
        title: 'Health',
        sections: [
            {
                title: 'Health Check Explained',
                content: 'The health check calls <code>/api/tsm/ls</code> to verify the API and TSM service manager are working.',
                concepts: [
                    { title: 'OK (green)', desc: 'API responded successfully and TSM reports running services.' },
                    { title: 'WARN (yellow)', desc: 'API is reachable but TSM reports 0 services. Normal if no services configured or all stopped.' },
                    { title: 'ERR (red)', desc: 'API unreachable or TSM returned an error. For remote envs, usually means SSH connection failed or timed out.' }
                ],
                keywords: ['health', 'status', 'ok', 'warn', 'error', 'tsm']
            },
            {
                title: 'Latency Indicators',
                content: 'Latency shows round-trip time for the health check API call.',
                concepts: [
                    { title: 'Green (<500ms)', desc: 'Fast response, typical for local or well-connected remote.' },
                    { title: 'Yellow (500-2000ms)', desc: 'Slow response, may indicate network latency or server load.' },
                    { title: 'Red (>2000ms)', desc: 'Very slow, often due to SSH connection overhead or timeouts.' }
                ],
                keywords: ['latency', 'slow', 'fast', 'timeout', 'performance']
            }
        ]
    },

    api: {
        title: 'API',
        sections: [
            {
                title: 'API Architecture',
                content: 'The dashboard Node.js server provides REST APIs that wrap TSM bash commands. See the <strong>API tab</strong> for the full endpoint reference.',
                keywords: ['api', 'rest', 'node', 'server', 'endpoint']
            },
            {
                title: 'Local Execution',
                content: 'When <code>env=local</code>, the server runs commands directly:',
                code: 'source ~/tetra/tetra.sh && tsm ls --json',
                keywords: ['local', 'bash', 'shell']
            },
            {
                title: 'Remote Execution',
                content: 'When <code>env=prod|staging|dev</code>, the server looks up SSH config from <code>tetra.toml</code> and runs:',
                code: 'ssh user@host \'source ~/tetra/tetra.sh && tsm ls --json\'',
                list: [
                    'SSH config from <code>$TETRA_DIR/orgs/{org}/tetra.toml</code>',
                    '30 second SSH timeout',
                    'Host defined in <code>[env.prod]</code>, <code>[env.staging]</code>, etc.'
                ],
                keywords: ['remote', 'ssh', 'prod', 'staging', 'dev', 'toml']
            },
            {
                title: 'API Caching',
                content: 'TSM API caches <code>/ls</code> and <code>/info</code> responses for 5 seconds to reduce SSH overhead.',
                concepts: [
                    { title: 'Cached: Yes', desc: 'Response came from cache, no SSH call made.' },
                    { title: 'Cached: No', desc: 'Fresh data fetched from TSM.' }
                ],
                keywords: ['cache', 'ttl', 'performance']
            }
        ]
    },

    context: {
        title: 'Context',
        sections: [
            {
                title: 'Org / Env / User',
                content: 'Each panel has its own context that determines which tetra instance to connect to.',
                list: [
                    '<strong>org:</strong> Organization/project namespace (e.g., <code>tetra</code>, <code>myproject</code>)',
                    '<strong>env:</strong> Environment target (<code>local</code>, <code>prod</code>, <code>staging</code>)',
                    '<strong>user:</strong> SSH user override for remote connections'
                ],
                keywords: ['org', 'env', 'user', 'context', 'organization', 'environment']
            },
            {
                title: 'tetra.toml Configuration',
                content: 'Remote hosts are defined in the org\'s tetra.toml file:',
                code: '[env.prod]\nhost = "1.2.3.4"\nuser = "root"\n\n[env.staging]\nhost = "5.6.7.8"\nuser = "deploy"',
                keywords: ['toml', 'config', 'host', 'configuration']
            }
        ]
    },

    terrain: {
        title: 'Terrain',
        sections: [
            {
                title: 'Terrain Framework',
                content: 'Panels communicate via the Terrain library loaded from <code>terrain-iframe.js</code>.',
                keywords: ['terrain', 'framework', 'library']
            },
            {
                title: 'Terrain.Mode',
                content: 'Extensible display mode system. Define custom modes with CSS variables, auto-detect context, react to changes.',
                concepts: [
                    { title: 'define(name, vars)', desc: 'Register a mode with CSS variables. Keys become --terrain-{key}.' },
                    { title: 'set(mode)', desc: 'Switch to a mode. Applies CSS vars and triggers onChange callbacks.' },
                    { title: 'autoDetect(opts)', desc: 'Configure which modes to use for iframe vs standalone contexts.' }
                ],
                code: '// Define custom modes (before Terrain.Iframe.init)\nTerrain.Mode\n  .define(\'compact\', {\n    padding: \'4px\',\n    fontSize: \'10px\',\n    gap: \'2px\'\n  })\n  .define(\'presentation\', {\n    padding: \'3rem\',\n    fontSize: \'18px\',\n    maxWidth: \'1200px\',\n    headerHeight: \'60px\'\n  });\n\n// Configure auto-detection\nTerrain.Mode.autoDetect({\n  iframe: \'compact\',\n  standalone: \'presentation\'\n});\n\n// Manual mode switching\nTerrain.Mode.set(\'presentation\');\n\n// React to changes\nTerrain.Mode.onChange((mode, prev) => {\n  console.log(`${prev} -> ${mode}`);\n});\n\n// CSS usage\nbody[data-terrain-mode="compact"] { ... }\n.header { height: var(--terrain-header-height); }\n.content { padding: var(--terrain-padding); }',
                keywords: ['mode', 'display', 'responsive', 'panel', 'full-panel', 'single-page', 'takeover', 'define', 'custom']
            },
            {
                title: 'Terrain.Bus',
                content: 'Pub/sub message bus connecting all panels.',
                code: '// Subscribe to all messages\nTerrain.Bus.subscribe(\'*\', (msg) => {\n  console.log(msg.type, msg);\n});\n\n// Publish a message\nTerrain.Bus.publish({ type: \'my-event\', data: 123 });',
                keywords: ['bus', 'pubsub', 'subscribe', 'publish', 'message']
            },
            {
                title: 'Terrain.State',
                content: 'Shared state for org/env/user context. Auto-syncs across panels.',
                code: '// Get current context\nconst { org, env, user } = Terrain.State;\n\n// Build API URL with context\nconst url = Terrain.State.apiUrl(\'/api/tsm/ls\');\n// => "/api/tsm/ls?org=tetra&env=prod&user=root"\n\n// React to context changes\nTerrain.State.onEnvChange((changes) => {\n  if (changes.envChanged) reload();\n});',
                keywords: ['state', 'context', 'sync', 'apiurl']
            },
            {
                title: 'Terrain.Iframe',
                content: 'Iframe initialization and communication helpers.',
                code: '// Initialize panel\nTerrain.Iframe.init({\n  name: \'my-panel\',\n  onReady: () => loadData()\n});\n\n// Send message to parent\nTerrain.Iframe.send({ type: \'request-data\' });\n\n// DOM event delegation\nTerrain.Iframe.on(\'refresh\', (el) => {\n  // handles <button data-action="refresh">\n});',
                keywords: ['iframe', 'init', 'send', 'action', 'delegation']
            }
        ]
    },

    reference: {
        title: 'Reference',
        sections: [
            {
                title: 'Log Status Icons',
                content: 'The activity log uses icons to indicate message status:',
                list: [
                    '<strong>✓</strong> Success - operation completed successfully',
                    '<strong>✗</strong> Error - operation failed, check message for details',
                    '<strong>⚠</strong> Warning - partial success or attention needed',
                    '<strong>·</strong> Info - status update or debug information'
                ],
                keywords: ['log', 'icon', 'status', 'success', 'error', 'warning']
            },
            {
                title: 'Capture Grooming',
                content: 'Captures are screenshots and DOM snapshots stored in <code>$TETRA_DIR/orgs/{org}/captures/</code>.',
                list: [
                    'Set retention period in days',
                    'Click "Preview" to see how many would be deleted',
                    'Click "Delete" to remove old captures'
                ],
                keywords: ['capture', 'groom', 'cleanup', 'delete', 'screenshot']
            },
            {
                title: 'Panel Timings',
                content: 'Shows iframe load times for each panel. Helps identify slow-loading panels.',
                concepts: [
                    { title: 'FAST (green)', desc: 'Loaded in under 500ms' },
                    { title: 'OK (yellow)', desc: 'Loaded in 500-2000ms' },
                    { title: 'SLOW (red)', desc: 'Took over 2000ms to load' }
                ],
                keywords: ['timing', 'performance', 'load', 'slow']
            },
            {
                title: 'Keyboard Shortcuts',
                content: 'Panel header controls:',
                list: [
                    '<strong>↻</strong> Reload - refresh the panel iframe',
                    '<strong>⛶</strong> Expand - takeover full console area'
                ],
                keywords: ['keyboard', 'shortcut', 'reload', 'expand', 'takeover']
            }
        ]
    }
};

/**
 * Render a help section to HTML
 */
window.renderHelpSection = function(section) {
    let html = `<div class="help-section" data-keywords="${(section.keywords || []).join(' ')}">`;
    html += `<h3>${section.title}</h3>`;

    if (section.content) {
        html += `<p>${section.content}</p>`;
    }

    if (section.code) {
        html += `<pre class="help-code">${escapeHtml(section.code)}</pre>`;
    }

    if (section.list) {
        html += '<ul>' + section.list.map(li => `<li>${li}</li>`).join('') + '</ul>';
    }

    if (section.concepts) {
        html += section.concepts.map(c =>
            `<div class="concept"><div class="concept-title">${c.title}</div><div class="concept-desc">${c.desc}</div></div>`
        ).join('');
    }

    html += '</div>';
    return html;
};

/**
 * Render a full help category
 */
window.renderHelpCategory = function(catId, category) {
    let html = `<div class="help-panel" data-panel="${catId}">`;
    html += category.sections.map(s => renderHelpSection(s)).join('');
    html += '<div class="help-no-results">No matching help topics found</div>';
    html += '</div>';
    return html;
};

function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
