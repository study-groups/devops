/**
 * DevWatchRankedList - Manages a list of items with a persistent ranking system.
 *
 * @param {string} storageKey - The localStorage key to use for storing rankings.
 */
class DevWatchRankedList {
    constructor(storageKey) {
        this.storageKey = storageKey;
        this.ranks = this._loadRanks();
    }

    _loadRanks() {
        try {
            const storedRanks = localStorage.getItem(this.storageKey);
            return storedRanks ? JSON.parse(storedRanks) : {};
        } catch (error) {
            console.error('Failed to load ranks from localStorage:', error);
            return {};
        }
    }

    _saveRanks() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.ranks));
        } catch (error) {
            console.error('Failed to save ranks to localStorage:', error);
        }
    }

    getRank(itemId) {
        return this.ranks[itemId] || 0;
    }

    setRank(itemId, rank) {
        const newRank = Math.max(-3, Math.min(3, rank));
        this.ranks[itemId] = newRank;
        this._saveRanks();
    }

    increaseRank(itemId) {
        const currentRank = this.getRank(itemId);
        this.setRank(itemId, currentRank + 1);
    }

    decreaseRank(itemId) {
        const currentRank = this.getRank(itemId);
        this.setRank(itemId, currentRank - 1);
    }

    getSortedList(items) {
        return [...items].sort((a, b) => {
            const rankA = this.getRank(a);
            const rankB = this.getRank(b);
            if (rankA !== rankB) {
                return rankB - rankA; // Higher rank first
            }
            return a.localeCompare(b); // Alphabetical secondary sort
        });
    }
}
