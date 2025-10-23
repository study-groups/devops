import fs from 'fs/promises';
import path from 'path';

export async function generateReport(analysisResult, options) {
    const timestamp = new Date().toISOString();
    const reportData = {
        timestamp,
        meta: analysisResult.meta,
        domStats: {
            elementCount: Object.keys(analysisResult.nodes).length,
            screenDimensions: {
                width: analysisResult.meta.screenWidth,
                height: analysisResult.meta.screenHeight
            }
        },
        performance: {
            duration: analysisResult.meta?.test?.duration || 0
        }
    };

    const reportPath = path.join(options.reportsDir, `report-${timestamp}.json`);
    
    // Ensure the reports directory exists
    await fs.mkdir(options.reportsDir, { recursive: true });
    
    await fs.writeFile(reportPath, JSON.stringify(reportData, null, 2));
    
    return reportPath;
} 