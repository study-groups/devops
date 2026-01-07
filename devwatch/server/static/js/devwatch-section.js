document.addEventListener('DOMContentLoaded', () => {
    document.body.addEventListener('click', event => {
        const header = event.target.closest('.devwatch-section-header');
        if (header) {
            const section = header.closest('.devwatch-section');
            if (section) {
                section.classList.toggle('is-open');
            }
        }
    });
});
