const { firefox } = require('playwright');

async function runTest() {
    const browser = await firefox.launch();
    const page = await browser.newPage();
    await page.goto('https://pixeljamarcade.com');
    const title = await page.title();
    console.log(`Page title: ${title}`);
    await browser.close();
}

runTest();

