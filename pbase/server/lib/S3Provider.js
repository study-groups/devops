/**
 * S3Provider - DO Spaces operations
 * Adapted from tetra/gamepak/src/S3Provider.js
 */

import {
    S3Client,
    GetObjectCommand,
    PutObjectCommand,
    ListObjectsV2Command,
    HeadObjectCommand,
    DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export class S3Provider {
    /**
     * @param {object} config
     * @param {string} config.bucket - S3 bucket name
     * @param {string} config.endpoint - S3 endpoint URL
     * @param {object} config.credentials - { accessKeyId, secretAccessKey }
     * @param {string} [config.region] - Region (derived from endpoint if not provided)
     */
    constructor(config) {
        this.bucket = config.bucket;
        this.endpoint = config.endpoint;

        // Derive region from endpoint (e.g., sfo3.digitaloceanspaces.com -> sfo3)
        const region = config.region || this.parseRegion(config.endpoint);

        this.client = new S3Client({
            endpoint: config.endpoint,
            region,
            credentials: config.credentials,
            forcePathStyle: false,
        });
    }

    /**
     * Extract region from DO Spaces endpoint
     */
    parseRegion(endpoint) {
        const match = endpoint.match(/https?:\/\/([^.]+)\.digitaloceanspaces\.com/);
        return match ? match[1] : 'us-east-1';
    }

    /**
     * Get object from S3
     */
    async getObject(key) {
        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
        });

        const response = await this.client.send(command);

        return {
            body: response.Body,
            contentType: response.ContentType || 'application/octet-stream',
            contentLength: response.ContentLength || 0,
        };
    }

    /**
     * Get object as string
     */
    async getObjectString(key) {
        const { body } = await this.getObject(key);
        const chunks = [];
        for await (const chunk of body) {
            chunks.push(chunk);
        }
        return Buffer.concat(chunks).toString('utf-8');
    }

    /**
     * Get object as JSON
     */
    async getObjectJson(key) {
        const str = await this.getObjectString(key);
        return JSON.parse(str);
    }

    /**
     * Put object to S3
     */
    async putObject(key, body, options = {}) {
        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: body,
            ContentType: options.contentType || this.guessContentType(key),
            ACL: options.acl || 'public-read',
        });

        await this.client.send(command);
    }

    /**
     * Put JSON object to S3
     */
    async putObjectJson(key, data, options = {}) {
        const body = JSON.stringify(data, null, 2);
        await this.putObject(key, body, {
            contentType: 'application/json',
            ...options,
        });
    }

    /**
     * Generate signed URL for object
     */
    async getSignedUrl(key, expiresIn = 7200) {
        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
        });

        return getSignedUrl(this.client, command, { expiresIn });
    }

    /**
     * List objects with prefix
     * @param {string} prefix - Key prefix
     * @param {string} [delimiter] - Delimiter for directory-like listing
     */
    async listObjects(prefix, delimiter = null) {
        const params = {
            Bucket: this.bucket,
            Prefix: prefix,
        };

        if (delimiter) {
            params.Delimiter = delimiter;
        }

        const command = new ListObjectsV2Command(params);
        const response = await this.client.send(command);

        const result = {
            objects: (response.Contents || []).map(obj => ({
                key: obj.Key,
                size: obj.Size,
                lastModified: obj.LastModified,
            })),
            prefixes: (response.CommonPrefixes || []).map(p => p.Prefix),
        };

        return result;
    }

    /**
     * List top-level directories (games)
     */
    async listDirectories(prefix = '') {
        const { prefixes } = await this.listObjects(prefix, '/');
        return prefixes.map(p => p.replace(prefix, '').replace(/\/$/, ''));
    }

    /**
     * Check if object exists
     */
    async headObject(key) {
        try {
            const command = new HeadObjectCommand({
                Bucket: this.bucket,
                Key: key,
            });

            const response = await this.client.send(command);

            return {
                exists: true,
                size: response.ContentLength,
                contentType: response.ContentType,
                lastModified: response.LastModified,
            };
        } catch (err) {
            if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
                return { exists: false };
            }
            throw err;
        }
    }

    /**
     * Delete object
     */
    async deleteObject(key) {
        const command = new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: key,
        });

        await this.client.send(command);
    }

    /**
     * Guess content type from file extension
     */
    guessContentType(key) {
        const ext = key.split('.').pop()?.toLowerCase();
        const types = {
            html: 'text/html',
            htm: 'text/html',
            css: 'text/css',
            js: 'application/javascript',
            mjs: 'application/javascript',
            json: 'application/json',
            toml: 'application/toml',
            png: 'image/png',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            gif: 'image/gif',
            svg: 'image/svg+xml',
            webp: 'image/webp',
            ico: 'image/x-icon',
            woff: 'font/woff',
            woff2: 'font/woff2',
            ttf: 'font/ttf',
            mp3: 'audio/mpeg',
            ogg: 'audio/ogg',
            wav: 'audio/wav',
            mp4: 'video/mp4',
            webm: 'video/webm',
            wasm: 'application/wasm',
            txt: 'text/plain',
            xml: 'application/xml',
        };

        return types[ext] || 'application/octet-stream';
    }
}
