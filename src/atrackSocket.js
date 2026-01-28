/**
 * Handles communication with Atrack GPS trackers.
 *
 * This file contains the implementation of the ClientSocket class which
 * handles the communication with the Atrack GPS trackers. It receives and
 * parses the data from the trackers and sends the commands.
 */

const Utilities = require('./utilities');
const Picture = require('./picture');
const Pattern = require('./pattern.js');

module.exports = class ClientSocket {
    /**
     * Constructor for ClientSocket class.
     *
     * @param {Socket} socket - The socket object that communicates with the Atrack GPS tracker.
     * @param {InfluxDBClient} timeSeriesDB - The InfluxDB client that writes data to the time series database.
     * @param {MinioClient} pictureDB - The Minio client that writes data to the picture database.
     */
    constructor(socket, timeSeriesDB, pictureDB) {
        this.socket = socket;
        this.deviceID = undefined;
        this.lastAlive = Date.now();
        this.seqNum = undefined;
        this.reportType = undefined;
        this.timeSeriesDB = timeSeriesDB;
        this.pictureDB = pictureDB;
        this.SOCKET_TIMEOUT = process.env.SOCKET_TIMEOUT || 60000;
        this.GET_REPORT_FORMAT_INTERVAL = process.env.GET_REPORT_FORMAT_INTERVAL || 30000;

        // base = no custom report => all false
        // custom = AK7V + OBDII
        // j1708 = AK7V + J1708
        // j1939 = AK7V + J1939
        this.cmdForm = "$FORM";
        this.cmdJ1708 = "$1708";
        this.cmdJ1939 = "$FMSC";
        this.isReportCustom = undefined;
        this.isReportJ1708 = undefined;
        this.isReportJ1939 = undefined;
        this.reportFormatType = undefined;
        this.reportJ1XXXFormat = undefined;
        this.reportCustomFormat = undefined;
        this.reportBaseFormat = ["GPSTime","RTCTime","SendTime","LNG","LAT","Heading","ReportID","Odometer","HDOP","InputStatus",
                                 "Speed","OutputStatus","AnalogInputValue","DriverID","1stTemp","2ndTemp","TextMsg"];
        this.atrackPattern = new Pattern(process.env.REPORT_PATTERN_PATH);

        this.keepAliveCheck = setInterval(() => {
            this.CheckTimeout();
        }, this.SOCKET_TIMEOUT);

        setTimeout(() => this.GetReportFormat(), 5000);
        this.getReportFormatInterval = setInterval(() => {
            this.GetReportFormat();
        }, this.GET_REPORT_FORMAT_INTERVAL);
    }

    /**
     * Get the device ID of the connected Atrack GPS tracker.
     *
     * If the device ID is already known, return the device ID.
     * If the device ID is not known, return a promise that resolves with the device ID in 100ms intervals.
     * If the device ID is not known after 60 seconds, return undefined.
     *
     * @return {Promise<bigint | undefined>} The device ID of the connected Atrack GPS tracker, or undefined if it cannot be obtained in 60 seconds.
     */
    async GetDeviceID() {
        if (this.deviceID) {
            return this.deviceID;
        } else {
            return new Promise(resolve => {
                const checkDeviceID = setInterval(() => {
                    if (this.deviceID) {
                        clearInterval(checkDeviceID);
                        resolve(this.deviceID);
                    }
                }, 100);

                // Cannot get deivce id in 60 seconds => return undefined
                setTimeout(() => {
                    clearInterval(checkDeviceID);
                    resolve(undefined);
                }, 60000);
            });
        }
    }


    /**
     * Handle the received data from the Atrack GPS tracker.
     *
     * This method is called when data is received from the Atrack GPS tracker.
     * It will determine the type of message received by looking at the first two bytes of the buffer.
     *
     * If the message is a keep alive message, it will update the last keep alive time.
     * If the message is a report message, it will call HandleReportMsg.
     * If the message is a picture message, it will call HandlePictureMsg.
     *
     * In all cases, it will send an ACK back to the Atrack GPS tracker.
     *
     * @param {Buffer} buffer The received data from the Atrack GPS tracker.
     */
    RecievedData(buffer) {
        // Log the raw buffer to see what's actually being received.
        console.log(`[Socket] Received raw buffer: ${buffer.toString('hex')}`);

        // Get Prefix (first two bytes)
        const prefix = buffer.subarray(0, 2);

        if (prefix.equals(Buffer.from([0xFE, 0x02])) && buffer.length === 12) {
            this.HandleKeepAliveMsg(buffer);
        } else if (prefix.equals(Buffer.from([0x40, 0x50]))) { //@P
            this.HandleReportMsg(buffer);
        } else if (prefix.equals(Buffer.from([0x40, 0x52]))) { //@R
            this.HandlePictureMsg(buffer);
        } else {
            this.HandleOtherMsg(buffer);
        }

        // Update time
        this.lastAlive = Date.now();

        // Send ACK
        this.SendACK();
    }

    /**
     * Handle the received keep alive message from the Atrack GPS tracker.
     *
     * This method is called when a keep alive message is received from the Atrack GPS tracker.
     * It will update the last keep alive time and the device id and seq number.
     *
     * @param {Buffer} buffer The received data from the Atrack GPS tracker.
     */
    HandleKeepAliveMsg(buffer) {
        // Get device id from bytes 2-9
        this.deviceID = buffer.subarray(2, 10).readBigUint64BE(0);
        // Get seq number from bytes 10-11
        this.seqNum = parseInt(buffer.subarray(10, 12).toString('hex'),16);
    }

    /**
     * Check the report format of a report message.
     *
     * The report format is determined by the value of the third byte of the report message.
     * If the value is 0x2C (',') then the format is ascii, otherwise it is binary.
     *
     * This method is called when a report message is received from the Atrack GPS tracker.
     * It will set the report format type for the tracker.
     *
     * @param {Buffer} buffer The received data from the Atrack GPS tracker.
     */
    CheckReportType(buffer) {
        // Check if format is format is already known
        if (this.reportType != undefined) {
            return
        }

        // If index 2 is 0x2C = ',' then the format is ascii
        if (buffer.subarray(2,3).equals(Buffer.from([0x2c]))) {
            this.reportType = 'ascii';
        } else {
            this.reportType = 'binary';
        }
    }

    /**
     * Handle the received report message from the Atrack GPS tracker.
     *
     * This method is called when a report message is received from the Atrack GPS tracker.
     * It will call either HandleReportMsgAscii or HandleReportMsgBinary depending on the format of the report message.
     *
     * @param {Buffer} buffer The received data from the Atrack GPS tracker.
     */
    HandleReportMsg(buffer) {
        this.CheckReportType(buffer);
        if (this.reportType === 'ascii') {
            this.HandleReportMsgAscii(buffer);
        } else if (this.reportType === 'binary') {
            this.HandleReportMsgBinary(buffer);
        }
    }

    /**
     * Handle the received other message from the Atrack GPS tracker.
     *
     * This method is called when a message that is not a report message is received from the Atrack GPS tracker.
     * It will parse the message and check if it is a command response.
     * If it is a command response and the command is telling report format, it will save the report format for the tracker and update the report format status.
     *
     * @param {Buffer} buffer The received data from the Atrack GPS tracker.
     */
    HandleOtherMsg(buffer) {
        //console.log('Received other message');
        if (this.reportType === 'ascii') {
            const dataAscii = buffer.toString('ascii');
            //console.log(dataAscii);
            const dataSplit = dataAscii.split('\r\n');
            for (let i = 0; i < dataSplit.length; i++) {
                if (Utilities.IsStringEmptyOrSpaces(dataSplit[i])) {
                    continue;
                }
                const dataCmdSplit = dataSplit[i].split('=');
                if (dataCmdSplit.length > 1) {
                    // $ABC=1,2,..
                    //console.log("Is command data respond");

                    // If the received message is a command response for getting report format, save it and update the report format status
                    // AT$FORM, AT$1708 or AT$FMSC
                    if ([this.cmdForm, this.cmdJ1708, this.cmdJ1939].includes(dataCmdSplit[0])) {
                        this.SaveReportFormat(dataCmdSplit);
                        this.UpdateReportFormatStatus();
                    }
                } else {
                    // Is OK or ERROR
                    //console.log("Is command status respond");
                }
            }
        } else {
            //console.log('Binary not supported');
        }
    }

    /**
     * Handle the received report message from the Atrack GPS tracker in ASCII format.
     *
     * This method is called when a report message is received from the Atrack GPS tracker in ASCII format.
     * It will parse the message and check if it is valid.
     * It will also update the device id if it is unknown.
     * Then it will check if the report format is finalized.
     * If it is, it will write the report to the database.
     *
     * @param {Buffer} buffer The received data from the Atrack GPS tracker in ASCII format.
     */
    HandleReportMsgAscii(buffer) {
        let headerCurrentIndex = 3;
        let bufferCRC = undefined;
        let bufferLength = undefined;
        let bufferSeqNum = undefined;
        let bufferID = undefined;

        [bufferCRC, headerCurrentIndex] = Utilities.GetHeaderValueAscii(buffer, headerCurrentIndex);
        [bufferLength, headerCurrentIndex] = Utilities.GetHeaderValueAscii(buffer, headerCurrentIndex);
        [bufferSeqNum, headerCurrentIndex] = Utilities.GetHeaderValueAscii(buffer, headerCurrentIndex, 'Int');
        [bufferID, headerCurrentIndex] = Utilities.GetHeaderValueAscii(buffer, headerCurrentIndex, 'Int');
        //console.log(`Received CRC: ${bufferCRC}`);
        //console.log(`Received Length: ${bufferLength}`);
        //console.log(`Received Seq Num: ${bufferSeqNum}`);
        //console.log(`Received Device ID: ${bufferID.toString()}`);

        // Update device id if unknown
        if (this.deviceID === undefined) {
            this.deviceID = bufferID;
        }

        // Check Buffer
        // if (!this.CheckBuffer(buffer, bufferCRC, bufferLength, bufferSeqNum, bufferDeviceID)) {
        // }

        // Update seq num
        this.seqNum = bufferSeqNum;

        // Check Report format
        if (!this.reportFinalFormat) {
            //console.log('Report format not finalized yet');
            return
        }

        // Get data frame
        let dataFrame = buffer.subarray(headerCurrentIndex).toString('ascii');
        const dataFrameLines = dataFrame.split('\r\n');

        // Write report to database
        this.WriteReport(dataFrameLines);
    }

    /**
     * Handle the received report message from the Atrack GPS tracker in binary format.
     *
     * This method is called when a report message is received from the Atrack GPS tracker in binary format.
     * It will parse the message and check if it is valid.
     * It will also update the device id if it is unknown.
     * Then it will check if the report format is finalized.
     * If it is, it will write the report to the database.
     *
     * @param {Buffer} buffer The received data from the Atrack GPS tracker in binary format.
     */
    HandleReportMsgBinary(buffer) {
        // TODO: implement
        //console.log('HandleReportMsgBinary not implemented');
    }

    /**
     * Write the report message to the time series database.
     *
     * @param {string[]} reportLines The report message split into lines.
     */
    WriteReport(reportLines) {
        // Report Format
        // 1712808280,1712867697,1713414999,100598781,13786921,0,2,0,7,0,0,0,0,,2000,2000,,52005,124,40,7
        // 0.GPS Date Time,
        // 1.RTC Date Time,
        // 2.Send Date Time,
        // 3.Lng,
        // 4.Lat,
        // 5.Heading,
        // 6.Report ID,
        // 7.Odometer,
        // 8.GPS HDOP,
        // 9.All Input Status,
        // 10.GPS/VSS Vehicle Speed,
        // 11.All Output Status,
        // 12.Avg Analog Input Value,
        // 13.Driver ID,
        // 14.1st Temp Sensor,
        // 15.2nd Temp Sensor,
        // 16.Text Msg
        for (let i = 0; i < reportLines.length; i++) {
            if (this.CheckReportMsg(reportLines[i]) === false) {
                continue;
            }

            //console.log('Receive report: ' + reportLines[i]);

            const frame = reportLines[i].split(',');
            const data = this.atrackPattern.ExtractValue(frame, this.reportFinalFormat);
            const timestamp = `${frame[1]}${'0'.repeat(9)}`;

            // console.log(data);

            this.timeSeriesDB.WriteData(this.deviceID.toString(), timestamp, data);
        }
    }

    /**
     * Handle the received picture message from the Atrack GPS tracker.
     *
     * This method is called when a picture message is received from the Atrack GPS tracker.
     * It will parse the message and check if it is valid.
     * It will also update the sequence number.
     * Then it will start collecting the picture data packets and check if the picture is done.
     * If it is, it will set the picture to undefined.
     *
     * @param {Buffer} buffer The received data from the Atrack GPS tracker in binary format.
     */
    HandlePictureMsg(buffer) {
        //console.log('Received picture data');
        // All picture data is in binary format
        // Get CRC from bytes 2-3
        const bufferCRC = parseInt(buffer.subarray(2, 4).toString('hex'), 16);
        // Get length from bytes 4-5
        const bufferLength = parseInt(buffer.subarray(4, 6).toString('hex'), 16);
        // Get Seq Num from bytes 6-7
        const bufferSeqNum = parseInt(buffer.subarray(6, 8).toString('hex'), 16);
        // Get Device ID from bytes 8-15
        const bufferDeviceID = buffer.subarray(8, 16).readBigUint64BE(0);
        // console.log(`[Picture] Received Buffer CRC: ${bufferCRC}`);
        // console.log(`[Picture] Received Buffer Length: ${bufferLength}`);
        // console.log(`[Picture] Received Buffer Seq Num: ${bufferSeqNum}`);
        // console.log(`[Picture] Received Buffer Device ID: ${bufferDeviceID}`);

        // Check Buffer
        // if (!this.CheckBuffer(buffer, bufferCRC, bufferLength, bufferSeqNum, bufferDeviceID)) {
        // }

        // Update seq num
        this.seqNum = bufferSeqNum;

        // Get data frame from bytes 16-end of the entire frame
        const PICTURE_DATAFRAME_START_INDEX = 16;
        let pictureDataFrame = buffer.subarray(PICTURE_DATAFRAME_START_INDEX);

        if (this.picture === undefined) {
            // Start receiving picture data packet
            this.picture = new Picture(pictureDataFrame, this.deviceID, this.pictureDB);
        } else {
            this.picture.AddPicturePackage(pictureDataFrame);
            if (this.picture.isDone()) {
                // End receiving picture data packet
                this.picture = undefined;
            }
        }
    }

    /**
     * Check if the given message is a valid report message.
     *
     * This method is called when a report message is received from the Atrack GPS tracker.
     * It will check if the message is not empty and if the first character is a number.
     * If both conditions are true, it will return true, otherwise it will return false.
     *
     * @param {string} msg - The message to be checked.
     * @returns {boolean} - True if the message is a valid report message, otherwise false.
     */
    CheckReportMsg(msg) {
        if (Utilities.IsStringEmptyOrSpaces(msg)) {
            return false
        } else if (/^\d+$/.test(msg[0]) === false) {
            return false
        }

        return true;
    }

    /**
     * Send an ACK message to the Atrack GPS tracker.
     *
     * This method is called when a message is received from the Atrack GPS tracker.
     * It will send an ACK message with the device id and sequence number of the received message.
     *
     * @returns {void}
     */
    SendACK() {
        if (this.deviceID && this.seqNum) {
            const seqNumHexString = this.seqNum.toString(16).padStart(4, '0');
            const ackMsg = `fe02${this.deviceID.toString(16).padStart(16, '0')}${seqNumHexString}`
            const ackMsgHex = Buffer.from(ackMsg, 'hex');
            this.socket.write(ackMsgHex);
            //console.log(`Send ACK: ${ackMsg}`);
        }
    }

    /**
     * Send a command to the Atrack GPS tracker.
     *
     * This method is used to send a command to the Atrack GPS tracker.
     * The command is sent as an ASCII string with a newline at the end.
     *
     * @param {string} command - The command to be sent.
     * @returns {void}
     */
    SendCommand(command) {
        let cmdEncode = Buffer.from(`${command}\r\n`, 'ascii');
        this.socket.write(cmdEncode);
        //console.log(`Sent: ${command}`);
    }

    /**
     * Check if the socket has timed out.
     *
     * This method is called at regular intervals to check if the socket has timed out.
     * If the socket has timed out, it will be ended.
     *
     * The timeout period is determined by the SOCKET_TIMEOUT environment variable, which defaults to 1 minute if not set.
     *
     * @returns {void}
     */
    CheckTimeout() {
        if (Date.now() - this.lastAlive >= this.SOCKET_TIMEOUT) {
            // Socket Timeout
            // console.log(`Socket Timeout: ${this.deviceID}`);
            this.socket.end();
        }
    }

    CheckBuffer() {
        // Check CRC
        // if (!this.CheckBufferCRC(buffer, bufferCRC)) {
        // }
        // Check device id
        // if (!this.CheckBufferDeviceID(buffer, bufferID)) {
        // }
        // Check length
        // if (!this.CheckBufferLength(buffer, bufferLength)) {
        // }
    }

    /**
     * Clear all intervals and end the socket.
     *
     * This method is called when the socket is to be ended.
     * It will clear all intervals and end the socket.
     *
     * @returns {void}
     */
    ClearSocket() {
        clearInterval(this.keepAliveCheck);
        clearInterval(this.getReportFormatInterval);
    }

    /**
     * Save the report format for the tracker.
     *
     * This method is called when a command response for getting report format is received from the Atrack GPS tracker.
     * It will parse the response and save the report format for the tracker.
     * The report format is determined by the value of the third byte of the report message.
     * If the value is 0x2C (',') then the format is ascii, otherwise it is binary.
     *
     * @param {Array<string>} input - The received command response from the Atrack GPS tracker.
     *
     * @returns {void}
     */
    SaveReportFormat(input) {
        const cmd = input[0];
        const value = input[1].split(',');
        let report = ""
        switch (cmd) {
            case this.cmdForm:
                if (this.isReportCustom === undefined) {
                    //$FORM=0,@P,0,"%MV%BV"
                    // Check if report format is not empty
                    report = value[3]
                    if (report.replace(/^"(.*)"$/, '$1')) {
                        this.reportCustomFormat = this.ReportFormatSplit(report);
                        this.isReportCustom = true;
                    } else {
                        this.isReportCustom = false;
                    }
                } else {
                    //console.log('Already got report format');
                }
                break;
            case this.cmdJ1708:
                if (this.isReportJ1708 === undefined) {
                    //$1708="%ZO1%ZO2%ZO3"
                    // Check if report format is not empty
                    report = value[0]
                    if (report.replace(/^"(.*)"$/, '$1')) {
                        this.reportJ1XXXFormat = this.ReportFormatSplit(report);
                        this.isReportJ1708 = true;
                    } else {
                        this.isReportJ1708 = false;
                    }
                } else {
                    //console.log('Already got report custom format');
                }
                break;
            case this.cmdJ1939:
                if (this.isReportJ1939 === undefined) {
                    //$FMSC=1,"%JO1%JH1%JL1%JS1"
                    report = value[1]
                    if (report.replace(/^"(.*)"$/, '$1')) {
                        this.reportJ1XXXFormat = this.ReportFormatSplit(report);
                        this.isReportJ1939 = true;
                    } else {
                        this.isReportJ1939 = false;
                    }
                } else {
                    //console.log('Already got report custom format');
                }
                break;
            default:
                //console.log('Invalid report command');
                break;
        }
    }

    /**
     * Split the given report format string into an array of format strings.
     *
     * The given report format string is expected to be a string with '%' as the delimiter.
     * The function will remove any double quotes from the string before splitting it.
     * The first element of the resulting array is the first element after the first '%'.
     * If the first element is empty, it is removed.
     *
     * @param {string} reportFormat - The report format string to be split.
     * @returns {Array<string>} - An array of format strings.
     */
    ReportFormatSplit(reportFormat) {
        const reportSplit = reportFormat.replace(/['"]+/g, '').split('%');
        // Check if report index 0 is empty
        //if (reportSplit[0]) {
        reportSplit.shift();
        //}
        return reportSplit;
    }

    /**
     * Get the report format from the Atrack GPS tracker.
     *
     * If the report format is already known, it will clear the interval that calls this method and print out the report format.
     * If the report format is not known, it will send the command to get the report format.
     *
     * @returns {void}
     */
    GetReportFormat() {
        if (this.UpdateReportFormatStatus()) {
            //console.log('Already recieved report format');
            //console.log(`Report format type: ${this.reportFormatType}`);
            //console.log(`Report custom format: ${this.reportCustomFormat}`);
            //console.log(`Report J1XXX format: ${this.reportJ1XXXFormat}`);
            clearInterval(this.getReportFormatInterval);
        } else {
            if (this.isReportCustom === undefined) {
                this.SendCommand(`AT${this.cmdForm}=?`);
            }
            if (this.isReportJ1708 === undefined) {
                this.SendCommand(`AT${this.cmdJ1708}=?`);
            }
            if (this.isReportJ1939 === undefined) {
                this.SendCommand(`AT${this.cmdJ1939}=?`);
            }
        }
    }

    /**
     * Update the report format status of the tracker.
     *
     * It will update the report format type and final report format based on the report format received.
     *
     * @returns {boolean} - True if all report format is received, false otherwise.
     */
    UpdateReportFormatStatus() {
        if ([this.isReportCustom, this.isReportJ1708, this.isReportJ1939].includes(undefined)) {
            //console.log('Not all report format is received');
            return false
        }

        if (this.isReportCustom && !this.isReportJ1708 && !this.isReportJ1939) {
            this.reportFormatType = 'custom';
            this.reportFinalFormat = this.reportBaseFormat.concat(this.reportCustomFormat);
        } else if (!this.isReportCustom && this.isReportJ1708 && !this.isReportJ1939) {
            this.reportFormatType = 'j1708';
            this.reportFinalFormat = this.reportBaseFormat.concat(this.reportJ1XXXFormat);
        } else if (!this.isReportCustom && !this.isReportJ1708 && this.isReportJ1939) {
            this.reportFormatType = 'j1939';
            this.reportFinalFormat = this.reportBaseFormat.concat(this.reportJ1XXXFormat);
        } else {
            this.reportFormatType = 'base';
            this.reportFinalFormat = this.reportBaseFormat;
        }
        return true
    }
}
