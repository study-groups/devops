// =============================================================================
// TUT MINDMAP COMPONENT - Simple class toggle version
// =============================================================================

(function(global) {
    'use strict';

    function toggleSpoke(element) {
        const container = element.closest('.mindmap-container');
        if (!container) return;

        // Close other expanded spokes
        container.querySelectorAll('.mindmap-spoke.expanded').forEach(spoke => {
            if (spoke !== element) {
                spoke.classList.remove('expanded');
            }
        });

        // Toggle this spoke
        element.classList.toggle('expanded');
    }

    function collapseAll(container) {
        if (!container) return;
        container.querySelectorAll('.mindmap-spoke.expanded').forEach(spoke => {
            spoke.classList.remove('expanded');
        });
    }

    function init() {
        document.querySelectorAll('.mindmap-spoke').forEach(spoke => {
            spoke.addEventListener('click', function(e) {
                e.stopPropagation();
                toggleSpoke(this);
            });
        });

        // Click outside to collapse
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.mindmap')) {
                document.querySelectorAll('.mindmap-spoke.expanded').forEach(spoke => {
                    spoke.classList.remove('expanded');
                });
            }
        });
    }

    // Auto-init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Export
    global.TUTMindmap = {
        init,
        toggleSpoke,
        collapseAll
    };

})(window);
