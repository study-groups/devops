/**
 * @file client/panels/core/panelRegistry.js
 * @description A central registry for all UI panels in the application.
 * This module provides a single place to register, unregister, and retrieve panels.
 * It ensures that panels are managed consistently across the application.
 * @exports panelRegistry
 */

import { panelOrder } from '/client/settings/core/panelOrder.js';
import eventBus from '/client/eventBus.js';

const panels = [];

class PanelRegistry {
    register(config) {
        if (panels.some(panel => panel.id === config.id)) {
            console.warn(`Panel with id "${config.id}" is already registered.`);
            return;
        }
        panels.push(config);
        eventBus.emit('panel-registry-changed');
    }

    unregister(id) {
        const index = panels.findIndex(panel => panel.id === id);
        if (index > -1) {
            panels.splice(index, 1);
            eventBus.emit('panel-registry-changed');
        }
    }

    getPanel(id) {
        return panels.find(panel => panel.id === id);
    }

    getAllPanels() {
        return [...panels].sort((a, b) => {
            const indexA = panelOrder.indexOf(a.id);
            const indexB = panelOrder.indexOf(b.id);

            if (indexA !== -1 && indexB !== -1) {
                return indexA - indexB;
            }
            if (indexA !== -1) {
                return -1;
            }
            if (indexB !== -1) {
                return 1;
            }
            return 0;
        });
    }
}

export const panelRegistry = new PanelRegistry(); 