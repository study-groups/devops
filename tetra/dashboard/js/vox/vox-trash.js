/**
 * vox-trash.js - Trash panel for soft-deleted voxes
 */
window.Vox = window.Vox || {};

Vox.trashDom = {
    body: document.getElementById('trash-body'),
    statsBar: document.getElementById('trash-stats-bar'),
    refreshBtn: document.getElementById('trash-refresh-btn'),
    emptyBtn: document.getElementById('trash-empty-btn')
};

Vox.loadTrash = function() {
    var dom = Vox.trashDom;
    fetch(Vox.API + '/trash?limit=100').then(function(r) { return r.json(); }).then(function(data) {
        Vox.renderTrash(data.voxes || [], data.total || 0);
    }).catch(function() {
        Vox.renderTrash([], 0);
    });
};

Vox.renderTrash = function(voxes, total) {
    var dom = Vox.trashDom;
    dom.body.innerHTML = '';
    dom.statsBar.textContent = 'Trash: ' + total + ' item' + (total !== 1 ? 's' : '');

    for (var i = 0; i < voxes.length; i++) {
        var vox = voxes[i];
        var id = vox.id;
        var tr = document.createElement('tr');

        var time = vox.created ? new Date(vox.created).toLocaleTimeString('en-US', { hour12: false }) : '-';
        var dur = vox.duration ? vox.duration.toFixed(1) : '-';
        var voice = vox.voice || '-';
        if (voice.length > 12) voice = voice.substring(0, 11) + '..';
        var shortId = id ? id.slice(-6) : '-';

        tr.innerHTML =
            '<td></td>' +
            '<td>' + time + '</td>' +
            '<td>' + shortId + '</td>' +
            '<td>' + (vox.provider || '-') + '</td>' +
            '<td title="' + (vox.voice || '') + '">' + voice + '</td>' +
            '<td>' + dur + '</td>' +
            '<td>' +
                '<button class="toolbar-btn trash-restore-btn" data-id="' + id + '">Restore</button> ' +
                '<button class="toolbar-btn trash-delete-btn" data-id="' + id + '" style="color:var(--one);">Delete</button>' +
            '</td>';

        dom.body.appendChild(tr);
    }

    // Bind restore/delete buttons
    dom.body.querySelectorAll('.trash-restore-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var vid = btn.getAttribute('data-id');
            btn.textContent = '...';
            btn.disabled = true;
            fetch(Vox.API + '/trash/' + vid + '/restore', { method: 'POST' })
                .then(function(r) { return r.json(); })
                .then(function(result) {
                    if (result.ok) {
                        Vox.loadTrash();
                        Vox.loadDb(); // refresh main list
                    } else {
                        btn.textContent = 'Restore';
                        btn.disabled = false;
                    }
                })
                .catch(function() {
                    btn.textContent = 'Restore';
                    btn.disabled = false;
                });
        });
    });

    dom.body.querySelectorAll('.trash-delete-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var vid = btn.getAttribute('data-id');
            if (!confirm('Permanently delete vox ' + vid + '?')) return;
            btn.textContent = '...';
            btn.disabled = true;
            fetch(Vox.API + '/trash/' + vid, { method: 'DELETE' })
                .then(function(r) { return r.json(); })
                .then(function(result) {
                    if (result.ok) Vox.loadTrash();
                })
                .catch(function() {
                    btn.textContent = 'Delete';
                    btn.disabled = false;
                });
        });
    });
};

Vox.initTrash = function() {
    var dom = Vox.trashDom;

    if (dom.refreshBtn) {
        dom.refreshBtn.addEventListener('click', Vox.loadTrash);
    }

    if (dom.emptyBtn) {
        dom.emptyBtn.addEventListener('click', function() {
            if (!confirm('Permanently delete ALL items in trash?')) return;
            dom.emptyBtn.textContent = '...';
            dom.emptyBtn.disabled = true;
            fetch(Vox.API + '/trash', { method: 'DELETE' })
                .then(function(r) { return r.json(); })
                .then(function(result) {
                    dom.emptyBtn.textContent = 'Empty Trash';
                    dom.emptyBtn.disabled = false;
                    if (result.ok) Vox.loadTrash();
                })
                .catch(function() {
                    dom.emptyBtn.textContent = 'Empty Trash';
                    dom.emptyBtn.disabled = false;
                });
        });
    }
};

// Expose for tab switching
window.VoxTrash = { refresh: Vox.loadTrash };
