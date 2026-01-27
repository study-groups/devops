#!/usr/bin/env bash
# org/guide/sections.sh - HTML section generators for setup guide
#
# Each function outputs an HTML section. Uses ORG_* variables set by helpers.sh

# Header section
_org_guide_section_header() {
    cat << EOF
    <header class="header">
        <div class="header-inner">
            <div class="logo">
                <div class="logo-mark">P</div>
                <div class="logo-text">PlaceholderMedia <span>/ ${ORG_NAME}</span></div>
            </div>
            <div class="header-meta">
                Setup Guide<br>
                ${CURRENT_DATE}
            </div>
        </div>
    </header>
EOF
}

# Progress bar
_org_guide_section_progress() {
    cat << EOF
        <div class="progress-section">
            <span class="progress-label">Setup Progress</span>
            <div class="progress-bar"><div class="progress-fill" style="width: ${PROGRESS_PCT}%"></div></div>
            <span class="progress-text">${DONE_COUNT} of ${TOTAL_COUNT} complete</span>
        </div>
EOF
}

# Domain section
_org_guide_section_domain() {
    local www_value www_status_html
    if [[ "$WWW_STATUS" == "done" ]]; then
        www_value="<div class=\"data-value mono\" style=\"color: var(--success)\">${WWW_CNAME}</div>"
        www_status_html="<span class=\"status status-done\">Ready</span>"
    else
        www_value="<span class=\"status status-pending\">Not Set</span>"
        www_status_html="<span class=\"status status-pending\">Pending</span>"
    fi

    cat << EOF
            <section>
                <div class="section-header">✓ Domain</div>
                <div class="section-body">
                    <div class="data-grid">
                        <div class="data-item">
                            <div class="data-label">Domain</div>
                            <div class="data-value mono">${PRIMARY_DOMAIN}</div>
                        </div>
                        <div class="data-item">
                            <div class="data-label">Provider</div>
                            <div class="data-value">${PROVIDER_NAME}</div>
                        </div>
                        <div class="data-item">
                            <div class="data-label">WWW Record</div>
                            ${www_value}
                        </div>
                        <div class="data-item">
                            <div class="data-label">Status</div>
                            <div class="data-value">${www_status_html}</div>
                        </div>
                    </div>
                </div>
            </section>
EOF
}

# Infrastructure section
_org_guide_section_infra() {
    local creds_status_html
    if [[ "$DNS_CREDS_STATUS" == "configured" ]]; then
        creds_status_html="<span class=\"status status-done\">Configured</span>"
    else
        creds_status_html="<span class=\"status status-pending\">Missing</span>"
    fi

    cat << EOF
            <section>
                <div class="section-header">✓ Infrastructure</div>
                <div class="section-body">
                    <div class="data-grid">
                        <div class="data-item">
                            <div class="data-label">API Gateway</div>
                            <div class="data-value">nodeholder</div>
                        </div>
                        <div class="data-item">
                            <div class="data-label">Gateway IP</div>
                            <div class="data-value mono">165.227.6.221</div>
                        </div>
                        <div class="data-item">
                            <div class="data-label">Tetra Org</div>
                            <div class="data-value">${ORG_NAME}</div>
                        </div>
                        <div class="data-item">
                            <div class="data-label">DNS API</div>
                            <div class="data-value">${creds_status_html}</div>
                        </div>
                    </div>
                </div>
            </section>
EOF
}

# Google Sites section (only if configured)
_org_guide_section_google_sites() {
    [[ -z "$GOOGLE_SITE_URL" ]] && return

    local site_short="${GOOGLE_SITE_URL##*/}"

    cat << EOF
            <section>
                <div class="section-header">🌐 Google Sites</div>
                <div class="section-body">
                    <div class="data-grid">
                        <div class="data-item">
                            <div class="data-label">Site URL</div>
                            <div class="data-value"><a href="${GOOGLE_SITE_URL}" target="_blank">${site_short} →</a></div>
                        </div>
                        <div class="data-item">
                            <div class="data-label">Custom Domain</div>
                            <div class="data-value mono">${GOOGLE_CUSTOM_DOMAIN:-not set}</div>
                        </div>
                    </div>
                </div>
            </section>
EOF
}

