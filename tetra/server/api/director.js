/**
 * Director API - Video production from tut guides
 *
 * Orchestrates vox (TTS), capture (screenshots), and ffmpeg (video build)
 * to produce narrated video walkthroughs from tut JSON guides.
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { execSync, exec } = require('child_process');

const TETRA_DIR = process.env.TETRA_DIR || path.join(process.env.HOME, 'tetra');
const ORGS_DIR = path.join(TETRA_DIR, 'orgs');
const BASH = '/opt/homebrew/bin/bash';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function directorBase(org) {
    return path.join(ORGS_DIR, org, 'director');
}

function projectDir(org, project) {
    return path.join(directorBase(org), project);
}

function projectJsonPath(org, project) {
    return path.join(projectDir(org, project), 'project.json');
}

function readProject(org, project) {
    const p = projectJsonPath(org, project);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function writeProject(org, project, data) {
    const dir = projectDir(org, project);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(projectJsonPath(org, project), JSON.stringify(data, null, 2), 'utf-8');
}

function ensureDirs(org, project) {
    const base = projectDir(org, project);
    for (const sub of ['shots', 'audio', 'output', 'segments']) {
        fs.mkdirSync(path.join(base, sub), { recursive: true });
    }
}

function pathTraversalCheck(resolved, org) {
    const orgBase = path.resolve(path.join(ORGS_DIR, org));
    return resolved.startsWith(orgBase);
}

function shellExec(cmd, timeout = 60000) {
    return execSync(cmd, { shell: BASH, timeout, encoding: 'utf-8' });
}

// ---------------------------------------------------------------------------
// Vox helpers — imported from shared vox module
// ---------------------------------------------------------------------------

const vox = require('./vox');
const { logTask, estimateCost, COST_RATES } = vox;
const VOX_DB = vox.VOX_DB;
const TASK_LOG_FILE = vox.TASK_LOG_FILE;

function estimateProjectCost(shots, provider, model) {
    let totalChars = 0;
    let shotsWithText = 0;
    for (const shot of shots) {
        if (shot.narration) {
            totalChars += shot.narration.length;
            shotsWithText++;
        }
    }
    const est = estimateCost('x'.repeat(totalChars), provider, model);
    return { ...est, totalChars, shotsWithText, totalShots: shots.length };
}

// ---------------------------------------------------------------------------
// Import: tut JSON → shot list
// ---------------------------------------------------------------------------

function importGuide(org, guideName) {
    const srcDir = path.join(ORGS_DIR, org, 'tut/src');
    const file = guideName.endsWith('.json') ? guideName : guideName + '.json';
    const srcPath = path.join(srcDir, file);

    if (!fs.existsSync(srcPath)) {
        throw new Error(`Guide not found: ${file}`);
    }

    const guide = JSON.parse(fs.readFileSync(srcPath, 'utf-8'));
    const htmlName = file.replace(/\.json$/, '.html');
    const projectName = file.replace(/\.json$/, '');
    const shots = [];
    let shotIndex = 1;

    // Detect doc type: steps[] = guide, groups[] = reference
    const docType = guide.steps ? 'guide' : 'reference';

    if (docType === 'guide') {
        // Guide: steps-based — one shot per step
        const steps = guide.steps || [];
        for (const step of steps) {
            const stepTitle = step.title || step.id || 'unnamed';
            let narration = '';
            const content = step.content || [];
            for (const block of content) {
                if (block.type === 'paragraph' || block.type === 'text') {
                    narration = block.text || block.content || '';
                    break;
                }
            }

            const id = 's' + String(shotIndex).padStart(2, '0');
            shots.push({
                id,
                group: 'steps',
                topic: stepTitle,
                stepIndex: shotIndex - 1,
                narration,
                captureUrl: `/api/tut/${org}/${htmlName}`,
                audioDuration: null,
                audioFile: null,
                screenshotFile: null,
                status: 'pending'
            });
            shotIndex++;
        }
    } else {
        // Reference: groups/topics-based — one shot per topic
        const groups = guide.groups || [];
        for (const group of groups) {
            const groupName = group.title || group.group || group.name || group.id || 'unnamed';
            const topics = group.topics || [];
            for (const topic of topics) {
                const topicName = topic.title || topic.topic || topic.name || topic.id || 'unnamed';
                const topicId = topic.id || topicName;
                let narration = '';
                const content = topic.content || [];
                for (const block of content) {
                    if (block.type === 'paragraph' || block.type === 'text') {
                        narration = block.text || block.content || '';
                        break;
                    }
                }

                const id = 's' + String(shotIndex).padStart(2, '0');
                shots.push({
                    id,
                    group: groupName,
                    topic: topicName,
                    narration,
                    captureUrl: `/api/tut/${org}/${htmlName}#${topicId}`,
                    audioDuration: null,
                    audioFile: null,
                    screenshotFile: null,
                    status: 'pending'
                });
                shotIndex++;
            }
        }
    }

    const projectData = {
        guide: file,
        voice: 'openai:shimmer',
        model: 'tts-1',
        provider: 'openai',
        resolution: { width: 1920, height: 1080 },
        fps: 30,
        transition: 'crossfade',
        transitionDuration: 0.5,
        shots
    };

    ensureDirs(org, projectName);
    writeProject(org, projectName, projectData);

    // Return full project data for immediate UI display
    return { project: projectName, shots: shots.length, data: projectData };
}

// ---------------------------------------------------------------------------
// Project CRUD
// ---------------------------------------------------------------------------

// GET /:org — list projects
router.get('/:org', (req, res) => {
    const { org } = req.params;
    const base = directorBase(org);
    try {
        if (!fs.existsSync(base)) return res.json({ org, projects: [] });
        const dirs = fs.readdirSync(base).filter(d => {
            const s = fs.statSync(path.join(base, d));
            return s.isDirectory() && fs.existsSync(path.join(base, d, 'project.json'));
        });
        const projects = dirs.map(d => {
            const data = readProject(org, d);
            return {
                name: d,
                guide: data?.guide,
                shots: data?.shots?.length || 0,
                audioReady: data?.shots?.filter(s => s.audioFile).length || 0,
                captureReady: data?.shots?.filter(s => s.screenshotFile).length || 0,
                provider: data?.provider || 'openai',
                voice: data?.voice || 'openai:shimmer',
                model: data?.model || 'tts-1'
            };
        });
        res.json({ org, projects });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /:org/import/:guide — create project from tut JSON
router.post('/:org/import/:guide', (req, res) => {
    const { org, guide } = req.params;
    try {
        const result = importGuide(org, guide);
        res.json({ ok: true, ...result });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// GET /:org/:project — get project.json
router.get('/:org/:project', (req, res) => {
    const { org, project } = req.params;
    if (['shots', 'audio', 'output', 'vox'].includes(project)) {
        return res.status(404).json({ error: 'Not found' });
    }
    const data = readProject(org, project);
    if (!data) return res.status(404).json({ error: 'Project not found' });
    res.json(data);
});

// PUT /:org/:project — update project.json
router.put('/:org/:project', (req, res) => {
    const { org, project } = req.params;
    const existing = readProject(org, project);
    if (!existing) return res.status(404).json({ error: 'Project not found' });
    const updated = { ...existing, ...req.body };
    writeProject(org, project, updated);
    res.json({ ok: true });
});

// DELETE /:org/:project — delete project
router.delete('/:org/:project', (req, res) => {
    const { org, project } = req.params;
    const dir = projectDir(org, project);
    const resolved = path.resolve(dir);
    if (!pathTraversalCheck(resolved, org)) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    if (!fs.existsSync(dir)) return res.status(404).json({ error: 'Not found' });
    fs.rmSync(dir, { recursive: true, force: true });
    res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Production: Audio
// ---------------------------------------------------------------------------

// POST /:org/:project/audio/:shotId — generate audio for one shot
router.post('/:org/:project/audio/:shotId', (req, res) => {
    const { org, project, shotId } = req.params;
    const data = readProject(org, project);
    if (!data) return res.status(404).json({ error: 'Project not found' });

    const shot = data.shots.find(s => s.id === shotId);
    if (!shot) return res.status(404).json({ error: 'Shot not found' });
    if (!shot.narration) return res.status(400).json({ error: 'No narration text' });

    const provider = req.body?.provider || data.provider || 'openai';
    const voice = req.body?.voice || data.voice || 'openai:shimmer';
    const model = req.body?.model || data.model || 'tts-1';

    // Build vox voice string (coqui uses model as voice name)
    let voxVoice;
    if (provider === 'coqui') {
        const v = voice || 'vits';
        voxVoice = 'coqui:' + (v === 'default' ? 'vits' : v);
    } else if (provider === 'formant') {
        voxVoice = 'formant:' + (voice || 'ipa');
    } else {
        voxVoice = voice.indexOf(':') !== -1 ? voice : (voice || 'shimmer');
    }

    const audioDir = path.join(projectDir(org, project), 'audio');
    fs.mkdirSync(audioDir, { recursive: true });
    const ext = provider === 'coqui' ? 'wav' : 'mp3';
    const audioFile = `${shotId}.${ext}`;
    const audioPath = path.join(audioDir, audioFile);

    // Cost estimate
    const cost = estimateCost(shot.narration, provider, model);

    try {
        const escaped = shot.narration.replace(/'/g, "'\\''");
        const modelFlag = provider === 'openai' && model && model !== 'tts-1' ? ` --model ${model}` : '';
        const t0 = Date.now();
        shellExec(
            `source ~/tetra/tetra.sh && echo '${escaped}' | vox generate ${voxVoice}${modelFlag} --output "${audioPath}"`
        );
        const encodeTime = (Date.now() - t0) / 1000;

        let duration = null;
        try {
            const out = execSync(
                `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${audioPath}"`,
                { encoding: 'utf-8', timeout: 10000 }
            );
            duration = parseFloat(out.trim()) || null;
        } catch (_) {}

        const rtf = duration ? Math.round((encodeTime / duration) * 100) / 100 : null;

        shot.audioFile = audioFile;
        shot.audioDuration = duration;
        shot.encodeTime = encodeTime;
        shot.rtf = rtf;
        shot.status = shot.screenshotFile ? 'complete' : 'partial';
        writeProject(org, project, data);

        // Write vox db meta reference for clearinghouse view
        const epoch = Math.floor(Date.now() / 1000);
        const voxId = String(epoch);
        try {
            fs.mkdirSync(VOX_DB, { recursive: true });
            const meta = {
                id: voxId,
                provider,
                voice: voxVoice,
                model: model || 'tts-1',
                duration,
                encodeTime,
                rtf,
                cost: cost.cost,
                chars: cost.chars,
                created: new Date().toISOString(),
                storagePath: audioPath,
                ref: { type: 'shot', org, project, shotId }
            };
            fs.writeFileSync(path.join(VOX_DB, `${voxId}.vox.meta.json`), JSON.stringify(meta, null, 2), 'utf-8');
            if (shot.narration) {
                fs.writeFileSync(path.join(VOX_DB, `${voxId}.vox.source.md`), shot.narration, 'utf-8');
            }
        } catch (_) {}

        logTask({
            event: 'vox_shot',
            id: voxId,
            project, shotId, provider, voice: voxVoice,
            model: model || 'tts-1',
            chars: cost.chars, cost: cost.cost,
            duration, encodeTime, rtf,
            status: 'ok'
        });

        res.json({ ok: true, shotId, id: voxId, audioFile, duration, encodeTime, rtf, cost });
    } catch (e) {
        logTask({
            event: 'vox_shot',
            project, shotId, provider, voice: voxVoice,
            model: model || 'tts-1',
            chars: cost.chars, cost: cost.cost,
            status: 'error', error: e.message
        });
        res.status(500).json({ error: e.message, cost });
    }
});

// POST /:org/:project/audio — generate audio for all shots
router.post('/:org/:project/audio', (req, res) => {
    const { org, project } = req.params;
    const data = readProject(org, project);
    if (!data) return res.status(404).json({ error: 'Project not found' });

    const provider = req.body?.provider || data.provider || 'openai';
    const voice = req.body?.voice || data.voice || 'openai:shimmer';
    const model = req.body?.model || data.model || 'tts-1';

    // Build vox voice string (coqui uses model as voice name)
    let voxVoice;
    if (provider === 'coqui') {
        const v = voice || 'vits';
        voxVoice = 'coqui:' + (v === 'default' ? 'vits' : v);
    } else if (provider === 'formant') {
        voxVoice = 'formant:' + (voice || 'ipa');
    } else {
        voxVoice = voice.indexOf(':') !== -1 ? voice : (voice || 'shimmer');
    }

    const audioDir = path.join(projectDir(org, project), 'audio');
    fs.mkdirSync(audioDir, { recursive: true });
    const ext = provider === 'coqui' ? 'wav' : 'mp3';

    const results = [];
    let totalCost = 0;
    for (const shot of data.shots) {
        if (!shot.narration) {
            results.push({ id: shot.id, skipped: true, reason: 'no narration' });
            continue;
        }
        const audioFile = `${shot.id}.${ext}`;
        const audioPath = path.join(audioDir, audioFile);
        const cost = estimateCost(shot.narration, provider, model);
        totalCost += cost.cost;

        try {
            const escaped = shot.narration.replace(/'/g, "'\\''");
            const modelFlag = provider === 'openai' && model && model !== 'tts-1' ? ` --model ${model}` : '';
            const t0 = Date.now();
            shellExec(
                `source ~/tetra/tetra.sh && echo '${escaped}' | vox generate ${voxVoice}${modelFlag} --output "${audioPath}"`
            );
            const encodeTime = (Date.now() - t0) / 1000;

            let duration = null;
            try {
                const out = execSync(
                    `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${audioPath}"`,
                    { encoding: 'utf-8', timeout: 10000 }
                );
                duration = parseFloat(out.trim()) || null;
            } catch (_) {}

            const rtf = duration ? Math.round((encodeTime / duration) * 100) / 100 : null;

            shot.audioFile = audioFile;
            shot.audioDuration = duration;
            shot.encodeTime = encodeTime;
            shot.rtf = rtf;
            shot.status = shot.screenshotFile ? 'complete' : 'partial';
            logTask({
                event: 'vox_batch',
                project, shotId: shot.id, provider, voice: voxVoice,
                model: model || 'tts-1',
                chars: cost.chars, cost: cost.cost,
                duration, encodeTime, rtf,
                status: 'ok'
            });
            results.push({ id: shot.id, audioFile, duration, encodeTime, rtf, cost });
        } catch (e) {
            logTask({
                event: 'vox_batch',
                project, shotId: shot.id, provider, voice: voxVoice,
                model: model || 'tts-1',
                chars: cost.chars, cost: cost.cost,
                status: 'error', error: e.message
            });
            results.push({ id: shot.id, error: e.message, cost });
        }
    }

    // Update project settings
    data.provider = provider;
    data.voice = voice;
    data.model = model;
    writeProject(org, project, data);
    res.json({ ok: true, results, totalCost });
});

// ---------------------------------------------------------------------------
// Production: Capture
// ---------------------------------------------------------------------------

router.post('/:org/:project/capture/:shotId', async (req, res) => {
    const { org, project, shotId } = req.params;
    const data = readProject(org, project);
    if (!data) return res.status(404).json({ error: 'Project not found' });

    const shot = data.shots.find(s => s.id === shotId);
    if (!shot) return res.status(404).json({ error: 'Shot not found' });

    const shotsDir = path.join(projectDir(org, project), 'shots');
    fs.mkdirSync(shotsDir, { recursive: true });
    const screenshotFile = `${shotId}.png`;

    try {
        const captureUrl = `http://localhost:4444${shot.captureUrl}`;
        const captureRes = await fetch(`http://localhost:4444/api/capture`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: captureUrl,
                org,
                capture: ['screenshot'],
                viewport: data.resolution || { width: 1920, height: 1080 }
            })
        });
        const captureData = await captureRes.json();

        if (captureData.screenshot) {
            const srcFile = captureData.screenshot;
            if (fs.existsSync(srcFile)) {
                fs.copyFileSync(srcFile, path.join(shotsDir, screenshotFile));
            }
        }

        shot.screenshotFile = screenshotFile;
        shot.status = shot.audioFile ? 'complete' : 'partial';
        writeProject(org, project, data);

        res.json({ ok: true, shotId, screenshotFile });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/:org/:project/capture', async (req, res) => {
    const { org, project } = req.params;
    const data = readProject(org, project);
    if (!data) return res.status(404).json({ error: 'Project not found' });

    const shotsDir = path.join(projectDir(org, project), 'shots');
    fs.mkdirSync(shotsDir, { recursive: true });

    const results = [];
    for (const shot of data.shots) {
        const screenshotFile = `${shot.id}.png`;
        try {
            const captureUrl = `http://localhost:4444${shot.captureUrl}`;
            const captureRes = await fetch(`http://localhost:4444/api/capture`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: captureUrl,
                    org,
                    capture: ['screenshot'],
                    viewport: data.resolution || { width: 1920, height: 1080 }
                })
            });
            const captureData = await captureRes.json();

            if (captureData.screenshot && fs.existsSync(captureData.screenshot)) {
                fs.copyFileSync(captureData.screenshot, path.join(shotsDir, screenshotFile));
            }

            shot.screenshotFile = screenshotFile;
            shot.status = shot.audioFile ? 'complete' : 'partial';
            results.push({ id: shot.id, screenshotFile });
        } catch (e) {
            results.push({ id: shot.id, error: e.message });
        }
    }

    writeProject(org, project, data);
    res.json({ ok: true, results });
});

// ---------------------------------------------------------------------------
// Production: Build video
// ---------------------------------------------------------------------------

router.post('/:org/:project/build', (req, res) => {
    const { org, project } = req.params;
    const data = readProject(org, project);
    if (!data) return res.status(404).json({ error: 'Project not found' });

    const base = projectDir(org, project);
    const segDir = path.join(base, 'segments');
    const outDir = path.join(base, 'output');
    fs.mkdirSync(segDir, { recursive: true });
    fs.mkdirSync(outDir, { recursive: true });

    const readyShots = data.shots.filter(s => s.audioFile && s.screenshotFile);
    if (readyShots.length === 0) {
        return res.status(400).json({ error: 'No shots with both audio and screenshot' });
    }

    try {
        const segFiles = [];
        for (const shot of readyShots) {
            const imgPath = path.join(base, 'shots', shot.screenshotFile);
            const audioPath = path.join(base, 'audio', shot.audioFile);
            const segPath = path.join(segDir, `${shot.id}.mp4`);

            execSync([
                'ffmpeg -y -loop 1',
                `-i "${imgPath}"`,
                `-i "${audioPath}"`,
                '-c:v libx264 -tune stillimage -c:a aac',
                '-shortest -pix_fmt yuv420p',
                `"${segPath}"`
            ].join(' '), { timeout: 120000 });

            segFiles.push(segPath);
        }

        const concatList = path.join(segDir, 'segments.txt');
        const listContent = segFiles.map(f => `file '${f}'`).join('\n');
        fs.writeFileSync(concatList, listContent, 'utf-8');

        const outputFile = path.join(outDir, 'video.mp4');
        const resolution = data.resolution || { width: 1920, height: 1080 };
        execSync([
            'ffmpeg -y -f concat -safe 0',
            `-i "${concatList}"`,
            '-c:v libx264 -crf 18 -preset slow',
            '-c:a aac -b:a 192k',
            `-r ${data.fps || 30}`,
            `-s ${resolution.width}x${resolution.height}`,
            `"${outputFile}"`
        ].join(' '), { timeout: 600000 });

        res.json({ ok: true, output: 'output/video.mp4', segments: readyShots.length });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ---------------------------------------------------------------------------
// Production: Publish
// ---------------------------------------------------------------------------

router.post('/:org/:project/publish', (req, res) => {
    const { org, project } = req.params;
    const data = readProject(org, project);
    if (!data) return res.status(404).json({ error: 'Project not found' });

    const outputFile = path.join(projectDir(org, project), 'output', 'video.mp4');
    if (!fs.existsSync(outputFile)) {
        return res.status(400).json({ error: 'No video to publish. Run build first.' });
    }

    try {
        shellExec(
            `source ~/tetra/tetra.sh && spaces_sync "${outputFile}" "s3://pja-videos/tut/${project}.mp4"`,
            300000
        );
        res.json({ ok: true, published: `tut/${project}.mp4` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ---------------------------------------------------------------------------
// Assets: serve files
// ---------------------------------------------------------------------------

router.get('/:org/:project/shots/:file', (req, res) => {
    const { org, project, file } = req.params;
    const filePath = path.join(projectDir(org, project), 'shots', file);
    const resolved = path.resolve(filePath);
    if (!pathTraversalCheck(resolved, org)) return res.status(403).json({ error: 'Forbidden' });
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
    res.sendFile(resolved);
});

router.get('/:org/:project/audio/:file', (req, res) => {
    const { org, project, file } = req.params;
    const filePath = path.join(projectDir(org, project), 'audio', file);
    const resolved = path.resolve(filePath);
    if (!pathTraversalCheck(resolved, org)) return res.status(403).json({ error: 'Forbidden' });
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
    res.sendFile(resolved);
});

router.get('/:org/:project/output/:file', (req, res) => {
    const { org, project, file } = req.params;
    const filePath = path.join(projectDir(org, project), 'output', file);
    const resolved = path.resolve(filePath);
    if (!pathTraversalCheck(resolved, org)) return res.status(403).json({ error: 'Forbidden' });
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
    res.sendFile(resolved);
});

module.exports = router;
