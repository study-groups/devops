window.addEventListener('DOMContentLoaded', () => {
    let iconPanel = document.getElementById('icons-panel');
    if (!iconPanel) {
        iconPanel = document.createElement('div');
        iconPanel.id = 'icons-panel';
        const container = document.getElementById('icons');
        if(container) {
            container.appendChild(iconPanel);
        }
    }

    async function loadIcons() {
        try {
            console.log('[ICONS] Attempting to load icons from /api/icons');
            const response = await fetch('/api/icons');
            console.log('[ICONS] Fetch response:', {
                status: response.status,
                statusText: response.statusText,
                url: response.url
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch icons. Status: ${response.status}`);
            }
            const iconFiles = await response.json();
            console.log('[ICONS] Loaded icons:', iconFiles);
            renderIcons(iconFiles);
        } catch (error) {
            console.error('Error loading icons:', error);
            iconPanel.innerHTML = `<p class="pja-text-muted">Could not load icons: ${error.message}</p>`;
        }
    }

    function renderIcons(iconFiles) {
        if (iconFiles.length === 0) {
            iconPanel.innerHTML = `<p class="pja-text-muted">No icons found.</p>`;
            return;
        }

        const iconGrid = document.createElement('div');
        iconGrid.className = 'devwatch-icon-grid';

        iconFiles.forEach(iconFile => {
            const iconWrapper = document.createElement('div');
            iconWrapper.className = 'devwatch-icon-wrapper';
            iconWrapper.title = iconFile;

            const img = document.createElement('img');
            img.src = `/static/icons/${iconFile}`;
            img.alt = iconFile;
            img.className = 'devwatch-icon';

            iconWrapper.appendChild(img);
            iconGrid.appendChild(iconWrapper);
        });

        iconPanel.innerHTML = '';
        iconPanel.appendChild(iconGrid);
    }

    const iconsTab = document.querySelector('[data-tab="icons"]');
    if (iconsTab && iconsTab.classList.contains('is-active')) {
        loadIcons();
    } else if (iconsTab) {
        const observer = new MutationObserver((mutationsList) => {
            for (const mutation of mutationsList) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    if (iconsTab.classList.contains('is-active')) {
                        loadIcons();
                    }
                }
            }
        });
        observer.observe(iconsTab, { attributes: true });
    }
});
