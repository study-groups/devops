class LogDisplay {
    constructor(containerElement, options = {}) {
        this.container = containerElement;
        this.columns = options.columns || [];
        this.detailsRenderer = options.detailsRenderer || (() => '');
        this.columnView = null;
    }

    render(data) {
        if (!this.container) return;

        if (data.length === 0) {
            this.showEmpty();
            return;
        }

        const options = {
            detailsRenderer: this.detailsRenderer
        };

        if (this.columnView) {
            this.columnView.data = data;
            this.columnView.render();
        } else {
            this.columnView = new ColumnView(this.container, this.columns, data, options);
        }
    }

    showLoading() {
        this.container.innerHTML = `
            <div class="log-loading pja-text-muted">
                Loading logs...
            </div>
        `;
    }

    showEmpty() {
        this.container.innerHTML = `
            <div class.log-empty pja-text-muted">
                <div class="log-empty-icon">📝</div>
                <div class="log-empty-message">No logs match your filters</div>
                <div class="log-empty-hint">Try adjusting your search or filter settings</div>
            </div>
        `;
    }

    showError(message) {
        this.container.innerHTML = `
            <div class="log-empty pja-error-bg">
                <div class="log-empty-icon pja-error">⚠️</div>
                <div class="log-empty-message pja-error">Error: ${message}</div>
                <div class="log-empty-hint pja-text-muted">Check console for details</div>
            </div>
        `;
    }
}
