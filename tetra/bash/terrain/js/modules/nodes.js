/**
 * Terrain Nodes Module
 * Node rendering, state management, and interaction
 * Built on CardBase for shared card functionality
 *
 * Node Types:
 * - frame: Full node with iframe, CLI, interactivity
 * - info: Static content display, no iframe
 * - link: Minimal, just title and external link
 */
(function() {
    'use strict';

    const Utils = window.Terrain.Utils;

    // Node type definitions
    const NODE_TYPES = {
        frame: {
            name: 'Frame',
            hasIframe: true,
            hasCli: true,
            hasEdit: true,
            minWidth: 280,
            expandedWidth: 520
        },
        info: {
            name: 'Info',
            hasIframe: false,
            hasCli: false,
            hasEdit: true,
            minWidth: 240,
            expandedWidth: null
        },
        link: {
            name: 'Link',
            hasIframe: false,
            hasCli: false,
            hasEdit: false,
            minWidth: 200,
            expandedWidth: null
        }
    };

    /**
     * Get node type definition
     */
    function getNodeType(typeName) {
        return NODE_TYPES[typeName] || NODE_TYPES.frame;
    }

    /**
     * Render node HTML based on type
     */
    function renderNodeHTML(node, index) {
        const type = getNodeType(node.type || 'frame');
        const escape = Utils.escapeHtml.bind(Utils);

        // Header - always present
        let html = `
            <div class="node-header">
                <div class="node-title">${escape(node.title)}</div>
                <div class="node-header-actions">`;

        // CLI toggle only for frame nodes
        if (type.hasCli) {
            html += `<button class="node-cli-toggle" data-action="toggle-cli" data-index="${index}">⌘</button>`;
        }

        // Close button for expandable nodes
        if (type.hasIframe) {
            html += `<button class="node-close-btn" data-action="close" data-index="${index}">×</button>`;
        }

        // External link for link nodes
        if (node.type === 'link' && node.link) {
            html += `<a class="node-link-btn" href="${escape(node.link)}" target="_blank">→</a>`;
        }

        html += `</div></div>`;

        // View section - shown in small mode
        html += `<div class="node-view">`;

        if (node.desc) {
            html += `<div class="node-desc">${escape(node.desc)}</div>`;
        }

        // Footer with actions
        if (type.hasIframe || type.hasEdit) {
            html += `<div class="node-footer">`;
            if (type.hasIframe) {
                html += `<button class="node-open-btn" data-action="open" data-index="${index}">OPEN</button>`;
            }
            if (type.hasEdit) {
                html += `<button class="node-edit-trigger" data-action="edit" data-index="${index}">Edit</button>`;
            }
            html += `</div>`;
        }

        html += `</div>`;

        // Open section - for frame nodes
        if (type.hasIframe) {
            html += `<div class="node-open"></div>`;
        }

        // Edit section
        if (type.hasEdit) {
            html += renderEditHTML(node, index);
        }

        return html;
    }

    /**
     * Render edit form HTML
     */
    function renderEditHTML(node, index) {
        const escape = Utils.escapeHtml.bind(Utils);

        return `
            <div class="node-edit">
                <label>Title</label>
                <input type="text" class="edit-title" value="${escape(node.title)}">

                <label>Description</label>
                <input type="text" class="edit-desc" value="${escape(node.desc || '')}">

                <label>Link</label>
                <input type="text" class="edit-link" value="${escape(node.link || '')}">

                <label>Type</label>
                <select class="edit-type">
                    <option value="frame" ${node.type === 'frame' ? 'selected' : ''}>Frame</option>
                    <option value="info" ${node.type === 'info' ? 'selected' : ''}>Info</option>
                    <option value="link" ${node.type === 'link' ? 'selected' : ''}>Link</option>
                </select>

                <label>Token (enter to save)</label>
                <input type="password" class="edit-token token-input" placeholder="Enter token..." value="">
                <div class="token-error">Invalid token.</div>

                <div class="node-edit-actions">
                    <button class="cancel" data-action="cancel" data-index="${index}">Cancel</button>
                    <button class="save" data-action="save" data-index="${index}">Save</button>
                </div>
            </div>
        `;
    }

    /**
     * Handle node expansion
     */
    function onNodeExpand(card, container, index, node) {
        if (container && Terrain.CLI) {
            Terrain.CLI.render(container, index, node);
        }
    }

    // Create the nodes manager using CardBase
    const TerrainNodes = Terrain.CardBase.create({
        name: 'nodes',
        stateKey: 'nodes',
        cardClass: 'terrain-node',
        events: {
            select: 'NODE_SELECT',
            expand: 'NODE_EXPAND',
            collapse: 'NODE_COLLAPSE',
            move: 'NODE_MOVE',
            update: 'NODE_UPDATE',
            toggle: 'UI_TOGGLE'
        },
        renderCard: renderNodeHTML,
        onExpand: onNodeExpand,
        getMinWidth: function(node) {
            return getNodeType(node.type || 'frame').minWidth;
        },
        getExpandedWidth: function(node) {
            return getNodeType(node.type || 'frame').expandedWidth;
        }
    });

    // Add node-specific methods
    TerrainNodes.getNodeType = getNodeType;
    TerrainNodes.NODE_TYPES = NODE_TYPES;

    // Aliases for backwards compatibility
    TerrainNodes.renderAll = TerrainNodes.renderAll;
    TerrainNodes.createNode = TerrainNodes.createCard;
    TerrainNodes.selectNode = TerrainNodes.select;
    TerrainNodes.expandNode = TerrainNodes.expand;
    TerrainNodes.collapseNode = TerrainNodes.collapse;
    TerrainNodes.collapseAllNodes = TerrainNodes.collapseAll;
    TerrainNodes.editNode = TerrainNodes.edit;
    TerrainNodes.addNode = TerrainNodes.add;

    // Export
    window.Terrain = window.Terrain || {};
    window.Terrain.Nodes = TerrainNodes;

})();
