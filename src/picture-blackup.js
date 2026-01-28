/**
 * Class Picture
 *
 * Handles picture data from Atrack GPS trackers
 *
 * @export
 * @class Picture
 */
const fs = require('fs');
const { Readable } = require('stream');

module.exports = class Picture {
    /**
     * Constructor for Picture class.
     *
     * @param {Buffer} firstBuffer - The first picture data packet from the Atrack GPS tracker.
     * @param {string} deviceID - The device ID of the vehicle.
     * @param {MinioClient} dbClient - The Minio client that writes data to the picture database.
     *
     * @returns {void}
     */
    constructor(firstBuffer, deviceID, dbClient) {
        const firstBufferInfo = this.ExtractPictureFrame(firstBuffer);

        this.pictureRTC = firstBufferInfo[0];
        this.currentPackageID = firstBufferInfo[1];
        this.totalPackageCount = firstBufferInfo[2];
        this.pictureContent = firstBufferInfo[4];

        const PICTURE_SAVE_TARGET = process.env.PICTURE_SAVE_TARGET;
        if (PICTURE_SAVE_TARGET === 'folder') {
            this.saveTarget = 'folder';
        } else {
            this.saveTarget = 'database';
        }

        this.deviceID = deviceID;
        this.dbClient = dbClient;
        this.dbBucket = process.env.PICTURE_BUCKET;

        // กำหนด default path เป็น '.' หาก env เป็น empty string หรือ undefined
        this.filePath = process.env.PICTURE_PATH && process.env.PICTURE_PATH.trim() !== '' ? process.env.PICTURE_PATH : '.';
        this.fileExt = process.env.PICTURE_EXT || 'jpg';

        this.fileName = `${this.deviceID}_${this.pictureRTC}.${this.fileExt}`;
        this.fullFilePath = `${this.filePath}/${this.fileName}`;

        console.log(`[Picture] Initialized with saveTarget: ${this.saveTarget}`);
        console.log(`[Picture] File will be saved to: ${this.fullFilePath}`);
    }

    /**
     * Extract picture frame information from a picture data packet.
     *
     * Extracts the picture RTC, package ID, total package ID, package size, and picture data
     * from a picture data packet.
     *
     * @param {Buffer} buffer - The picture data packet from the Atrack GPS tracker.
     *
     * @returns {array} An array containing the picture RTC, package ID, total package ID, package size, and picture data.
     */
    ExtractPictureFrame(buffer) {
        const pictureRTC = parseInt(buffer.subarray(0, 4).toString('hex'), 16);
        const picturePackageID = parseInt(buffer.subarray(4, 5).toString('hex'), 16);
        const pictureTotalID = parseInt(buffer.subarray(5, 6).toString('hex'), 16);
        const picturePackageSize = parseInt(buffer.subarray(6, 8).toString('hex'), 16);
        const pictureData = buffer.subarray(8);

        //console.log(`[Picture] RTC: ${pictureRTC}, PackageID: ${picturePackageID}, TotalID: ${pictureTotalID}, Size: ${picturePackageSize}`);

        return [pictureRTC, picturePackageID, pictureTotalID, picturePackageSize, pictureData];
    }

    CheckPictureFrame(info) {
        // TODO: implement validation if needed
        return true;
    }

    /**
     * Add a picture data package to the current picture.
     *
     * @param {Buffer} pictureBuffer - The picture data package from the Atrack GPS tracker.
     * @returns {boolean} True if package added successfully, else false.
     */
    async AddPicturePackage(pictureBuffer) {
        const pictureInfo = this.ExtractPictureFrame(pictureBuffer);

        if (!this.CheckPictureFrame(pictureInfo)) {
            console.log('[Picture] Invalid picture frame detected.');
            return false;
        }

        console.log(`[Picture] Adding package ${pictureInfo[1]} / ${this.totalPackageCount}`);

        this.pictureContent = Buffer.concat([this.pictureContent, pictureInfo[4]]);
        this.currentPackageID = pictureInfo[1];

        if (this.totalPackageCount === pictureInfo[1]) {
            console.log('[Picture] All picture data received.');
            switch (this.saveTarget) {
                case 'folder':
                    console.log('[Picture] Saving picture to folder...');
                    this.WriteToFolder(this.pictureContent);
                    break;
                case 'database':
                    console.log('[Picture] Saving picture to database...');
                    await this.WriteToDB(this.pictureContent);
                    break;
                default:
                    console.log('[Picture] Unknown save target.');
            }
        }
        return true;
    }

    /**
     * Write the picture data to a file on disk.
     * @param {Buffer} content
     */
    WriteToFolder(content) {
        console.log(`[Picture] Attempting to save picture to folder: ${this.fullFilePath}`);
        fs.mkdir(this.filePath, { recursive: true }, (err) => {
            if (err) {
                console.error('[Picture] Failed to create directory:', err);
                return;
            }
            const ws = fs.createWriteStream(this.fullFilePath);
            ws.on('error', (err) => {
                console.error('[Picture] Write stream error:', err);
            });
            ws.write(content);
            ws.end(() => {
                console.log(`[Picture] Successfully saved picture to folder: ${this.fullFilePath}`);
            });
        });
    }

    /**
     * Write the picture data to the Minio database.
     * @param {Buffer} content
     */
    async WriteToDB(content) {
        console.log('[Picture] Attempting to save picture to database...');
        if (this.dbClient && typeof this.dbClient.WriteToBucket === 'function') {
            try {
                const contentStream = Readable.from(content);
                await this.dbClient.WriteToBucket(this.dbBucket, `${this.deviceID}/${this.fileName}`, contentStream);
                console.log('[Picture] Successfully saved picture to database.');
            } catch (err) {
                console.error('[Picture] Error saving to DB:', err);
            }
        } else {
            console.error('[Picture] DB client not available or invalid.');
        }
    }

    /**
     * Check if all picture data packages have been received.
     * @returns {boolean}
     */
    isDone() {
        return this.currentPackageID === this.totalPackageCount;
    }
}
