import { test, expect } from '@playwright/test';

test.describe('Preview Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4000');
    // Wait for splash screen to disappear
    await page.waitForSelector('#devpages-splash', { state: 'hidden', timeout: 15000 });
    // Wait for workspace to be ready
    await page.waitForSelector('.workspace-container', { timeout: 10000 });
    await page.waitForTimeout(500); // Extra time for layout stabilization
  });

  test('preview fills space when editor is hidden', async ({ page }) => {
    const container = page.locator('.workspace-container');
    const preview = page.locator('.workspace-preview');
    const editor = page.locator('.workspace-editor');

    // Get initial widths
    const containerBox = await container.boundingBox();
    const initialPreviewBox = await preview.boundingBox();

    console.log('Initial state:');
    console.log(`  Container width: ${containerBox.width}px`);
    console.log(`  Preview width: ${initialPreviewBox.width}px`);

    // Hide the editor by clicking the toggle
    const editToggle = page.locator('#edit-toggle');
    await editToggle.click();

    // Wait for transition
    await page.waitForTimeout(500);

    // Debug: Check editor visibility attribute
    const editorVisible = await editor.getAttribute('data-editor-visible');
    const editorDisplay = await editor.evaluate(el => getComputedStyle(el).display);
    console.log('Editor state after toggle:', { editorVisible, editorDisplay });

    // Editor should be hidden (either by attribute or display)
    expect(editorVisible === 'false' || editorDisplay === 'none').toBe(true);

    // Debug: Check CSS is being applied
    const previewFlexGrow = await preview.evaluate(el => getComputedStyle(el).flexGrow);
    const previewFlex = await preview.evaluate(el => getComputedStyle(el).flex);
    const containerHasClass = await container.evaluate(el => {
      const editor = el.querySelector('.workspace-editor');
      return editor?.getAttribute('data-editor-visible');
    });
    console.log('CSS state:', { previewFlexGrow, previewFlex, containerHasClass });

    // Get new preview width
    const newPreviewBox = await preview.boundingBox();
    console.log('After hiding editor:');
    console.log(`  Preview width: ${newPreviewBox.width}px`);

    // Preview should be significantly larger than initial 250px
    expect(newPreviewBox.width).toBeGreaterThan(initialPreviewBox.width);

    // Preview should take most of the container (accounting for sidebar)
    const sidebar = page.locator('.workspace-sidebar');
    const sidebarVisible = await sidebar.getAttribute('data-visible');

    if (sidebarVisible === 'false') {
      // If sidebar is also hidden, preview should fill container
      expect(newPreviewBox.width).toBeCloseTo(containerBox.width, -1);
    } else {
      // Preview should be larger than before
      expect(newPreviewBox.width).toBeGreaterThan(400);
    }

    // Verify CSS computed style
    const flexGrow = await preview.evaluate(el => getComputedStyle(el).flexGrow);
    expect(flexGrow).toBe('1');

    // Verify border-left is removed
    const borderLeft = await preview.evaluate(el => getComputedStyle(el).borderLeftWidth);
    expect(borderLeft).toBe('0px');
  });

  test('preview fills all space when both sidebar and editor are hidden', async ({ page }) => {
    const container = page.locator('.workspace-container');
    const preview = page.locator('.workspace-preview');

    // Hide sidebar first
    const sidebarToggle = page.locator('#sidebar-toggle');
    await sidebarToggle.click();
    await page.waitForTimeout(200);

    // Hide editor
    const editToggle = page.locator('#edit-toggle');
    await editToggle.click();
    await page.waitForTimeout(300);

    const containerBox = await container.boundingBox();
    const previewBox = await preview.boundingBox();

    console.log('Both hidden:');
    console.log(`  Container width: ${containerBox.width}px`);
    console.log(`  Preview width: ${previewBox.width}px`);

    // Preview should fill entire container width
    expect(previewBox.width).toBeCloseTo(containerBox.width, -1);
  });
});
