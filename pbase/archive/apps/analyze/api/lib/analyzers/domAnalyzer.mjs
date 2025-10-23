// pbase/apps/analyze-api/src/lib/analyzer.mjs
import { chromium } from '/root/src/pixeljam/pbase/playwright/node_modules/playwright';

import os from 'os';
import path from 'path';
import fs from 'fs/promises';

export async function analyzeDomStructure(url, options = {}) {
    const startTime = process.hrtime.bigint();
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    let meta = {};

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        // Capture screenshot after DOM content loaded
        if (options.screenshotPath) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const screenshotFileName = `${new URL(url).hostname}-${timestamp}.png`;
            const fullPath = path.join(options.screenshotPath, screenshotFileName);
            await page.screenshot({
                path: fullPath,
                fullPage: true
            });
            meta.screenshot = {
                path: fullPath,
                timestamp: timestamp
            };
        }

        const result = await page.evaluate(() => {
            // DOM traversal code stays the same...
            const getRelevantStyles = (computedStyles) => {
                const relevantStyles = [
                    "display", "position", "top", "right", "bottom", "left",
                    "margin", "padding", "width", "height", "z-index"
                ];
                const styles = {};
                for (const property of relevantStyles) {
                    styles[property] = computedStyles.getPropertyValue(property);
                }
                return styles;
            };

            const generateSemanticId = (node, parentId = null) => {
                const tag = node.tagName.toLowerCase();
                const id = node.id ? `-${node.id}` : '';
                
                // Ensure className is a string before splitting
                const classes = typeof node.className === 'string' && node.className.trim() !== ''
                    ? `-${node.className.split(' ')[0]}`
                    : '';
                
                const uniqueSuffix = Math.random().toString(36).substr(2, 4);
                return `${tag}${id}${classes}-${uniqueSuffix}`;
            };

            const nodes = {};

            const traverse = (node, parentId = null) => {
                const id = generateSemanticId(node, parentId);
                const computedStyles = window.getComputedStyle(node);
                const styles = getRelevantStyles(computedStyles);
                const boundingBox = node.getBoundingClientRect();

                nodes[id] = {
                    tagName: node.tagName,
                    className: node.className || null,
                    nodeId: node.id || null,
                    styles,
                    boundingBox: {
                        top: boundingBox.top,
                        left: boundingBox.left,
                        width: boundingBox.width,
                        height: boundingBox.height
                    }
                };

                return {
                    id,
                    tagName: node.tagName,
                    className: node.className || null,
                    nodeId: node.id || null,
                    children: [...node.children].map(child => traverse(child, id))
                };
            };

            const treeMap = traverse(document.documentElement);

            const meta = {
                url: window.location.href,
                userAgent: navigator.userAgent,
                deviceType: /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop",
                screenWidth: window.innerWidth,
                screenHeight: window.innerHeight,
                iframeCount: document.getElementsByTagName('iframe').length
            };

            return { meta, treeMap, nodes };
        });

        // Merge the meta objects
        meta = { ...result.meta, ...meta };

        // Add system info
        meta.test = {
            startedAt: new Date().toISOString(),
            duration: Number((process.hrtime.bigint() - startTime) / BigInt(1000000)),
            environment: process.env.NODE_ENV || 'development',
            system: {
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
                cpus: os.cpus().length,
                memory: {
                    total: os.totalmem(),
                    free: os.freemem(),
                    process: process.memoryUsage()
                }
            }
        };

        await browser.close();
        return { meta, treeMap: result.treeMap, nodes: result.nodes };
    } catch (err) {
        await browser.close();
        throw err;
    }
}
