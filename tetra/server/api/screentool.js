const express = require('express');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { BASH } = require('../lib/bash');
const router = express.Router();

const TETRA_DIR = process.env.TETRA_DIR || path.join(process.env.HOME, 'tetra');

const CONFIG_WHITELIST = [
    'FFMPEG_FPS', 'FFMPEG_CRF', 'FFMPEG_PRESET', 'FFMPEG_INPUT',
    'FFMPEG_RESOLUTION', 'AUDIO_RECORDER', 'AUDIO_SAMPLE_RATE'
];

const CONFIG_DEFAULTS = {
    FFMPEG_FPS: '30',
    FFMPEG_CRF: '23',
    FFMPEG_PRESET: 'ultrafast',
    FFMPEG_INPUT: ':0',
    FFMPEG_RESOLUTION: '1920x1080',
    AUDIO_RECORDER: 'arecord',
    AUDIO_SAMPLE_RATE: '44100'
};

function getStDir(org, env) {
    const orgDir = path.join(TETRA_DIR, 'orgs', org || 'tetra');
    const candidate = path.join(orgDir, 'screentool');
    return process.env.ST_DIR || candidate;
}

function getStSrc() {
    return process.env.ST_SRC || '';
}

function parseConfigFile(configPath) {
    const config = {};
    if (!fs.existsSync(configPath)) return config;
    const lines = fs.readFileSync(configPath, 'utf8').split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const match = trimmed.match(/^([A-Z_]+)=(.*)$/);
        if (match && CONFIG_WHITELIST.includes(match[1])) {
            config[match[1]] = match[2].replace(/^["']|["']$/g, '');
        }
    }
    return config;
}

function writeConfigFile(configPath, config) {
    const lines = [];
    for (const key of CONFIG_WHITELIST) {
        if (config[key] !== undefined) {
            lines.push(`${key}=${config[key]}`);
        }
    }
    fs.writeFileSync(configPath, lines.join('\n') + '\n');
}

/**
 * GET /list - List recording sessions
 */
router.get('/list', (req, res) => {
    const { org = 'tetra', env = 'local' } = req.query;
    const stDir = getStDir(org, env);

    try {
        const script = `
            st_dir="${stDir}"
            if [[ ! -d "$st_dir" ]]; then
                echo '{"recordings":[]}'
                exit 0
            fi
            echo '{"recordings":['
            first=1
            for dir in $(ls -1d "$st_dir"/*/  2>/dev/null | sort -r); do
                id=$(basename "$dir")
                [[ "$id" =~ ^[0-9]+$ ]] || continue
                vid=$(find "$dir" -maxdepth 1 -type f \\( -name "*.mkv" -o -name "*.mp4" -o -name "*.mov" \\) | head -1)
                [[ -z "$vid" ]] && continue
                size=$(du -sh "$vid" 2>/dev/null | cut -f1)
                date=$(date -r "$id" '+%Y-%m-%d %H:%M' 2>/dev/null || echo "")
                dur=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$vid" 2>/dev/null)
                if [[ -n "$dur" ]]; then
                    secs=\${dur%%.*}
                    mins=\$((secs / 60))
                    rsecs=\$((secs % 60))
                    dur="\${mins}m\${rsecs}s"
                fi
                has_audio=false
                [[ -f "$dir/audio.wav" || -f "$dir/audio.mp3" ]] && has_audio=true
                [[ $first -eq 1 ]] && first=0 || echo ','
                echo "{\\"id\\":\\"$id\\",\\"date\\":\\"$date\\",\\"duration\\":\\"$dur\\",\\"size\\":\\"$size\\",\\"hasAudio\\":$has_audio,\\"file\\":\\"$vid\\"}"
            done
            echo ']}'
        `;
        const output = execSync(script, { shell: BASH, timeout: 15000, encoding: 'utf8' });
        const data = JSON.parse(output);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message, recordings: [] });
    }
});

/**
 * GET /info?id=X - Get ffprobe details for a recording
 */
