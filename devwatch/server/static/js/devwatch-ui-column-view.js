/* pja-ui-column-view.js */

class ColumnView {
    constructor(container, columns, data, options = {}) {
        this.container = container;
        this.columns = columns;
        this.data = data;
        this.detailsRenderer = options.detailsRenderer;
        this.sortManager = new SortManager('timestamp', 'desc');
        this.timeManager = new TimeManager();
        this.render();
    }

    render() {
        this.container.innerHTML = '';
        this.container.classList.add('devwatch-table');

        this.renderHeader();
        this.renderBody();
    }

    renderHeader() {
        const header = document.createElement('div');
        header.className = 'devwatch-table__header';

        this.columns.forEach(col => {
            const cell = document.createElement('div');
            cell.className = 'devwatch-table__header-cell';
            cell.textContent = col.title;
            cell.style.width = col.width;
            cell.dataset.id = col.id;

            if (col.sortable) {
                cell.addEventListener('dblclick', () => this.handleSort(col.id));
                const sortIndicator = document.createElement('span');
                sortIndicator.className = 'devwatch-table__sort-indicator';
                cell.appendChild(sortIndicator);
            }
            
            if (col.id === 'timestamp') {
                 cell.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    this.timeManager.toggleFormat();
                    this.renderBody();
                });
            }

            const resizer = document.createElement('div');
            resizer.className = 'devwatch-table__resizer';
            resizer.addEventListener('mousedown', (e) => this.initResize(e, cell));
            cell.appendChild(resizer);

            header.appendChild(cell);
        });

        this.container.appendChild(header);
        this.updateSortIndicators();
    }

    renderBody() {
        if (this.body) {
            this.body.remove();
        }
        
        this.body = document.createElement('div');
        this.body.className = 'devwatch-table__body';

        const sortedData = this.sortManager.sort(this.data);

        sortedData.forEach(row => {
            const rowEl = document.createElement('div');
            rowEl.className = 'devwatch-table__row';

            this.columns.forEach(col => {
                const cell = document.createElement('div');
                cell.className = 'devwatch-table__cell';
                cell.dataset.colId = col.id;
                let value = row[col.id] || '';
                if (col.id === 'timestamp') {
                    value = this.timeManager.format(value);
                }
                
                if (col.cellRenderer) {
                    cell.innerHTML = col.cellRenderer(value);
                } else {
                    cell.textContent = value;
                }

                cell.title = value;
                const column = this.columns.find(c => c.id === col.id);
                if (column) {
                   cell.style.width = column.width;
                }
                rowEl.appendChild(cell);
            });

            this.body.appendChild(rowEl);

            if (this.detailsRenderer) {
                const detailsContent = this.detailsRenderer(row);
                if (detailsContent) {
                    const detailsEl = document.createElement('div');
                    detailsEl.className = 'devwatch-table__row-details';
                    detailsEl.style.display = 'none';
                    detailsEl.innerHTML = detailsContent;

                    rowEl.style.cursor = 'pointer';
                    rowEl.addEventListener('click', () => {
                        const isVisible = detailsEl.style.display !== 'none';
                        detailsEl.style.display = isVisible ? 'none' : 'block';
                        rowEl.classList.toggle('expanded', !isVisible);
                    });
                    
                    this.body.appendChild(detailsEl);
                }
            }
        });

        this.container.appendChild(this.body);
    }

    handleSort(columnId) {
        this.sortManager.setSort(columnId);
        this.updateSortIndicators();
        this.renderBody();
    }

    updateSortIndicators() {
        this.container.querySelectorAll('.devwatch-table__header-cell').forEach(cell => {
            const indicator = cell.querySelector('.devwatch-table__sort-indicator');
            if (indicator) {
                if (cell.dataset.id === this.sortManager.column) {
                    indicator.textContent = this.sortManager.direction === 'asc' ? '▲' : '▼';
                } else {
                    indicator.textContent = '';
                }
            }
        });
    }

    initResize(e, cell) {
        e.stopPropagation();
        const startX = e.clientX;
        const startWidth = cell.offsetWidth;
        const colId = cell.dataset.id;
        const column = this.columns.find(c => c.id === colId);

        const doDrag = (e) => {
            const newWidth = startWidth + (e.clientX - startX);
            if (newWidth > 30) { // Set a minimum width
                if (column) {
                    column.width = `${newWidth}px`;
                }
                cell.style.width = `${newWidth}px`;
                
                this.body.querySelectorAll(`.devwatch-table__cell[data-col-id="${colId}"]`).forEach(dataCell => {
                    dataCell.style.width = `${newWidth}px`;
                });
            }
        };

        const stopDrag = () => {
            document.removeEventListener('mousemove', doDrag);
            document.removeEventListener('mouseup', stopDrag);
        };

        document.addEventListener('mousemove', doDrag);
        document.addEventListener('mouseup', stopDrag);
    }
}

class SortManager {
    constructor(defaultColumn, defaultDirection) {
        this.column = defaultColumn;
        this.direction = defaultDirection;
    }

    setSort(column) {
        if (this.column === column) {
            this.direction = this.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.column = column;
            this.direction = 'asc';
        }
    }

    sort(data) {
        return [...data].sort((a, b) => {
            const valA = a[this.column];
            const valB = b[this.column];

            if (valA < valB) return this.direction === 'asc' ? -1 : 1;
            if (valA > valB) return this.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }
}

class TimeManager {
    constructor(defaultFormat = 'relative') {
        this.formatType = defaultFormat; // 'relative' or 'absolute'
    }

    toggleFormat() {
        this.formatType = this.formatType === 'relative' ? 'absolute' : 'relative';
    }

    format(timestamp) {
        if (this.formatType === 'absolute') {
            return new Date(timestamp).toLocaleString();
        } else {
            const now = new Date();
            const seconds = Math.floor((now - new Date(timestamp)) / 1000);
            if (seconds < 60) return `${seconds}s ago`;
            const minutes = Math.floor(seconds / 60);
            if (minutes < 60) return `${minutes}m ago`;
            const hours = Math.floor(minutes / 60);
            if (hours < 24) return `${hours}h ago`;
            const days = Math.floor(hours / 24);
            return `${days}d ago`;
        }
    }
}
