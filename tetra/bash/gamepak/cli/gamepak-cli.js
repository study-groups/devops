#!/usr/bin/env node

/**
 * gamepak CLI
 *
 * Usage:
 *   gamepak list                        List all games
 *   gamepak get <slug>                  Get full game object
 *   gamepak get <slug> <topic>          Get specific topic
 *   gamepak set <slug> <topic> <json>   Set topic value
 *   gamepak publish <slug> <dir> <ver>  Publish game to S3
 *   gamepak url <slug> [variant]        Get game URL
 *   gamepak validate <slug>             Validate game HTML and manifest
 *   gamepak validate <slug> --fix       Apply fixes to S3
 *
 * Environment:
 *   TETRA_ORG    Default org (or use --org flag)
 *   TETRA_DIR    Tetra directory (default: ~/tetra)
 */

import { Gamepak, GameValidator } from '../src/index.js';

const USAGE = `
gamepak - Package manager for games

USAGE
  gamepak [--org <org>] <command> [args...]

COMMANDS
  list                        List all games
  get <slug>                  Get full game object
  get <slug> <topic>          Get specific topic (controls, permissions, etc.)
  set <slug> <topic> <json>   Set topic value
  publish <slug> <dir> <ver>  Publish game files to S3
  url <slug> [variant]        Get game URL
  manifest                    Show raw manifest
  validate <slug>             Validate game HTML and manifest
  validate <slug> --fix       Validate and apply fixes to S3
  validate --all              Validate all games

VALIDATE OPTIONS
  --fix                       Apply fixes to S3 (creates backup first)
  --json                      Output as JSON
  --no-html                   Skip HTML validation
  --no-manifest               Skip manifest validation

ENVIRONMENT
  TETRA_ORG    Default org (or use --org flag)
  TETRA_DIR    Tetra directory (default: ~/tetra)

EXAMPLES
  gamepak --org pixeljam-arcade list
  gamepak get pong controls
  gamepak set pong controls '{"gamepad": {...}}'
  gamepak publish pong ./dist 1.2.0
  gamepak validate cheap-golf
  gamepak validate cheap-golf --fix
`;

async function main() {
  const args = process.argv.slice(2);

  // Parse --org flag
  let org = process.env.TETRA_ORG;
  const orgIndex = args.indexOf('--org');
  if (orgIndex !== -1 && args[orgIndex + 1]) {
    org = args[orgIndex + 1];
    args.splice(orgIndex, 2);
  }

  const [command, ...rest] = args;

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    console.log(USAGE);
    process.exit(0);
  }

  if (!org) {
    console.error('Error: TETRA_ORG not set. Use --org flag or set TETRA_ORG environment variable.');
    process.exit(1);
  }

  try {
    const pak = await Gamepak.forOrg(org);

    switch (command) {
      case 'list': {
        const games = await pak.list({ showHidden: true });
        console.log(JSON.stringify(games, null, 2));
        break;
      }

      case 'get': {
        const [slug, topic] = rest;
        if (!slug) {
          console.error('Usage: gamepak get <slug> [topic]');
          process.exit(1);
        }
        const result = await pak.get(slug, topic || null);
        if (result === null || result === undefined) {
          console.error(`Not found: ${slug}${topic ? '.' + topic : ''}`);
          process.exit(1);
        }
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      case 'set': {
        const [slug, topic, jsonValue] = rest;
        if (!slug || !topic || !jsonValue) {
          console.error('Usage: gamepak set <slug> <topic> <json>');
          process.exit(1);
        }
        const value = JSON.parse(jsonValue);
        const result = await pak.set(slug, topic, value);
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      case 'publish': {
        const [slug, dir, version] = rest;
        if (!slug || !dir || !version) {
          console.error('Usage: gamepak publish <slug> <dir> <version>');
          process.exit(1);
        }
        const result = await pak.publish(slug, dir, version);
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      case 'url': {
        const [slug, variant] = rest;
        if (!slug) {
          console.error('Usage: gamepak url <slug> [variant]');
          process.exit(1);
        }
        // Use admin context for CLI
        const user = { isAuth: true, role: 'admin' };
        const result = await pak.resolve(slug, user, variant || 'default');
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      case 'manifest': {
        const manifest = await pak.loadManifest(true);
        console.log(JSON.stringify(manifest, null, 2));
        break;
      }

      case 'validate': {
        await handleValidate(pak, rest);
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        console.log(USAGE);
        process.exit(1);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Handle validate command
 */
async function handleValidate(pak, args) {
  // Parse options
  const options = {
    fix: false,
    json: false,
    checkHtml: true,
    checkManifest: true,
    all: false,
  };

  const slugs = [];

  for (const arg of args) {
    switch (arg) {
      case '--fix':
        options.fix = true;
        break;
      case '--json':
        options.json = true;
        break;
      case '--no-html':
        options.checkHtml = false;
        break;
      case '--no-manifest':
        options.checkManifest = false;
        break;
      case '--all':
      case '-a':
        options.all = true;
        break;
      default:
        if (!arg.startsWith('-')) {
          slugs.push(arg);
        }
    }
  }

  // Get games to validate
  let games = [];
  if (options.all) {
    games = await pak.list({ showHidden: true });
  } else if (slugs.length > 0) {
    for (const slug of slugs) {
      const game = await pak.get(slug);
      if (!game) {
        console.error(`Game not found: ${slug}`);
        process.exit(1);
      }
      games.push(game);
    }
  } else {
    console.error('Usage: gamepak validate <slug> [--fix] [--json]');
    console.error('       gamepak validate --all');
    process.exit(1);
  }

  // Create validator
  const validator = new GameValidator(pak.s3);

  // Validate each game
  const results = [];
  let hasErrors = false;

  for (const game of games) {
    const result = await validator.validate(game, {
      checkHtml: options.checkHtml,
      checkManifest: options.checkManifest,
    });

    if (result.issues.length > 0) {
      hasErrors = true;
    }

    // Apply fix if requested
    if (options.fix && (result.issues.length > 0 || result.warnings.length > 0)) {
      const fixable = [...result.issues, ...result.warnings].filter(i => i.fix);
      if (fixable.length > 0) {
        try {
          const fixResult = await validator.applyFix(result);
          result.fixed = true;
          result.backupKey = fixResult.backupKey;
        } catch (err) {
          result.fixError = err.message;
        }
      }
    }

    results.push(result);

    // Output
    if (options.json) {
      // Collect for batch JSON output
    } else {
      console.log(validator.formatText(result));
      if (result.fixed) {
        console.log(`\n✓ Fixes applied to S3`);
        if (result.backupKey) {
          console.log(`  Backup: ${result.backupKey}`);
        }
      }
      if (games.length > 1) {
        console.log('\n');
      }
    }
  }

  // JSON output
  if (options.json) {
    const output = results.map(r => {
      const { _html, _htmlPath, ...clean } = r;
      return clean;
    });
    console.log(JSON.stringify(results.length === 1 ? output[0] : output, null, 2));
  }

  // Exit code
  process.exit(hasErrors ? 1 : 0);
}

main();
