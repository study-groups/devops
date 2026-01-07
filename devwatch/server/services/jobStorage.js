/**
 * Job Storage Service
 * 
 * Handles persistent storage of Bree/Cron job results for long-term recall
 */

const fs = require('fs').promises;
const path = require('path');

class JobStorageService {
    constructor(storageDir) {
        this.storageDir = storageDir;
        this.ensureDirectoryExists();
    }

    async ensureDirectoryExists() {
        try {
            await fs.mkdir(this.storageDir, { recursive: true });
        } catch (error) {
            console.error('Failed to create storage directory:', error);
        }
    }

    /**
     * Store a job result
     * @param {Object} jobResult - The job result to store
     * @param {string} jobResult.env - Environment (dev, staging, prod)
     * @param {string} jobResult.runId - Unique run identifier
     * @param {string} jobResult.type - Job type (auto, manual)
     * @param {string} jobResult.status - Job status (running, success, error, timedout)
     * @param {Object} jobResult.data - Additional job data
     */
    async storeJobResult(jobResult) {
        const { env, runId, type, status, timestamp = new Date(), ...data } = jobResult;
        
        const jobRecord = {
            runId,
            env,
            type,
            status,
            timestamp: timestamp instanceof Date ? timestamp.toISOString() : timestamp,
            data,
            storedAt: new Date().toISOString()
        };

        const filePath = path.join(this.storageDir, `${env}.json`);
        
        try {
            // Read existing jobs or start with empty array
            let jobs = [];
            try {
                const content = await fs.readFile(filePath, 'utf-8');
                jobs = JSON.parse(content);
            } catch (readError) {
                // File doesn't exist or is invalid, start fresh
                jobs = [];
            }

            // Find existing job or add new one
            const existingIndex = jobs.findIndex(job => job.runId === runId);
            if (existingIndex !== -1) {
                // Update existing job
                jobs[existingIndex] = { ...jobs[existingIndex], ...jobRecord };
            } else {
                // Add new job at the beginning
                jobs.unshift(jobRecord);
            }

            // Keep only the last 50 jobs (configurable)
            jobs = jobs.slice(0, 50);

            // Write back to file
            await fs.writeFile(filePath, JSON.stringify(jobs, null, 2));
            
            return jobRecord;
        } catch (error) {
            console.error('Failed to store job result:', error);
            throw error;
        }
    }

    /**
     * Get the last N job results for an environment
     * @param {string} env - Environment to get results for
     * @param {number} limit - Maximum number of results to return (default: 5)
     * @returns {Array} Array of job results
     */
    async getJobResults(env, limit = 5) {
        const filePath = path.join(this.storageDir, `${env}.json`);
        
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const jobs = JSON.parse(content);
            return jobs.slice(0, limit);
        } catch (error) {
            // File doesn't exist or is invalid, return empty array
            return [];
        }
    }

    /**
     * Get job results for all environments
     * @param {number} limit - Maximum number of results per environment (default: 5)
     * @returns {Object} Object with env keys and job arrays as values
     */
    async getAllJobResults(limit = 5) {
        const environments = ['dev', 'staging', 'prod'];
        const results = {};

        for (const env of environments) {
            results[env] = await this.getJobResults(env, limit);
        }

        return results;
    }

    /**
     * Update job status (useful for timeout handling)
     * @param {string} env - Environment 
     * @param {string} runId - Run ID to update
     * @param {string} status - New status
     * @param {Object} additionalData - Additional data to merge
     */
    async updateJobStatus(env, runId, status, additionalData = {}) {
        const filePath = path.join(this.storageDir, `${env}.json`);
        
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const jobs = JSON.parse(content);
            
            const jobIndex = jobs.findIndex(job => job.runId === runId);
            if (jobIndex !== -1) {
                jobs[jobIndex] = {
                    ...jobs[jobIndex],
                    status,
                    ...additionalData,
                    updatedAt: new Date().toISOString()
                };
                
                await fs.writeFile(filePath, JSON.stringify(jobs, null, 2));
                return jobs[jobIndex];
            }
            
            return null;
        } catch (error) {
            console.error('Failed to update job status:', error);
            throw error;
        }
    }

    /**
     * Clean up old job records
     * @param {number} maxAge - Maximum age in days (default: 30)
     */
    async cleanupOldJobs(maxAge = 30) {
        const environments = ['dev', 'staging', 'prod'];
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - maxAge);

        for (const env of environments) {
            const filePath = path.join(this.storageDir, `${env}.json`);
            
            try {
                const content = await fs.readFile(filePath, 'utf-8');
                const jobs = JSON.parse(content);
                
                const filteredJobs = jobs.filter(job => {
                    const jobDate = new Date(job.timestamp);
                    return jobDate > cutoffDate;
                });

                if (filteredJobs.length !== jobs.length) {
                    await fs.writeFile(filePath, JSON.stringify(filteredJobs, null, 2));
                }
            } catch (error) {
                // File doesn't exist or is invalid, skip
                continue;
            }
        }
    }
}

module.exports = JobStorageService;
