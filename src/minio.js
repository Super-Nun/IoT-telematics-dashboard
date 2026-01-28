/**
 * Minio Client
 *
 * Handles writing data to Minio
 *
 * @export
 * @class MinioClient
 */
const Minio = require('minio');

module.exports = class MinioClient {
    /**
     * Constructor for MinioClient class.
     */
    constructor() {
        const URL = process.env.MINIO_SERVER_URL;
        const PORT = process.env.MINIO_SERVER_PORT;
        const SSL = process.env.MINIO_SERVER_SSL;
        const ACCESS_KEY = process.env.MINIO_ACCESS_KEY;
        const SECRET_KEY = process.env.MINIO_SECRET_KEY;

        this.client = new Minio.Client({
            endPoint: URL,
            port: parseInt(PORT),
            useSSL: String(SSL).toLowerCase() === 'true',
            accessKey: ACCESS_KEY,
            secretKey: SECRET_KEY,
        });

        console.log('[Minio] ✅ Minio client initialized');
    }

    /**
     * Writes the given data to the specified Minio bucket.
     *
     * @param {string} bucketName - The name of the Minio bucket to write to.
     * @param {string} objectName - The name of the object within the bucket to write to.
     * @param {Buffer|Stream} data - The data to write to Minio.
     * @param {Object} metaData - Optional. The meta data to associate with the object.
     */
    async WriteToBucket(bucketName, objectName, data, metaData = {}) {
        if (!this.client) {
            console.error('[Minio] ❌ Minio client is not initialized');
            return;
        }

        console.log(`[Minio] ⏳ Uploading to bucket: "${bucketName}", object: "${objectName}"`);

        try {
            const result = await this.client.putObject(bucketName, objectName, data, metaData);
            console.log(`[Minio] ✅ Upload successful. ETag: ${result?.etag || result}`);
        } catch (err) {
            console.error('[Minio] ❌ Upload failed:', err.message || err);
        }
    }
}
