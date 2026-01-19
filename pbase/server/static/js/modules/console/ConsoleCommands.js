/**
 * ConsoleCommands.js - PJA-SDK Command Registry
 * Defines all available commands, categories, and tab completion
 */

// Command categories with visual styling
export const CATEGORIES = {
    game: {
        label: 'GAME',
        color: '#4fc3f7',
        description: 'Game state control'
    },
    rt: {
        label: 'RT',
        color: '#81c784',
        description: 'Realtime iframe messaging'
    },
    mp: {
        label: 'MP',
        color: '#ffb74d',
        description: 'Multiplayer protocol'
    },
    deck: {
        label: 'DECK',
        color: '#ba68c8',
        description: 'ControlDeck integration'
    },
    theme: {
        label: 'THEME',
        color: '#f06292',
        description: 'CSS theming'
    },
    frame: {
        label: 'FRAME',
        color: '#90a4ae',
        description: 'Iframe control'
    },
    util: {
        label: 'UTIL',
        color: '#a1887f',
        description: 'Utilities'
    }
};

// PJA.Game commands
export const GAME_COMMANDS = {
    start: {
        description: 'Start the game',
        usage: 'start',
        category: 'game'
    },
    stop: {
        description: 'Stop and reset game',
        usage: 'stop',
        category: 'game'
    },
    pause: {
        description: 'Pause active game',
        usage: 'pause',
        category: 'game'
    },
    resume: {
        description: 'Resume from pause',
        usage: 'resume',
        category: 'game'
    },
    toggle: {
        description: 'Toggle pause state',
        usage: 'toggle',
        category: 'game'
    },
    state: {
        description: 'Show current game state',
        usage: 'state',
        category: 'game'
    },
    paddle: {
        description: 'Set paddle position (player 0-1, value 0-1)',
        usage: 'paddle <player> <value>',
        args: ['player', 'value'],
        category: 'game'
    },
    score: {
        description: 'Set player score',
        usage: 'score <player> <points>',
        args: ['player', 'points'],
        category: 'game'
    },
    addscore: {
        description: 'Add to player score',
        usage: 'addscore <player> <points>',
        args: ['player', 'points'],
        category: 'game'
    },
    end: {
        description: 'End game with optional winner',
        usage: 'end [winner]',
        args: ['winner?'],
        category: 'game'
    }
};

// PJA.RT commands
export const RT_COMMANDS = {
    send: {
        description: 'Send message to game',
        usage: 'send <type> [data]',
        args: ['type', 'data?'],
        category: 'rt'
    },
    log: {
        description: 'Log to console',
        usage: 'log <message>',
        args: ['message'],
        category: 'rt'
    },
    query: {
        description: 'Query game for info',
        usage: 'query <key>',
        args: ['key'],
        category: 'rt'
    },
    volume: {
        description: 'Set volume (0-1)',
        usage: 'volume <level>',
        args: ['level'],
        category: 'rt'
    },
    mute: {
        description: 'Toggle mute',
        usage: 'mute [on|off]',
        args: ['state?'],
        category: 'rt'
    }
};

// PJA.MP commands
export const MP_COMMANDS = {
    connect: {
        description: 'Connect to multiplayer server',
        usage: 'connect <url>',
        args: ['url'],
        category: 'mp'
    },
    disconnect: {
        description: 'Disconnect from server',
        usage: 'disconnect',
        category: 'mp'
    },
    join: {
        description: 'Join lobby',
        usage: 'join <name> [color]',
        args: ['name', 'color?'],
        category: 'mp'
    },
    leave: {
        description: 'Leave lobby',
        usage: 'leave',
        category: 'mp'
    },
    queue: {
        description: 'Join game queue',
        usage: 'queue <gameType>',
        args: ['gameType'],
        category: 'mp'
    },
    stats: {
        description: 'Get server stats',
        usage: 'stats',
        category: 'mp'
    },
    osc: {
        description: 'Send OSC message',
        usage: 'osc <address> [args...]',
        args: ['address', 'args...'],
        category: 'mp'
    }
};

// PJA.Deck commands
export const DECK_COMMANDS = {
    deck: {
        description: 'Initialize ControlDeck',
        usage: 'deck [channel]',
        args: ['channel?'],
        category: 'deck'
    },
    axis: {
        description: 'Get axis value',
        usage: 'axis <name>',
        args: ['name'],
        completions: ['left-x', 'left-y', 'right-x', 'right-y'],
        category: 'deck'
    },
    button: {
        description: 'Check button state',
        usage: 'button <name>',
        args: ['name'],
        completions: ['A', 'B', 'X', 'Y', 'L1', 'R1', 'L2', 'R2', 'START', 'SELECT'],
        category: 'deck'
    },
    deckstate: {
        description: 'Send state to ControlDeck AI',
        usage: 'deckstate <json>',
        args: ['json'],
        category: 'deck'
    }
};

// PJA.Theme commands
export const THEME_COMMANDS = {
    'theme.get': {
        description: 'Get CSS variable',
        usage: 'theme.get <name>',
        args: ['name'],
        completions: ['--bg', '--fg', '--accent', '--one', '--two', '--three', '--four'],
        category: 'theme'
    },
    'theme.set': {
        description: 'Set CSS variable',
        usage: 'theme.set <name> <value>',
        args: ['name', 'value'],
        category: 'theme'
    },
    'theme.reset': {
        description: 'Reset to default theme',
        usage: 'theme.reset',
        category: 'theme'
    },
    'theme.all': {
        description: 'Show all theme tokens',
        usage: 'theme.all',
        category: 'theme'
    },
    'theme.apply': {
        description: 'Apply TUT theme object',
        usage: 'theme.apply <json>',
        args: ['json'],
        category: 'theme'
    }
};

