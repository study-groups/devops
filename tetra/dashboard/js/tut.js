/**
 * tut.js - Dashboard panel for the tut-server
 *
 * Embeds the tut-server (system-wide tutorial browser) in an iframe.
 * Supports environment switching:
 *   local → http://localhost:<port>  (tut-server running locally)
 *   dev/stg/prod → SSH tunnel target (user provides host:port)
 */

(function() {
    'use strict';

    var DEFAULT_LOCAL_PORT = 8000;

    var state = {
        env: 'local',
        localPort: null,      // discovered from /api/tut/port or health
        remoteTarget: ''      // host:port for SSH tunnel
    };

    var frame = document.getElementById('tut-frame');
    var urlLabel = document.getElementById('base-url-label');
    var hostInput = document.getElementById('remote-host');
    var sshBadge = document.getElementById('ssh-badge');

    // ----------------------------------------------------------------
    // URL resolution
    // ----------------------------------------------------------------

    function getBaseUrl() {
        if (state.env === 'local') {
            var port = state.localPort || DEFAULT_LOCAL_PORT;
            return 'http://localhost:' + port;
        }
        var target = state.remoteTarget || 'localhost:8000';
        // Remote: assume SSH tunnel forwards to localhost:<port>
        return 'http://' + target;
    }

    function updateLabel() {
        var url = getBaseUrl();
        urlLabel.textContent = url.replace('http://', '');
    }

    function navigate(path) {
        frame.src = getBaseUrl() + (path || '/');
        updateLabel();
    }

    // ----------------------------------------------------------------
    // Discover local tut-server port
    // ----------------------------------------------------------------

    function discoverLocalPort() {
        // Try common ports until we find a running tut-server
        var ports = [8000, 8001, 8002, 8003, 8004, 8005, 8010, 8020];
        var found = false;

        function tryPort(i) {
            if (i >= ports.length || found) {
                if (!found) {
                    state.localPort = DEFAULT_LOCAL_PORT;
                    updateLabel();
                }
                return;
            }
            var url = 'http://localhost:' + ports[i] + '/health';
            fetch(url, { mode: 'cors' })
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    if (data.service === 'tut-server' && !found) {
                        found = true;
                        state.localPort = ports[i];
                        updateLabel();
                        navigate('/');
                    } else {
                        tryPort(i + 1);
                    }
                })
                .catch(function() { tryPort(i + 1); });
        }

        tryPort(0);
    }

    // ----------------------------------------------------------------
    // Environment switching
    // ----------------------------------------------------------------

    function setEnv(env) {
        state.env = env;

        document.querySelectorAll('.env-pill').forEach(function(p) {
            p.classList.toggle('active', p.dataset.env === env);
        });

        var isRemote = env !== 'local';
        hostInput.classList.toggle('hidden', !isRemote);
        sshBadge.classList.toggle('visible', isRemote);

        if (isRemote && state.remoteTarget) {
            navigate('/');
        } else if (!isRemote) {
            navigate('/');
        }
        updateLabel();
    }

    // ----------------------------------------------------------------
    // Init
    // ----------------------------------------------------------------

    Terrain.Iframe.init({
        name: 'tut',
        onReady: function() {
            discoverLocalPort();
        }
    });

    Terrain.Iframe.on('set-env', function(el) {
        setEnv(el.dataset.env);
    });

    Terrain.Iframe.on('refresh', function() {
        frame.contentWindow.location.reload();
    });

    hostInput.addEventListener('change', function() {
        state.remoteTarget = this.value.trim();
        updateLabel();
        if (state.remoteTarget) {
            navigate('/');
        }
    });

    Terrain.State.onEnvChange(function(changes) {
        if (changes.envChanged) {
            setEnv(Terrain.State.env);
        }
    });

})();
