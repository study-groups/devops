const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Navigate to the app
  const port = process.env.PORT || 3000;
  await page.goto(`http://localhost:${port}`);
  
  // Wait for terminal to load
  await page.waitForSelector('#terminal-container', { timeout: 5000 });
  
  // Get terminal container data
  const terminalData = await page.evaluate(() => {
    const container = document.querySelector('#terminal-container');
    const terminal = document.querySelector('#terminal');
    const tetraContainer = document.querySelector('#tetra-container');
    
    if (!container) return null;
    
    const containerRect = container.getBoundingClientRect();
    const containerStyle = window.getComputedStyle(container);
    
    const terminalRect = terminal ? terminal.getBoundingClientRect() : null;
    const terminalStyle = terminal ? window.getComputedStyle(terminal) : null;
    
    const tetraRect = tetraContainer ? tetraContainer.getBoundingClientRect() : null;
    const tetraStyle = tetraContainer ? window.getComputedStyle(tetraContainer) : null;
    
    return {
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      tetraContainer: tetraRect ? {
        rect: tetraRect,
        style: {
          maxWidth: tetraStyle.maxWidth,
          margin: tetraStyle.margin,
          gridTemplateRows: tetraStyle.gridTemplateRows,
          height: tetraStyle.height
        }
      } : null,
      terminalContainer: {
        rect: containerRect,
        style: {
          gridArea: containerStyle.gridArea,
          height: containerStyle.height,
          padding: containerStyle.padding,
          position: containerStyle.position,
          overflow: containerStyle.overflow
        }
      },
      terminal: terminalRect ? {
        rect: terminalRect,
        style: {
          width: terminalStyle.width,
          height: terminalStyle.height,
          position: terminalStyle.position
        }
      } : null
    };
  });
  
  // Create output directory
  const outputDir = path.join(__dirname, '..', 'debug-output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Save baseline data
  const outputFile = process.argv[2] === 'after' ? 'after-change.json' : 'baseline.json';
  fs.writeFileSync(
    path.join(outputDir, outputFile),
    JSON.stringify(terminalData, null, 2)
  );
  
  console.log(`Captured terminal state to ${outputFile}`);
  
  await browser.close();
})().catch(console.error);
