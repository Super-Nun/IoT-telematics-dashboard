/**
 * @fileoverview InfluxDB Client
 * @description Handles writing data to InfluxDB
 */

const { Point, InfluxDB } = require('@influxdata/influxdb-client');
module.exports = class InfluxClient {
    /**
     * Constructor for InfluxClient class.
     * 
     * @constructor
     * @param {string} [INFLUXDB_SERVER_URL=http://localhost:8086] - The URL of the InfluxDB server.
     * @param {string} [INFLUXDB_ORG=Grandline Innovation] - The name of the InfluxDB organization.
     * @param {string} [INFLUXDB_BUCKET=Vehicle Data] - The name of the InfluxDB bucket.
     * @param {number} [INFLUXDB_FLUSH_INTERVAL=10000] - The interval in milliseconds for how often the data should be flushed to the server.
     * @param {string} [INFLUXDB_TOKEN] - The token for authentication against the InfluxDB server.
     * @param {string} [INFLUXDB_MEASUREMENT_REPORT=report] - The name of the measurement for report data.
     */
    constructor() {

        const INFLUXDB_SERVER_URL = process.env.INFLUXDB_SERVER_URL || 'http://localhost:8086';
        const INFLUXDB_ORG = process.env.INFLUXDB_ORG || 'GLi';
        const INFLUXDB_BUCKET = process.env.INFLUXDB_BUCKET || 'Vehicle Data';
        const INFLUXDB_FLUSH_INTERVAL = process.env.INFLUXDB_FLUSH_INTERVAL || 10000;
        const INFLUXDB_TOKEN = process.env.INFLUXDB_TOKEN;
        this.INFLUXDB_MEASUREMENT_REPORT = process.env.INFLUXDB_MEASUREMENT_REPORT || 'report';

        const writeOption = {
            flushInterval: INFLUXDB_FLUSH_INTERVAL,
        }

        this.client = new InfluxDB({ url: INFLUXDB_SERVER_URL, token: INFLUXDB_TOKEN });
        this.influxWriteAPI = this.client.getWriteApi(INFLUXDB_ORG, INFLUXDB_BUCKET, 'ns', writeOption);
        // this.flushInterval = setInterval( () => { this.FlushData() }, INFLUXDB_FLUSH_INTERVAL);
    }

    /**
     * Returns the WriteAPI object.
     * @return {WriteAPI} The WriteAPI object.
     */
    GetWriteAPI() {
        return this.influxWriteAPI
    }

    /**
     * Writes a data point to the InfluxDB server.
     * 
     * @param {string} deviceID - The device ID of the vehicle.
     * @param {string} timestamp - The timestamp for the data point.
     * @param {Array} dataList - The list of data points to be written.
     * @param {string} [measurement=this.INFLUXDB_MEASUREMENT_REPORT] - The measurement name for the data points.
     */
    WriteData(deviceID, timestamp, dataList, measurement = this.INFLUXDB_MEASUREMENT_REPORT) {

        const point = new Point(measurement)
            .tag('id', deviceID)
            .timestamp(timestamp)

        dataList.forEach(data => {
            switch (data.dbtype) {
                case 'int':
                    point.intField(data.name, data.value);
                    break;
                case 'float':
                    point.floatField(data.name, data.value);
                    break;
                case 'string':
                    point.stringField(data.name, data.value);
                    break;
                case 'boolean':
                    point.booleanField(data.name, data.value);
                    break;
                default:
                    //console.log(`Unknown data type: ${data.dbtype}`);
                    break;

            }
        });

        this.influxWriteAPI.writePoint(point);
    }

    /**
     * Returns the InfluxDB client.
     * 
     * @returns {InfluxDB} The InfluxDB client.
     */
    GetClient() {
        return this.client
    }

    /**
     * Flushes the current batch of data points from the write buffer to InfluxDB.
     * 
     * @returns {void}
     */
    FlushData() {
        this.influxWriteAPI.flush();
    }

}
