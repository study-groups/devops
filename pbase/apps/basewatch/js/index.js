window.onload = function() {
  const token = localStorage.getItem('authToken');
  const debugEnabled = localStorage.getItem('debugEnabled') === 'true';

  // Fetch and load the SVG definitions
  fetchSvgDefinitions();
  //.catch(error => console.error('Error fetching SVG definitions:', error));
  
  // Function to load sections
  function loadSections(header, main, footer) {
    loadSection(header, 'header');
    loadSection(main, 'main');
    loadSection(footer, 'footer');
  }

  // Determine which content to load based on authentication status
  if (token && token.startsWith('Bearer ')) {
    loadSections('index-header-private.html', 
      'index-main-private.html', 
      'index-footer-private.html');
  } else {
    loadSections('login-header.html', 
      'login-body.html', 
      'login-footer.html');
  }
}

function showInfoModal() {
    const content = `
        <h2 class="text-2xl font-bold mb-1">PBASE Information</h2>
        <p class="mb-1 ">Context: global</p>
    `;

    const controls = {
        debugMode: {
            type: 'checkbox',
            label: 'Debug Mode',
            id: 'debugModeCheckbox', // Added id field
            checked: localStorage.getItem('debugMode') === 'true',
            onChange: (checked) => {
                localStorage.setItem('debugMode', checked);
                toggleDebugMode(checked);
            }
        },

        fontMode: {
            type: 'checkbox',
            label: 'Monospace Mode',
            id: 'monospaceFontCheckbox', // Added id field
            checked: localStorage.getItem('monospaceMode') === 'false',
            onChange: (checked) => {
                localStorage.setItem('monospaceMode', checked);
                toggleMonospaceMode(checked);
                document.footer.classList.toggle('monospace-font', checked);
            }
        },
  
        logoStrokeWidth: {
            type: 'slider',
            label: 'Logo Stroke Width',
            min: 0.05,
            max: 3,
            step: 0.1,
            value: 1,
            onChange: (value) => {
                const logo = document.querySelector('#logo-svg');
                if (logo) {
                    logo.style.strokeWidth = value;
                }
            }
        }
    };



    createInfoPopup(content, controls, { modal: true });
}