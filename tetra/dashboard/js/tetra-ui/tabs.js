/**
 * TetraUI Tabs - Tab navigation component
 *
 * Usage:
 *   TetraUI.Tabs.create(container, tabs, opts)
 *   TetraUI.Tabs.activate(tabsEl, tabId)
 */

window.TetraUI = window.TetraUI || {};

TetraUI.Tabs = {
    /**
     * Create tabs
     * @param {HTMLElement|string} container
     * @param {Array} tabs - [{id, label, content?}]
     * @param {Object} opts - {variant, onChange}
     */
    create: function(container, tabs, opts) {
        var el = typeof container === 'string'
            ? document.querySelector(container)
            : container;
        if (!el) return null;

        opts = opts || {};
        var variant = opts.variant || 'default';
        var onChange = opts.onChange || function() {};
        var activeId = opts.active || (tabs[0] && tabs[0].id);

        var tabsCls = 'tetra-tabs';
        if (variant === 'pill') tabsCls += ' tabs--pill';
        if (variant === 'equal') tabsCls += ' tabs--equal';

        var html = '<div class="' + tabsCls + '">';
        for (var i = 0; i < tabs.length; i++) {
            var t = tabs[i];
            var active = t.id === activeId ? ' active' : '';
            html += '<div class="tetra-tab' + active + '" data-tab="' + t.id + '">' +
                TetraUI.dom.esc(t.label) + '</div>';
        }
        html += '</div>';

        // Add content panels if provided
        for (var j = 0; j < tabs.length; j++) {
            var tab = tabs[j];
            if (tab.content !== undefined) {
                var activePanel = tab.id === activeId ? ' active' : '';
                html += '<div class="tab-content' + activePanel + '" id="tab-' + tab.id + '">' +
                    tab.content + '</div>';
            }
        }

        el.innerHTML = html;

        // Wire up click handlers
        var tabEls = el.querySelectorAll('.tetra-tab');
        tabEls.forEach(function(tabEl) {
            tabEl.addEventListener('click', function() {
                var tabId = tabEl.dataset.tab;
                TetraUI.Tabs.activate(el, tabId);
                onChange(tabId);
            });
        });

        return {
            container: el,
            activate: function(tabId) {
                TetraUI.Tabs.activate(el, tabId);
            },
            getActive: function() {
                var active = el.querySelector('.tetra-tab.active');
                return active ? active.dataset.tab : null;
            }
        };
    },

    /**
     * Activate a tab
     * @param {HTMLElement} container
     * @param {string} tabId
     */
    activate: function(container, tabId) {
        var tabs = container.querySelectorAll('.tetra-tab');
        tabs.forEach(function(t) {
            if (t.dataset.tab === tabId) {
                t.classList.add('active');
            } else {
                t.classList.remove('active');
            }
        });

        var panels = container.querySelectorAll('.tab-content');
        panels.forEach(function(p) {
            if (p.id === 'tab-' + tabId) {
                p.classList.add('active');
            } else {
                p.classList.remove('active');
            }
        });
    }
};
