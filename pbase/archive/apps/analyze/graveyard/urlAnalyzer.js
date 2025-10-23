import { chromium } from 'playwright';
import path from 'path';
import { analyzeURL as originalAnalyzer } from './analyzers/domAnalyzer.mjs';

export async function analyzeURL(url) {
    try {
        // Use the original analyzer but wrap it in additional error handling
        const result = await originalAnalyzer(url);
        
        if (!result || !result.treeMap) {
            throw new Error('Analysis failed to produce required data');
        }
        
        return result;
    } catch (error) {
        console.error('URL analysis error:', error);
        throw error;
    }
}

export async function analyzeTree(url) {
    try {
        const browser = await chromium.launch();
        const page = await browser.newPage();
        
        await page.goto(url);
        
        // Get the DOM tree structure
        const treeStructure = await page.evaluate(() => {
            function getNodeTree(node) {
                const tree = {
                    tag: node.tagName?.toLowerCase() || 'text',
                    children: []
                };
                
                if (node.nodeType === 3 && node.textContent.trim()) { // Text node
                    tree.content = node.textContent.trim();
                }
                
                for (const child of node.childNodes) {
                    if (child.nodeType === 1 || (child.nodeType === 3 && child.textContent.trim())) {
                        tree.children.push(getNodeTree(child));
                    }
                }
                
                return tree;
            }
            
            return getNodeTree(document.body);
        });
        
        await browser.close();
        return { treeStructure };
        
    } catch (error) {
        console.error('Tree analysis error:', error);
        throw error;
    }
}

export async function testPlaywright(url) {
    try {
        const browser = await chromium.launch();
        const page = await browser.newPage();
        
        const navigationStart = Date.now();
        await page.goto(url);
        const navigationTime = Date.now() - navigationStart;
        
        // Basic page metrics
        const metrics = await page.evaluate(() => ({
            documentHeight: document.documentElement.scrollHeight,
            documentWidth: document.documentElement.scrollWidth,
            title: document.title,
            links: document.getElementsByTagName('a').length,
            images: document.getElementsByTagName('img').length
        }));
        
        await browser.close();
        
        return {
            navigationTime,
            metrics,
            status: 'success'
        };
        
    } catch (error) {
        console.error('Playwright test error:', error);
        throw error;
    }
} 