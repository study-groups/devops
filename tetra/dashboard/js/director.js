/**
 * director.js - 4-channel video editor for tut guides
 *
 * Channels: Visual (screenshots), Audio (vox), Title (overlays), Transition
 * Features: Live iframe preview, step navigation, capture integration, timeline
 */
(function() {
    'use strict';

    var API = '/api/director';
    var TUT_API = '/api/tut';
    var CAPTURE_API = '/api/capture';
    var PREFS_KEY = 'director-prefs';

    function loadPrefs() {
        try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch (_) { return {}; }
    }
    function savePrefs() {
        localStorage.setItem(PREFS_KEY, JSON.stringify({
            guide: guideSelect.value,
            provider: providerSelect.value,
            voice: getVoiceValue(),
            model: modelSelect.value
        }));
    }
    function saveProjectPrefs() {
        if (!state.currentProject || !state.projectData) return;
        var body = {
            provider: providerSelect.value,
            voice: getVoiceValue(),
            model: modelSelect.value
        };
        fetch(API + '/' + state.org + '/' + encodeURIComponent(state.currentProject), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).catch(function() {});
    }

    // DOM refs
    var guideSelect = document.getElementById('guide-select');
    var providerSelect = document.getElementById('provider-select');
    var voiceSelect = document.getElementById('voice-select');
    var modelSelect = document.getElementById('model-select');

    var previewIframe = document.getElementById('preview-iframe');
    var prevStepBtn = document.getElementById('prev-step');
    var nextStepBtn = document.getElementById('next-step');
    var stepInfo = document.getElementById('step-info');
    var previewTopic = document.getElementById('preview-topic');
    var captureBtn = document.getElementById('capture-btn');
    var captureStatus = document.getElementById('capture-status');
    var viewportSelect = document.getElementById('viewport-select');

    var visualThumb = document.getElementById('visual-thumb');
    var visualDuration = document.getElementById('visual-duration');
    var audioWave = document.getElementById('audio-wave');
    var narrationText = document.getElementById('narration-text');
    var audioDuration = document.getElementById('audio-duration');
    var shotAudio = document.getElementById('shot-audio');

    var titleText = document.getElementById('title-text');
    var titlePosition = document.getElementById('title-position');
    var titleFadeIn = document.getElementById('title-fade-in');
    var titleFadeOut = document.getElementById('title-fade-out');
    var titleStyle = document.getElementById('title-style');

    var transitionType = document.getElementById('transition-type');
    var transitionDuration = document.getElementById('transition-duration');

    var timelineTrack = document.getElementById('timeline-track');
    var timelineCount = document.getElementById('timeline-count');
    var timelineDuration = document.getElementById('timeline-duration');

    var statusProject = document.getElementById('status-project');
    var statusShots = document.getElementById('status-shots');
    var statusAudio = document.getElementById('status-audio');
    var statusVisual = document.getElementById('status-visual');
    var statusCost = document.getElementById('status-cost');

    var importOverlay = document.getElementById('import-overlay');
    var importTitle = document.getElementById('import-title');
    var importStats = document.getElementById('import-stats');
    var importDismiss = document.getElementById('import-dismiss');

    var VOX_DATA = {
        openai: {
            models: {
                'tts-1': ['shimmer', 'alloy', 'ash', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage'],
                'tts-1-hd': ['shimmer', 'alloy', 'ash', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage']
            }
        },
        coqui: {
            models: {
                'vits': [],
                'tacotron': [],
                'xtts': [
                    'Claribel_Dervla', 'Daisy_Studious', 'Gracie_Wise',
                    'Tammie_Ema', 'Alison_Dietlinde', 'Ana_Florence',
                    'Annmarie_Nele', 'Asya_Anara', 'Brenda_Stern',
                    'Gitta_Nikolina', 'Henriette_Usha', 'Sofia_Hellen',
                    'Tammy_Grit', 'Tanja_Adelina', 'Vjollca_Johnnie',
                    'Andrew_Chipper', 'Badr_Odhiambo', 'Dionisio_Schuyler',
                    'Royston_Min', 'Viktor_Eka'
                ]
            }
        }
    };

    var state = {
        org: 'tetra',
        guides: [],
        projects: [],
        currentProject: null,
        projectData: null,
        selectedShotIndex: 0,
        currentStep: 0,
        totalSteps: 0,
        guideType: null, // 'guide' or 'reference'
        guideData: null
    };

    // ----------------------------------------------------------------
    // Init
    // ----------------------------------------------------------------

    function readParams() {
        var p = new URLSearchParams(window.location.search);
        if (p.get('org')) state.org = p.get('org');
    }

    function fetchJSON(url, opts) {
        return fetch(url, opts).then(function(r) { return r.json(); });
    }

    // ----------------------------------------------------------------
    // Guide loading
    // ----------------------------------------------------------------

    function loadGuides() {
        fetchJSON(TUT_API + '/' + state.org + '/src').then(function(data) {
            state.guides = (data && data.files) ? data.files : [];
            loadProjects();
        }).catch(function() {
            state.guides = [];
            loadProjects();
        });
    }

    function loadProjects() {
        fetchJSON(API + '/' + state.org).then(function(data) {
            state.projects = (data && data.projects) ? data.projects : [];
            renderGuideSelect();
        }).catch(function() {
            state.projects = [];
            renderGuideSelect();
        });
    }

    function renderGuideSelect() {
        guideSelect.innerHTML = '<option value="">-- select guide --</option>';
        state.projects.forEach(function(p) {
            var opt = document.createElement('option');
            opt.value = 'project:' + p.name;
            opt.textContent = p.name + ' (' + p.shots + ' shots)';
            guideSelect.appendChild(opt);
        });
        var projectNames = state.projects.map(function(p) { return p.name; });
        state.guides.forEach(function(g) {
            var name = (g.name || g).replace(/\.json$/, '');
            if (projectNames.indexOf(name) === -1) {
                var opt = document.createElement('option');
                opt.value = 'import:' + name;
                opt.textContent = '+ import: ' + name;
                guideSelect.appendChild(opt);
            }
        });

        // Restore saved guide selection
        var prefs = loadPrefs();
        if (prefs.guide && guideSelect.querySelector('option[value="' + prefs.guide + '"]')) {
            guideSelect.value = prefs.guide;
            guideSelect.dispatchEvent(new Event('change'));
        }
    }

    guideSelect.addEventListener('change', function() {
        var val = guideSelect.value;
        if (!val) return;
        savePrefs();
        if (val.startsWith('project:')) {
            loadProject(val.replace('project:', ''));
        } else if (val.startsWith('import:')) {
            importGuide(val.replace('import:', ''));
        }
    });

    // ----------------------------------------------------------------
    // Import
    // ----------------------------------------------------------------

    function showImport(title, loading) {
        importTitle.textContent = title;
        importStats.innerHTML = loading ? '<span class="spinner"></span> Loading...' : '';
        importDismiss.style.display = loading ? 'none' : '';
        importOverlay.classList.add('active');
    }

    function hideImport() { importOverlay.classList.remove('active'); }

    importDismiss.addEventListener('click', hideImport);

    function importGuide(name) {
        showImport('Importing ' + name + '...', true);
        fetch(API + '/' + state.org + '/import/' + encodeURIComponent(name), { method: 'POST' })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.ok) {
                    var shots = data.data ? data.data.shots : [];
                    var totalChars = shots.reduce(function(sum, s) { return sum + (s.narration ? s.narration.length : 0); }, 0);
                    var cost = (totalChars * 15) / 1000000;
                    importTitle.textContent = 'Imported: ' + data.project;
                    importStats.innerHTML =
                        '<span class="label">shots:</span><span class="value">' + shots.length + '</span>' +
                        '<span class="label">characters:</span><span class="value">' + totalChars.toLocaleString() + '</span>' +
                        '<span class="label">est. cost:</span><span class="value">' + (cost > 0 ? '$' + cost.toFixed(4) : 'free') + '</span>';
                    importDismiss.style.display = '';
                    loadProjects();
                    if (data.data) {
                        state.currentProject = data.project;
                        state.projectData = data.data;
                        guideSelect.value = 'project:' + data.project;
                        onProjectLoaded();
                    }
                } else {
                    importTitle.textContent = 'Import failed';
                    importStats.innerHTML = '<span style="color:var(--one)">' + (data.error || 'error') + '</span>';
                    importDismiss.style.display = '';
                }
            })
            .catch(function(e) {
                importTitle.textContent = 'Error';
                importStats.innerHTML = '<span style="color:var(--one)">' + e.message + '</span>';
                importDismiss.style.display = '';
            });
    }

    // ----------------------------------------------------------------
    // Project loading
    // ----------------------------------------------------------------

    function loadProject(name) {
        state.currentProject = name;
        fetchJSON(API + '/' + state.org + '/' + encodeURIComponent(name))
            .then(function(data) {
                state.projectData = data;
                if (data.provider) providerSelect.value = data.provider;
                updateModelDropdown();
                if (data.model) modelSelect.value = data.model;
                updateVoiceDropdown();
                if (data.voice) {
                    var v = data.voice.split(':').pop();
                    // Parse "xtts/Speaker" into model=xtts, voice=Speaker
                    var slashIdx = v.indexOf('/');
                    if (slashIdx !== -1) {
                        modelSelect.value = v.substring(0, slashIdx);
                        updateVoiceDropdown();
                        voiceSelect.value = v.substring(slashIdx + 1);
                    } else {
                        modelSelect.value = v;
                        updateVoiceDropdown();
                    }
                }
                onProjectLoaded();
            })
            .catch(function() { state.projectData = null; });
    }

    function onProjectLoaded() {
        state.selectedShotIndex = 0;
        state.currentStep = 0;
        renderTimeline();
        updateStatus();
        loadGuideIntoIframe();
        if (state.projectData.shots && state.projectData.shots.length > 0) {
            selectShot(0);
        }
    }

    // ----------------------------------------------------------------
    // Iframe preview + step navigation
    // ----------------------------------------------------------------

    function loadGuideIntoIframe() {
        if (!state.projectData) return;
        var guideName = state.projectData.guide.replace(/\.json$/, '.html');
        var url = '/api/tut/' + state.org + '/' + guideName;
        previewIframe.src = url;

        // Also fetch the JSON to know structure
        fetchJSON(TUT_API + '/' + state.org + '/src/' + state.projectData.guide)
            .then(function(data) {
                state.guideData = data;
                if (data.steps) {
                    state.guideType = 'guide';
                    state.totalSteps = data.steps.length;
                } else if (data.groups) {
                    state.guideType = 'reference';
                    var count = 0;
                    data.groups.forEach(function(g) { count += (g.topics || []).length; });
                    state.totalSteps = count;
                }
                updateStepInfo();
            })
            .catch(function() {
                state.guideData = null;
                state.guideType = null;
            });
    }

    function updateStepInfo() {
        stepInfo.textContent = (state.currentStep + 1) + ' / ' + state.totalSteps;
        var shot = getCurrentShot();
        previewTopic.textContent = shot ? (shot.topic || shot.group || '-') : '-';
    }

    function navigateStep(delta) {
        var newStep = state.currentStep + delta;
        if (newStep < 0 || newStep >= state.totalSteps) return;
        state.currentStep = newStep;
        updateStepInfo();

        // Navigate iframe
        if (state.guideType === 'guide') {
            // Guides use JS navigation - send postMessage
            try {
                previewIframe.contentWindow.postMessage({ type: 'goToStep', step: newStep }, '*');
            } catch (e) {}
        } else if (state.guideType === 'reference') {
            // References use URL fragments
            var topic = getTopicAtIndex(newStep);
            if (topic) {
                var hash = '#' + (topic.id || topic.topic);
                previewIframe.contentWindow.location.hash = hash;
            }
        }

        // Sync shot selection if there's a matching shot
        if (newStep < state.projectData.shots.length) {
            selectShot(newStep);
        }
    }

    function getTopicAtIndex(idx) {
        if (!state.guideData || !state.guideData.groups) return null;
        var count = 0;
        for (var i = 0; i < state.guideData.groups.length; i++) {
            var g = state.guideData.groups[i];
            var topics = g.topics || [];
            for (var j = 0; j < topics.length; j++) {
                if (count === idx) return topics[j];
                count++;
            }
        }
        return null;
    }

    prevStepBtn.addEventListener('click', function() { navigateStep(-1); });
    nextStepBtn.addEventListener('click', function() { navigateStep(1); });

    // Keyboard nav
    document.addEventListener('keydown', function(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (e.key === 'ArrowLeft') navigateStep(-1);
        if (e.key === 'ArrowRight') navigateStep(1);
    });

    // ----------------------------------------------------------------
    // Capture
    // ----------------------------------------------------------------

    captureBtn.addEventListener('click', function() {
        if (!state.currentProject) return;
        var shot = getCurrentShot();
        if (!shot) return;

        captureStatus.textContent = 'capturing...';
        captureBtn.disabled = true;

        var viewport = viewportSelect.value.split('x');
        var guideName = state.projectData.guide.replace(/\.json$/, '.html');
        var url = 'http://localhost:4444/api/tut/' + state.org + '/' + guideName;

        // Add hash for reference docs
        if (state.guideType === 'reference' && shot.topic) {
            url += '#' + shot.topic;
        }

        fetch(CAPTURE_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: url,
                org: state.org,
                capture: ['screenshot'],
                viewport: { width: parseInt(viewport[0]), height: parseInt(viewport[1]) }
            })
        })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.screenshot) {
                    // Copy to project shots dir
                    return fetch(API + '/' + state.org + '/' + state.currentProject + '/capture/' + shot.id, {
                        method: 'POST'
                    }).then(function(r) { return r.json(); });
                }
                throw new Error('No screenshot returned');
            })
            .then(function(data) {
                captureStatus.textContent = 'captured';
                captureBtn.disabled = false;
                loadProject(state.currentProject);
            })
            .catch(function(e) {
                captureStatus.textContent = 'error: ' + e.message;
                captureBtn.disabled = false;
            });
    });

    // ----------------------------------------------------------------
    // Timeline
    // ----------------------------------------------------------------

    function renderTimeline() {
        timelineTrack.innerHTML = '';
        if (!state.projectData || !state.projectData.shots) {
            timelineCount.textContent = '0';
            timelineDuration.textContent = '0:00';
            return;
        }

        var shots = state.projectData.shots;
        var totalDur = 0;

        shots.forEach(function(shot, idx) {
            var el = document.createElement('div');
            el.className = 'timeline-shot';
            if (idx === state.selectedShotIndex) el.classList.add('active');
            if (shot.status === 'complete') el.classList.add('complete');
            else if (shot.status === 'partial') el.classList.add('partial');

            var thumbHtml;
            if (shot.videoFile) {
                thumbHtml = '<video src="' + API + '/' + state.org + '/' + state.currentProject + '/output/' + shot.videoFile + '" muted style="width:100%;height:100%;object-fit:cover"></video>';
            } else if (shot.screenshotFile) {
                thumbHtml = '<img src="' + API + '/' + state.org + '/' + state.currentProject + '/shots/' + shot.screenshotFile + '">';
            } else {
                thumbHtml = '<span class="no-img">' + shot.id + '</span>';
            }

            var badgeClass = shot.videoFile ? 'timeline-shot-badge animated' : 'timeline-shot-badge';
            var badgeText = shot.videoFile ? 'animated' : 'static';

            el.innerHTML =
                '<div class="timeline-shot-thumb">' + thumbHtml + '</div>' +
                '<div class="timeline-shot-label">' + (shot.topic || shot.id) + '</div>' +
                '<div class="' + badgeClass + '">' + badgeText + '</div>';

            el.addEventListener('click', function() { selectShot(idx); });
            timelineTrack.appendChild(el);

            if (shot.audioDuration) totalDur += shot.audioDuration;
        });

        timelineCount.textContent = shots.length;
        var mins = Math.floor(totalDur / 60);
        var secs = Math.floor(totalDur % 60);
        timelineDuration.textContent = mins + ':' + (secs < 10 ? '0' : '') + secs;
    }

    // ----------------------------------------------------------------
    // Shot selection + channel editor
    // ----------------------------------------------------------------

    function getCurrentShot() {
        if (!state.projectData || !state.projectData.shots) return null;
        return state.projectData.shots[state.selectedShotIndex] || null;
    }

    function selectShot(idx) {
        state.selectedShotIndex = idx;
        state.currentStep = idx;
        updateStepInfo();
        renderTimeline();

        var shot = getCurrentShot();
        if (!shot) return;

        // Visual
        if (shot.videoFile) {
            visualThumb.innerHTML = '<video src="' + API + '/' + state.org + '/' + state.currentProject + '/output/' + shot.videoFile + '" controls muted style="max-width:100%;max-height:100%"></video>';
        } else if (shot.screenshotFile) {
            visualThumb.innerHTML = '<img src="' + API + '/' + state.org + '/' + state.currentProject + '/shots/' + shot.screenshotFile + '">';
        } else {
            visualThumb.innerHTML = '<span class="placeholder">no screenshot</span>';
        }
        visualDuration.value = shot.audioDuration || 0;

        // Audio
        narrationText.value = shot.narration || '';
        if (shot.audioFile) {
            audioWave.textContent = shot.audioDuration ? shot.audioDuration.toFixed(1) + 's' : 'ready';
            shotAudio.src = API + '/' + state.org + '/' + state.currentProject + '/audio/' + shot.audioFile;
            audioDuration.textContent = shot.audioDuration ? shot.audioDuration.toFixed(1) + 's' : '-';
        } else {
            audioWave.textContent = 'no audio';
            shotAudio.src = '';
            audioDuration.textContent = '-';
        }

        // Title (from shot or defaults)
        titleText.value = shot.title?.text || shot.topic || '';
        titlePosition.value = shot.title?.position || 'none';
        titleFadeIn.value = shot.title?.fadeIn || 0.5;
        titleFadeOut.value = shot.title?.fadeOut || 0.5;
        titleStyle.value = shot.title?.style || 'default';

        // Transition
        transitionType.value = shot.transition?.type || state.projectData.transition || 'crossfade';
        transitionDuration.value = shot.transition?.duration || state.projectData.transitionDuration || 0.5;

        // Navigate iframe to match
        if (state.guideType === 'guide') {
            try {
                previewIframe.contentWindow.postMessage({ type: 'goToStep', step: idx }, '*');
            } catch (e) {}
        } else if (state.guideType === 'reference' && shot.topic) {
            try {
                previewIframe.contentWindow.location.hash = '#' + shot.topic;
            } catch (e) {}
        }

        updateAnimPlayer();
    }

    // Save channel changes to shot
    function saveCurrentShot() {
        var shot = getCurrentShot();
        if (!shot) return;

        shot.title = {
            text: titleText.value,
            position: titlePosition.value,
            fadeIn: parseFloat(titleFadeIn.value) || 0.5,
            fadeOut: parseFloat(titleFadeOut.value) || 0.5,
            style: titleStyle.value
        };
        shot.transition = {
            type: transitionType.value,
            duration: parseFloat(transitionDuration.value) || 0.5
        };
        shot.narration = narrationText.value;

        // Persist to server
        fetch(API + '/' + state.org + '/' + state.currentProject, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state.projectData)
        }).catch(function() {});
    }

    // Debounced save on input change
    var saveTimeout = null;
    function debouncedSave() {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(saveCurrentShot, 500);
    }

    [titleText, titlePosition, titleFadeIn, titleFadeOut, titleStyle,
     transitionType, transitionDuration, narrationText].forEach(function(el) {
        el.addEventListener('change', debouncedSave);
        el.addEventListener('input', debouncedSave);
    });

    // ----------------------------------------------------------------
    // Actions
    // ----------------------------------------------------------------

    document.querySelector('[data-action="recapture"]').addEventListener('click', function() {
        captureBtn.click();
    });

    document.querySelector('[data-action="regen-audio"]').addEventListener('click', function() {
        var shot = getCurrentShot();
        if (!shot || !state.currentProject) return;

        audioWave.textContent = 'generating...';
        fetch(API + '/' + state.org + '/' + state.currentProject + '/audio/' + shot.id, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                provider: providerSelect.value,
                voice: getVoiceValue(),
                model: modelSelect.value
            })
        })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.ok) loadProject(state.currentProject);
                else audioWave.textContent = 'error';
            })
            .catch(function() { audioWave.textContent = 'error'; });
    });

    document.querySelector('[data-action="play-audio"]').addEventListener('click', function() {
        if (shotAudio.src) shotAudio.play();
    });

    document.getElementById('test-vox-btn').addEventListener('click', function() {
        var text = narrationText.value.trim() || 'The quick brown fox jumps over the lazy dog.';
        fetch('/api/vox/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: text,
                provider: providerSelect.value,
                voice: getVoiceValue(),
                model: modelSelect.value
            })
        })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.ok && data.audioUrl) {
                    var audio = new Audio(data.audioUrl);
                    audio.play();
                }
            });
    });

    document.getElementById('gen-all-btn').addEventListener('click', function() {
        if (!state.currentProject) return;
        var btn = document.getElementById('gen-all-btn');
        btn.textContent = 'generating...';
        btn.disabled = true;

        fetch(API + '/' + state.org + '/' + state.currentProject + '/audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                provider: providerSelect.value,
                voice: getVoiceValue(),
                model: modelSelect.value
            })
        })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                btn.textContent = 'gen all audio';
                btn.disabled = false;
                if (data.ok) loadProject(state.currentProject);
            })
            .catch(function() {
                btn.textContent = 'gen all audio';
                btn.disabled = false;
            });
    });

    document.getElementById('capture-animated-btn').addEventListener('click', function() {
        if (!state.currentProject) return;
        var shot = getCurrentShot();
        if (!shot) return;

        captureStatus.textContent = 'capturing animated...';
        var btn = document.getElementById('capture-animated-btn');
        btn.disabled = true;

        fetch(API + '/' + state.org + '/' + state.currentProject + '/capture-animated/' + shot.id, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                viewport: viewportSelect.value.split('x').reduce(function(o, v, i) {
                    o[i === 0 ? 'width' : 'height'] = parseInt(v);
                    return o;
                }, {})
            })
        })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                btn.disabled = false;
                if (data.ok) {
                    captureStatus.textContent = 'animated capture done';
                    loadProject(state.currentProject);
                } else {
                    captureStatus.textContent = 'error: ' + (data.error || 'failed');
                }
            })
            .catch(function(e) {
                btn.disabled = false;
                captureStatus.textContent = 'error: ' + e.message;
            });
    });

    document.getElementById('build-btn').addEventListener('click', function() {
        if (!state.currentProject) return;
        fetch(API + '/' + state.org + '/' + state.currentProject + '/build', { method: 'POST' })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.ok) alert('Video built: ' + data.segments + ' segments');
                else alert('Build failed: ' + (data.error || 'error'));
            });
    });

    document.getElementById('publish-btn').addEventListener('click', function() {
        if (!state.currentProject) return;
        fetch(API + '/' + state.org + '/' + state.currentProject + '/publish', { method: 'POST' })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.ok) alert('Published: ' + data.published);
                else alert('Publish failed: ' + (data.error || 'error'));
            });
    });

    // ----------------------------------------------------------------
    // Voice dropdown
    // ----------------------------------------------------------------

    function updateModelDropdown() {
        var provider = providerSelect.value;
        var data = VOX_DATA[provider] || { models: {} };
        var modelNames = Object.keys(data.models);
        modelSelect.innerHTML = '';
        modelNames.forEach(function(m) {
            var opt = document.createElement('option');
            opt.value = m;
            opt.textContent = m;
            modelSelect.appendChild(opt);
        });
        modelSelect.disabled = modelNames.length === 0;
        updateVoiceDropdown();
    }

    function updateVoiceDropdown() {
        var provider = providerSelect.value;
        var data = VOX_DATA[provider] || { models: {} };
        var model = modelSelect.value;
        var voices = data.models[model] || [];
        voiceSelect.innerHTML = '';
        if (voices.length === 0) {
            voiceSelect.innerHTML = '<option value="">n/a</option>';
            voiceSelect.disabled = true;
        } else {
            voices.forEach(function(v) {
                var opt = document.createElement('option');
                opt.value = v;
                opt.textContent = v;
                voiceSelect.appendChild(opt);
            });
            voiceSelect.disabled = false;
        }
    }

    // Build the voice string sent to the backend (e.g. "xtts/Claribel_Dervla", "vits", "shimmer")
    function getVoiceValue() {
        var provider = providerSelect.value;
        var model = modelSelect.value;
        var voice = voiceSelect.value;
        if (provider === 'coqui' && voice && voice !== 'n/a') {
            return model + '/' + voice;
        }
        if (provider === 'coqui') return model;
        return voice || model;
    }

    providerSelect.addEventListener('change', function() {
        updateModelDropdown();
        savePrefs();
        saveProjectPrefs();
    });
    modelSelect.addEventListener('change', function() {
        updateVoiceDropdown();
        savePrefs();
        saveProjectPrefs();
    });
    voiceSelect.addEventListener('change', function() {
        savePrefs();
        saveProjectPrefs();
    });

    // ----------------------------------------------------------------
    // Status bar
    // ----------------------------------------------------------------

    function updateStatus() {
        if (!state.projectData) {
            statusProject.textContent = 'none';
            statusShots.textContent = '0';
            statusAudio.textContent = '0/0';
            statusVisual.textContent = '0/0';
            statusCost.textContent = '$0.00';
            return;
        }
        var shots = state.projectData.shots || [];
        var audioCount = shots.filter(function(s) { return s.audioFile; }).length;
        var visualCount = shots.filter(function(s) { return s.screenshotFile; }).length;
        var totalChars = shots.reduce(function(sum, s) { return sum + (s.narration ? s.narration.length : 0); }, 0);
        var cost = (totalChars * 15) / 1000000;

        statusProject.textContent = state.currentProject || 'none';
        statusShots.textContent = shots.length;
        statusAudio.textContent = audioCount + '/' + shots.length;
        statusVisual.textContent = visualCount + '/' + shots.length;
        statusCost.textContent = cost > 0 ? '$' + cost.toFixed(4) : 'free';
    }

    // ----------------------------------------------------------------
    // Init
    // ----------------------------------------------------------------

    // Apply saved prefs (localStorage defaults, before project overrides)
    function applyPrefs() {
        var prefs = loadPrefs();
        if (prefs.provider) providerSelect.value = prefs.provider;
        updateModelDropdown();
        if (prefs.model) modelSelect.value = prefs.model;
        updateVoiceDropdown();
        if (prefs.voice) {
            var slashIdx = prefs.voice.indexOf('/');
            if (slashIdx !== -1) {
                voiceSelect.value = prefs.voice.substring(slashIdx + 1);
            } else {
                voiceSelect.value = prefs.voice;
            }
        }
    }

    Terrain.Iframe.init({
        name: 'director',
        onReady: function() {
            readParams();
            applyPrefs();
            loadGuides();
        }
    });

    // ----------------------------------------------------------------
    // Collapsible channels
    // ----------------------------------------------------------------

    document.getElementById('channel-editor').addEventListener('click', function(e) {
        var header = e.target.closest('.channel-header');
        if (!header) return;
        // Don't collapse if clicking a button inside the header
        if (e.target.closest('button')) return;
        header.closest('.channel').classList.toggle('collapsed');
    });

    // ----------------------------------------------------------------
    // Animation Player
    // ----------------------------------------------------------------

    var animBg = document.getElementById('anim-bg');
    var animTitleOverlay = document.getElementById('anim-title-overlay');
    var animTransitionOverlay = document.getElementById('anim-transition-overlay');
    var animPlayBtn = document.getElementById('anim-play');
    var animPauseBtn = document.getElementById('anim-pause');
    var animStopBtn = document.getElementById('anim-stop');
    var animScrub = document.getElementById('anim-scrub');
    var animTime = document.getElementById('anim-time');
    var animRafId = null;
    var animScrubbing = false;

    function formatTime(t) {
        var m = Math.floor(t / 60);
        var s = Math.floor(t % 60);
        return m + ':' + (s < 10 ? '0' : '') + s;
    }

    function updateAnimPlayer() {
        var shot = getCurrentShot();
        if (!shot) return;

        // Background
        if (shot.videoFile) {
            animBg.innerHTML = '<video src="' + API + '/' + state.org + '/' + state.currentProject + '/output/' + shot.videoFile + '" muted style="width:100%;height:100%;object-fit:cover"></video>';
        } else if (shot.screenshotFile) {
            animBg.innerHTML = '<img src="' + API + '/' + state.org + '/' + state.currentProject + '/shots/' + shot.screenshotFile + '">';
        } else {
            animBg.innerHTML = '';
        }

        // Title overlay setup
        var pos = titlePosition.value || 'none';
        animTitleOverlay.className = 'anim-title-overlay';
        if (pos !== 'none') {
            animTitleOverlay.classList.add('pos-' + pos);
        }
        var style = titleStyle.value || 'default';
        if (style !== 'default') {
            animTitleOverlay.classList.add('style-' + style);
        }
        animTitleOverlay.textContent = titleText.value || '';

        // Transition overlay setup
        animTransitionOverlay.className = 'anim-transition-overlay';
        var tt = transitionType.value || 'cut';
        if (tt !== 'cut') {
            animTransitionOverlay.classList.add(tt);
        }
        animTransitionOverlay.style.opacity = '0';

        // Reset scrub
        var dur = shotAudio.duration || 0;
        animScrub.max = dur || 100;
        animScrub.value = 0;
        animTime.textContent = '0:00 / ' + formatTime(dur);
    }

    function animTick() {
        if (!shotAudio.src || shotAudio.paused) {
            animRafId = null;
            return;
        }
        var t = shotAudio.currentTime;
        var dur = shotAudio.duration || 1;

        // Update scrub + time
        if (!animScrubbing) {
            animScrub.value = t;
            animTime.textContent = formatTime(t) + ' / ' + formatTime(dur);
        }

        // Title fade logic
        var fadeIn = parseFloat(titleFadeIn.value) || 0.5;
        var fadeOut = parseFloat(titleFadeOut.value) || 0.5;
        var pos = titlePosition.value || 'none';
        if (pos !== 'none' && titleText.value) {
            if (t < fadeIn) {
                animTitleOverlay.classList.add('visible');
            } else if (t > dur - fadeOut) {
                animTitleOverlay.classList.remove('visible');
            } else {
                animTitleOverlay.classList.add('visible');
            }
        } else {
            animTitleOverlay.classList.remove('visible');
        }

        // Transition preview at end
        var transDur = parseFloat(transitionDuration.value) || 0.5;
        var tt = transitionType.value || 'cut';
        if (tt !== 'cut' && dur - t <= transDur && dur - t >= 0) {
            var progress = 1 - ((dur - t) / transDur);
            if (tt === 'fade-black' || tt === 'crossfade') {
                animTransitionOverlay.style.opacity = progress;
            } else if (tt === 'slide-left') {
                animTransitionOverlay.style.opacity = '1';
                animTransitionOverlay.style.transform = 'translateX(' + (-100 + progress * 100) + '%)';
            }
        } else {
            animTransitionOverlay.style.opacity = '0';
            animTransitionOverlay.style.transform = '';
        }

        animRafId = requestAnimationFrame(animTick);
    }

    animPlayBtn.addEventListener('click', function() {
        if (!shotAudio.src) return;
        shotAudio.play();
        if (!animRafId) animRafId = requestAnimationFrame(animTick);
    });

    animPauseBtn.addEventListener('click', function() {
        shotAudio.pause();
    });

    animStopBtn.addEventListener('click', function() {
        shotAudio.pause();
        shotAudio.currentTime = 0;
        animTitleOverlay.classList.remove('visible');
        animTransitionOverlay.style.opacity = '0';
        animTransitionOverlay.style.transform = '';
        animScrub.value = 0;
        animTime.textContent = '0:00 / ' + formatTime(shotAudio.duration || 0);
    });

    animScrub.addEventListener('input', function() {
        animScrubbing = true;
        shotAudio.currentTime = parseFloat(animScrub.value);
        animTime.textContent = formatTime(shotAudio.currentTime) + ' / ' + formatTime(shotAudio.duration || 0);
    });
    animScrub.addEventListener('change', function() {
        animScrubbing = false;
    });

    shotAudio.addEventListener('ended', function() {
        animTitleOverlay.classList.remove('visible');
        animTransitionOverlay.style.opacity = '0';
        animTransitionOverlay.style.transform = '';
    });

    shotAudio.addEventListener('loadedmetadata', function() {
        animScrub.max = shotAudio.duration;
        animTime.textContent = '0:00 / ' + formatTime(shotAudio.duration);
    });

    window.addEventListener('message', function(e) {
        var msg = e.data;
        if (!msg || typeof msg !== 'object') return;
        if (msg.type === 'env-change' && msg.org && msg.org !== state.org) {
            state.org = msg.org;
            state.currentProject = null;
            state.projectData = null;
            loadGuides();
        }
    });

    // ----------------------------------------------------------------
    // Timeline Cue Editor
    // ----------------------------------------------------------------

    var tlEditor = document.getElementById('timeline-cue-editor');
    var tlAutoGen = document.getElementById('tl-auto-gen');
    var tlSendPreview = document.getElementById('tl-send-preview');

    function generateEvenCues(text, duration) {
        if (!text || !duration) return [];
        var words = text.split(/\s+/).filter(function(w) { return w.length > 0; });
        var perWord = duration / words.length;
        var cues = [];
        for (var i = 0; i < words.length; i++) {
            cues.push({
                text: words[i],
                start: Math.round(i * perWord * 100) / 100,
                end: Math.round((i + 1) * perWord * 100) / 100
            });
        }
        return cues;
    }

    function renderCueEditor() {
        var shot = getCurrentShot();
        if (!shot) { tlEditor.innerHTML = ''; return; }
        var cues = shot.timeline || [];
        if (cues.length === 0) {
            tlEditor.innerHTML = '<div style="padding:6px;font-size:9px;color:var(--ink-muted)">No cues. Click auto-gen.</div>';
            return;
        }
        var html = '';
        for (var i = 0; i < cues.length; i++) {
            html += '<div class="tl-cue-row" data-idx="' + i + '">' +
                '<span class="tl-word">' + cues[i].text + '</span>' +
                '<span class="tl-label">s:</span>' +
                '<input type="number" class="tl-start" value="' + cues[i].start + '" step="0.05" min="0">' +
                '<span class="tl-label">e:</span>' +
                '<input type="number" class="tl-end" value="' + cues[i].end + '" step="0.05" min="0">' +
                '</div>';
        }
        tlEditor.innerHTML = html;
    }

    // Auto-generate evenly spaced cues from narration + audio duration
    tlAutoGen.addEventListener('click', function() {
        var shot = getCurrentShot();
        if (!shot || !shot.narration) return;
        var dur = shot.audioDuration || (shotAudio.duration || 0);
        if (!dur) { alert('No audio duration. Generate audio first.'); return; }
        shot.timeline = generateEvenCues(shot.narration, dur);
        renderCueEditor();
        debouncedSave();
    });

    // Save cue edits back to shot
    tlEditor.addEventListener('change', function(e) {
        var input = e.target;
        if (!input.classList.contains('tl-start') && !input.classList.contains('tl-end')) return;
        var row = input.closest('.tl-cue-row');
        var idx = parseInt(row.dataset.idx);
        var shot = getCurrentShot();
        if (!shot || !shot.timeline || !shot.timeline[idx]) return;
        if (input.classList.contains('tl-start')) {
            shot.timeline[idx].start = parseFloat(input.value) || 0;
        } else {
            shot.timeline[idx].end = parseFloat(input.value) || 0;
        }
        debouncedSave();
    });

    // Send cues to iframe for live preview
    tlSendPreview.addEventListener('click', function() {
        var shot = getCurrentShot();
        if (!shot || !shot.timeline || shot.timeline.length === 0) return;
        var audioSrc = shot.audioFile
            ? API + '/' + state.org + '/' + state.currentProject + '/audio/' + shot.audioFile
            : '';
        try {
            previewIframe.contentWindow.postMessage({
                type: 'anim-init',
                cues: shot.timeline,
                narration: shot.narration || '',
                audioSrc: audioSrc
            }, '*');
            // Start playback after short delay for init
            setTimeout(function() {
                previewIframe.contentWindow.postMessage({
                    type: 'anim-play',
                    audioSrc: audioSrc
                }, '*');
            }, 200);
        } catch (e) {}
    });

    // Hook into selectShot to render cue editor
    var _origSelectShot = selectShot;
    selectShot = function(idx) {
        _origSelectShot(idx);
        renderCueEditor();
    };

})();
