import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

function loadSubstitutions(filename = 'sub.vars') {
    const subs = {};
    const data = readFileSync(filename, 'utf8');
    for (const line of data.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.includes('=')) continue;
        const [varName, val] = trimmed.split('=', 2);
        subs[varName.trim()] = val.trim();
    }
    return subs;
}

const server = createServer((req, res) => {
    const subs = loadSubstitutions('sub.vars');
    let content = readFileSync('index.html', 'utf8');
    for (const [varName, val] of Object.entries(subs)) {
        const regex = new RegExp(varName, 'g');
        content = content.replace(regex, val);
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(content);
});

server.listen(8000, () => {
    console.log('Server running at http://localhost:8000/');
});
