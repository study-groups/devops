// Orgs Panel - TOML Parsers
// Parse environments, volumes, SSH keys from TOML content

function parseEnvironments(content) {
    const envs = [];
    const envRegex = /\[env\.(\w+)\]([\s\S]*?)(?=\[|\z)/g;
    let match;

    while ((match = envRegex.exec(content)) !== null) {
        const name = match[1];
        const block = match[2];

        const env = { name };

        const hostMatch = block.match(/host\s*=\s*"([^"]+)"/);
        if (hostMatch) env.host = hostMatch[1];

        const descMatch = block.match(/description\s*=\s*"([^"]+)"/);
        if (descMatch) env.description = descMatch[1];

        const domainMatch = block.match(/domain\s*=\s*"([^"]+)"/);
        if (domainMatch) env.domain = domainMatch[1];

        const regionMatch = block.match(/region\s*=\s*"([^"]+)"/);
        if (regionMatch) env.region = regionMatch[1];

        envs.push(env);
    }

    return envs;
}

function parseVolumes(content) {
    const volumes = [];
    const volRegex = /\[storage\.volumes\.([^\]]+)\]([\s\S]*?)(?=\[|\z)/g;
    let match;

    while ((match = volRegex.exec(content)) !== null) {
        const name = match[1];
        const block = match[2];

        const vol = { name };

        const sizeMatch = block.match(/size_gb\s*=\s*(\d+)/);
        if (sizeMatch) vol.size_gb = parseInt(sizeMatch[1]);

        const regionMatch = block.match(/region\s*=\s*"([^"]+)"/);
        if (regionMatch) vol.region = regionMatch[1];

        const attachedMatch = block.match(/attached_to\s*=\s*"([^"]+)"/);
        if (attachedMatch) vol.attached_to = attachedMatch[1];

        volumes.push(vol);
    }

    return volumes;
}

function parseSSHKeys(content) {
    const keys = [];
    const keysMatch = content.match(/\[ssh_keys\]([\s\S]*?)(?=\[|\z)/);

    if (keysMatch) {
        const keyRegex = /"([^"]+)"\s*=\s*"([^"]+)"/g;
        let match;
        while ((match = keyRegex.exec(keysMatch[1])) !== null) {
            keys.push({ name: match[1], fingerprint: match[2] });
        }
    }

    return keys;
}