# Google Analytics section (only if Google config exists)
_org_guide_section_analytics() {
    [[ -z "$GOOGLE_SITE_URL" ]] && return

    local ga4_value ga4_status_html
    if [[ "$GA4_STATUS" == "done" ]]; then
        ga4_value="<div class=\"data-value mono\" style=\"color: var(--success)\">${GOOGLE_GA4_ID}</div>"
        ga4_status_html="<span class=\"status status-done\">Active</span>"
    else
        ga4_value="<span class=\"status status-todo\">Not Configured</span>"
        ga4_status_html="<span class=\"status status-todo\">Pending</span>"
    fi

    cat << EOF
            <section>
                <div class="section-header">📊 Analytics</div>
                <div class="section-body">
                    <div class="data-grid">
                        <div class="data-item">
                            <div class="data-label">GA4 Measurement ID</div>
                            ${ga4_value}
                        </div>
                        <div class="data-item">
                            <div class="data-label">Status</div>
                            <div class="data-value">${ga4_status_html}</div>
                        </div>
                    </div>
                </div>
            </section>
EOF
}

# Stripe/Payments section
_org_guide_section_stripe() {
    local mode_html creds_html
    if [[ -n "$STRIPE_MODE" ]]; then
        if [[ "$STRIPE_MODE" == "live" ]]; then
            mode_html="<div class=\"data-value\" style=\"color: var(--success)\">Live</div>"
        else
            mode_html="<div class=\"data-value\" style=\"color: var(--warning)\">Test</div>"
        fi
    else
        mode_html="<span class=\"status status-todo\">Not Set</span>"
    fi

    if [[ "$STRIPE_STATUS" == "done" ]]; then
        creds_html="<span class=\"status status-done\">Configured</span>"
    else
        creds_html="<span class=\"status status-todo\">Missing</span>"
    fi

    cat << EOF
            <section>
                <div class="section-header">💳 Payments</div>
                <div class="section-body">
                    <div class="data-grid">
                        <div class="data-item">
                            <div class="data-label">Provider</div>
                            <div class="data-value">Stripe</div>
                        </div>
                        <div class="data-item">
                            <div class="data-label">Mode</div>
                            ${mode_html}
                        </div>
                        <div class="data-item">
                            <div class="data-label">API Keys</div>
                            <div class="data-value">${creds_html}</div>
                        </div>
                        <div class="data-item">
                            <div class="data-label">Dashboard</div>
                            <div class="data-value"><a href="https://dashboard.stripe.com" target="_blank">Open →</a></div>
                        </div>
                    </div>
                </div>
            </section>
EOF
}

# Action Required section
_org_guide_section_actions() {
    cat << EOF
            <section class="grid-full">
                <div class="section-header">⏳ Action Required</div>
                <div class="section-body">
                    <ul class="list">
EOF

    # Add CNAME if not done
    if [[ "$WWW_STATUS" != "done" ]]; then
        cat << EOF
                        <li class="list-item">
                            <div class="check"></div>
                            <div class="item-text">
                                <div class="item-title">Add CNAME record for www</div>
                                <div class="item-sub">dns remote rc add ${PRIMARY_DOMAIN} CNAME www ghs.googlehosted.com</div>
                            </div>
                        </li>
EOF
    fi

    # Connect domain in Google Sites
    local www_check_class=""
    [[ "$WWW_STATUS" == "done" ]] && www_check_class=" done"
    cat << EOF
                        <li class="list-item">
                            <div class="check${www_check_class}"></div>
                            <div class="item-text">
                                <div class="item-title">Connect domain in Google Sites</div>
                                <div class="item-sub">Settings → Custom domains → Add <code>www.${PRIMARY_DOMAIN}</code></div>
                                <a href="https://sites.google.com" target="_blank" class="btn">Open Google Sites →</a>
                            </div>
                        </li>
EOF

    # Set up GA4
    local ga4_check_class=""
    [[ "$GA4_STATUS" == "done" ]] && ga4_check_class=" done"
    cat << EOF
                        <li class="list-item">
                            <div class="check${ga4_check_class}"></div>
                            <div class="item-text">
                                <div class="item-title">Set up Google Analytics</div>
                                <div class="item-sub">Create GA4 property, add measurement ID to <code>sections/20-google.toml</code></div>
                            </div>
                        </li>
                    </ul>
                </div>
            </section>
EOF
}

# Future section
_org_guide_section_future() {
    cat << EOF
            <section>
                <div class="section-header">📋 Future</div>
                <div class="section-body">
                    <ul class="list">
EOF

    # Stripe - dynamic based on status
    if [[ "$STRIPE_STATUS" == "done" ]]; then
        cat << EOF
                        <li class="list-item">
                            <div class="check done"></div>
                            <div class="item-text">
                                <div class="item-title">Stripe payments</div>
                            </div>
                        </li>
EOF
    else
        cat << EOF
                        <li class="list-item">
                            <div class="check"></div>
                            <div class="item-text">
                                <div class="item-title">Stripe payments</div>
                                <div class="item-sub">Add STRIPE_SECRET_KEY to <code>secrets.env</code></div>
                            </div>
                        </li>
EOF
    fi

    cat << 'EOF'
                        <li class="list-item">
                            <div class="check"></div>
                            <div class="item-text">
                                <div class="item-title">Email (MX records)</div>
                            </div>
                        </li>
                        <li class="list-item">
                            <div class="check"></div>
                            <div class="item-text">
                                <div class="item-title">Root domain redirect</div>
                            </div>
                        </li>
                    </ul>
                </div>
            </section>
EOF
}

