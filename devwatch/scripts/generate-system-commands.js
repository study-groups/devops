#!/usr/bin/env node

/**
 * Generate System Commands Script
 * 
 * Creates individual JSON command files in PW_DIR/data/saved-commands/system/
 * Based on the new saved-commands architecture
 */

const path = require('path');
const { generateSystemCommands } = require('../server/static/js/system-commands-generator');

async function main() {
    // Check for PW_DIR environment variable
    const PW_DIR = process.env.PW_DIR;
    if (!PW_DIR) {
        console.error('\n❌ ERROR: PW_DIR environment variable is not set.');
        console.error('Please set PW_DIR before running this script.');
        console.error('\nExample:');
        console.error('  export PW_DIR=/path/to/your/data/directory');
        console.error('  npm run generate-system-commands\n');
        process.exit(1);
    }

    // Define output directory following new architecture
    const outputDir = path.join(PW_DIR, 'data', 'saved-commands', 'system');
    
    console.log('🔧 Generating System Commands');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📁 PW_DIR: ${PW_DIR}`);
    console.log(`📂 Output: ${outputDir}`);
    console.log('');

    try {
        const results = await generateSystemCommands(outputDir);
        
        console.log('\n✅ System Commands Generated Successfully!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📋 Summary:');
        console.log(`   • ${results.length} command files created`);
        console.log(`   • Stored in: ${outputDir}`);
        console.log(`   • Index file: ${path.join(outputDir, 'index.json')}`);
        console.log('');
        console.log('🎯 Next Steps:');
        console.log('   1. Start the Playwright server');
        console.log('   2. Open Command Runner');
        console.log('   3. Select "System" from the command type dropdown');
        console.log('   4. Execute PWD and other system commands');
        console.log('');
        
    } catch (error) {
        console.error('\n❌ Failed to generate system commands:', error.message);
        process.exit(1);
    }
}

// Run the script
main();
