
function renderTerminal(step) {
    const terminal = document.getElementById('terminal');
    terminal.innerHTML = '';

    const content = terminalContent[step] || [];

    content.forEach((line, index) => {
        setTimeout(() => {
            const lineDiv = document.createElement('div');
            lineDiv.className = `terminal-line ${line.type}`;

            if (line.type === 'blank') {
                lineDiv.innerHTML = '&nbsp;';
            } else if (line.inline) {
                const span = document.createElement('span');
                span.textContent = line.text;
                lineDiv.appendChild(span);
                lineDiv.style.display = 'inline';
            } else {
                if (line.highlight) {
                    const span = document.createElement('span');
                    span.className = 'highlight';
                    span.textContent = line.text;
                    lineDiv.appendChild(span);
                } else {
                    lineDiv.textContent = line.text;
                }
            }

            terminal.appendChild(lineDiv);
            lineDiv.classList.add('visible');

            // Auto-scroll to bottom
            terminal.scrollTop = terminal.scrollHeight;
        }, index * 100);
    });
}

function updateStep() {
    // Hide all steps
    document.querySelectorAll('.step').forEach(step => {
        step.classList.remove('active');
    });

    // Show current step
    const currentStepEl = document.querySelector(`[data-step="${currentStep}"]`);
    if (currentStepEl) {
        currentStepEl.classList.add('active');
    }

    // Update buttons
    document.getElementById('prevBtn').disabled = currentStep === 0;
    document.getElementById('nextBtn').disabled = currentStep === totalSteps;

    if (currentStep === totalSteps) {
        document.getElementById('nextBtn').textContent = '✓ Complete';
    } else {
        document.getElementById('nextBtn').textContent = 'Next →';
    }

    // Update progress
    document.getElementById('progress').textContent = `Step ${currentStep + 1} of ${totalSteps + 1}`;

    // Update terminal
    renderTerminal(currentStep);

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function nextStep() {
    if (currentStep < totalSteps) {
        currentStep++;
        updateStep();
    }
}

function prevStep() {
    if (currentStep > 0) {
        currentStep--;
        updateStep();
    }
}

function toggleDetails(element) {
    const section = element.closest('.details-section');
    section.classList.toggle('collapsed');
}

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' && currentStep < totalSteps) {
        nextStep();
    } else if (e.key === 'ArrowLeft' && currentStep > 0) {
        prevStep();
    }
});

// Initialize
updateStep();
