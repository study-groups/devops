const settings = {
    monospaceFontPopup: {
        type: 'checkbox',
        label: 'Use Monospace for Popup',
        checked: localStorage.getItem('monospaceFont') === 'true',
        onChange: function(checked) {
            const popup = document.querySelector('.popup');
            if (popup) {
                popup.style.fontFamily = checked ? 'monospace' : 'inherit';
            }
            localStorage.setItem('monospaceFont', checked);
        }
    },
    monospaceFontFooter: {
        type: 'checkbox',
        label: 'Use Monospace for Footer',
        checked: localStorage.getItem('monospaceFontFooter') === 'true',
        onChange: function(checked) {
            const footer = document.getElementById('footer');
            if (footer) {
                footer.style.fontFamily = checked ? 'monospace' : 'inherit';
            }
            localStorage.setItem('monospaceFontFooter', checked);
        }
    }
};

function applySettings() {
    for (const [key, control] of Object.entries(settings)) {
        control.onChange(control.checked);
    }
}

document.addEventListener('DOMContentLoaded', applySettings);