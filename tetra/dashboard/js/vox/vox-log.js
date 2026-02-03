/**
 * vox-log.js - Vox log listing, filters, stats
 */
window.Vox = window.Vox || {};

Vox.updateStorageLine = function() {
    var state = Vox.state;
    var dom = Vox.dom;
    dom.storageLine.textContent = 'Storage: ' + state.dbPath + ' (' + state.count + ' voxes)';
};

Vox.loadDb = function() {
    var state = Vox.state;
    fetch(Vox.API + '/db?limit=50').then(function(r) { return r.json(); }).then(function(data) {
        state.count = data.total || 0;
        if (data.dbPath) state.dbPath = data.dbPath;
        Vox.updateStorageLine();
        Vox.renderVoxes(data.voxes || []);
    }).catch(function() {});

    fetch(Vox.API + '/tasks/stats').then(function(r) { return r.json(); }).then(function(data) {
        Vox.renderStats(data);
    }).catch(function() {});
};

Vox.renderVoxes = function(voxes) {
    var state = Vox.state;
    var dom = Vox.dom;
    dom.logBody.innerHTML = '';

    // Apply filter
    var filtered = voxes;
    if (state.filter === 'error') {
        Vox.loadErrorTasks();
        return;
    }

    for (var i = 0; i < filtered.length; i++) {
        var vox = filtered[i];
        var id = vox.id || vox.doc_id || vox.fragmentId;
        var hasAudio = !!(id && vox.voices && vox.voices.length > 0) || !!(id && vox.storagePath) || !!(id && vox.duration);

        // Data row
        var tr = document.createElement('tr');
        if (id) tr.setAttribute('data-vox-id', id);
        if (id === state.expandedId) tr.classList.add('expanded');

        var time = vox.created ? new Date(vox.created).toLocaleTimeString('en-US', { hour12: false }) : '-';
        var dur = vox.duration ? vox.duration.toFixed(1) : '-';
        var rtf = vox.rtf ? vox.rtf.toFixed(1) : '-';
        var cost = vox.cost ? '$' + vox.cost.toFixed(4) : '$0';
        var voice = vox.voice || (vox.voices && vox.voices[0]) || '-';
        if (voice.length > 12) voice = voice.substring(0, 11) + '..';
        var shortId = id ? id.slice(-6) : '-';

        var chevron = id ? (id === state.expandedId ? '\u25bc' : '\u25b6') : '';
        var firstCell;
        if (id && hasAudio) {
            firstCell = '<td class="dual-btn-cell">' +
                '<button class="play-btn row-play" data-play-id="' + id + '" title="Play audio">&#9654;</button>' +
                '<button class="chevron-btn" data-fid="' + id + '">' + chevron + '</button></td>';
        } else if (id) {
            firstCell = '<td class="dual-btn-cell">' +
                '<button class="play-btn ghost" title="No audio">&#9654;</button>' +
                '<button class="chevron-btn" data-fid="' + id + '">' + chevron + '</button></td>';
        } else {
            firstCell = '<td class="dual-btn-cell"><button class="play-btn ghost" title="No audio">&#9654;</button></td>';
        }

        tr.innerHTML =
            firstCell +
            '<td>' + time + '</td>' +
            '<td>' + shortId + '</td>' +
            '<td>' + (vox.provider || '-') + '</td>' +
            '<td title="' + (vox.voice || '') + '">' + voice + '</td>' +
            '<td>' + dur + '</td>' +
            '<td>' + rtf + '</td>' +
            '<td>' + cost + '</td>';

        dom.logBody.appendChild(tr);

        // Expand row (hidden by default)
        if (id) {
            var expandTr = document.createElement('tr');
            expandTr.className = 'expand-row';
            if (id === state.expandedId) expandTr.classList.add('open');
            expandTr.setAttribute('data-expand-id', id);
            expandTr.innerHTML = '<td colspan="8"></td>';
            dom.logBody.appendChild(expandTr);

            // Bind click
            (function(vid, dataRow, expRow) {
                dataRow.addEventListener('click', function(e) {
                    if (e.target.classList.contains('play-btn') || e.target.classList.contains('row-play')) return;
                    Vox.toggleExpand(vid, dataRow, expRow);
                });
                // Bind row play button
                var rowPlayBtn = dataRow.querySelector('.row-play');
                if (rowPlayBtn) {
                    rowPlayBtn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        dom.sharedAudio.src = Vox.API + '/db/' + vid + '/audio';
                        dom.sharedAudio.play();
                    });
                }
            })(id, tr, expandTr);

            // If this was the expanded one, re-populate from cache
            if (id === state.expandedId && state.cache[id]) {
                Vox.populateExpandRow(expandTr, state.cache[id]);
            }
        }
    }
};

Vox.loadErrorTasks = function() {
    var dom = Vox.dom;
    fetch(Vox.API + '/tasks?limit=100&event=vox_generate').then(function(r) { return r.json(); }).then(function(data) {
        var errors = (data.tasks || []).filter(function(t) { return t.status === 'error'; });
        dom.logBody.innerHTML = '';
        for (var i = errors.length - 1; i >= 0; i--) {
            var t = errors[i];
            var tr = document.createElement('tr');
            var time = t.ts ? new Date(t.ts).toLocaleTimeString('en-US', { hour12: false }) : '-';
            tr.innerHTML =
                '<td></td>' +
                '<td>' + time + '</td>' +
                '<td class="error">err</td>' +
                '<td>' + (t.provider || '-') + '</td>' +
                '<td>' + (t.voice || '-') + '</td>' +
                '<td>-</td>' +
                '<td>-</td>' +
                '<td>-</td>';
            dom.logBody.appendChild(tr);
        }
    }).catch(function() {});
};

Vox.renderStats = function(data) {
    var dom = Vox.dom;
    var mins = Math.floor(data.totalDuration / 60);
    var secs = Math.floor(data.totalDuration % 60);
    var durStr = mins + 'm ' + (secs < 10 ? '0' : '') + secs + 's';
    dom.statsBar.textContent = 'Total: ' + data.count +
        '  Audio: ' + durStr +
        '  Avg RTF: ' + data.avgRtf +
        '  Cost: $' + data.totalCost.toFixed(4);
};

Vox.initFilters = function() {
    var state = Vox.state;
    var dom = Vox.dom;

    dom.filterBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
            dom.filterBtns.forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            state.filter = btn.dataset.filter || null;
            Vox.loadDb();
        });
    });

    dom.autoRefreshCb.addEventListener('change', function() {
        if (dom.autoRefreshCb.checked) {
            state.refreshInterval = setInterval(Vox.loadDb, 5000);
        } else {
            clearInterval(state.refreshInterval);
            state.refreshInterval = null;
        }
    });
};
