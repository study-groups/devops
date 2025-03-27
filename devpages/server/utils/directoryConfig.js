const fs = require('fs').promises;
const path = require('path');

async function parseIndexFile(content) {
    const sections = {};
    let currentSection = null;
    
    // Split into lines and process each
    const lines = content.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        
        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('//')) continue;
        
        // Check for section header
        if (trimmed.startsWith('# ')) {
            currentSection = trimmed.substring(2).toLowerCase();
            sections[currentSection] = [];
            continue;
        }
        
        // Process line based on current section
        if (currentSection && trimmed) {
            // Remove inline comments
            const parts = trimmed.split('#')[0].trim();
            if (parts) {
                if (trimmed.startsWith('- ')) {
                    // Exclude list item
                    sections[currentSection].push(parts.substring(2));
                } else if (/^\d+\./.test(trimmed)) {
                    // Numbered file entry
                    sections[currentSection].push({
                        name: parts.substring(parts.indexOf(' ') + 1),
                        rank: parseInt(parts)
                    });
                } else if (trimmed.includes(':')) {
                    // Option setting
                    const [key, value] = parts.split(':').map(s => s.trim());
                    sections[currentSection].push({ [key]: value });
                }
            }
        }
    }
    
    return sections;
}

async function getDirectoryConfig(directory) {
    try {
        const indexPath = path.join(directory, 'index.md');
        console.log('[CONFIG] Looking for index.md at:', indexPath);
        const content = await fs.readFile(indexPath, 'utf8');
        const sections = await parseIndexFile(content);
        
        // Convert sections to config object
        const config = {
            sort: 'alpha',
            showIndex: true,
            showRank: true,
            exclude: [],
            files: []
        };
        
        // Process options
        if (sections.options) {
            sections.options.forEach(opt => {
                const [key, value] = Object.entries(opt)[0];
                config[key] = value === 'true' ? true : 
                            value === 'false' ? false : 
                            value;
            });
        }
        
        // Process explicit file list
        if (sections.files) {
            config.files = sections.files;
        }
        
        // Process exclude list
        if (sections.exclude) {
            config.exclude = sections.exclude;
        }
        
        return config;
    } catch (error) {
        // Return default config if no index.md exists
        return {
            sort: 'alpha',
            showIndex: true,
            showRank: true,
            exclude: [],
            files: []
        };
    }
}

function rankFiles(files, config) {
    // Start with explicitly ordered files
    const ranked = config.files.map((file, idx) => ({
        name: file.name,
        rank: file.rank || (idx + 1)
    }));
    
    // Get remaining files
    const remaining = files.filter(f => 
        !ranked.find(r => r.name === f) &&
        !config.exclude.some(pattern => 
            new RegExp('^' + pattern.replace(/\*/g, '.*') + '$').test(f)
        )
    );
    
    // Sort remaining files
    if (config.sort === 'date') {
        remaining.sort((a, b) => fs.statSync(a).mtime - fs.statSync(b).mtime);
    } else if (config.sort === 'alpha' || !config.sort) {
        remaining.sort();
    }
    
    // Add remaining files to ranked list
    remaining.forEach((file, idx) => {
        ranked.push({
            name: file,
            rank: ranked.length + idx + 1
        });
    });
    
    return ranked;
}

module.exports = {
    getDirectoryConfig,
    rankFiles
}; 