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
                content: 'Panels communicate via the Terrain library loaded from <code>terrain-iframe.js</code>. It provides a message bus, state management, display modes, and design tools.',
                list: [
                    '<strong>Terrain.Bus</strong> - Pub/sub message bus (parent ↔ iframes)',
                    '<strong>Terrain.State</strong> - Shared org/env/user context',
                    '<strong>Terrain.Mode</strong> - Display mode system (panel, full-panel, custom)',
                    '<strong>Terrain.Iframe</strong> - Iframe initialization helpers',
                    '<strong>Terrain.Design</strong> - Design token viewer (?design=true)'
                ],
                keywords: ['terrain', 'framework', 'library', 'overview']
            },
            {
                title: 'Message Protocol',
                content: 'Messages are plain objects with routing metadata and timestamps.',
                list: [
                    '<code>type</code> — Message type string (e.g., "ready", "env-change")',
                    '<code>source</code> — Sender ID; parent uses "terrain"',
                    '<code>from</code> — Alternative sender field; iframes use panel name',
                    '<code>_to</code> — Target panel; matches data-view attribute',
                    '<code>_from</code> — Routing annotation added by parent during forwarding',
                    '<code>timestamp</code> — Message timestamp in milliseconds (Date.now())',
                    '<code>ts</code> — API timestamp in seconds (Date.now()/1000)'
                ],
                code: '{\n  type: \'env-change\',\n  source: \'terrain\',\n  _to: \'deploy\',\n  _from: \'parent\',\n  timestamp: 1705600000000\n}',
                keywords: ['message', 'protocol', 'format', 'timestamp', '_to', '_from', 'source']
            },
            {
                title: 'Dual Timestamps',
                content: 'The protocol uses two timestamp conventions for different contexts.',
                concepts: [
                    { title: 'timestamp (ms)', desc: 'Date.now() in milliseconds. Used for message routing, iframe load timing, and event ordering.' },
                    { title: 'ts (seconds)', desc: 'Date.now()/1000 as Unix epoch. Used in API responses, Caddy access logs, and TSM service data.' }
                ],
                code: '// Message routing uses milliseconds\nsendToPanel(panel, {\n  timestamp: Date.now()  // 1705600000000\n});\n\n// API responses use seconds\n{\n  ts: 1705600000.0,\n  method: \'GET\',\n  status: 200\n}',
                keywords: ['timestamp', 'milliseconds', 'seconds', 'unix', 'epoch', 'time']
            },
            {
                title: 'Targeting',
                content: 'The parent window acts as a message router. All iframe-to-iframe communication goes through parent.',
                concepts: [
                    { title: 'route(panel, msg)', desc: 'Send to one iframe. Sets _to field from panel.dataset.view.' },
                    { title: 'publish(msg)', desc: 'Broadcast to all iframes. Each receives the message.' },
                    { title: 'broadcast(msg, src)', desc: 'Send to all except source. Used for cross-panel sync.' },
                    { title: 'Iframe.send(msg)', desc: 'Iframe sends to parent. Only direction available from iframe.' }
                ],
                code: '// Panel identified by data-view\n<div data-view="deploy">...</div>\n\n// Parent routes to specific panel\nTerrain.Bus.route(\n  document.querySelector(\'[data-view="deploy"]\'),\n  { type: \'refresh\' }\n);\n\n// Iframe sends up to parent\nTerrain.Iframe.send({ type: \'ready\' });',
                keywords: ['target', 'client', 'server', 'route', 'broadcast', 'parent', 'iframe']
            },
            {
                title: 'Message Types',
                content: 'Standard message types handled automatically by Terrain.',
                concepts: [
                    { title: 'ready', desc: 'Iframe initialization complete. Parent records load timing.' },
                    { title: 'env-change', desc: 'Context switch with org/env/user. Auto-updates Terrain.State.' },
                    { title: 'mode-change', desc: 'Display mode toggle (panel↔full-panel). Auto-calls Terrain.Mode.set().' },
                    { title: 'log-watch-change', desc: 'TSM panel broadcasts selected services to sync with Logs panel.' },
                    { title: 'injectTokens', desc: 'Parent injects CSS variables into iframe document.' },
                    { title: 'request-timings', desc: 'Admin panel requests load timing data from parent.' },
                    { title: 'timing-update', desc: 'Parent responds with array of panel timing measurements.' }
                ],
                keywords: ['ready', 'env-change', 'mode-change', 'log-watch', 'inject', 'timing', 'message']
            },
            {
                title: 'Routing Flow',
                content: 'How messages flow between parent and iframes.',
                code: '// FLOW 1: Iframe → Parent\n// tsm.iframe.html clicks env button\nTerrain.Iframe.send({ type: \'log-watch-change\', services: [...] });\n  ↓\nwindow.parent.postMessage(msg, \'*\');\n  ↓\n// index.html message handler\nwindow.addEventListener(\'message\', (e) => {\n  Terrain.Bus._notify({ ...msg, _from: \'tsm\', _to: \'parent\' });\n  Terrain.Bus.broadcast(msg, e.source);  // to other panels\n});\n\n// FLOW 2: Parent → Iframe\n// User clicks env button in header\nupdatePanelIframe(panel, true);\n  ↓\nsendToPanel(panel, { type: \'env-change\', env, org, user });\n  ↓\nTerrain.Bus.route(panel, { ...msg, _to: panel.dataset.view });\n  ↓\niframe.contentWindow.postMessage(msg, \'*\');\n  ↓\n// deploy.iframe.html receives\nTerrain.State._handleEnvChange(msg);  // auto-update context',
                keywords: ['flow', 'routing', 'postmessage', 'send', 'receive', 'handler']
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
            },
            {
                title: 'Terrain.Design',
                content: 'Design token viewer activated by <code>?design=true</code>. Shows all CSS variables and allows copying them.',
                concepts: [
                    { title: 'Activation', desc: 'Add ?design=true to any URL that loads terrain-iframe.js' },
                    { title: 'FAB Button', desc: 'Gear icon appears in bottom-right corner to toggle the panel' },
                    { title: 'Click to Copy', desc: 'Click any token row to copy var(--name) to clipboard' }
                ],
                code: '// Check if design mode is active\nif (Terrain.Design.isEnabled()) {\n  console.log(\'Design mode active\');\n}\n\n// Programmatic control\nTerrain.Design.show();    // Open panel\nTerrain.Design.hide();    // Close panel\nTerrain.Design.toggle();  // Toggle panel\n\n// URLs that activate design mode:\n// http://localhost:4444/?design=true\n// http://localhost:4444/tsm.iframe.html?design=true',
                keywords: ['design', 'token', 'css', 'variable', 'inspector', 'fab', 'copy']
            },
            {
                title: 'Design Token Categories',
                content: 'The design panel automatically categorizes CSS variables found in :root.',
                list: [
                    '<strong>Colors:</strong> --one, --two, --three, --four, --ink, --accent-*',
                    '<strong>Paper/Background:</strong> --paper-*, --bg-*, --shade, --border',
                    '<strong>Layout:</strong> --gap-*, --height, --width, --size, --padding, --margin',
                    '<strong>Typography:</strong> --font-*, --text-*',
                    '<strong>Terrain Mode:</strong> --terrain-* (set by Terrain.Mode)',
                    '<strong>Other:</strong> Any CSS variables not matching above patterns'
                ],
                keywords: ['design', 'category', 'colors', 'paper', 'layout', 'typography', 'variable']
            },
            {
                title: 'Logging & Debugging',
                content: 'Built-in logging for debugging message flow and performance.',
                concepts: [
                    { title: '[Console]', desc: 'Parent window logs all received messages to browser console' },
                    { title: '[Terrain.X]', desc: 'Module-specific logging with prefix convention' },
                    { title: 'iframeTimings', desc: 'Map tracking panel load start/end times' },
                    { title: 'Developer Panel', desc: 'Subscribes to "*" wildcard to visualize all traffic' }
                ],
                code: '// Parent logs all messages (index.html)\nwindow.addEventListener(\'message\', (e) => {\n  console.log(\'[Console] Message:\', e.data);\n});\n\n// Module logging convention\nconsole.log(\'[Terrain.Mode] Applied:\', modeName);\nconsole.log(\'[Terrain.Design] Initialized\');\nconsole.log(\'[Inspector] Initialized\');\n\n// Timing tracking in parent\niframeTimings.set(panelId, {\n  start: Date.now(),\n  view: \'deploy\',\n  end: null,\n  duration: null\n});\n// On \'ready\' message:\ntiming.end = Date.now();\ntiming.duration = timing.end - timing.start;',
                keywords: ['log', 'debug', 'console', 'timing', 'trace', 'developer']
            },
            {
                title: 'Performance Monitoring',
                content: 'Track iframe load times and API latency.',
                list: [
                    '<strong>Panel Timings:</strong> Admin tab shows load time per panel',
                    '<strong>Color Coding:</strong> Green (<500ms), Yellow (500-2000ms), Red (>2000ms)',
                    '<strong>request-timings:</strong> Admin panel requests current timing data',
                    '<strong>timing-update:</strong> Parent responds with collected timings'
                ],
                code: '// Request timing data (admin.iframe.html)\nTerrain.Iframe.send({ type: \'request-timings\', source: \'admin\' });\n\n// Parent responds with:\n{\n  type: \'timing-update\',\n  timings: [\n    { panel: \'top-left\', view: \'console\', duration: 342 },\n    { panel: \'top-right\', view: \'tsm\', duration: 567 },\n    ...\n  ]\n}',
                keywords: ['performance', 'timing', 'latency', 'slow', 'fast', 'monitor']
            },
            {
                title: 'Parent/Iframe Detection',
                content: 'Terrain auto-detects whether it\'s running in parent or iframe context.',
                code: '// Auto-detection (terrain-iframe.js)\nTerrain.Bus._isParent = window.parent === window;\n\n// In parent window (index.html): true\n// In iframe (tsm.iframe.html): false\n\n// Behavior differs:\nif (Terrain.Bus._isParent) {\n  // publish() broadcasts to all iframes\n  // route() sends to specific iframe\n} else {\n  // publish() sends to parent via postMessage\n  // Terrain.Iframe.send() available\n}',
                keywords: ['parent', 'iframe', 'detect', 'context', 'window']
            }
        ]
    },

    capture: {
        title: 'Capture',
        sections: [
            {
                title: 'Capture API',
                content: 'Screenshot and DOM capture service. Base URL: <code>http://localhost:4444</code>',
                code: 'POST /api/capture\nContent-Type: application/json\n\n{\n  "url": "https://example.com",\n  "org": "tetra",\n  "capture": ["screenshot", "dom", "text"],\n  "waitForSelector": "#main-content"\n}',
                keywords: ['capture', 'screenshot', 'api', 'post']
            },
            {
                title: 'Capture Types',
                content: 'Types of content to capture from the page.',
                list: [
                    '<code>screenshot</code> — PNG image of the viewport',
                    '<code>dom</code> — Full HTML source',
                    '<code>text</code> — Visible text content only',
                    '<code>struct</code> — Page structure/outline',
                    '<code>interact</code> — Clickable/fillable elements'
                ],
                keywords: ['capture', 'screenshot', 'dom', 'text', 'struct', 'type']
            },
            {
                title: 'Wait Strategies',
                content: 'Control when capture occurs. Pick one strategy.',
                concepts: [
                    { title: 'waitForSelector', desc: '"#element-id" — Wait for element to appear (best for SPAs)' },
                    { title: 'waitForTimeout', desc: '2000 — Fixed delay in milliseconds' },
                    { title: 'waitUntil: networkidle0', desc: 'No network requests for 500ms (most reliable)' },
                    { title: 'waitUntil: domcontentloaded', desc: 'DOM ready event (faster, less reliable)' }
                ],
                keywords: ['wait', 'selector', 'timeout', 'networkidle', 'spa']
            },
            {
                title: 'Viewport Configuration',
                content: 'Set browser window dimensions for the capture.',
                code: '{\n  "url": "https://example.com",\n  "org": "tetra",\n  "viewport": {"width": 1280, "height": 720},\n  "capture": ["screenshot"]\n}',
                list: [
                    '<strong>Desktop:</strong> 1920×1080, 1440×900, 1280×720',
                    '<strong>Tablet:</strong> 768×1024, 1024×768',
                    '<strong>Mobile:</strong> 375×667, 414×896'
                ],
                keywords: ['viewport', 'width', 'height', 'responsive', 'mobile', 'desktop']
            },
            {
                title: 'Multi-Step Capture',
                content: 'Execute a sequence of actions before capturing (login flows, navigation, form filling).',
                code: 'POST /api/capture\n{\n  "org": "tetra",\n  "capture": ["screenshot"],\n  "steps": [\n    {"action": "navigate", "url": "https://example.com/login"},\n    {"action": "waitForSelector", "selector": "#login-form"},\n    {"action": "fill", "selector": "#email", "value": "user@example.com"},\n    {"action": "fill", "selector": "#password", "value": "secret"},\n    {"action": "click", "selector": "button[type=submit]"},\n    {"action": "waitForSelector", "selector": ".dashboard"},\n    {"action": "saveSession", "name": "logged-in"}\n  ]\n}',
                keywords: ['steps', 'multi', 'journey', 'login', 'flow', 'sequence']
            },
            {
                title: 'Step Actions',
                content: 'Available actions for multi-step captures.',
                concepts: [
                    { title: 'navigate', desc: '{"action": "navigate", "url": "..."}' },
                    { title: 'click', desc: '{"action": "click", "selector": "..."}' },
                    { title: 'fill', desc: '{"action": "fill", "selector": "...", "value": "..."}' },
                    { title: 'wait', desc: '{"action": "wait", "ms": 1000}' },
                    { title: 'waitForSelector', desc: '{"action": "waitForSelector", "selector": "..."}' },
                    { title: 'evaluate', desc: '{"action": "evaluate", "script": "return document.title"}' },
                    { title: 'saveSession', desc: '{"action": "saveSession", "name": "..."}' },
                    { title: 'setViewport', desc: '{"action": "setViewport", "width": 375, "height": 667}' }
                ],
                keywords: ['action', 'click', 'fill', 'wait', 'navigate', 'evaluate', 'session']
            },
            {
                title: 'Sessions',
                content: 'Save and reuse browser sessions (cookies, localStorage) across captures.',
                code: '// Save session during steps\n{"action": "saveSession", "name": "logged-in"}\n\n// Reuse session in later capture\nPOST /api/capture\n{\n  "url": "https://example.com/dashboard",\n  "org": "tetra",\n  "session": "logged-in",\n  "capture": ["screenshot"]\n}',
                list: [
                    '<code>GET /api/capture/sessions?org=tetra</code> — List sessions',
                    '<code>DELETE /api/capture/sessions/tetra/{name}</code> — Delete session'
                ],
                keywords: ['session', 'cookie', 'login', 'auth', 'reuse']
            },
            {
                title: 'Capture Endpoints',
                content: 'REST endpoints for managing captures.',
                list: [
                    '<code>POST /api/capture</code> — Create new capture',
                    '<code>GET /api/capture/list?org=tetra</code> — List captures',
                    '<code>GET /api/capture/tetra/{id}</code> — Get capture metadata',
                    '<code>GET /api/capture/tetra/{id}/file/{filename}</code> — Get capture file',
                    '<code>DELETE /api/capture/tetra/{id}</code> — Delete capture'
                ],
                keywords: ['endpoint', 'list', 'get', 'delete', 'rest']
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
        html += '<div class="concepts-grid">' + section.concepts.map(c =>
            `<div class="concept"><div class="concept-title">${c.title}</div><div class="concept-desc">${c.desc}</div></div>`
        ).join('') + '</div>';
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