# Commands section
_org_guide_section_commands() {
    cat << EOF
            <section>
                <div class="section-header">🔧 Commands</div>
                <div class="section-body">
                    <div class="code"><span class="c"># Load credentials</span>
<span class="k">source</span> \$TETRA_DIR/orgs/${ORG_NAME}/secrets.env

<span class="c"># DNS via nodeholder</span>
dns remote rc list <span class="v">${PRIMARY_DOMAIN}</span>
dns remote rc add <span class="v">${PRIMARY_DOMAIN}</span> A @ 1.2.3.4

<span class="c"># Health check</span>
dns check <span class="v">${PRIMARY_DOMAIN}</span></div>
                </div>
            </section>
EOF
}

# Architecture diagram
_org_guide_section_architecture() {
    cat << EOF
            <section class="grid-full">
                <div class="section-header">🏗️ Architecture</div>
                <div class="section-body">
                    <div class="arch"><span class="box">┌─────────────────────────────────────────┐
│             ${PRIMARY_DOMAIN}              │
└───────────────────┬─────────────────────┘</span>
                    │ <span class="c">DNS (${PROVIDER_NAME})</span>
                    ▼
<span class="box">┌───────────────────┐</span>     ┌ ─ ─ ─ ─ ─ ─ ─ ─ ┐
<span class="box">│</span>  <span class="highlight">www</span> → Google Sites<span class="box">│</span>       <span class="c">api</span> → Server
<span class="box">└─────────┬─────────┘</span>     └ ─ ─ ─ ─ ─ ─ ─ ─ ┘
          │                    <span class="c">(future)</span>
          ▼
<span class="box">┌───────────────────┐     ┌───────────────────┐</span>
<span class="box">│</span>  Google Analytics <span class="box">│</span>     <span class="box">│</span>      Stripe      <span class="box">│</span>
<span class="box">└───────────────────┘     └───────────────────┘</span></div>
                </div>
            </section>
EOF
}

# Links section
_org_guide_section_links() {
    local dns_link
    case "$DOMAIN_PROVIDER" in
        rc) dns_link='<a href="https://manage.resellerclub.com" target="_blank">Reseller Club →</a>' ;;
        do) dns_link='<a href="https://cloud.digitalocean.com/networking/domains" target="_blank">DigitalOcean →</a>' ;;
        cf) dns_link='<a href="https://dash.cloudflare.com" target="_blank">CloudFlare →</a>' ;;
        *)  dns_link='Not configured' ;;
    esac

    cat << EOF
            <section class="grid-full">
                <div class="section-header">🔗 Links</div>
                <div class="section-body">
                    <div class="data-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
                        <div class="data-item">
                            <div class="data-label">Domain Management</div>
                            <div class="data-value">${dns_link}</div>
                        </div>
                        <div class="data-item">
                            <div class="data-label">Website</div>
                            <div class="data-value"><a href="https://sites.google.com" target="_blank">Google Sites →</a></div>
                        </div>
                        <div class="data-item">
                            <div class="data-label">Analytics</div>
                            <div class="data-value"><a href="https://analytics.google.com" target="_blank">Google Analytics →</a></div>
                        </div>
                        <div class="data-item">
                            <div class="data-label">Payments</div>
                            <div class="data-value"><a href="https://dashboard.stripe.com" target="_blank">Stripe →</a></div>
                        </div>
                    </div>
                </div>
            </section>
EOF
}

# Footer
_org_guide_section_footer() {
    cat << EOF
    <footer class="footer">
        Managed by <strong>tetra</strong> · PlaceholderMedia · ${MONTH_YEAR}
    </footer>
EOF
}

export -f _org_guide_section_header _org_guide_section_progress
export -f _org_guide_section_domain _org_guide_section_infra
export -f _org_guide_section_google_sites _org_guide_section_analytics
export -f _org_guide_section_stripe _org_guide_section_actions
export -f _org_guide_section_future _org_guide_section_commands
export -f _org_guide_section_architecture _org_guide_section_links
export -f _org_guide_section_footer
