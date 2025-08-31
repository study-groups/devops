// pdata/CapabilityManager.js
import fs from 'fs-extra';
import path from 'path';

class CapabilityManager {
    constructor(config = {}) {
        this.dataRoot = config.dataRoot;
        if (!this.dataRoot) {
            throw new Error('[CapabilityManager] dataRoot is required.');
        }

        this.rolesFilePath = path.join(this.dataRoot, 'roles.csv');
        this.capabilitiesFilePath = path.join(this.dataRoot, 'capabilities.csv');
        this.assetsFilePath = path.join(this.dataRoot, 'assets.csv');

        this.roles = new Map();
        this.capabilities = new Map();
        this.assetSets = new Map();

        this._loadData();
    }

    _loadData() {
        this.roles = this._loadCsvFile(this.rolesFilePath, 2, (parts, map) => {
            const role = parts[0].trim();
            if (!role) return;
            const caps = parts.slice(1).join(',').split(';').map(c => c.trim()).filter(Boolean);
            map.set(role, caps);
        }, "RolesCaps", true, false);

        this.capabilities = this._loadCsvFile(this.capabilitiesFilePath, 2, (parts, map) => {
            const [capability, expression, description = ''] = parts.map(p => p.trim());
            if (capability && expression) {
                map.set(capability, { expression, description });
            }
        }, "Capabilities", true, false);

        this.assetSets = this._loadCsvFile(this.assetsFilePath, 2, (parts, map) => {
            const setName = parts[0].trim();
            if (!setName) return;
            const paths = parts.slice(1).join(',').split(',').map(p => p.trim()).filter(Boolean);
            map.set(setName, paths);
        }, "Asset Sets", true, false);
    }

    _loadCsvFile(filePath, expectedParts, processLine, label, isOptional = false, exactMatch = true) {
        const map = new Map();
        if (!fs.existsSync(filePath)) {
            if (isOptional) return map;
            fs.writeFileSync(filePath, ''); // Touch file
            return map;
        }
        if (!fs.statSync(filePath).isFile()) throw new Error(`[CapabilityManager] ${label} is not a file.`);
        
        const content = fs.readFileSync(filePath, 'utf8');
        content.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed) {
                const parts = trimmed.split(',');
                if (exactMatch ? parts.length === expectedParts : parts.length >= expectedParts) {
                    processLine(parts, map);
                } else {
                    console.warn(`[CapabilityManager] Skipping line in ${label}: incorrect number of parts. Expected at least ${expectedParts}, got ${parts.length}. Line: "${line}"`);
                }
            }
        });
        return map;
    }

    expandRolesToCapabilities(userRoles = []) {
        const finalCapabilities = new Set();

        for (const roleName of userRoles) {
            const roleCaps = this.roles.get(roleName) || [];
            for (const capIdentifier of roleCaps) {
                if (this.capabilities.has(capIdentifier)) {
                    const capDef = this.capabilities.get(capIdentifier);
                    const expressions = capDef.expression.split(';').map(e => e.trim()).filter(Boolean);
                    expressions.forEach(exp => finalCapabilities.add(exp));
                } else {
                    finalCapabilities.add(capIdentifier);
                }
            }
        }
        
        return Array.from(finalCapabilities);
    }
}

export { CapabilityManager };
