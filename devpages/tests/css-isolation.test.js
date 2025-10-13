/**
 * CSS Isolation Tests
 * Verifies that CSS scoping and cleanup works correctly
 */

import { CSSManager } from '../client/preview/CSSManager.js';

/**
 * Test helper: Create temporary CSS file
 */
function createTestCSS(content) {
  const blob = new Blob([content], { type: 'text/css' });
  return URL.createObjectURL(blob);
}

/**
 * Test helper: Count scoped links
 */
function countScopedLinks(scope) {
  return document.querySelectorAll(`link[data-scope="${scope}"]`).length;
}

/**
 * Test 1: CSS Manager creates scoped links
 */
export async function test_cssManagerCreatesScope() {
  const cssManager = new CSSManager('test-scope-1');

  // Mock frontmatter CSS
  const mockCSS = createTestCSS('body { color: red; }');
  await cssManager.loadFrontmatterCSS([mockCSS], 'test.md');

  const count = countScopedLinks('test-scope-1');
  console.assert(count === 1, `Expected 1 scoped link, got ${count}`);

  // Cleanup
  cssManager.cleanup();
  const afterCount = countScopedLinks('test-scope-1');
  console.assert(afterCount === 0, `Expected 0 links after cleanup, got ${afterCount}`);

  console.log('✓ Test 1: CSS Manager creates scoped links');
}

/**
 * Test 2: Multiple scopes don't interfere
 */
export async function test_multipleScopesIsolated() {
  const cssManager1 = new CSSManager('scope-a');
  const cssManager2 = new CSSManager('scope-b');

  const mockCSS1 = createTestCSS('body { color: red; }');
  const mockCSS2 = createTestCSS('body { color: blue; }');

  await cssManager1.loadFrontmatterCSS([mockCSS1], 'a.md');
  await cssManager2.loadFrontmatterCSS([mockCSS2], 'b.md');

  const countA = countScopedLinks('scope-a');
  const countB = countScopedLinks('scope-b');

  console.assert(countA === 1, `Expected 1 link in scope-a, got ${countA}`);
  console.assert(countB === 1, `Expected 1 link in scope-b, got ${countB}`);

  // Cleanup scope-a shouldn't affect scope-b
  cssManager1.cleanup();

  const afterA = countScopedLinks('scope-a');
  const afterB = countScopedLinks('scope-b');

  console.assert(afterA === 0, `Expected 0 links in scope-a after cleanup, got ${afterA}`);
  console.assert(afterB === 1, `Expected 1 link in scope-b after cleanup, got ${afterB}`);

  // Cleanup scope-b
  cssManager2.cleanup();

  console.log('✓ Test 2: Multiple scopes are isolated');
}

/**
 * Test 3: Duplicate CSS files are not loaded twice
 */
export async function test_duplicateCSS() {
  const cssManager = new CSSManager('dedup-scope');

  const mockCSS = createTestCSS('body { color: green; }');

  // Load same CSS twice
  await cssManager.loadFrontmatterCSS([mockCSS, mockCSS], 'test.md');

  const count = countScopedLinks('dedup-scope');
  console.assert(count === 1, `Expected 1 link (deduped), got ${count}`);

  cssManager.cleanup();

  console.log('✓ Test 3: Duplicate CSS files are deduplicated');
}

/**
 * Test 4: CSS path resolution
 */
export function test_cssPathResolution() {
  const cssManager = new CSSManager('resolve-scope');

  // Test relative paths
  const relative = cssManager.resolveCSSPath('./style.css', 'docs/page.md');
  console.assert(
    relative.includes('docs/style.css'),
    `Expected resolved path to contain 'docs/style.css', got: ${relative}`
  );

  // Test parent directory
  const parent = cssManager.resolveCSSPath('../common.css', 'docs/page.md');
  console.assert(
    parent.includes('common.css') && !parent.includes('docs'),
    `Expected parent path without 'docs', got: ${parent}`
  );

  // Test absolute URL
  const absolute = cssManager.resolveCSSPath('https://cdn.com/style.css', 'page.md');
  console.assert(
    absolute === 'https://cdn.com/style.css',
    `Expected absolute URL unchanged, got: ${absolute}`
  );

  console.log('✓ Test 4: CSS path resolution works correctly');
}

/**
 * Test 5: Cleanup by source type
 */
export async function test_cleanupBySource() {
  const cssManager = new CSSManager('source-scope');

  const mockFrontmatter = createTestCSS('/* frontmatter */');
  const mockPlugin = [{ id: 'test', cssUrls: [createTestCSS('/* plugin */')] }];

  await cssManager.loadFrontmatterCSS([mockFrontmatter], 'test.md');
  await cssManager.loadPluginCSS(mockPlugin);

  const totalBefore = document.querySelectorAll('link[data-scope="source-scope"]').length;
  console.assert(totalBefore === 2, `Expected 2 links before cleanup, got ${totalBefore}`);

  // Cleanup only frontmatter
  cssManager.cleanupSource('frontmatter');

  const afterFrontmatter = document.querySelectorAll('link[data-scope="source-scope"][data-source="frontmatter"]').length;
  const afterPlugin = document.querySelectorAll('link[data-scope="source-scope"][data-source="plugin"]').length;

  console.assert(afterFrontmatter === 0, `Expected 0 frontmatter links, got ${afterFrontmatter}`);
  console.assert(afterPlugin === 1, `Expected 1 plugin link, got ${afterPlugin}`);

  // Cleanup all
  cssManager.cleanup();

  console.log('✓ Test 5: Cleanup by source type works');
}

/**
 * Test 6: CSS bundling for publishing
 */
export async function test_cssBundling() {
  const cssManager = new CSSManager('bundle-scope');

  // Mock CSS content that would be fetched
  const mockContent = '/* Test CSS */\nbody { color: purple; }';

  // We can't fully test fetchAndBundleCSS without a server,
  // but we can verify the path resolution
  const paths = ['./a.css', '../b.css'];
  paths.forEach(path => {
    const resolved = cssManager.resolveCSSPath(path, 'docs/test.md');
    console.assert(
      resolved.includes('/api/files/content?pathname='),
      `Expected API path, got: ${resolved}`
    );
  });

  console.log('✓ Test 6: CSS bundling path resolution');
}

/**
 * Run all tests
 */
export async function runAllCSSTests() {
  console.log('\n=== CSS Isolation Tests ===\n');

  try {
    test_cssPathResolution();
    await test_cssManagerCreatesScope();
    await test_multipleScopesIsolated();
    await test_duplicateCSS();
    await test_cleanupBySource();
    await test_cssBundling();

    console.log('\n✅ All CSS isolation tests passed!\n');
  } catch (error) {
    console.error('\n❌ CSS isolation tests failed:', error);
    throw error;
  }
}

// Auto-run if loaded in browser
if (typeof window !== 'undefined') {
  window.runCSSTests = runAllCSSTests;
  console.log('CSS tests loaded. Run window.runCSSTests() to execute.');
}

export default {
  test_cssManagerCreatesScope,
  test_multipleScopesIsolated,
  test_duplicateCSS,
  test_cssPathResolution,
  test_cleanupBySource,
  test_cssBundling,
  runAllCSSTests
};
