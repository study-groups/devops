/**
 * agents.js - Agent registry & resource tracking panel
 *
 * Agents have a type (qa/vox/general) mapping to bash modules,
 * a provider (openai/anthropic/tetra), model, budget, and tags.
 * Free agents (tetra provider, budget 0/0) tracked alongside paid.
 */
(function() {
    'use strict';

    var API = '/api/agents';

    // DOM refs
    var typeFilter = document.getElementById('type-filter');
    var periodSelect = document.getElementById('period-select');
    var refreshBtn = document.getElementById('refresh-btn');
    var createBtn = document.getElementById('create-btn');
    var cardsRow = document.getElementById('cards-row');
    var ledgerBody = document.getElementById('ledger-body');
    var ledgerCount = document.getElementById('ledger-count');
    var agentFilters = document.getElementById('agent-filters');
    var statsAgents = document.getElementById('stats-agents');
    var statsCalls = document.getElementById('stats-calls');
    var statsCost = document.getElementById('stats-cost');
    var statsPeriod = document.getElementById('stats-period');

    // Create form refs
    var createOverlay = document.getElementById('create-overlay');
    var crType = document.getElementById('cr-type');
    var crProvider = document.getElementById('cr-provider');
    var crModel = document.getElementById('cr-model');
    var crName = document.getElementById('cr-name');
    var crTags = document.getElementById('cr-tags');
    var crDaily = document.getElementById('cr-daily');
    var crTotal = document.getElementById('cr-total');
    var crCancel = document.getElementById('cr-cancel');
    var crSubmit = document.getElementById('cr-submit');

    // Per-card expand/collapse state
    var expandedCards = {};
    try {
        var saved = JSON.parse(localStorage.getItem('agents-expanded') || '{}');
        if (saved && typeof saved === 'object') expandedCards = saved;
    } catch (_) {}

    function toggleCard(name) {
        expandedCards[name] = !expandedCards[name];
        try { localStorage.setItem('agents-expanded', JSON.stringify(expandedCards)); } catch (_) {}
    }

    var state = {
        agents: {},
        providers: {},
        period: 'total',
        typeFilter: '',
        ledgerFilter: 'all',
        selectedAgent: null
    };

    // ----------------------------------------------------------------
    // Data loading
    // ----------------------------------------------------------------

    function loadAll() {
        state.period = periodSelect.value;
        state.typeFilter = typeFilter.value;
        loadStatus();
        loadLedger();
    }

    function loadStatus() {
        var typeParam = state.typeFilter ? '&type=' + state.typeFilter : '';
        fetch(API + '/status?period=' + state.period + typeParam)
            .then(function(r) { return r.json(); })
            .then(function(data) {
                state.agents = data.agents || {};
                // Populate type filter if server returned types
                if (data.types) updateTypeFilter(data.types);
                renderCards();
                renderAgentFilters();
                updateStats();
            })
            .catch(function() {
                cardsRow.innerHTML = '<div style="padding:8px;color:var(--one);font-size:10px;">Error loading agents</div>';
            });
    }

    function loadLedger() {
        var params = 'period=' + state.period + '&limit=100';
        if (state.ledgerFilter && state.ledgerFilter !== 'all') {
            params += '&agent=' + state.ledgerFilter;
        } else if (state.typeFilter) {
            params += '&type=' + state.typeFilter;
        }
        fetch(API + '/ledger?' + params)
            .then(function(r) { return r.json(); })
            .then(function(data) {
                renderLedger(data.entries || []);
                ledgerCount.textContent = data.total + ' entries';
            })
            .catch(function() {
                ledgerBody.innerHTML = '';
                ledgerCount.textContent = '0 entries';
            });
    }

    function loadProviders() {
        fetch(API + '/providers')
            .then(function(r) { return r.json(); })
            .then(function(data) { state.providers = data; })
            .catch(function() {});
    }

    function updateTypeFilter(types) {
        // Keep existing options, add any new ones from server
        var existing = {};
        for (var i = 0; i < typeFilter.options.length; i++) {
            existing[typeFilter.options[i].value] = true;
        }
        types.forEach(function(t) {
            if (t && !existing[t]) {
                var opt = document.createElement('option');
                opt.value = t;
                opt.textContent = t;
                typeFilter.appendChild(opt);
            }
        });
    }

    // ----------------------------------------------------------------
    // Agent cards
    // ----------------------------------------------------------------

    function renderCards() {
        var names = Object.keys(state.agents);
        if (names.length === 0) {
            cardsRow.innerHTML = '<div style="padding:8px;color:var(--ink-muted);font-size:10px;">No agents found.</div>';
            return;
        }

        cardsRow.innerHTML = '';
        names.forEach(function(name) {
            var a = state.agents[name];
            var card = document.createElement('div');
            var isExpanded = !!expandedCards[name];
            card.className = 'agent-card ' + (isExpanded ? 'expanded' : 'icon');
            if (name === state.selectedAgent) card.classList.add('selected');
            if (a.free) card.classList.add('free');

            var hasBudget = a.budget && (a.budget.daily_usd > 0 || a.budget.total_usd > 0);
            if (hasBudget) {
                var dailyPct = a.budget.daily_usd > 0 ? (a.spend.daily / a.budget.daily_usd) * 100 : 0;
                var totalPct = a.budget.total_usd > 0 ? (a.spend.total / a.budget.total_usd) * 100 : 0;
                if (dailyPct > 100 || totalPct > 100) card.classList.add('over-budget');
            }

            var html =
                '<div class="card-header">' +
                    '<span class="card-name">' + name + '</span>' +
                    '<span class="card-type">' + (a.type || 'general') + '</span>' +
                    '<span class="card-provider">' + a.provider + '</span>' +
                    '<span class="card-key-dot ' + (a.api_key_ok ? 'ok' : 'missing') + '" title="API key: ' + (a.api_key_ok ? 'found' : 'missing') + '"></span>' +
                    '<span class="card-spend-inline">' + (a.free ? 'free' : '$' + a.spend.total.toFixed(2)) + '</span>' +
                '</div>' +
                '<div class="card-model">Model: ' + a.model + '</div>';

            if (hasBudget) {
                html += '<div class="card-budgets">' +
                    budgetRowHTML('daily', a.spend.daily, a.budget.daily_usd) +
                    budgetRowHTML('total', a.spend.total, a.budget.total_usd) +
                '</div>';
            } else {
                html += '<div class="card-budgets"><div class="budget-row"><span class="budget-label" style="width:auto">free / unmetered</span></div></div>';
            }

            html += modelBreakdownHTML(a.by_model);

            if (a.tags && a.tags.length) {
                html += '<div class="card-tags">' + a.tags.map(function(t) { return '<span>' + t + '</span>'; }).join('') + '</div>';
            }

            if (hasBudget) {
                html += '<div class="budget-edit" id="edit-' + name + '">' +
                    '<label>Daily $</label><input class="edit-daily" value="' + a.budget.daily_usd + '" data-agent="' + name + '">' +
                    '<label>Total $</label><input class="edit-total" value="' + a.budget.total_usd + '" data-agent="' + name + '">' +
                    '<button class="toolbar-btn save-budget" data-agent="' + name + '" style="font-size:8px;">Save</button>' +
                '</div>';
            }

            card.innerHTML = html;

            card.addEventListener('click', function(e) {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT') return;
                toggleCard(name);
                state.selectedAgent = name;
                state.ledgerFilter = name;
                renderCards();
                loadLedger();
                updateFilterButtons();
            });

            cardsRow.appendChild(card);
        });

        // Bind save budget buttons
        var saveBtns = cardsRow.querySelectorAll('.save-budget');
        for (var i = 0; i < saveBtns.length; i++) {
            (function(btn) {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var agentName = btn.getAttribute('data-agent');
                    var editDiv = document.getElementById('edit-' + agentName);
                    var daily = editDiv.querySelector('.edit-daily').value;
                    var total = editDiv.querySelector('.edit-total').value;
                    saveBudget(agentName, daily, total);
                });
            })(saveBtns[i]);
        }
    }

    function budgetRowHTML(label, spend, limit) {
        var pct = limit > 0 ? Math.min((spend / limit) * 100, 100) : 0;
        var cls = pct < 70 ? 'ok' : pct < 100 ? 'warn' : 'over';
        return '<div class="budget-row">' +
            '<span class="budget-label">' + label + '</span>' +
            '<div class="budget-bar"><div class="budget-fill ' + cls + '" style="width:' + pct + '%"></div></div>' +
            '<span class="budget-amount">$' + spend.toFixed(4) + ' / $' + limit + '</span>' +
        '</div>';
    }

    function modelBreakdownHTML(byModel) {
        var models = Object.keys(byModel || {});
        if (models.length === 0) return '';
        var html = '<div class="card-models">';
        models.forEach(function(m) {
            var d = byModel[m];
            html += '<div class="model-line">' +
                '<span class="model-name">' + m + '</span>' +
                '<span>' + d.calls + ' calls  $' + d.cost_usd.toFixed(4) + '</span>' +
            '</div>';
        });
        return html + '</div>';
    }

    function toggleCardSelect(name) {
        if (state.selectedAgent === name) {
            var editDiv = document.getElementById('edit-' + name);
            if (editDiv) editDiv.classList.toggle('visible');
        } else {
            var edits = cardsRow.querySelectorAll('.budget-edit');
            for (var i = 0; i < edits.length; i++) edits[i].classList.remove('visible');
            state.selectedAgent = name;
            state.ledgerFilter = name;
            renderCards();
            loadLedger();
            updateFilterButtons();
        }
    }

    // ----------------------------------------------------------------
    // Agent filter buttons (ledger header)
    // ----------------------------------------------------------------

    function renderAgentFilters() {
        agentFilters.innerHTML = '';
        Object.keys(state.agents).forEach(function(name) {
            var btn = document.createElement('button');
            btn.className = 'filter-btn';
            btn.setAttribute('data-agent', name);
            btn.textContent = name;
            if (state.ledgerFilter === name) btn.classList.add('active');
            btn.addEventListener('click', function() {
                state.ledgerFilter = name;
                state.selectedAgent = name;
                updateFilterButtons();
                renderCards();
                loadLedger();
            });
            agentFilters.appendChild(btn);
        });
    }

    function updateFilterButtons() {
        var allBtn = document.querySelector('[data-agent="all"]');
        if (allBtn) allBtn.classList.toggle('active', state.ledgerFilter === 'all');
        var btns = agentFilters.querySelectorAll('.filter-btn');
        for (var i = 0; i < btns.length; i++) {
            btns[i].classList.toggle('active', btns[i].getAttribute('data-agent') === state.ledgerFilter);
        }
    }

    document.querySelector('[data-agent="all"]').addEventListener('click', function() {
        state.ledgerFilter = 'all';
        state.selectedAgent = null;
        updateFilterButtons();
        renderCards();
        loadLedger();
    });

    // ----------------------------------------------------------------
    // Ledger table
    // ----------------------------------------------------------------

    function renderLedger(entries) {
        ledgerBody.innerHTML = '';
        for (var i = 0; i < entries.length; i++) {
            var e = entries[i];
            var tr = document.createElement('tr');
            var time = e.ts ? new Date(e.ts * 1000).toLocaleString('en-US', {
                month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                hour12: false
            }) : '-';
            var agentClass = 'agent-' + (e.service || '');
            var cost = typeof e.cost_usd === 'number' ? '$' + e.cost_usd.toFixed(6) : '-';
            var runId = e.run_id || '-';
            if (runId.length > 10) runId = runId.slice(-10);

            tr.innerHTML =
                '<td>' + time + '</td>' +
                '<td class="' + agentClass + '">' + (e.service || '-') + '</td>' +
                '<td>' + (e.model || '-') + '</td>' +
                '<td>' + (e.input_tokens || 0) + '</td>' +
                '<td>' + (e.output_tokens || 0) + '</td>' +
                '<td class="cost">' + cost + '</td>' +
                '<td title="' + (e.run_id || '') + '">' + runId + '</td>';
            ledgerBody.appendChild(tr);
        }
    }

    // ----------------------------------------------------------------
    // Stats bar
    // ----------------------------------------------------------------

    function updateStats() {
        var names = Object.keys(state.agents);
        var totalCalls = 0;
        var totalCost = 0;
        var freeCount = 0;

        names.forEach(function(n) {
            totalCalls += state.agents[n].calls || 0;
            totalCost += state.agents[n].spend.period || 0;
            if (state.agents[n].free) freeCount++;
        });

        statsAgents.textContent = 'Agents: ' + names.length + ' (' + freeCount + ' free)';
        statsCalls.textContent = 'Calls: ' + totalCalls;
        statsCost.textContent = 'Cost: $' + totalCost.toFixed(6);
        statsPeriod.textContent = 'Period: ' + state.period;
    }

    // ----------------------------------------------------------------
    // Budget save
    // ----------------------------------------------------------------

    function saveBudget(agentName, daily, total) {
        fetch(API + '/agents/' + agentName + '/budget', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ daily_usd: parseFloat(daily), total_usd: parseFloat(total) })
        })
        .then(function(r) { return r.json(); })
        .then(function(data) { if (data.ok) loadAll(); })
        .catch(function() {});
    }

    // ----------------------------------------------------------------
    // Create agent — cascading: type -> provider -> model
    // ----------------------------------------------------------------

    createBtn.addEventListener('click', function() {
        createOverlay.classList.add('visible');
        updateCreateProviders();
    });

    crCancel.addEventListener('click', function() {
        createOverlay.classList.remove('visible');
    });

    createOverlay.addEventListener('click', function(e) {
        if (e.target === createOverlay) createOverlay.classList.remove('visible');
    });

    crType.addEventListener('change', function() {
        updateCreateProviders();
        autoName();
    });

    crProvider.addEventListener('change', function() {
        updateCreateModels();
        autoName();
        // If tetra provider, set budget to 0
        if (crProvider.value === 'tetra') {
            crDaily.value = '0';
            crTotal.value = '0';
        } else {
            if (crDaily.value === '0') crDaily.value = '5.0';
            if (crTotal.value === '0') crTotal.value = '100.0';
        }
    });

    crModel.addEventListener('change', autoName);

    function updateCreateProviders() {
        var selectedType = crType.value;
        crProvider.innerHTML = '';
        var providers = state.providers || {};
        Object.keys(providers).forEach(function(p) {
            var pdata = providers[p];
            if (pdata.types && pdata.types.indexOf(selectedType) !== -1) {
                var opt = document.createElement('option');
                opt.value = p;
                opt.textContent = p;
                crProvider.appendChild(opt);
            }
        });
        updateCreateModels();
    }

    function updateCreateModels() {
        var selectedType = crType.value;
        var selectedProvider = crProvider.value;
        crModel.innerHTML = '';
        var providers = state.providers || {};
        var pdata = providers[selectedProvider];
        if (pdata && pdata.models && pdata.models[selectedType]) {
            pdata.models[selectedType].forEach(function(m) {
                var opt = document.createElement('option');
                opt.value = m;
                opt.textContent = m;
                crModel.appendChild(opt);
            });
        }
    }

    function autoName() {
        // Suggest name: type-provider-model e.g. qa-openai-gpt4o
        var t = crType.value;
        var p = crProvider.value;
        var m = (crModel.value || '').replace(/[^a-z0-9]/gi, '').slice(0, 12);
        if (t && p && m) {
            crName.placeholder = t + '-' + p + '-' + m;
        }
    }

    crSubmit.addEventListener('click', function() {
        var name = crName.value.trim() || crName.placeholder;
        var agentType = crType.value;
        var provider = crProvider.value;
        var model = crModel.value;

        if (!name || !provider || !model) return;

        crSubmit.textContent = 'creating...';
        crSubmit.disabled = true;

        fetch(API + '/agents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                type: agentType,
                provider: provider,
                model: model,
                daily_usd: parseFloat(crDaily.value),
                total_usd: parseFloat(crTotal.value),
                tags: crTags.value
            })
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            crSubmit.textContent = 'Create';
            crSubmit.disabled = false;
            if (data.ok) {
                createOverlay.classList.remove('visible');
                crName.value = '';
                crTags.value = '';
                loadAll();
            }
        })
        .catch(function() {
            crSubmit.textContent = 'Create';
            crSubmit.disabled = false;
        });
    });

    // ----------------------------------------------------------------
    // Events
    // ----------------------------------------------------------------

    typeFilter.addEventListener('change', loadAll);
    periodSelect.addEventListener('change', loadAll);
    refreshBtn.addEventListener('click', loadAll);

    // ----------------------------------------------------------------
    // Init
    // ----------------------------------------------------------------

    Terrain.Iframe.init({
        name: 'agents',
        onReady: function() {
            loadProviders();
            loadAll();
        }
    });

    window.addEventListener('message', function(e) {
        var msg = e.data;
        if (!msg || typeof msg !== 'object') return;
        if (msg.type === 'env-change') loadAll();
    });

})();