router.get('/info', (req, res) => {
    const { id, org = 'tetra', env = 'local' } = req.query;
    if (!id) return res.status(400).json({ error: 'id required' });

    const stDir = getStDir(org, env);
    const sessionDir = path.join(stDir, id);

    try {
        const script = `
            dir="${sessionDir}"
            vid=$(find "$dir" -maxdepth 1 -type f \\( -name "*.mkv" -o -name "*.mp4" -o -name "*.mov" \\) | head -1)
            if [[ -z "$vid" ]]; then
                echo '{"error":"no video file found"}'
                exit 0
            fi
            ffprobe -v quiet -print_format json -show_format -show_streams "$vid"
        `;
        const output = execSync(script, { shell: BASH, timeout: 10000, encoding: 'utf8' });
        res.json(JSON.parse(output));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /status - Check if currently recording, with session info
 */
router.get('/status', (req, res) => {
    const { org = 'tetra', env = 'local' } = req.query;
    const stDir = getStDir(org, env);

    try {
        const script = `
            st_dir="${stDir}"
            recording=false
            session_id=""
            elapsed=""
            pid=""

            # Only match ffmpeg writing to this ST_DIR
            if pgrep -f "ffmpeg.*$st_dir" >/dev/null 2>&1; then
                recording=true
                pid=$(pgrep -f "ffmpeg.*$st_dir" | head -1)
            fi

            if [[ -L "$st_dir/latest" ]]; then
                session_id=$(readlink "$st_dir/latest")
                if [[ "$recording" == "true" && -n "$session_id" ]]; then
                    start_ts=\${session_id%%_*}
                    if [[ "$start_ts" =~ ^[0-9]+$ ]]; then
                        now=$(date +%s)
                        diff=$((now - start_ts))
                        mins=$((diff / 60))
                        secs=$((diff % 60))
                        elapsed="\${mins}m\${secs}s"
                    fi
                fi
            fi

            echo "{\\"recording\\":$recording,\\"sessionId\\":\\"$session_id\\",\\"elapsed\\":\\"$elapsed\\",\\"pid\\":\\"$pid\\"}"
        `;
        const output = execSync(script, { shell: BASH, timeout: 5000, encoding: 'utf8' });
        res.json(JSON.parse(output));
    } catch (err) {
        res.json({ recording: false, sessionId: '', elapsed: '', pid: '' });
    }
});

/**
 * GET /config - Read config from $ST_DIR/config.sh
 */
router.get('/config', (req, res) => {
    const { org = 'tetra', env = 'local' } = req.query;
    const stDir = getStDir(org, env);
    const stSrc = getStSrc();
    const configPath = path.join(stDir, 'config.sh');

    const saved = parseConfigFile(configPath);
    const config = { ...CONFIG_DEFAULTS, ...saved };
    res.json({ ST_DIR: stDir, ST_SRC: stSrc, config });
});

/**
 * POST /config - Write whitelisted config vars to $ST_DIR/config.sh
 */
router.post('/config', (req, res) => {
    const { org = 'tetra', env = 'local' } = req.query;
    const stDir = getStDir(org, env);
    const configPath = path.join(stDir, 'config.sh');

    const existing = parseConfigFile(configPath);
    const body = req.body || {};

    for (const key of CONFIG_WHITELIST) {
        if (body[key] !== undefined) {
            existing[key] = String(body[key]);
        }
    }

    try {
        writeConfigFile(configPath, existing);
        res.json({ ok: true, config: existing });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /record/start - Start a recording session
 */
router.post('/record/start', (req, res) => {
    const { org = 'tetra', env = 'local' } = req.query;
    const stDir = getStDir(org, env);
    const stSrc = getStSrc();

    if (!stSrc) {
        return res.status(400).json({ error: 'ST_SRC not set in server environment' });
    }

    try {
        const script = `
            export ST_SRC="${stSrc}"
            export ST_DIR="${stDir}"
            export ST_CONFIG="$ST_DIR/config.sh"
            source "$ST_SRC/env.sh"
            source "$ST_SRC/bash/launcher.sh"
            launcher_start_recording
        `;
        const output = execSync(script, {
            shell: BASH,
            timeout: 10000,
            encoding: 'utf8',
            env: { ...process.env, ST_SRC: stSrc, ST_DIR: stDir }
        });
        res.json({ ok: true, output: output.trim() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /record/stop - Stop the current recording session
 */
router.post('/record/stop', (req, res) => {
    const { org = 'tetra', env = 'local' } = req.query;
    const stDir = getStDir(org, env);
    const stSrc = getStSrc();

    if (!stSrc) {
        return res.status(400).json({ error: 'ST_SRC not set in server environment' });
    }

    try {
        const script = `
            export ST_SRC="${stSrc}"
            export ST_DIR="${stDir}"
            export ST_CONFIG="$ST_DIR/config.sh"
            source "$ST_SRC/env.sh"
            source "$ST_SRC/bash/launcher.sh"
            latest=$(readlink "$ST_DIR/latest" 2>/dev/null)
            if [[ -z "$latest" ]]; then
                echo '{"error":"no active session"}'
                exit 1
            fi
            launcher_stop_recording "$ST_DIR/$latest"
        `;
        const output = execSync(script, {
            shell: BASH,
            timeout: 10000,
            encoding: 'utf8',
            env: { ...process.env, ST_SRC: stSrc, ST_DIR: stDir }
        });
        res.json({ ok: true, output: output.trim() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /video/:id/:filename - Serve a video file with range support
 */
router.get('/video/:id/:filename', (req, res) => {
    const { id, filename } = req.params;
    const { org = 'tetra', env = 'local' } = req.query;

    if (id.includes('..') || filename.includes('..')) {
        return res.status(400).json({ error: 'invalid path' });
    }

    const stDir = getStDir(org, env);
    const filePath = path.join(stDir, id, filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'file not found' });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = { '.mp4': 'video/mp4', '.mkv': 'video/x-matroska', '.mov': 'video/quicktime', '.webm': 'video/webm' };
    const contentType = mimeTypes[ext] || 'video/mp4';

    const range = req.headers.range;
    if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;
        const stream = fs.createReadStream(filePath, { start, end });
        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': contentType
        });
        stream.pipe(res);
    } else {
        res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': contentType
        });
        fs.createReadStream(filePath).pipe(res);
    }
});

/**
 * POST /transcode/:id/:filename - Convert video to browser-compatible MP4
 *
 * Conversion strategy:
 * 1. Probe source file for codec info (ffprobe)
 * 2. If video is H.264 and audio is AAC: remux only (-c copy) ~instant
 * 3. If video is H.264 but audio needs conversion: copy video, transcode audio
 * 4. If video needs conversion: full transcode with libx264/aac
 *
 * Output uses -movflags +faststart to relocate moov atom for streaming.
 * Original file is preserved; new file is named <original>_converted.mp4
 */
router.post('/transcode/:id/:filename', async (req, res) => {
    const { id, filename } = req.params;
    const { org = 'tetra', env = 'local' } = req.query;

    if (id.includes('..') || filename.includes('..')) {
        return res.status(400).json({ error: 'invalid path' });
    }

    const stDir = getStDir(org, env);
    const inputPath = path.join(stDir, id, filename);
    const baseName = path.basename(filename, path.extname(filename));
    const outputPath = path.join(stDir, id, `${baseName}_converted.mp4`);

    if (!fs.existsSync(inputPath)) {
        return res.status(404).json({ error: 'source file not found' });
    }

    if (fs.existsSync(outputPath)) {
        return res.status(400).json({ error: 'converted file already exists', output: outputPath });
    }

    try {
        // Step 1: Probe source file for codec information
        const probeScript = `ffprobe -v quiet -print_format json -show_streams -show_format "${inputPath}"`;
        const probeOutput = execSync(probeScript, { shell: BASH, timeout: 10000, encoding: 'utf8' });
        const probeData = JSON.parse(probeOutput);

        const videoStream = probeData.streams?.find(s => s.codec_type === 'video');
        const audioStream = probeData.streams?.find(s => s.codec_type === 'audio');

        const sourceInfo = {
            container: probeData.format?.format_name,
            duration: probeData.format?.duration,
            size: probeData.format?.size,
            video: videoStream ? {
                codec: videoStream.codec_name,
                profile: videoStream.profile,
                width: videoStream.width,
                height: videoStream.height,
                fps: videoStream.r_frame_rate,
                bitrate: videoStream.bit_rate
            } : null,
            audio: audioStream ? {
                codec: audioStream.codec_name,
                sample_rate: audioStream.sample_rate,
                channels: audioStream.channels,
                bitrate: audioStream.bit_rate
            } : null
        };

        // Step 2: Validate source has video
        if (!videoStream) {
            return res.status(400).json({
                error: 'Source file has no video stream',
                source: sourceInfo
            });
        }

        // Step 3: Determine optimal conversion strategy
        const videoCodecName = videoStream.codec_name;
        const videoIsH264 = videoCodecName === 'h264';
        const videoIsH265 = videoCodecName === 'hevc' || videoCodecName === 'h265';
        const videoIsVP9 = videoCodecName === 'vp9';
        const audioIsAAC = audioStream?.codec_name === 'aac';
        const audioIsCompatible = !audioStream || audioIsAAC || audioStream.codec_name === 'mp3';

        let strategy, videoCodec, audioCodec, description;

        if (videoIsH264 && audioIsCompatible) {
            strategy = 'remux';
            videoCodec = 'copy';
            audioCodec = 'copy';
            description = 'Stream copy (remux) - video H.264, audio compatible. Near-instant.';
        } else if (videoIsH264 && !audioIsCompatible) {
            strategy = 'transcode_audio';
            videoCodec = 'copy';
            audioCodec = 'aac -b:a 128k';
            description = `Video copy, transcode audio from ${audioStream?.codec_name} to AAC 128kbps.`;
        } else {
            strategy = 'full_transcode';
            // For H.265/HEVC and VP9, need full re-encode to H.264
            videoCodec = 'libx264 -preset medium -crf 23';
            audioCodec = audioStream ? 'aac -b:a 128k' : null;
            const codecNote = videoIsH265 ? ' (HEVC→H.264)' : videoIsVP9 ? ' (VP9→H.264)' : '';
            description = `Full transcode: ${videoCodecName}→H.264 CRF 23${codecNote}, audio→AAC. May take a while.`;
        }

        // Step 4: Build ffmpeg command
        // -map 0:v:0: Explicitly select first video stream
        // -map 0:a?: Include audio if present (? = optional)
        // -movflags +faststart: Relocates moov atom to file start for progressive download
        // -y: Overwrite output
        const audioArgs = audioCodec ? `-c:a ${audioCodec}` : '-an';
        const ffmpegCmd = `ffmpeg -i "${inputPath}" -map 0:v:0 -map 0:a? -c:v ${videoCodec} ${audioArgs} -movflags +faststart -y "${outputPath}" 2>&1`;

        const conversionInfo = {
            source: sourceInfo,
            strategy,
            description,
            command: ffmpegCmd,
            output: `${id}/${baseName}_converted.mp4`
        };

        // Step 4: Execute conversion
        const startTime = Date.now();
        const ffmpegOutput = execSync(ffmpegCmd, {
            shell: BASH,
            timeout: 600000, // 10 min timeout
            encoding: 'utf8',
            maxBuffer: 10 * 1024 * 1024
        });

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const outputStat = fs.statSync(outputPath);

        // Step 6: Verify output has video stream
        const verifyScript = `ffprobe -v quiet -print_format json -show_streams "${outputPath}"`;
        const verifyOutput = execSync(verifyScript, { shell: BASH, timeout: 10000, encoding: 'utf8' });
        const verifyData = JSON.parse(verifyOutput);
        const outputVideoStream = verifyData.streams?.find(s => s.codec_type === 'video');

        if (!outputVideoStream) {
            fs.unlinkSync(outputPath);
            return res.status(500).json({
                error: 'Conversion failed: output has no video stream',
                source: sourceInfo,
                ffmpegLog: ffmpegOutput.slice(-3000)
            });
        }

        res.json({
            ok: true,
            ...conversionInfo,
            result: {
                elapsed: `${elapsed}s`,
                inputSize: parseInt(probeData.format?.size),
                outputSize: outputStat.size,
                compression: ((1 - outputStat.size / parseInt(probeData.format?.size)) * 100).toFixed(1) + '%',
                outputVideo: {
                    codec: outputVideoStream.codec_name,
                    width: outputVideoStream.width,
                    height: outputVideoStream.height
                },
                ffmpegLog: ffmpegOutput.slice(-2000)
            }
        });

    } catch (err) {
        // Clean up partial output on failure
        if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
        }
        res.status(500).json({
            error: err.message,
            stderr: err.stderr?.slice(-2000)
        });
    }
});

module.exports = router;
