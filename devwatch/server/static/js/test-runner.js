// Playwright Job Runner
window.addEventListener('DOMContentLoaded', () => {
    if (!window.DevWatch || !window.APP) {
        console.error("PJA SDK or APP namespace not loaded.");
        return;
    }

    const jobNameInput = document.getElementById('job-name');
    const tagsInput = document.getElementById('tags-input');
    const runJobBtn = document.getElementById('run-job-btn');
    const saveJobBtn = document.getElementById('save-job-btn');
    const dryRunBtn = document.getElementById('dry-run-btn');
    const environmentSelect = document.getElementById('environment-select');
    const updateSnapshotsToggle = document.getElementById('update-snapshots-toggle');
    const projectSelect = document.getElementById('project-select');
    const headlessToggle = document.getElementById('headless-toggle');
    const savedJobsList = document.getElementById('saved-jobs-list');
    const generatedCommand = document.getElementById('generated-command');
    const cliInput = document.getElementById('cli-input');
    const testFileSelect = document.getElementById('test-file-select');
    const refreshTestsBtn = null; // removed button
    const testsDirNote = document.getElementById('tests-dir-note');

    let jobs = [];
    let currentJobId = null;
    let namedTests = [];

    function initialize() {
        loadJobs();
        loadNamedTests();
        renderJobs();
        attachEventListeners();
        updateGeneratedCommand(); 
        refreshTestsList();
        PJA.addLogEntry("Playwright Job Runner initialized.", "success");
    }

    function attachEventListeners() {
        runJobBtn.addEventListener('click', runCurrentJob);
        saveJobBtn.addEventListener('click', saveCurrentJob);
        dryRunBtn.addEventListener('click', executeDryRun);
        tagsInput.addEventListener('input', updateGeneratedCommand);
        environmentSelect.addEventListener('change', updateGeneratedCommand);
        updateSnapshotsToggle.addEventListener('change', updateGeneratedCommand);
        if (testFileSelect) testFileSelect.addEventListener('change', updateGeneratedCommand);
        // refresh happens on init and can be triggered again by re-opening the page
        if (projectSelect) projectSelect.addEventListener('change', updateGeneratedCommand);
        if (headlessToggle) headlessToggle.addEventListener('change', updateGeneratedCommand);
        if (cliInput) cliInput.addEventListener('input', () => {
            // If a custom CLI is provided, reflect it as the generated command
            const v = cliInput.value.trim();
            generatedCommand.textContent = v || generateCommand(getTagsFromInput(), updateSnapshotsToggle.checked);
        });
    }

    function generateCommand(tags, updateSnapshots) {
        let command = 'npx playwright test';
        const file = (testFileSelect && testFileSelect.value) || '';
        if (file) {
            command += ` ${file}`;
        }
        const project = (projectSelect && projectSelect.value) || '';
        if (project) {
            command += ` --project="${project}"`;
        }
        if (headlessToggle && !headlessToggle.checked) {
            command += ' --headed';
        }
        if (tags && tags.length > 0) {
            const grep = tags.map(tag => `--grep "@${tag}"`).join(' ');
            command += ` ${grep}`;
        }
        if (updateSnapshots) {
            command += ' --update-snapshots';
        }
        return command;
    }

    function updateGeneratedCommand() {
        const tags = getTagsFromInput();
        const updateSnapshots = updateSnapshotsToggle.checked;
        const command = generateCommand(tags, updateSnapshots);
        generatedCommand.textContent = command;
    }
    
    function getTagsFromInput() {
        return tagsInput.value.split(',')
            .map(t => t.trim())
            .filter(t => t);
    }

    function loadJobs() {
        jobs = APP.utils.storage.get('playwright_jobs', []);
    }

    function saveJobs() {
        APP.utils.storage.set('playwright_jobs', jobs);
    }

    function renderJobs() {
        savedJobsList.innerHTML = '';
        if (jobs.length === 0) {
            savedJobsList.innerHTML = '<li class="saved-job-item">No saved jobs yet.</li>';
            return;
        }
        jobs.forEach(job => {
            const li = document.createElement('li');
            li.className = 'saved-job-item';
            li.dataset.jobId = job.id;
            li.innerHTML = `
                <span class="job-name">${job.name}</span>
                <div class="devwatch-btn-group">
                    <button class="devwatch-btn devwatch-btn-small run-saved-job-btn">Run</button>
                    <button class="devwatch-btn devwatch-btn-small devwatch-btn-secondary delete-saved-job-btn">Delete</button>
                </div>
            `;
            
            li.querySelector('.run-saved-job-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                runSavedJob(job.id);
            });
            
            li.querySelector('.delete-saved-job-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteJob(job.id);
            });
            
            li.addEventListener('click', () => {
                loadJobIntoBuilder(job.id);
            });

            savedJobsList.appendChild(li);
        });
    }

    async function loadNamedTests() {
        try {
            const resp = await fetch('/api/named-tests');
            namedTests = await resp.json();
        } catch (_) {
            namedTests = [];
        }
    }

    function saveCurrentJob() {
        const name = jobNameInput.value.trim();
        if (!name) {
            PJA.addLogEntry("Job name cannot be empty.", "error");
            return;
        }

        const tags = getTagsFromInput();
        const env = environmentSelect.value;
        const updateSnapshots = updateSnapshotsToggle.checked;
        const project = projectSelect ? projectSelect.value : '';
        const headless = headlessToggle ? headlessToggle.checked : true;
        
        if (currentJobId) {
            // Update existing job
            const job = jobs.find(j => j.id === currentJobId);
            job.name = name;
            job.tags = tags;
            job.env = env;
            job.updateSnapshots = updateSnapshots;
            job.project = project;
            job.headless = headless;
            PJA.addLogEntry(`Job updated: "${name}"`, "success");
        } else {
            // Create new job
            const newJob = {
                id: APP.utils.generateId(),
                name,
                tags,
                env,
                updateSnapshots,
                project,
                headless
            };
            jobs.push(newJob);
            PJA.addLogEntry(`Job saved: "${name}"`, "success");
        }
        
        saveJobs();
        renderJobs();
        clearJobBuilder();
    }
    
    function deleteJob(jobId) {
        jobs = jobs.filter(j => j.id !== jobId);
        saveJobs();
        renderJobs();
        if (currentJobId === jobId) {
            clearJobBuilder();
        }
        PJA.addLogEntry(`Job deleted.`, "info");
    }

    function loadJobIntoBuilder(jobId) {
        const job = jobs.find(j => j.id === jobId);
        if (job) {
            jobNameInput.value = job.name;
            tagsInput.value = job.tags.join(', ');
            environmentSelect.value = job.env || 'dev';
            updateSnapshotsToggle.checked = job.updateSnapshots || false;
            currentJobId = job.id;
            updateGeneratedCommand();
            PJA.addLogEntry(`Loaded job "${job.name}" into builder.`, 'info');
        }
    }

    function clearJobBuilder() {
        jobNameInput.value = '';
        tagsInput.value = '';
        environmentSelect.value = 'dev';
        updateSnapshotsToggle.checked = false;
        currentJobId = null;
        updateGeneratedCommand();
    }
    
    function runCurrentJob() {
        const name = jobNameInput.value.trim() || 'Unsaved Job';
        const tags = getTagsFromInput();
        const updateSnapshots = updateSnapshotsToggle.checked;
        const command = (cliInput && cliInput.value.trim()) || generateCommand(tags, updateSnapshots);
        const env = environmentSelect.value;
        
        executeJob(name, command, env);
        logPlannedRun(name, command);
    }
    
    function runSavedJob(jobId) {
        const job = jobs.find(j => j.id === jobId);
        if (job) {
            // Restore project/headless if present
            if (projectSelect && job.project) projectSelect.value = job.project;
            if (headlessToggle && typeof job.headless === 'boolean') headlessToggle.checked = job.headless;
            const command = generateCommand(job.tags, job.updateSnapshots);
            executeJob(job.name, command, job.env);
            logPlannedRun(job.name, command);
        }
    }

    function executeDryRun() {
        const name = jobNameInput.value.trim() || 'Unsaved Job';
        const tags = getTagsFromInput();
        const updateSnapshots = updateSnapshotsToggle.checked;
        const command = `${(cliInput && cliInput.value.trim()) || generateCommand(tags, updateSnapshots)} --list`;
        const env = environmentSelect.value;
        
        executeJob(`${name} (Dry Run)`, command, env);
        logPlannedRun(name + ' (Dry Run)', command);
    }

    async function executeJob(name, command, env) {
        const activityLog = document.getElementById('activity-log');
        // Create or update a single active job entry
        if (!window.__activeJobEntry) {
            const entry = window.DevWatch.addLogEntry(`Job "${name}" started`, 'info', { command, environment: env });
            window.__activeJobEntry = entry.id;
        } else {
            window.DevWatch.updateLogEntry(window.__activeJobEntry, { message: `Job "${name}" started` });
        }
        startProgressPolling(name);

        try {
            const response = await fetch('/api/command/run', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ command, env }),
            });

            const result = await response.json();
            
            const ok = response.ok;
            const details = ok ? formatResultDetails(result) : formatErrorDetails(result);
            window.DevWatch.updateLogEntry(window.__activeJobEntry, {
                message: `Job "${name}" ${ok ? 'Completed' : 'Failed'}`,
                detailsText: details,
                collapsed: false
            });
            // collapse after a short delay
            setTimeout(() => window.DevWatch.updateLogEntry(window.__activeJobEntry, { collapsed: true }), 2500);
        } catch (error) {
            const details = formatErrorDetails({ error: error.message });
            window.DevWatch.updateLogEntry(window.__activeJobEntry, {
                message: `Job "${name}" Failed`,
                detailsText: details
            });
        }
    }

    function logPlannedRun(name, command) {
        // Create a concise, structured confirmation log entry
        const tags = getTagsFromInput();
        const file = (testFileSelect && testFileSelect.value) || '';
        const project = (projectSelect && projectSelect.value) || '';
        const headed = headlessToggle ? !headlessToggle.checked : false;
        const updateSnapshots = updateSnapshotsToggle.checked;
        const env = environmentSelect.value;

        const summary = {
            job: name,
            command,
            environment: env,
            file: file || 'ALL',
            project: project || 'default',
            headed,
            updateSnapshots,
            tags
        };

        if (window.DevWatch && typeof window.DevWatch.addLogEntry === 'function') {
            window.DevWatch.addLogEntry('Planned test run', 'info', summary);
        }
    }

    let progressInterval = null;
    function startProgressPolling(jobName) {
        if (progressInterval) clearInterval(progressInterval);
        progressInterval = setInterval(async () => {
            try {
                const resp = await fetch('/api/playwright/progress');
                if (!resp.ok) return;
                const prog = await resp.json();
                const passed = (prog.results || []).filter(r => r.status === 'passed').length;
                const failed = (prog.results || []).filter(r => r.status === 'failed').length;
                const lines = [
                    `Running: ${prog.completedTests}/${prog.totalTests}`,
                    prog.currentTest ? `Current: ${prog.currentTest.title}` : null,
                    `Passed: ${passed} Failed: ${failed}`
                ].filter(Boolean);
                window.DevWatch.updateLogEntry(window.__activeJobEntry, { detailsText: lines.join('\n') });
            } catch (_) {
                // ignore transient errors
            }
        }, 1000);
        // Stop after 10 minutes as a safeguard
        setTimeout(() => clearInterval(progressInterval), 10 * 60 * 1000);
    }

    function formatResultDetails(result) {
        // Prefer stdout; fallback to results stats if present
        if (result.rawOutput || result.stdout) {
            return (result.rawOutput || result.stdout);
        }
        if (result.results && result.results.stats) {
            const s = result.results.stats;
            return `Total: ${s.total}, Passed: ${s.passed}, Failed: ${s.failed}, Skipped: ${s.skipped}, Duration: ${(s.duration/1000).toFixed(1)}s`;
        }
        return 'Completed';
    }

    function formatErrorDetails(result) {
        const parts = [];
        if (result.error) parts.push(String(result.error));
        if (result.stderr) parts.push(result.stderr);
        if (result.stdout) parts.push(`Output:\n${result.stdout}`);
        return parts.join('\n\n') || 'Error';
    }

    async function refreshTestsList() {
        try {
            const [testsRes, cfgRes] = await Promise.all([
                fetch('/api/tests'),
                fetch('/api/config')
            ]);
        const testsJson = await testsRes.json();
        const cfgJson = await cfgRes.json();
            const tests = Array.isArray(testsJson.availableTests) ? testsJson.availableTests : [];
            if (testsDirNote && cfgJson?.paths?.tests) {
                testsDirNote.innerHTML = `Scanning <code>${cfgJson.paths.tests}</code> for <code>*.spec.js</code>. <em>Nested folders and .ts files are not included.</em>`;
            }
            if (testFileSelect) {
                const current = testFileSelect.value;
                testFileSelect.innerHTML = '<option value="">All tests</option>';
                tests.forEach(t => {
                    if (t && t.path) {
                        const opt = document.createElement('option');
                        opt.value = t.path;
                        opt.textContent = t.name;
                        testFileSelect.appendChild(opt);
                    }
                });
                if (current) {
                    testFileSelect.value = current;
                }
            }
            // Populate projects from config
            if (projectSelect) {
                const currentProj = projectSelect.value;
                projectSelect.innerHTML = '<option value="">Default</option>';
                if (Array.isArray(cfgJson.projects)) {
                    cfgJson.projects.forEach(p => {
                        const opt = document.createElement('option');
                        opt.value = p;
                        opt.textContent = p;
                        projectSelect.appendChild(opt);
                    });
                }
                if (currentProj) projectSelect.value = currentProj;
            }
        } catch (e) {
            PJA.addLogEntry('Failed to refresh tests list', 'error', { error: String(e) });
        }
    }

    function displayResults(container, jobName, result) {
        let output = `<h4>Job "${jobName}" Completed</h4>`;

        if (result.stdout && result.stdout.includes('Running')) { // Full test run
            const summary = result.summary || { passed: 'N/A', failed: 'N/A', skipped: 'N/A' };
             output += `
                <div class="pja-success">
                    <strong>Run Summary:</strong> 
                    Passed: ${summary.passed}, 
                    Failed: ${summary.failed}, 
                    Skipped: ${summary.skipped}
                </div>`;
            if (result.details) {
                output += `<pre>${result.details}</pre>`;
            }
        } else { // Dry run
             output += `
                <div class="pja-info"><strong>Dry Run Results:</strong></div>
                <pre>${result.stdout || 'No output.'}</pre>
            `;
        }
        
        container.innerHTML = output;
    }

    function displayError(container, jobName, result) {
        let output = `<div class="pja-error"><h4>Job "${jobName}" Failed</h4>`;
        if (result.error) {
            output += `<p>${result.error}</p>`;
        }
        if (result.stderr) {
            output += `<pre>${result.stderr}</pre>`;
        }
         if (result.stdout) {
            output += `<h5>Output:</h5><pre>${result.stdout}</pre>`;
        }
        output += '</div>';
        container.innerHTML = output;
    }

    initialize();
});