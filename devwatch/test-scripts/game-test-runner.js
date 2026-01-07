#!/usr/bin/env node

/**
 * PJA Game API Test Runner
 * Comprehensive testing framework for game lifecycle, multiplayer, and performance
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// Test configuration
const CONFIG = {
    TICK_RATE: 30,
    DISPLAY_RATE: 60,
    MAX_PLAYERS: 4,
    DEFAULT_DURATION: 5000, // ms
    TIMEOUT: 30000 // ms
};

// Mock game states and types
const GamePhase = {
    IDLE: 'idle',
    WAITING: 'waiting',
    PLAYING: 'playing',
    GAME_OVER: 'game_over'
};

class MockPJAGame {
    constructor(config = {}) {
        this.config = {
            maxPlayers: config.maxPlayers || 4,
            tickRate: config.tickRate || 30,
            displayRate: config.displayRate || 60,
            gameMode: config.gameMode || 'multiplayer',
            ...config
        };
        
        this.state = {
            phase: GamePhase.IDLE,
            players: [],
            timestamp: Date.now(),
            frameCount: 0,
            tickCount: 0,
            config: this.config
        };
        
        this.metrics = {
            tickTimes: [],
            frameTimes: [],
            inputLatency: [],
            stateUpdates: 0
        };
        
        this.eventLog = [];
        this.tickInterval = null;
        this.frameInterval = null;
    }
    
    log(event, data = {}) {
        const logEntry = {
            timestamp: Date.now(),
            tick: this.state.tickCount,
            frame: this.state.frameCount,
            event,
            data
        };
        this.eventLog.push(logEntry);
        console.log(`[${logEntry.tick}:${logEntry.frame}] ${event}:`, data);
    }
    
    setState(newPhase) {
        const oldPhase = this.state.phase;
        this.state.phase = newPhase;
        this.state.timestamp = Date.now();
        this.metrics.stateUpdates++;
        
        this.log('STATE_TRANSITION', { from: oldPhase, to: newPhase });
        
        // Emit state change
        this.onStateChange(oldPhase, newPhase);
    }
    
    onStateChange(oldPhase, newPhase) {
        // Override in tests
    }
    
    addPlayer(playerId) {
        if (this.state.players.length >= this.config.maxPlayers) {
            throw new Error('Player limit exceeded');
        }
        
        const player = {
            id: playerId,
            position: { x: 0, y: 0 },
            velocity: { x: 0, y: 0 },
            score: 0,
            active: true,
            joinedAt: Date.now()
        };
        
        this.state.players.push(player);
        this.log('PLAYER_JOINED', { playerId, totalPlayers: this.state.players.length });
        
        if (this.state.phase === GamePhase.IDLE) {
            this.setState(GamePhase.WAITING);
        }
        
        return player;
    }
    
    processInput(inputFrame) {
        const startTime = performance.now();
        
        const player = this.state.players.find(p => p.id === inputFrame.playerId);
        if (!player) return;
        
        // Simulate input processing
        const movement = {
            x: (inputFrame.inputs.right - inputFrame.inputs.left) * 10,
            y: (inputFrame.inputs.down - inputFrame.inputs.up) * 10
        };
        
        player.position.x += movement.x;
        player.position.y += movement.y;
        
        const processingTime = performance.now() - startTime;
        this.metrics.inputLatency.push(processingTime);
        
        this.log('INPUT_PROCESSED', { 
            playerId: inputFrame.playerId, 
            movement, 
            processingTime: processingTime.toFixed(2) + 'ms' 
        });
    }
    
    startGame() {
        if (this.state.phase !== GamePhase.WAITING) {
            throw new Error('Cannot start game from current state: ' + this.state.phase);
        }
        
        this.setState(GamePhase.PLAYING);
        
        // Start tick loop (30Hz)
        this.tickInterval = setInterval(() => {
            const tickStart = performance.now();
            this.tick();
            const tickTime = performance.now() - tickStart;
            this.metrics.tickTimes.push(tickTime);
        }, 1000 / this.config.tickRate);
        
        // Start frame loop (60Hz)
        this.frameInterval = setInterval(() => {
            const frameStart = performance.now();
            this.render();
            const frameTime = performance.now() - frameStart;
            this.metrics.frameTimes.push(frameTime);
        }, 1000 / this.config.displayRate);
        
        this.log('GAME_STARTED');
    }
    
    tick() {
        this.state.tickCount++;
        
        // Simulate game logic
        if (Math.random() < 0.01) { // 1% chance per tick
            this.checkWinCondition();
        }
    }
    
    render() {
        this.state.frameCount++;
        // Simulate rendering
    }
    
    checkWinCondition() {
        if (this.state.players.some(p => p.score >= 10)) {
            this.endGame('score_reached');
        }
    }
    
    endGame(reason = 'natural') {
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }
        
        if (this.frameInterval) {
            clearInterval(this.frameInterval);
            this.frameInterval = null;
        }
        
        this.setState(GamePhase.GAME_OVER);
        this.log('GAME_ENDED', { reason, duration: Date.now() - this.state.timestamp });
    }
    
    reset() {
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }
        
        if (this.frameInterval) {
            clearInterval(this.frameInterval);
            this.frameInterval = null;
        }
        
        this.setState(GamePhase.IDLE);
        this.state.players = [];
        this.state.frameCount = 0;
        this.state.tickCount = 0;
        this.log('GAME_RESET');
    }
    
    getMetrics() {
        const avgTickTime = this.metrics.tickTimes.length > 0 
            ? this.metrics.tickTimes.reduce((a, b) => a + b, 0) / this.metrics.tickTimes.length 
            : 0;
            
        const avgFrameTime = this.metrics.frameTimes.length > 0
            ? this.metrics.frameTimes.reduce((a, b) => a + b, 0) / this.metrics.frameTimes.length
            : 0;
            
        const avgInputLatency = this.metrics.inputLatency.length > 0
            ? this.metrics.inputLatency.reduce((a, b) => a + b, 0) / this.metrics.inputLatency.length
            : 0;
        
        return {
            tickCount: this.state.tickCount,
            frameCount: this.state.frameCount,
            avgTickTime: parseFloat(avgTickTime.toFixed(2)),
            avgFrameTime: parseFloat(avgFrameTime.toFixed(2)),
            avgInputLatency: parseFloat(avgInputLatency.toFixed(2)),
            stateUpdates: this.metrics.stateUpdates,
            fps: this.state.frameCount > 0 ? (this.state.frameCount / (Date.now() - this.state.timestamp) * 1000) : 0
        };
    }
}

// Test implementations
class GameTester {
    constructor() {
        this.results = [];
    }
    
    async runTest(testName, testFn, timeout = CONFIG.TIMEOUT) {
        console.log(`\n=== Running Test: ${testName} ===`);
        
        const startTime = Date.now();
        
        try {
            const result = await Promise.race([
                testFn(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Test timeout')), timeout)
                )
            ]);
            
            const duration = Date.now() - startTime;
            
            this.results.push({
                name: testName,
                status: 'PASSED',
                duration,
                result
            });
            
            console.log(`✓ Test passed in ${duration}ms`);
            return result;
            
        } catch (error) {
            const duration = Date.now() - startTime;
            
            this.results.push({
                name: testName,
                status: 'FAILED',
                duration,
                error: error.message
            });
            
            console.error(`✗ Test failed in ${duration}ms:`, error.message);
            throw error;
        }
    }
    
    async testGameInitialization() {
        return this.runTest('Game Initialization', async () => {
            const game = new MockPJAGame();
            
            if (game.state.phase !== GamePhase.IDLE) {
                throw new Error('Game should start in IDLE phase');
            }
            
            if (game.state.players.length !== 0) {
                throw new Error('Game should start with no players');
            }
            
            return { phase: game.state.phase, playerCount: game.state.players.length };
        });
    }
    
    async testSinglePlayerLifecycle() {
        return this.runTest('Single Player Lifecycle', async () => {
            const game = new MockPJAGame({ maxPlayers: 1 });
            
            // Add player
            game.addPlayer('player1');
            if (game.state.phase !== GamePhase.WAITING) {
                throw new Error('Game should be in WAITING phase after player joins');
            }
            
            // Start game
            game.startGame();
            if (game.state.phase !== GamePhase.PLAYING) {
                throw new Error('Game should be in PLAYING phase after start');
            }
            
            // Wait for some ticks
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // End game
            game.endGame();
            if (game.state.phase !== GamePhase.GAME_OVER) {
                throw new Error('Game should be in GAME_OVER phase after end');
            }
            
            const metrics = game.getMetrics();
            return { 
                finalPhase: game.state.phase, 
                metrics,
                eventCount: game.eventLog.length 
            };
        });
    }
    
    async testMultiplayerJoin() {
        return this.runTest('Multiplayer Join Sequence', async () => {
            const game = new MockPJAGame({ maxPlayers: 4 });
            
            const players = [];
            for (let i = 1; i <= 4; i++) {
                const player = game.addPlayer(`player${i}`);
                players.push(player);
                
                if (game.state.players.length !== i) {
                    throw new Error(`Expected ${i} players, got ${game.state.players.length}`);
                }
            }
            
            // Try to add one more (should fail)
            try {
                game.addPlayer('player5');
                throw new Error('Should not allow more than max players');
            } catch (error) {
                if (!error.message.includes('Player limit exceeded')) {
                    throw error;
                }
            }
            
            return { 
                playerCount: game.state.players.length, 
                maxPlayers: game.config.maxPlayers 
            };
        });
    }
    
    async testInputProcessing() {
        return this.runTest('Input Processing', async () => {
            const game = new MockPJAGame();
            game.addPlayer('player1');
            game.startGame();
            
            const inputFrames = [];
            
            // Generate test inputs
            for (let i = 0; i < 10; i++) {
                const inputFrame = {
                    timestamp: Date.now(),
                    tickId: i,
                    playerId: 'player1',
                    inputs: {
                        up: Math.random(),
                        down: Math.random(),
                        left: Math.random(),
                        right: Math.random(),
                        action: Math.random() > 0.5
                    },
                    sequence: i
                };
                
                game.processInput(inputFrame);
                inputFrames.push(inputFrame);
                
                await new Promise(resolve => setTimeout(resolve, 33)); // ~30Hz
            }
            
            game.endGame();
            
            const metrics = game.getMetrics();
            
            if (metrics.avgInputLatency === 0) {
                throw new Error('No input latency recorded');
            }
            
            return { 
                inputsProcessed: inputFrames.length, 
                avgLatency: metrics.avgInputLatency,
                metrics 
            };
        });
    }
    
    async testStateTransitions() {
        return this.runTest('State Machine Transitions', async () => {
            const game = new MockPJAGame();
            
            const transitions = [];
            game.onStateChange = (from, to) => {
                transitions.push({ from, to, timestamp: Date.now() });
            };
            
            // Test valid transitions
            game.addPlayer('player1'); // IDLE -> WAITING
            game.startGame(); // WAITING -> PLAYING
            game.endGame(); // PLAYING -> GAME_OVER
            game.reset(); // GAME_OVER -> IDLE
            
            const expectedTransitions = [
                { from: GamePhase.IDLE, to: GamePhase.WAITING },
                { from: GamePhase.WAITING, to: GamePhase.PLAYING },
                { from: GamePhase.PLAYING, to: GamePhase.GAME_OVER },
                { from: GamePhase.GAME_OVER, to: GamePhase.IDLE }
            ];
            
            if (transitions.length !== expectedTransitions.length) {
                throw new Error(`Expected ${expectedTransitions.length} transitions, got ${transitions.length}`);
            }
            
            for (let i = 0; i < expectedTransitions.length; i++) {
                const expected = expectedTransitions[i];
                const actual = transitions[i];
                
                if (actual.from !== expected.from || actual.to !== expected.to) {
                    throw new Error(`Transition ${i}: expected ${expected.from}->${expected.to}, got ${actual.from}->${actual.to}`);
                }
            }
            
            return { transitions, stateUpdates: game.metrics.stateUpdates };
        });
    }
    
    async testPerformanceMetrics() {
        return this.runTest('Performance Metrics', async () => {
            const game = new MockPJAGame();
            game.addPlayer('player1');
            game.startGame();
            
            // Run for specified duration
            const duration = 2000; // 2 seconds
            await new Promise(resolve => setTimeout(resolve, duration));
            
            game.endGame();
            
            const metrics = game.getMetrics();
            
            // Validate tick rate (should be close to 30Hz)
            const expectedTicks = Math.floor(duration / 1000 * CONFIG.TICK_RATE);
            const tickRateError = Math.abs(metrics.tickCount - expectedTicks) / expectedTicks;
            
            if (tickRateError > 0.1) { // Allow 10% error
                throw new Error(`Tick rate error too high: ${(tickRateError * 100).toFixed(1)}%`);
            }
            
            // Validate frame rate (should be close to 60Hz)
            const expectedFrames = Math.floor(duration / 1000 * CONFIG.DISPLAY_RATE);
            const frameRateError = Math.abs(metrics.frameCount - expectedFrames) / expectedFrames;
            
            if (frameRateError > 0.1) { // Allow 10% error
                throw new Error(`Frame rate error too high: ${(frameRateError * 100).toFixed(1)}%`);
            }
            
            return {
                ...metrics,
                tickRateError: parseFloat((tickRateError * 100).toFixed(2)),
                frameRateError: parseFloat((frameRateError * 100).toFixed(2)),
                duration
            };
        });
    }
    
    getSummary() {
        const passed = this.results.filter(r => r.status === 'PASSED').length;
        const failed = this.results.filter(r => r.status === 'FAILED').length;
        const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
        
        return {
            total: this.results.length,
            passed,
            failed,
            totalDuration,
            results: this.results
        };
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    const options = {};
    
    // Parse command line arguments
    for (let i = 0; i < args.length; i += 2) {
        const key = args[i].replace(/^--/, '');
        const value = args[i + 1];
        options[key] = value;
    }
    
    const tester = new GameTester();
    
    try {
        switch (options.test) {
            case 'init':
                await tester.testGameInitialization();
                break;
                
            case 'lifecycle':
                await tester.testSinglePlayerLifecycle();
                break;
                
            case 'multiplayer-join':
                await tester.testMultiplayerJoin();
                break;
                
            case 'input-processing':
                await tester.testInputProcessing();
                break;
                
            case 'state-transitions':
                await tester.testStateTransitions();
                break;
                
            case 'performance':
                await tester.testPerformanceMetrics();
                break;
                
            case 'all':
                await tester.testGameInitialization();
                await tester.testSinglePlayerLifecycle();
                await tester.testMultiplayerJoin();
                await tester.testInputProcessing();
                await tester.testStateTransitions();
                await tester.testPerformanceMetrics();
                break;
                
            default:
                console.error('Unknown test:', options.test);
                console.log('Available tests: init, lifecycle, multiplayer-join, input-processing, state-transitions, performance, all');
                process.exit(1);
        }
        
        const summary = tester.getSummary();
        console.log('\n=== Test Summary ===');
        console.log(`Total: ${summary.total}, Passed: ${summary.passed}, Failed: ${summary.failed}`);
        console.log(`Total Duration: ${summary.totalDuration}ms`);
        
        if (summary.failed > 0) {
            process.exit(1);
        }
        
    } catch (error) {
        console.error('Test execution failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { MockPJAGame, GameTester, GamePhase };
