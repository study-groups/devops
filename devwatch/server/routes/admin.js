// Admin Routes - Main admin interface HTML and routes

const express = require('express');
const path = require('path');

const router = express.Router();

// Main admin interface
router.get('/', (req, res) => {
    const PW_DIR = req.app.locals.PW_DIR;
    
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Arcade Playwright Admin</title>
    <link rel="stylesheet" href="/static/icons.css">
    <style>
        body { 
            font-family: 'Courier New', monospace; 
            background: #1a1a1a; 
            color: #00ff00; 
            margin: 0; 
            padding: 20px; 
            line-height: 1.4; 
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { border-bottom: 2px solid #00ff00; padding-bottom: 10px; margin-bottom: 20px; }
        .section { background: #2a2a2a; border: 1px solid #00ff00; margin: 20px 0; padding: 15px; border-radius: 5px; }
        .env-section { background: #0a2a0a; border-color: #00aa00; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px; }
        .stat-card { background: #3a3a3a; border: 1px solid #666; padding: 10px; border-radius: 3px; }
        .tests-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 15px; margin-top: 15px; }
        .test-card { background: #2a2a2a; border: 1px solid #666; padding: 15px; border-radius: 5px; }
        .test-card h3 { margin-top: 0; color: #00ff00; }
        .test-card ul { margin: 5px 0; padding-left: 20px; }
        .test-card li { margin: 3px 0; font-size: 14px; }
        .activity-log { max-height: 200px; overflow-y: auto; }
        .activity-item { padding: 5px 0; border-bottom: 1px solid #333; font-size: 14px; }
        .activity-time { color: #888; font-weight: bold; }
        .activity-action { color: #00ff00; font-weight: bold; }
        .activity-details { color: #ccc; }
        .test-results-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
        .test-results-list { max-height: 400px; overflow-y: auto; }
        .test-result-item { padding: 10px; margin: 5px 0; border: 1px solid #666; border-radius: 5px; cursor: pointer; transition: background 0.2s; }
        .test-result-item:hover { background: #2a4a2a; }
        .test-result-item.success { border-left: 4px solid #00aa00; }
        .test-result-item.failure { border-left: 4px solid #aa0000; }
        .result-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }
        .result-status { font-size: 18px; }
        .result-env { background: #333; padding: 2px 8px; border-radius: 3px; font-size: 12px; font-weight: bold; }
        .result-time { color: #888; font-size: 12px; }
        .result-master { font-size: 16px; }
        .result-summary { color: #ccc; font-size: 14px; }
        .env-path { color: #ffff00; font-weight: bold; }
        .btn { background: #00aa00; color: #000; border: none; padding: 8px 16px; margin: 5px; cursor: pointer; border-radius: 3px; }
        .btn:hover { background: #00ff00; }
        .btn:disabled { background: #555; color: #999; cursor: not-allowed; }
        .danger { background: #aa0000; color: #fff; }
        .danger:hover { background: #ff0000; }
        .refresh-btn { float: right; margin-top: -5px; }
        .reports-link { background: #0066aa; color: #fff; text-decoration: none; display: inline-block; }
        .reports-link:hover { background: #0088cc; color: #fff; }
        
        /* Enhanced Test Suite Styles */
        .test-suite-explanation, .environment-explanation, .command-explanation { 
            background: #1a3a1a; 
            border: 1px solid #00aa00; 
            padding: 15px; 
            border-radius: 5px; 
            margin-bottom: 20px; 
        }
        .suite-selection, .browser-selection, .command-preview { margin: 20px 0; }
        .suite-options { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); 
            gap: 15px; 
            margin: 15px 0; 
        }
        .suite-option { 
            cursor: pointer; 
            display: block; 
        }
        .suite-option input[type="radio"] { display: none; }
        .suite-card { 
            background: #2a2a2a; 
            border: 2px solid #666; 
            padding: 15px; 
            border-radius: 5px; 
            transition: all 0.3s ease; 
        }
        .suite-option input[type="radio"]:checked + .suite-card { 
            border-color: #00ff00; 
            background: #1a3a1a; 
        }
        .suite-card:hover { border-color: #00aa00; background: #1a2a1a; }
        .suite-card h4 { margin: 0 0 10px 0; color: #00ff00; }
        .suite-card p { margin: 0 0 10px 0; color: #ccc; font-size: 14px; }
        .suite-meta { color: #888; font-size: 12px; font-weight: bold; }
        
        .browser-options { display: flex; flex-wrap: wrap; gap: 15px; margin: 15px 0; }
        .browser-options label { 
            background: #3a3a3a; 
            padding: 8px 15px; 
            border-radius: 5px; 
            border: 1px solid #666; 
            cursor: pointer; 
            transition: all 0.3s ease;
        }
        .browser-options label:hover { border-color: #00aa00; background: #1a2a1a; }
        .browser-options input[type="checkbox"]:checked + span,
        .browser-options label:has(input:checked) { 
            border-color: #00ff00; 
            background: #1a3a1a; 
        }
        
        .command-box { 
            background: #000; 
            border: 1px solid #00ff00; 
            border-radius: 5px; 
            padding: 15px; 
            position: relative; 
        }
        .command-box pre { 
            margin: 0; 
            color: #00ff00; 
            font-family: 'Courier New', monospace; 
            white-space: pre-wrap; 
            word-break: break-all; 
        }
        .copy-btn { 
            position: absolute; 
            top: 10px; 
            right: 10px; 
            background: #00aa00; 
            border: none; 
            color: #000; 
            padding: 5px 10px; 
            border-radius: 3px; 
            cursor: pointer; 
            font-size: 12px; 
        }
        .copy-btn:hover { background: #00ff00; }
        
        .env-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); 
            gap: 20px; 
            margin: 20px 0; 
        }
        .env-card { 
            border-radius: 8px; 
            padding: 20px; 
            border: 2px solid; 
        }
        .dev-env { background: #0a2a0a; border-color: #00aa00; }
        .staging-env { background: #2a2a0a; border-color: #aaaa00; }
        .prod-env { background: #2a0a0a; border-color: #aa0000; }
        
        .env-header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            margin-bottom: 15px; 
        }
        .env-header h3 { margin: 0; color: #00ff00; }
        .env-details { margin: 15px 0; }
        .env-url { margin: 5px 0; }
        .env-description { 
            font-size: 14px; 
            color: #ccc; 
            margin: 10px 0; 
        }
        
        /* Environment Periodic Stats */
        .env-periodic-stats {
            margin: 15px 0;
            padding: 10px;
            background: #1a1a1a;
            border-radius: 5px;
            border: 1px solid #333;
        }
        
        .env-periodic-stats h4 {
            margin: 0 0 10px 0;
            color: #00ff00;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .periodic-controls {
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .periodic-controls label {
            color: #ccc;
            font-size: 11px;
            font-weight: bold;
        }
        
        .periodic-filter {
            background: #2a2a2a;
            border: 1px solid #444;
            color: #fff;
            padding: 3px 8px;
            border-radius: 3px;
            font-size: 11px;
        }
        
        .periodic-summary {
            font-size: 11px;
            font-family: monospace;
        }
        
        .periodic-loading {
            color: #888;
            font-style: italic;
        }
        
        .periodic-stat-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 3px 0;
            border-bottom: 1px solid #2a2a2a;
        }
        
        .periodic-stat-item:last-child {
            border-bottom: none;
        }
        
        .periodic-metric {
            color: #66aaff;
            font-weight: bold;
        }
        
        .periodic-value {
            color: #ffaa66;
            font-weight: bold;
        }
        
        .periodic-trend {
            color: #66ffaa;
            font-size: 10px;
        }
        
        /* Enhanced Directory Statistics */
        .directory-overview {
            margin: 20px 0;
        }
        
        .directory-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
        }
        
        .directory-card {
            background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
            border: 1px solid #333;
            border-radius: 8px;
            padding: 15px;
            position: relative;
            overflow: hidden;
        }
        
        .directory-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 4px;
            height: 100%;
            background: var(--accent-color);
        }
        
        .directory-card.logs { --accent-color: #ff6b6b; }
        .directory-card.test-results { --accent-color: #4ecdc4; }
        .directory-card.reports { --accent-color: #45b7d1; }
        .directory-card.screenshots { --accent-color: #f9ca24; }
        .directory-card.pw_data { --accent-color: #6c5ce7; }
        
        .directory-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 12px;
            padding-left: 8px;
        }
        
        .directory-icon {
            font-size: 18px;
            color: var(--accent-color);
        }
        
        .directory-name {
            color: #fff;
            font-weight: bold;
            font-size: 14px;
        }
        
        .directory-stats {
            padding-left: 8px;
        }
        
        .directory-stat {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px 0;
            font-size: 12px;
        }
        
        .stat-label {
            color: #aaa;
        }
        
        .stat-value {
            color: var(--accent-color);
            font-weight: bold;
        }
        
        .directory-description {
            padding-left: 8px;
            margin-top: 8px;
            font-size: 10px;
            color: #666;
            font-style: italic;
            border-top: 1px solid #333;
            padding-top: 8px;
        }
        
        .directory-loading {
            color: #888;
            text-align: center;
            padding: 40px;
            font-style: italic;
        }
        
        /* Monitoring & Logging Section Styles */
        .monitoring-overview {
            margin: 20px 0;
        }
        
        .monitoring-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }
        
        .monitoring-card {
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 8px;
            padding: 15px;
        }
        
        .monitoring-card.full-width {
            grid-column: 1 / -1;
        }
        
        .monitoring-card h3 {
            margin: 0 0 15px 0;
            color: #00ff00;
            font-size: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
            position: relative;
        }
        
        .info-toggle {
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: #333;
            border: 2px solid #00ff00;
            color: #00ff00;
            font-size: 12px;
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;
            user-select: none;
        }
        
        .info-toggle:hover {
            background: #00ff00;
            color: #000;
            transform: scale(1.1);
        }
        
        .info-content {
            transition: all 0.3s ease;
            overflow: hidden;
        }
        
        .info-content.hidden {
            max-height: 0;
            opacity: 0;
            margin: 0;
        }
        
        .info-content.visible {
            max-height: 500px;
            opacity: 1;
        }
        
        .config-item {
            margin-bottom: 10px;
            font-size: 13px;
        }
        
        .config-item strong {
            color: #66aaff;
            display: inline-block;
            min-width: 120px;
        }
        
        .log-types {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 5px;
        }
        
        .log-type {
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
        }
        
        .log-type.instant { background: #ff6b6b; color: white; }
        .log-type.periodic { background: #4ecdc4; color: white; }
        .log-type.test { background: #45b7d1; color: white; }
        .log-type.suite { background: #f9ca24; color: black; }
        .log-type.matrix { background: #6c5ce7; color: white; }
        .log-type.system { background: #fd79a8; color: white; }
        
        .log-controls {
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-bottom: 15px;
            padding: 10px;
            background: #111;
            border-radius: 5px;
        }
        
        .log-controls-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .log-filters {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .log-filters label {
            color: #ccc;
            font-size: 12px;
        }
        
        .log-filters select {
            background: #2a2a2a;
            border: 1px solid #444;
            color: #fff;
            padding: 5px 10px;
            border-radius: 3px;
            font-size: 12px;
        }
        
        .log-type-toggles {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }
        
        .log-type-toggle {
            padding: 4px 8px;
            border: 1px solid #444;
            border-radius: 3px;
            font-size: 10px;
            font-weight: bold;
            text-transform: uppercase;
            cursor: pointer;
            transition: all 0.2s ease;
            user-select: none;
        }
        
        .log-type-toggle.active.instant { background: #ff6b6b; color: white; border-color: #ff6b6b; }
        .log-type-toggle.active.periodic { background: #4ecdc4; color: white; border-color: #4ecdc4; }
        .log-type-toggle.active.test { background: #45b7d1; color: white; border-color: #45b7d1; }
        .log-type-toggle.active.suite { background: #f9ca24; color: black; border-color: #f9ca24; }
        .log-type-toggle.active.matrix { background: #6c5ce7; color: white; border-color: #6c5ce7; }
        .log-type-toggle.active.system { background: #fd79a8; color: white; border-color: #fd79a8; }
        
        .log-type-toggle.inactive {
            background: #2a2a2a;
            color: #666;
            border-color: #444;
            opacity: 0.5;
        }
        
        .log-type-toggle:hover {
            transform: scale(1.05);
        }
        
        .log-actions {
            display: flex;
            gap: 8px;
        }
        
        .btn-sm {
            padding: 5px 10px;
            font-size: 11px;
        }
        
        .log-display {
            background: #0a0a0a;
            border: 1px solid #333;
            border-radius: 5px;
            height: 300px;
            overflow-y: auto;
            padding: 10px;
            font-family: monospace;
            font-size: 12px;
            line-height: 1.4;
        }
        
        /* Custom scrollbar styling */
        .log-display::-webkit-scrollbar {
            width: 8px;
        }
        
        .log-display::-webkit-scrollbar-track {
            background: #1a1a1a;
            border-radius: 4px;
        }
        
        .log-display::-webkit-scrollbar-thumb {
            background: linear-gradient(180deg, #00ff00 0%, #00aa00 100%);
            border-radius: 4px;
            border: 1px solid #333;
        }
        
        .log-display::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(180deg, #00ff00 0%, #00cc00 100%);
        }
        
        .log-display::-webkit-scrollbar-corner {
            background: #1a1a1a;
        }
        
        .log-loading {
            color: #888;
            text-align: center;
            padding: 20px;
            font-style: italic;
        }
        
        .log-entry {
            padding: 5px 0;
            border-bottom: 1px solid #1a1a1a;
            display: flex;
            gap: 10px;
        }
        
        .log-entry:last-child {
            border-bottom: none;
        }
        
        .log-timestamp {
            color: #666;
            flex-shrink: 0;
            width: 80px;
            font-size: 10px;
        }
        
        .log-type-badge {
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 9px;
            font-weight: bold;
            text-transform: uppercase;
            flex-shrink: 0;
            width: 60px;
            text-align: center;
        }
        
        .log-message {
            color: #ccc;
            flex: 1;
        }
        
        .log-stats {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px;
            background: #111;
            border-radius: 0 0 5px 5px;
            border-top: 1px solid #333;
            font-size: 11px;
        }
        
        .stat-item {
            color: #888;
        }
        
        .stat-item span {
            color: #00ff00;
            font-weight: bold;
        }
        .env-actions { 
            margin: 15px 0; 
        }
        
        .monitoring-controls {
            display: flex;
            align-items: center;
            gap: 15px;
            flex-wrap: wrap;
            background: #1a2a1a;
            padding: 15px;
            border-radius: 5px;
            border: 1px solid #333;
        }
        
        .monitoring-controls label {
            color: #00ff00;
            font-weight: bold;
            font-size: 12px;
        }
        
        .test-selector, .interval-selector {
            background: #2a2a2a;
            border: 1px solid #00aa00;
            color: #00ff00;
            padding: 5px 10px;
            border-radius: 3px;
            font-family: inherit;
            min-width: 120px;
        }
        
        .test-selector:focus, .interval-selector:focus {
            outline: none;
            border-color: #00ff00;
        }
        
        .monitoring-toggle-btn {
            background: #00aa00;
            color: #000;
            font-weight: bold;
            min-width: 140px;
            transition: all 0.3s ease;
        }
        
        .monitoring-toggle-btn:hover {
            background: #00ff00;
        }
        
        .monitoring-toggle-btn.monitoring {
            background: #aa0000;
            color: #fff;
        }
        
        .monitoring-toggle-btn.monitoring:hover {
            background: #ff0000;
        }
        .run-selected-btn { 
            background: #00aa00; 
            color: #000; 
            font-weight: bold; 
        }
        .run-selected-btn:hover { background: #00ff00; }
        
        .individual-tests { margin: 20px 0; }
        .test-list { margin: 15px 0; }
        .test-item { 
            background: #2a2a2a; 
            border: 1px solid #666; 
            border-radius: 5px; 
            padding: 15px; 
            margin: 10px 0; 
            display: flex; 
            align-items: flex-start; 
            gap: 15px; 
        }
        .test-item input[type="checkbox"] { margin-top: 5px; }
        .test-details { flex: 1; }
        .test-name { color: #00ff00; font-weight: bold; margin-bottom: 5px; }
        .test-description { color: #ccc; font-size: 14px; margin-bottom: 8px; }
        .test-meta { 
            display: flex; 
            gap: 15px; 
            font-size: 12px; 
            color: #888; 
        }
        .recent-title { font-weight: bold; margin-bottom: 10px; }
        
        /* Collapsible sections */
        .section-header { 
            cursor: pointer; 
            user-select: none; 
            padding: 10px; 
            background: #333; 
            border-radius: 5px 5px 0 0; 
            margin: -15px -15px 15px -15px;
            display: flex; 
            justify-content: space-between; 
            align-items: center;
        }
        .section-header:hover { background: #444; }
        .section-content { transition: max-height 0.3s ease; overflow: hidden; }
        .section-content.collapsed { max-height: 0; margin: 0; padding: 0; }
        .section-content.expanded { max-height: 2000px; }
        .collapse-icon { 
            font-size: 18px; 
            transition: transform 0.3s ease; 
            color: #00ff00;
        }
        .collapse-icon.collapsed { transform: rotate(-90deg); }
        
        /* Environment monitoring status */
        .env-status { 
            display: inline-block; 
            padding: 2px 8px; 
            border-radius: 3px; 
            font-size: 12px; 
            font-weight: bold; 
            margin-left: 10px;
        }
        .env-status.monitoring { background: #004400; color: #00ff00; }
        .env-status.stopped { background: #440000; color: #ff4444; }
        .env-status.unknown { background: #333; color: #999; }
        
        /* Environment recent results */
        .env-recent { 
            margin-top: 10px; 
            padding: 10px; 
            background: #1a1a1a; 
            border-radius: 3px; 
            font-size: 12px;
        }
        .recent-test { 
            display: flex; 
            justify-content: space-between; 
            padding: 2px 0; 
            border-bottom: 1px solid #333;
        }
        .recent-test:last-child { border-bottom: none; }
        
        /* Professional Environment Controls */
        .environment-controls {
            background: linear-gradient(135deg, #1a2a2a 0%, #2a2a3a 100%);
            border: 1px solid #4a4a6a;
            border-radius: 8px;
            padding: 16px;
            margin: 15px 0;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
        
        .controls-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }
        
        .controls-header h3 {
            margin: 0;
            color: #66aaff;
            font-size: 16px;
        }
        
        .frequency-control {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .frequency-control label {
            color: #aaccff;
            font-size: 13px;
        }
        
        .frequency-control select {
            background: #1a1a2a;
            border: 1px solid #4a4a6a;
            color: #aaccff;
            padding: 4px 8px;
            border-radius: 4px;
            font-family: inherit;
            font-size: 13px;
        }
        
        .signal-controls {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }
        
        .signal-inputs {
            display: flex;
            align-items: center;
            gap: 20px;
            flex-wrap: wrap;
        }
        
        .input-group {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        
        .input-group label {
            color: #aaccff;
            font-size: 12px;
            font-weight: bold;
        }
        
        .signal-input, .signal-select {
            background: #1a1a2a;
            border: 1px solid #4a4a6a;
            color: #aaccff;
            padding: 6px 10px;
            border-radius: 4px;
            font-family: inherit;
            font-size: 13px;
            min-width: 80px;
        }
        
        .signal-input:focus, .signal-select:focus {
            outline: none;
            border-color: #66aaff;
        }
        
        .signal-actions {
            display: flex;
            align-items: center;
            gap: 15px;
        }
        
        .signal-btn {
            background: linear-gradient(135deg, #aa4400 0%, #ff6600 100%);
            color: #fff;
            padding: 10px 20px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: bold;
            transition: all 0.3s ease;
            border: none;
            cursor: pointer;
        }
        
        .signal-btn:hover {
            background: linear-gradient(135deg, #ff6600 0%, #aa4400 100%);
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(255, 102, 0, 0.3);
        }
        
        .signal-btn:disabled {
            background: #444;
            color: #888;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }
        
        .signal-status {
            color: #aaccff;
            font-size: 13px;
            font-weight: bold;
        }
        
        .signal-note {
            color: #888;
            font-size: 12px;
            font-style: italic;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        /* Professional Test Feed Styling */
        .test-feed {
            background: linear-gradient(135deg, #1a1a2a 0%, #2a2a3a 100%);
            border: 1px solid #4a4a6a;
            border-radius: 8px;
            margin-top: 15px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
        
        .feed-header {
            background: linear-gradient(135deg, #2a2a4a 0%, #3a3a5a 100%);
            padding: 12px 16px;
            border-bottom: 1px solid #4a4a6a;
            border-radius: 8px 8px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .feed-header .icon {
            color: #66aaff;
            margin-right: 8px;
        }
        
        .feed-count {
            background: #3a3a5a;
            color: #aaccff;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
        }
        
        .feed-list {
            padding: 0;
            max-height: 200px;
            overflow-y: auto;
        }
        
        .feed-empty {
            padding: 20px;
            text-align: center;
            color: #888;
            font-style: italic;
        }
        
        .feed-item {
            padding: 10px 16px;
            border-bottom: 1px solid #3a3a4a;
            transition: background 0.2s ease;
            font-size: 13px;
        }
        
        .feed-item:hover {
            background: #2a2a3a;
        }
        
        .feed-item:last-child {
            border-bottom: none;
        }
        
        .feed-item.success {
            border-left: 3px solid #00aa44;
            background: rgba(0, 170, 68, 0.1);
        }
        
        .feed-item.failure {
            border-left: 3px solid #aa0044;
            background: rgba(170, 0, 68, 0.1);
        }
        
        .feed-timestamp {
            color: #888;
            font-size: 11px;
            float: right;
        }
        
        .feed-status {
            font-weight: bold;
        }
        
        .feed-status.success {
            color: #00ff44;
        }
        
        .feed-status.failure {
            color: #ff4444;
        }
        
        .feed-details {
            color: #ccc;
            margin-top: 4px;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
                    <h1 id="main-title"><span class="icon icon-gamepad"></span>Arcade Playwright Admin</h1>
        <button class="btn refresh-btn" onclick="location.reload()"><span class="icon icon-refresh"></span>Refresh</button>
        <a href="/reports" class="btn reports-link"><span class="icon icon-chart"></span>View Reports</a>
        <a href="/static/system-info.html" class="btn info-link" target="_blank"><span class="icon icon-info"></span>System Info</a>
        </div>

        <div class="section env-section">
            <div class="section-header" onclick="toggleSection('config-section')">
                <h2><span class="icon icon-folder"></span>Environment Configuration</h2>
                <span class="collapse-icon collapsed">▼</span>
            </div>
            <div class="section-content collapsed" id="config-section">
                <strong>PW_DIR:</strong> <span class="env-path">${PW_DIR}</span><br>
                <strong>Process PWD:</strong> <span class="env-path">${process.cwd()}</span>
            </div>
        </div>

        <!-- Test Suite Selection Section -->
        <div class="section">
            <div class="section-header" onclick="toggleSection('test-selection-section')">
                <h2><span class="icon icon-beaker"></span>Test Suite Configuration</h2>
                <span class="collapse-icon">▼</span>
            </div>
            <div class="section-content expanded" id="test-selection-section">
                <div class="test-suite-explanation">
                    <p><strong><span class="icon icon-clipboard"></span>Test Suites:</strong> Pre-configured collections of tests for different scenarios. Select a suite or customize your own selection.</p>
                    <p><strong><span class="icon icon-globe"></span>Environments:</strong> Choose which environment to test against. Each generates the same command you could run manually.</p>
                </div>
                
                <!-- Test Suite Selection -->
                <div class="suite-selection">
                    <h3><span class="icon icon-clipboard"></span>Choose Test Suite</h3>
                    <div class="suite-options">
                        <label class="suite-option">
                            <input type="radio" name="testSuite" value="basic" checked>
                            <div class="suite-card">
                                <h4><span class="icon icon-lightning"></span>Basic Health Check</h4>
                                <p>Essential tests for site availability and core functionality</p>
                                <div class="suite-meta"><span class="icon icon-chart"></span>~15s | 1 test</div>
                            </div>
                        </label>
                        <label class="suite-option">
                            <input type="radio" name="testSuite" value="full">
                            <div class="suite-card">
                                <h4><span class="icon icon-gamepad"></span>Complete Game Flow</h4>
                                <p>Comprehensive testing including game navigation and user flows</p>
                                <div class="suite-meta"><span class="icon icon-chart"></span>~60s | 2 tests</div>
                            </div>
                        </label>
                        <label class="suite-option">
                            <input type="radio" name="testSuite" value="custom">
                            <div class="suite-card">
                                <h4><span class="icon icon-lightning"></span>Custom Selection</h4>
                                <p>Select individual tests to run</p>
                                <div class="suite-meta"><span class="icon icon-chart"></span>Variable | Your choice</div>
                            </div>
                        </label>
                    </div>
                </div>

                <!-- Individual Test Selection (shown when custom is selected) -->
                <div class="individual-tests" id="individual-tests" style="display: none;">
                    <h3><span class="icon icon-folder"></span>Available Tests</h3>
                    <div class="test-list" id="test-list">
                        <!-- Will be populated by JavaScript -->
                    </div>
                </div>

                <!-- Browser/Project Selection -->
                <div class="browser-selection">
                    <h3><span class="icon icon-computer"></span>Browser Selection</h3>
                    <div class="browser-options">
                        <label><input type="checkbox" value="Desktop Chrome" checked> <span class="icon icon-computer"></span>Desktop Chrome</label>
                        <label><input type="checkbox" value="Desktop Firefox"> <span class="icon icon-computer"></span>Desktop Firefox</label>
                        <label><input type="checkbox" value="Desktop Safari"> <span class="icon icon-computer"></span>Desktop Safari</label>
                        <label><input type="checkbox" value="Mobile iPhone"> <span class="icon icon-computer"></span>Mobile iPhone</label>
                        <label><input type="checkbox" value="Mobile Android"> <span class="icon icon-computer"></span>Mobile Android</label>
                    </div>
                </div>

                <!-- Command Preview -->
                <div class="command-preview">
                    <h3><span class="icon icon-document"></span>Command Preview</h3>
                    <div class="command-explanation">
                        <p><span class="icon icon-document"></span><strong>This shows the exact command line equivalent of your selections.</strong></p>
                        <p><span class="icon icon-lightbulb"></span>Copy this command to run the same tests manually from your terminal in the <code>playwright/</code> directory.</p>
                    </div>
                    <div class="command-box">
                        <pre id="command-preview-text">Loading...</pre>
                        <button class="copy-btn" onclick="copyCommand()"><span class="icon icon-clipboard"></span>Copy Command</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Environment Execution Section -->
        <div class="section">
            <div class="section-header" onclick="toggleSection('environments-section')">
                <h2><span class="icon icon-globe"></span>Run Tests on Environments</h2>
                <span class="collapse-icon">▼</span>
            </div>
            <div class="section-content expanded" id="environments-section">
                <div class="environment-explanation">
                    <p><strong><span class="icon icon-globe"></span>Multi-Environment Testing:</strong> Run your selected tests against different environments.</p>
                    <p><strong><span class="icon icon-refresh"></span>Status Monitoring:</strong> Track running tests and view results in real-time.</p>
                </div>
                
                <!-- Signal Generator Controls -->
                <div class="environment-controls">
                    <div class="controls-header">
                        <h3><span class="icon icon-zap"></span>Quick Actions</h3>
                        <div class="frequency-control">
                            <label for="update-frequency">Feed Updates:</label>
                            <select id="update-frequency" onchange="updateFeedFrequency(this.value)">
                                <option value="1000">1 second</option>
                                <option value="2000">2 seconds</option>
                                <option value="5000" selected>5 seconds</option>
                                <option value="10000">10 seconds</option>
                            </select>
                        </div>
                    </div>
                    <div class="signal-controls">
                        <div class="signal-inputs">
                            <div class="input-group">
                                <label for="request-count">Requests:</label>
                                <input type="number" id="request-count" min="1" max="1000" value="10" class="signal-input">
                            </div>
                            <div class="input-group">
                                <label for="time-period">Over (seconds):</label>
                                <input type="number" id="time-period" min="1" max="300" value="5" class="signal-input">
                            </div>
                            <div class="input-group">
                                <label for="target-env">Target:</label>
                                <select id="target-env" class="signal-select">
                                    <option value="dev">Development</option>
                                    <option value="staging">Staging</option>
                                    <option value="prod">Production</option>
                                    <option value="all">All Environments</option>
                                </select>
                            </div>
                        </div>
                        <div class="signal-actions">
                            <button class="btn signal-btn" id="generate-signal-btn" onclick="generateSignalBlast()">
                                <span class="icon icon-zap"></span>Fire Signal Blast
                            </button>
                            <div class="signal-status" id="signal-status"></div>
                        </div>
                        <div class="signal-note">
                            <span class="icon icon-info"></span>Sends a burst of GET requests to test load handling and response times
                        </div>
                    </div>
                </div>
                
                <div class="env-grid">
                    <div class="env-card dev-env">
                        <div class="env-header">
                            <h3><span class="icon icon-wrench"></span>Development Environment</h3>
                            <span class="env-status unknown" id="dev-status">Unknown</span>
                        </div>
                        <div class="env-details">
                            <p class="env-url"><a href="https://dev.pixeljamarcade.com" target="_blank">https://dev.pixeljamarcade.com</a></p>
                            <p class="env-description"><span class="icon icon-wrench"></span>Development environment for testing new features and changes</p>
                            <div class="env-periodic-stats" id="dev-periodic-stats">
                                <h4><span class="icon icon-activity"></span>Periodic Activity Summary</h4>
                                <div class="periodic-controls">
                                    <label for="dev-periodic-filter">Filter by TYPE:</label>
                                    <select id="dev-periodic-filter" class="periodic-filter" onchange="filterPeriodicStats('dev', this.value)">
                                        <option value="all">All Types</option>
                                        <option value="PERIODIC" selected>PERIODIC</option>
                                        <option value="TEST">TEST</option>
                                        <option value="SUITE">SUITE</option>
                                        <option value="SYSTEM">SYSTEM</option>
                                        <option value="INSTANT">INSTANT</option>
                                        <option value="MATRIX">MATRIX</option>
                                    </select>
                                </div>
                                <div class="periodic-summary" id="dev-periodic-summary">
                                    <div class="periodic-loading">Loading periodic statistics...</div>
                                </div>
                            </div>
                        </div>
                        <div class="env-actions">
                            <div class="monitoring-controls">
                                <label for="dev-test-select">Test:</label>
                                <select id="dev-test-select" class="test-selector">
                                    <option value="health-check">Health Check</option>
                                    <option value="performance">Performance</option>
                                    <option value="game-flow">Game Flow</option>
                                    <option value="accessibility">Accessibility</option>
                                </select>
                                
                                <label for="dev-interval-select">Interval:</label>
                                <select id="dev-interval-select" class="interval-selector">
                                    <option value="1000">1 second</option>
                                    <option value="5000" selected>5 seconds</option>
                                    <option value="10000">10 seconds</option>
                                    <option value="15000">15 seconds</option>
                                    <option value="30000">30 seconds</option>
                                    <option value="60000">1 minute</option>
                                    <option value="120000">2 minutes</option>
                                    <option value="300000">5 minutes</option>
                                    <option value="600000">10 minutes</option>
                                    <option value="900000">15 minutes</option>
                                    <option value="1800000">30 minutes</option>
                                    <option value="3600000">1 hour</option>
                                    <option value="86400000">1 day</option>
                                </select>
                                
                                <button class="btn monitoring-toggle-btn" id="dev-monitoring-btn" onclick="toggleMonitoring('dev')">
                                    <span class="icon icon-play"></span>Start Monitoring
                                </button>
                            </div>
                        </div>
                        <div class="test-feed" id="dev-feed">
                            <div class="feed-header">
                                <span class="icon icon-pulse"></span>Test Probes
                                <span class="feed-count" id="dev-feed-count">0/5</span>
                            </div>
                            <div class="feed-list" id="dev-feed-list">
                                <div class="feed-empty">Waiting for test probes...</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="env-card staging-env">
                        <div class="env-header">
                            <h3><span class="icon icon-rocket"></span>Staging Environment</h3>
                            <span class="env-status unknown" id="staging-status">Unknown</span>
                        </div>
                        <div class="env-details">
                            <p class="env-url"><a href="https://staging.pixeljamarcade.com" target="_blank">https://staging.pixeljamarcade.com</a></p>
                            <p class="env-description"><span class="icon icon-rocket"></span>Pre-production environment that mirrors production setup</p>
                            <div class="env-periodic-stats" id="staging-periodic-stats">
                                <h4><span class="icon icon-activity"></span>Periodic Activity Summary</h4>
                                <div class="periodic-controls">
                                    <label for="staging-periodic-filter">Filter by TYPE:</label>
                                    <select id="staging-periodic-filter" class="periodic-filter" onchange="filterPeriodicStats('staging', this.value)">
                                        <option value="all">All Types</option>
                                        <option value="PERIODIC" selected>PERIODIC</option>
                                        <option value="TEST">TEST</option>
                                        <option value="SUITE">SUITE</option>
                                        <option value="SYSTEM">SYSTEM</option>
                                        <option value="INSTANT">INSTANT</option>
                                        <option value="MATRIX">MATRIX</option>
                                    </select>
                                </div>
                                <div class="periodic-summary" id="staging-periodic-summary">
                                    <div class="periodic-loading">Loading periodic statistics...</div>
                                </div>
                            </div>
                        </div>
                        <div class="env-actions">
                            <div class="monitoring-controls">
                                <label for="staging-test-select">Test:</label>
                                <select id="staging-test-select" class="test-selector">
                                    <option value="health-check">Health Check</option>
                                    <option value="performance">Performance</option>
                                    <option value="game-flow">Game Flow</option>
                                    <option value="accessibility">Accessibility</option>
                                </select>
                                
                                <label for="staging-interval-select">Interval:</label>
                                <select id="staging-interval-select" class="interval-selector">
                                    <option value="1000">1 second</option>
                                    <option value="5000">5 seconds</option>
                                    <option value="10000">10 seconds</option>
                                    <option value="15000">15 seconds</option>
                                    <option value="30000" selected>30 seconds</option>
                                    <option value="60000">1 minute</option>
                                    <option value="120000">2 minutes</option>
                                    <option value="300000">5 minutes</option>
                                    <option value="600000">10 minutes</option>
                                    <option value="900000">15 minutes</option>
                                    <option value="1800000">30 minutes</option>
                                    <option value="3600000">1 hour</option>
                                    <option value="86400000">1 day</option>
                                </select>
                                
                                <button class="btn monitoring-toggle-btn" id="staging-monitoring-btn" onclick="toggleMonitoring('staging')">
                                    <span class="icon icon-play"></span>Start Monitoring
                                </button>
                            </div>
                        </div>
                        <div class="test-feed" id="staging-feed">
                            <div class="feed-header">
                                <span class="icon icon-pulse"></span>Test Probes
                                <span class="feed-count" id="staging-feed-count">0/5</span>
                            </div>
                            <div class="feed-list" id="staging-feed-list">
                                <div class="feed-empty">Waiting for test probes...</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="env-card prod-env">
                        <div class="env-header">
                            <h3><span class="icon icon-fire"></span>Production Environment</h3>
                            <span class="env-status unknown" id="prod-status">Unknown</span>
                        </div>
                        <div class="env-details">
                            <p class="env-url"><a href="https://pixeljamarcade.com" target="_blank">https://pixeljamarcade.com</a></p>
                            <p class="env-description"><span class="icon icon-fire"></span>Live production environment serving real users</p>
                            <div class="env-periodic-stats" id="prod-periodic-stats">
                                <h4><span class="icon icon-activity"></span>Periodic Activity Summary</h4>
                                <div class="periodic-controls">
                                    <label for="prod-periodic-filter">Filter by TYPE:</label>
                                    <select id="prod-periodic-filter" class="periodic-filter" onchange="filterPeriodicStats('prod', this.value)">
                                        <option value="all">All Types</option>
                                        <option value="PERIODIC" selected>PERIODIC</option>
                                        <option value="TEST">TEST</option>
                                        <option value="SUITE">SUITE</option>
                                        <option value="SYSTEM">SYSTEM</option>
                                        <option value="INSTANT">INSTANT</option>
                                        <option value="MATRIX">MATRIX</option>
                                    </select>
                                </div>
                                <div class="periodic-summary" id="prod-periodic-summary">
                                    <div class="periodic-loading">Loading periodic statistics...</div>
                                </div>
                            </div>
                        </div>
                        <div class="env-actions">
                            <div class="monitoring-controls">
                                <label for="prod-test-select">Test:</label>
                                <select id="prod-test-select" class="test-selector">
                                    <option value="health-check">Health Check</option>
                                    <option value="performance">Performance</option>
                                    <option value="game-flow">Game Flow</option>
                                    <option value="accessibility">Accessibility</option>
                                </select>
                                
                                <label for="prod-interval-select">Interval:</label>
                                <select id="prod-interval-select" class="interval-selector">
                                    <option value="1000">1 second</option>
                                    <option value="5000">5 seconds</option>
                                    <option value="10000">10 seconds</option>
                                    <option value="15000">15 seconds</option>
                                    <option value="30000">30 seconds</option>
                                    <option value="60000">1 minute</option>
                                    <option value="120000">2 minutes</option>
                                    <option value="300000" selected>5 minutes</option>
                                    <option value="600000">10 minutes</option>
                                    <option value="900000">15 minutes</option>
                                    <option value="1800000">30 minutes</option>
                                    <option value="3600000">1 hour</option>
                                    <option value="86400000">1 day</option>
                                </select>
                                
                                <button class="btn monitoring-toggle-btn" id="prod-monitoring-btn" onclick="toggleMonitoring('prod')">
                                    <span class="icon icon-play"></span>Start Monitoring
                                </button>
                            </div>
                        </div>
                        <div class="test-feed" id="prod-feed">
                            <div class="feed-header">
                                <span class="icon icon-pulse"></span>Test Probes
                                <span class="feed-count" id="prod-feed-count">0/5</span>
                            </div>
                            <div class="feed-list" id="prod-feed-list">
                                <div class="feed-empty">Waiting for test probes...</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Testing Matrix Section -->
        <div class="section testing-matrix-section">
            <div class="section-header" onclick="toggleSection('testing-matrix-section')">
                <h2 id="testing-matrix-header"><span class="icon icon-chart"></span>Testing Matrix Dashboard</h2>
                <span class="collapse-icon">▼</span>
            </div>
            <div class="section-content expanded" id="testing-matrix-section">
                <div id="testing-matrix-container">
                    <div class="matrix-controls">
                        <div class="selection-info">
                            <span class="icon icon-check"></span>
                            <span>Selected: <span class="selection-count" id="selection-count">0</span> combinations</span>
                        </div>
                        <div class="matrix-actions">
                            <button class="btn run-selected-matrix" disabled>
                                <span class="icon icon-play"></span>
                                Run Selected
                            </button>
                            <button class="btn clear-selection">
                                <span class="icon icon-x"></span>
                                Clear Selection
                            </button>
                            <a href="/reports" class="btn" style="background: #0066aa;">
                                <span class="icon icon-chart"></span>
                                View Results
                            </a>
                        </div>
                    </div>
                    
                    <div class="matrix-stats" id="matrix-stats">
                        <!-- Stats will be populated by JavaScript -->
                    </div>
                    
                    <div class="matrix-container">
                        <div class="matrix-grid" id="testing-matrix-grid">
                            <!-- Matrix will be populated by JavaScript -->
                        </div>
                    </div>
                    
                    <div class="matrix-legend">
                        <div class="legend-item">
                            <div class="legend-indicator success"></div>
                            <span>All Tests Passed</span>
                        </div>
                        <div class="legend-item">
                            <div class="legend-indicator error"></div>
                            <span>Some Tests Failed</span>
                        </div>
                        <div class="legend-item">
                            <div class="legend-indicator running"></div>
                            <span>Tests Running</span>
                        </div>
                        <div class="legend-item">
                            <div class="legend-indicator pending"></div>
                            <span>Not Yet Tested</span>
                        </div>
                    </div>
                    
  
                </div>
            </div>
        </div>

        <div class="section">
            <div class="section-header" onclick="toggleSection('system-overview-section')">
                <h2><span class="icon icon-info"></span>Testing System Overview</h2>
                <span class="collapse-icon collapsed">▼</span>
            </div>
            <div class="section-content collapsed" id="system-overview-section">
                <div class="system-overview">
                    <h3><span class="icon icon-document"></span>Single Source of Truth</h3>
                    <p>All testing configuration is defined in: <code>playwright/config/testing-system-config.json</code></p>
                    
                    <h3><span class="icon icon-chart"></span>Where Test Results Go</h3>
                    <ul>
                        <li><strong>Central Database:</strong> <code>pw_data/central-test-results.json</code> - <a href="/reports">Access via Reports Dashboard</a></li>
                        <li><strong>HTML Reports:</strong> <code>pw_data/reports/</code> - <a href="/reports/raw">View Raw Reports</a></li>
                        <li><strong>Individual Results:</strong> <code>pw_data/results/{environment}/</code> - JSON files per test run</li>
                    </ul>
                    
                    <h3><span class="icon icon-refresh"></span>Periodic Testing</h3>
                    <p><strong>Currently Running:</strong> <span id="periodic-status">Loading...</span></p>
                    <p><strong>Tests in Periodic Rotation:</strong> Performance metrics (basic health checks)</p>
                    <p><strong>Control:</strong> Use "Start/Stop Monitoring" buttons above for each environment</p>
                    
                    <h3><span class="icon icon-lightbulb"></span>Enhanced Logging Structure</h3>
                    <p>All test events are logged with structured references:</p>
                    <ul>
                        <li><strong>TYPE:</strong> Test type (health-check, performance, game-flow)</li>
                        <li><strong>SRC:</strong> Source info (device, browser, userAgent, viewport)</li>
                        <li><strong>DST:</strong> Destination info (endpoint, environment, credentials)</li>
                    </ul>
                    <p><strong>Central Log:</strong> <code>logs/central-events.jsonl</code> - All events with TYPE/SRC/DST structure</p>
                    
                    <h3><span class="icon icon-lightbulb"></span>Quick Actions</h3>
                    <div style="margin: 15px 0;">
                        <a href="/reports" class="btn" style="margin-right: 10px;"><span class="icon icon-chart"></span>View All Results</a>
                        <a href="/reports/raw" class="btn" style="margin-right: 10px;"><span class="icon icon-document"></span>HTML Reports</a>
                        <a href="playwright/docs/TESTING_SYSTEM_GUIDE.md" class="btn" target="_blank"><span class="icon icon-info"></span>Full Documentation</a>
                    </div>
                </div>
            </div>
        </div>

        <!-- System Monitoring & Logging Section -->
        <div class="section">
            <div class="section-header" onclick="toggleSection('monitoring-logging-section')">
                <h2><span class="icon icon-activity"></span>System Monitoring & Logging</h2>
                <span class="collapse-icon collapsed">▼</span>
            </div>
            <div class="section-content collapsed" id="monitoring-logging-section">
                <div class="monitoring-overview">
                    <div class="monitoring-grid">
                        <!-- System Logger Components -->
                        <div class="monitoring-card">
                            <h3>
                                <span class="info-toggle" onclick="toggleInfo('logger')" title="Toggle detailed information">ⓘ</span>
                                <span class="icon icon-layers"></span>System Logger Components
                            </h3>
                            <div class="info-content visible" id="logger-info">
                                <div class="logger-config">
                                    <div class="config-item">
                                        <strong>Log Types:</strong>
                                        <div class="log-types">
                                            <span class="log-type instant">INSTANT</span>
                                            <span class="log-type periodic">PERIODIC</span>
                                            <span class="log-type test">TEST</span>
                                            <span class="log-type suite">SUITE</span>
                                            <span class="log-type matrix">MATRIX</span>
                                            <span class="log-type system">SYSTEM</span>
                                        </div>
                                    </div>
                                    <div class="config-item">
                                        <strong>Storage:</strong> localStorage + PW_DIR/logs/server/server.log
                                    </div>
                                    <div class="config-item">
                                        <strong>Retention:</strong> Last 500 entries in memory, last 200 in localStorage
                                    </div>
                                    <div class="config-item">
                                        <strong>Auto-refresh:</strong> 10-second intervals
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Test Runner Monitor -->
                        <div class="monitoring-card">
                            <h3>
                                <span class="info-toggle" onclick="toggleInfo('monitor')" title="Toggle detailed information">ⓘ</span>
                                <span class="icon icon-clock"></span>Test Runner Monitor
                            </h3>
                            <div class="info-content visible" id="monitor-info">
                                <div class="monitor-config">
                                    <div class="config-item">
                                        <strong>Update Frequency:</strong> 2-second intervals during active tests
                                    </div>
                                    <div class="config-item">
                                        <strong>Progress Tracking:</strong> Real-time percentage, pass/fail counts, current test
                                    </div>
                                    <div class="config-item">
                                        <strong>Timeout Handling:</strong> 20-second grace period before marking as stuck
                                    </div>
                                    <div class="config-item">
                                        <strong>Simulation Mode:</strong> Fallback when real test data unavailable
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Result Storage -->
                        <div class="monitoring-card">
                            <h3>
                                <span class="info-toggle" onclick="toggleInfo('storage')" title="Toggle detailed information">ⓘ</span>
                                <span class="icon icon-database"></span>Result Storage
                            </h3>
                            <div class="info-content visible" id="storage-info">
                                <div class="storage-config">
                                    <div class="config-item">
                                        <strong>Central Database:</strong> pw_data/central-test-results.json
                                    </div>
                                    <div class="config-item">
                                        <strong>HTML Reports:</strong> pw_data/reports/ (Playwright native)
                                    </div>
                                    <div class="config-item">
                                        <strong>Screenshots:</strong> pw_data/screenshots/
                                    </div>
                                    <div class="config-item">
                                        <strong>HAR Files:</strong> Network captures when enabled
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Live System Log -->
                        <div class="monitoring-card full-width">
                            <h3><span class="icon icon-file-text"></span>Live System Log</h3>
                            <div class="log-controls">
                                <div class="log-controls-row">
                                    <div class="log-filters">
                                        <label for="log-type-filter">Legacy filter:</label>
                                        <select id="log-type-filter" onchange="filterSystemLogs(this.value)">
                                            <option value="all">All Types</option>
                                            <option value="INSTANT">INSTANT</option>
                                            <option value="PERIODIC">PERIODIC</option>
                                            <option value="TEST">TEST</option>
                                            <option value="SUITE">SUITE</option>
                                            <option value="MATRIX">MATRIX</option>
                                            <option value="SYSTEM">SYSTEM</option>
                                        </select>
                                    </div>
                                    <div class="log-actions">
                                        <button class="btn btn-sm" onclick="clearSystemLogs()">
                                            <span class="icon icon-trash"></span>Clear
                                        </button>
                                        <button class="btn btn-sm" onclick="exportSystemLogs()">
                                            <span class="icon icon-download"></span>Export
                                        </button>
                                        <button class="btn btn-sm" onclick="refreshSystemLogs()">
                                            <span class="icon icon-refresh"></span>Refresh
                                        </button>
                                    </div>
                                </div>
                                <div class="log-type-toggles" id="log-type-toggles">
                                    <!-- Dynamic type toggles will be populated here -->
                                </div>
                            </div>
                            <div class="log-display" id="system-log-display">
                                <div class="log-loading">Loading system logs...</div>
                            </div>
                            <div class="log-stats" id="log-stats">
                                <span class="stat-item">Total: <span id="total-logs">0</span></span>
                                <span class="stat-item">Memory: <span id="memory-logs">0</span></span>
                                <span class="stat-item">LocalStorage: <span id="localStorage-logs">0</span></span>
                                <span class="stat-item">Last Update: <span id="last-log-update">Never</span></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="section">
            <div class="section-header" onclick="toggleSection('stats-section')">
                <h2><span class="icon icon-chart"></span>Directory Statistics</h2>
                <span class="collapse-icon collapsed">▼</span>
            </div>
            <div class="section-content collapsed" id="stats-section">
                <div class="directory-overview">
                    <div class="directory-grid" id="directory-stats">
                        <div class="directory-loading">Loading comprehensive directory statistics...</div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <link rel="stylesheet" href="/static/testing-matrix.css?v=${Date.now()}">
    <link rel="stylesheet" href="/static/system-logger.css?v=${Date.now()}">
    <link rel="stylesheet" href="/static/test-runner-monitor.css?v=${Date.now()}">
    <script src="/static/notification-system.js?v=${Date.now()}"></script>
    <script src="/static/js/dashboard-logger.js?v=${Date.now()}"></script>
    <script src="/static/test-runner-monitor.js?v=${Date.now()}"></script>
    <script src="/static/info-system.js?v=${Date.now()}"></script>
    <script src="/static/testing-matrix.js?v=${Date.now()}"></script>
    <script src="/static/admin-client-enhanced.js?v=${Date.now()}"></script>
</body>
</html>
    `);
});

module.exports = router;