// Frame/iframe commands
export const FRAME_COMMANDS = {
    load: {
        description: 'Load game in iframe',
        usage: 'load <url|slug>',
        args: ['url'],
        category: 'frame'
    },
    reload: {
        description: 'Reload current game',
        usage: 'reload',
        category: 'frame'
    },
    unload: {
        description: 'Unload game iframe',
        usage: 'unload',
        category: 'frame'
    },
    inspect: {
        description: 'Toggle inspector mode',
        usage: 'inspect',
        category: 'frame'
    },
    postmessage: {
        description: 'Send postMessage to iframe',
        usage: 'postmessage <type> [data]',
        args: ['type', 'data?'],
        category: 'frame'
    }
};

// Utility commands
export const UTIL_COMMANDS = {
    help: {
        description: 'Show help',
        usage: 'help [command]',
        args: ['command?'],
        category: 'util'
    },
    clear: {
        description: 'Clear console',
        usage: 'clear',
        category: 'util'
    },
    history: {
        description: 'Show command history',
        usage: 'history',
        category: 'util'
    },
    echo: {
        description: 'Echo message',
        usage: 'echo <message>',
        args: ['message'],
        category: 'util'
    },
    json: {
        description: 'Pretty print JSON',
        usage: 'json <data>',
        args: ['data'],
        category: 'util'
    },
    eval: {
        description: 'Evaluate JavaScript',
        usage: 'eval <expression>',
        args: ['expression'],
        category: 'util'
    }
};

// All commands merged
export const ALL_COMMANDS = {
    ...GAME_COMMANDS,
    ...RT_COMMANDS,
    ...MP_COMMANDS,
    ...DECK_COMMANDS,
    ...THEME_COMMANDS,
    ...FRAME_COMMANDS,
    ...UTIL_COMMANDS
};

/**
 * Get commands by category
 * @param {string} category - Category name
 * @returns {Object} Commands in that category
 */
export function getCommandsByCategory(category) {
    const result = {};
    for (const [name, cmd] of Object.entries(ALL_COMMANDS)) {
        if (cmd.category === category) {
            result[name] = cmd;
        }
    }
    return result;
}

/**
 * Get all command names
 * @returns {string[]} Array of command names
 */
export function getCommandNames() {
    return Object.keys(ALL_COMMANDS);
}

/**
 * Get completions for a partial command
 * @param {string} partial - Partial command input
 * @returns {Array<{text: string, description: string, category: string}>}
 */
export function getCompletions(partial) {
    const parts = partial.trim().split(/\s+/);
    const cmd = parts[0]?.toLowerCase() || '';

    // Empty or first word - complete command names
    if (parts.length <= 1) {
        if (!cmd) {
            // Show categories
            return Object.entries(CATEGORIES).map(([key, cat]) => ({
                text: key,
                description: cat.description,
                category: key,
                isCategory: true
            }));
        }

        // Filter commands by prefix
        return Object.entries(ALL_COMMANDS)
            .filter(([name]) => name.startsWith(cmd))
            .map(([name, def]) => ({
                text: name,
                description: def.description,
                category: def.category
            }));
    }

    // Completing arguments
    const cmdDef = ALL_COMMANDS[cmd];
    if (!cmdDef) return [];

    // Check if command has predefined completions
    if (cmdDef.completions) {
        const argIndex = parts.length - 2;
        const currentArg = parts[parts.length - 1] || '';

        return cmdDef.completions
            .filter(c => c.toLowerCase().startsWith(currentArg.toLowerCase()))
            .map(c => ({
                text: c,
                description: `${cmd} argument`,
                category: cmdDef.category
            }));
    }

    return [];
}

/**
 * Get help text for a command
 * @param {string} cmd - Command name
 * @returns {string} Help text
 */
export function getHelp(cmd) {
    if (!cmd) {
        // General help - list categories
        let text = 'PBase Console - PJA-SDK Testing Interface\n\n';
        text += 'Categories:\n';
        for (const [key, cat] of Object.entries(CATEGORIES)) {
            text += `  ${cat.label.padEnd(8)} - ${cat.description}\n`;
        }
        text += '\nType a category name to see commands, or "help <command>" for details.';
        return text;
    }

    // Check if it's a category
    if (CATEGORIES[cmd]) {
        const commands = getCommandsByCategory(cmd);
        let text = `${CATEGORIES[cmd].label} Commands:\n\n`;
        for (const [name, def] of Object.entries(commands)) {
            text += `  ${name.padEnd(14)} - ${def.description}\n`;
        }
        return text;
    }

    // Command help
    const def = ALL_COMMANDS[cmd];
    if (!def) {
        return `Unknown command: ${cmd}`;
    }

    let text = `${cmd} - ${def.description}\n\n`;
    text += `Usage: ${def.usage}\n`;
    if (def.args) {
        text += `Arguments: ${def.args.join(', ')}\n`;
    }
    if (def.completions) {
        text += `Options: ${def.completions.join(', ')}\n`;
    }
    return text;
}
