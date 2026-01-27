#!/usr/bin/env bash
# org/guide/css.sh - CSS template for setup guide

_org_guide_css() {
    cat << 'CSS'
        :root {
            --primary: #6366f1;
            --success: #10b981;
            --warning: #f59e0b;
            --pending: #94a3b8;
            --bg: #0f172a;
            --surface: #1e293b;
            --card: #334155;
            --text: #f1f5f9;
            --muted: #94a3b8;
            --border: #475569;
            --accent: #a78bfa;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--bg);
            color: var(--text);
            line-height: 1.5;
            font-size: 14px;
        }

        .header {
            background: var(--surface);
            border-bottom: 1px solid var(--border);
            padding: 1rem;
            position: sticky;
            top: 0;
            z-index: 100;
        }

        .header-inner {
            max-width: 1200px;
            margin: 0 auto;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
        }

        .logo {
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }

        .logo-mark {
            width: 36px;
            height: 36px;
            background: linear-gradient(135deg, var(--primary), var(--accent));
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 18px;
            color: white;
        }

        .logo-text {
            font-weight: 600;
            font-size: 1.125rem;
            letter-spacing: -0.02em;
        }

        .logo-text span {
            color: var(--muted);
            font-weight: 400;
        }

        .header-meta {
            font-size: 0.75rem;
            color: var(--muted);
            text-align: right;
        }

        .main {
            max-width: 1200px;
            margin: 0 auto;
            padding: 1.5rem 1rem;
        }

        .progress-section {
            background: var(--surface);
            border-radius: 8px;
            padding: 1rem;
            margin-bottom: 1.5rem;
            display: flex;
            align-items: center;
            gap: 1rem;
            flex-wrap: wrap;
        }

        .progress-label {
            font-weight: 500;
            white-space: nowrap;
        }

        .progress-bar {
            flex: 1;
            min-width: 150px;
            height: 6px;
            background: var(--card);
            border-radius: 3px;
            overflow: hidden;
        }

        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, var(--primary), var(--accent));
            border-radius: 3px;
        }

        .progress-text {
            font-size: 0.75rem;
            color: var(--muted);
            white-space: nowrap;
        }

        .grid {
            display: grid;
            gap: 1.5rem;
        }

        @media (min-width: 768px) {
            .grid { grid-template-columns: 1fr 1fr; }
            .grid-full { grid-column: 1 / -1; }
        }

        section {
            background: var(--surface);
            border-radius: 8px;
            overflow: hidden;
        }

        .section-header {
            padding: 0.75rem 1rem;
            background: var(--card);
            font-weight: 600;
            font-size: 0.8rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--muted);
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .section-body {
            padding: 1rem;
        }

        .status {
            display: inline-flex;
            align-items: center;
            gap: 0.25rem;
            padding: 0.125rem 0.5rem;
            border-radius: 4px;
            font-size: 0.7rem;
            font-weight: 600;
            text-transform: uppercase;
        }

        .status-done { background: rgba(16,185,129,0.2); color: var(--success); }
        .status-pending { background: rgba(245,158,11,0.2); color: var(--warning); }
        .status-todo { background: rgba(148,163,184,0.2); color: var(--pending); }

        .list { list-style: none; }

        .list-item {
            padding: 0.75rem 0;
            border-bottom: 1px solid var(--border);
            display: flex;
            gap: 0.75rem;
            align-items: flex-start;
        }

        .list-item:last-child { border-bottom: none; }

        .check {
            width: 18px;
            height: 18px;
            border-radius: 4px;
            border: 2px solid var(--border);
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            margin-top: 1px;
        }

        .check.done {
            background: var(--success);
            border-color: var(--success);
        }

        .check.done::after { content: '✓'; color: white; }

        .item-text { flex: 1; }
        .item-title { font-weight: 500; }
        .item-sub { font-size: 0.8rem; color: var(--muted); margin-top: 0.125rem; }

        .data-grid {
            display: grid;
            gap: 0.5rem;
        }

        @media (min-width: 480px) {
            .data-grid { grid-template-columns: 1fr 1fr; }
        }

        .data-item {
            background: var(--card);
            padding: 0.75rem;
            border-radius: 6px;
        }

        .data-label {
            font-size: 0.7rem;
            color: var(--muted);
            text-transform: uppercase;
            letter-spacing: 0.03em;
        }

        .data-value {
            font-weight: 600;
            margin-top: 0.125rem;
            word-break: break-all;
        }

        .data-value.mono {
            font-family: 'SF Mono', Monaco, monospace;
            font-size: 0.85rem;
        }

        .code {
            background: var(--bg);
            padding: 0.75rem;
            border-radius: 6px;
            font-family: 'SF Mono', Monaco, monospace;
            font-size: 0.8rem;
            overflow-x: auto;
            white-space: pre;
            line-height: 1.6;
        }

        .code .c { color: var(--muted); }
        .code .v { color: var(--success); }
        .code .k { color: var(--accent); }

        code {
            background: var(--card);
            padding: 0.125rem 0.375rem;
            border-radius: 3px;
            font-family: 'SF Mono', Monaco, monospace;
            font-size: 0.85em;
        }

        a { color: var(--accent); text-decoration: none; }
        a:hover { text-decoration: underline; }

        .btn {
            display: inline-flex;
            align-items: center;
            gap: 0.375rem;
            background: var(--primary);
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            font-size: 0.8rem;
            font-weight: 500;
            margin-top: 0.75rem;
        }

        .btn:hover { background: #4f46e5; text-decoration: none; }

        .arch {
            font-family: 'SF Mono', Monaco, monospace;
            font-size: 0.75rem;
            line-height: 1.4;
            text-align: center;
            color: var(--muted);
            overflow-x: auto;
            white-space: pre;
        }

        .arch .box { color: var(--text); }
        .arch .highlight { color: var(--accent); }

        .footer {
            text-align: center;
            padding: 2rem 1rem;
            color: var(--muted);
            font-size: 0.75rem;
        }

        @media (max-width: 480px) {
            .header-meta { display: none; }
            .section-body { padding: 0.75rem; }
            .arch { font-size: 0.65rem; }
        }
CSS
}

export -f _org_guide_css
