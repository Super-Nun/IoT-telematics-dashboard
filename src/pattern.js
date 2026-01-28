
/**
 * @module Pattern
 *
 * @description
 * A class to handle pattern info of Atrack GPS trackers
 */
const fs = require('fs');
const path = require('path');
const Utilities = require('./utilities')

module.exports = class Pattern {
    /**
     * Create a Pattern object from a given string or object.
     * If the given argument is a string, it is treated as a path to a JSON file
     * containing the pattern information. If the given argument is an object, it
     * is treated as the pattern information itself. If the given argument is
     * neither a string nor an object, an Error is thrown.
     * 
     * @param {string|object} pattern - The pattern to be used.
     * @throws {Error} If the given argument is neither a string nor an object.
     * @constructor
     */
    constructor(pattern) {
        if (typeof pattern === "string") {
            // pattern args is a path
            const reportPath = path.join(__dirname, pattern);
            const reportText = fs.readFileSync(reportPath, 'utf8');
            this.reportPattern = JSON.parse(reportText);    
        } else if (typeof pattern === "object") {
            // pattern args is an object
            this.reportPattern = pattern;
        } else {
            // Invalid pattern args
            throw new Error("Invalid pattern args");
        }
        
    }
    
    /**
     * Extracts values from the given input array according to the given pattern and reportsPattern.
     * The values in the input array are processed in order, and the extracted values are returned
     * as an array of objects with fields name, dbtype, and value. If the input array does not
     * contain any valid values, the function returns undefined.
     *
     * @param {Array<string>} input - The input array to extract values from.
     * @param {Array<string>} pattern - The pattern to use for extracting values from the input.
     * @param {number} [offset=0] - The offset to start extracting values from in the input array.
     * @return {Array<Object> | undefined} The extracted values, or undefined if none were found.
     */
    ExtractValue(input, pattern, offset=0) {
        const reportPatternKeys = Object.keys(this.reportPattern);
        const outputValueList = [];
        for (let i = offset; i < input.length; i++) {
            if (!reportPatternKeys.includes(pattern[i])) {
                continue
            }

            let value = this.GetValue(input[i], this.reportPattern[pattern[i]]);
            // name, dbtype, value
            if (Array.isArray(value)) {
                Utilities.ConcatConstArray(outputValueList,value);
            } else if (value !== undefined) {
                outputValueList.push({ name: this.reportPattern[pattern[i]].name, dbtype: this.reportPattern[pattern[i]].dbtype, value: value });
            }
        }
        
        if (outputValueList.length != 0) {
            return outputValueList;
        } else {
            return undefined;
        }
    }

    /**
     * Gets the value from the given rawValue according to the given patternInfo.
     * The value is returned in the correct type according to the dbtype in patternInfo.
     * If the dbtype is unknown, the function returns undefined.
     *
     * @param {string} rawValue - The raw value from the device.
     * @param {Object} patternInfo - The pattern information containing the dbtype and other relevant information.
     * @return {any | undefined} The extracted value, or undefined if the dbtype is unknown.
     */
    GetValue(rawValue, patternInfo) {
        let outputValue = undefined;
        switch (patternInfo.dbtype) {
            case "int":
                outputValue = this.GetValueInt(rawValue, patternInfo);
                break;
            case "float":
                outputValue = this.GetValueFloat(rawValue, patternInfo);
                break;
            case "boolean":
                outputValue = this.GetValueBoolean(rawValue, patternInfo);
                break;
            case "string":
                outputValue = this.GetValueString(rawValue, patternInfo);
                break;
            case "U8":
                outputValue = this.GetValueU8(rawValue, patternInfo);
                break;
            case "g_force":
                outputValue = this.GetValueGForce(rawValue, patternInfo);
                break;
            case "tpms":
                outputValue = this.GetValueTPMS(rawValue, patternInfo);
                break;
            default:
                //console.log(`Unknown dbtype: ${pattern[i].dbtype}`);
                break;
        }
        return outputValue
    }

    /**
     * Gets the value from the given rawValue according to the given patternInfo.
     * If rawValue is a string, it is parsed as an integer. If patternInfo.multiplier is given, the value is multiplied by it.
     * The value is returned as an integer.
     *
     * @param {string | number} rawValue - The raw value from the device.
     * @param {Object} patternInfo - The pattern information containing the dbtype and other relevant information.
     * @return {number} The extracted value.
     */
    GetValueInt(rawValue, patternInfo) {
        let outputValue = rawValue;
        if (typeof rawValue === "string") {
            outputValue = parseInt(rawValue);
        }
        if (patternInfo.multiplier) {
            outputValue = outputValue * patternInfo.multiplier
        }
        return outputValue
    }

    /**
     * Gets the value from the given rawValue according to the given patternInfo.
     * If the patternInfo.decimals is given, the value is parsed as a float with the given number of decimal places.
     * The value is returned as a float.
     *
     * @param {string | number} rawValue - The raw value from the device.
     * @param {Object} patternInfo - The pattern information containing the dbtype and other relevant information.
     * @return {number} The extracted value.
     */
    GetValueFloat(rawValue, patternInfo) {
        let outputValue = this.GetValueInt(rawValue, patternInfo);
        if (patternInfo.decimals) {
            outputValue = Utilities.ParseFloatDecimal(outputValue, patternInfo.decimals)
        }
        return outputValue;
    }

    /**
     * Gets the value from the given rawValue according to the given patternInfo.
     * If the rawValue is '1', the value is true, otherwise it is false.
     *
     * @param {string | number} rawValue - The raw value from the device.
     * @return {boolean} The extracted value.
     */
    GetValueBoolean(rawValue) {
        return parseInt(rawValue) === 1 ? true : false ;
    }

    /**
     * Gets the value from the given rawValue according to the given patternInfo.
     * If the rawValue is a number, it is converted to a string.
     * If the patternInfo contains a dictionary, the value is looked up in the dictionary.
     * The value is returned as a string.
     *
     * @param {string | number} rawValue - The raw value from the device.
     * @param {Object} patternInfo - The pattern information containing the dbtype and other relevant information.
     * @return {string | undefined} The extracted value, or undefined if the rawValue is not in the dictionary.
     */
    GetValueString(rawValue, patternInfo) {
        let outputValue = undefined;
        if (typeof rawValue === "number") {
            rawValue.toString();
        }
        if (patternInfo.dict && patternInfo.dict.hasOwnProperty(rawValue)) {
            outputValue = patternInfo.dict[rawValue];
        }
        return outputValue
    }

    /**
     * Gets the value from the given rawValue according to the given patternInfo.
     * The rawValue is expected to be an integer between 0 and 255.
     * If the patternInfo contains a tables object, the value is extracted for each bit 
     * target in the tables object. The value is looked up in the table, and the value
     * is added to the output list if it is defined.
     * The output is an array of objects with fields name, dbtype, and value.
     * If no values are found in the tables, the function returns undefined.
     *
     * @param {string | number} rawValue - The raw value from the device.
     * @param {Object} patternInfo - The pattern information containing the dbtype and other relevant information.
     * @return {Array<Object> | undefined} The extracted values, or undefined if none were found.
     */
    GetValueU8(rawValue,patternInfo) {
        const inputValue = this.GetValueInt(rawValue, patternInfo);
        const outputList = [];
        if (0 <= inputValue <= 255) {
            if (patternInfo.tables) {  
                for (const bitTarget in patternInfo.tables) {
                    let bitsValue = Utilities.GetIntSliceFromBinary(inputValue, 8, bitTarget);
                    if (bitsValue != undefined && patternInfo.tables[bitTarget].dbtype != "U8") {
                        let tablesValue = this.GetValue(bitsValue, patternInfo.tables[bitTarget]);
                        if (tablesValue != undefined) {
                            outputList.push({ name: patternInfo.tables[bitTarget].name, 
                                dbtype: patternInfo.tables[bitTarget].dbtype, 
                                value: tablesValue 
                            });
                        }
                    }
                }
            }
        }
        if (outputList.length === 0) {
            return undefined;
        } else {
            return outputList;
        }
    }

    /**
     * Gets the value from the given rawValue according to the given patternInfo.
     * The rawValue is expected to be a string with length of 12.
     * The function gets the x,y,z g force value from the rawValue and returns them as an array of objects with fields name, dbtype, and value.
     * If no values are found, the function returns undefined.
     *
     * @param {string} rawValue - The raw value from the device.
     * @param {Object} patternInfo - The pattern information containing the dbtype and other relevant information.
     * @return {Array<Object> | undefined} The extracted values, or undefined if none were found.
     */
    GetValueGForce(rawValue, patternInfo) {
        // Check if rawValue is a string with length of 12
        if (typeof rawValue != "string" || rawValue.length < 12) {
            return undefined;
        }

        // Get first 12 characters
        rawValue = rawValue.slice(0, 12);

        // Get x,y,z hex string
        let xHexString = rawValue.slice(0, 4);
        let yHexString = rawValue.slice(4, 8);
        let zHexString = rawValue.slice(8, 12);

        // Get x,y,z g force value
        let xValue = Utilities.ParseHexStringToSignedInt(xHexString, 32);
        let yValue = Utilities.ParseHexStringToSignedInt(yHexString, 32);
        let zValue = Utilities.ParseHexStringToSignedInt(zHexString, 32);

        // Save x,y,z g force value
        let output = []
        if (xValue != undefined) {
            output.push({name: `${patternInfo.name}_x`, dbtype: 'int', value: xValue})
        }
        if (yValue != undefined) {
            output.push({name: `${patternInfo.name}_y`, dbtype: 'int', value: yValue})
        }
        if (zValue != undefined) {
            output.push({name: `${patternInfo.name}_z`, dbtype: 'int', value: zValue})
        }

        if (output.length == 0) {
            return undefined;
        } else {
            return output;
        }
    }

    /**
     * Parses the given rawValue and returns an array of tire temperature and pressure values.
     *
     * @param {string} rawValue - The raw value containing tire data.
     * @return {Array<Object>|undefined} An array of objects containing tire temperature and pressure values, or undefined if the rawValue is invalid.
     */
    // Example rawValue
    // 1 tire '12345678'
    // 1234 = ID (Hex)
    // 56 = tire temp (Hex)
    // 78 = tire pressure (Hex)
    // 2 tires 'D02A9900A2348899'
    // tire 1 = D02A9900
    // tire 2 = A2348899
    GetValueTPMS(rawValue, patternInfo) {
        // Check tire count in raw Value
        const TPMS_LENGTH = 8;         
        // Check if rawValue is diviable by TPMS_LENGTH
        if (rawValue.length % TPMS_LENGTH != 0) {
            return undefined;
        }

        // Check patternInfo pressure equation
        if (patternInfo["pressure_slope"] == undefined || !patternInfo["pressure_const"] == undefined) {
            return undefined;
        }
        const PRESSURE_SLOPE = patternInfo["pressure_slope"];
        const PRESSURE_CONST = patternInfo["pressure_const"];
        // Check patternInfo temp equation
        if (patternInfo["temp_slope"] == undefined || patternInfo["temp_const"] == undefined) {
            return undefined;
        }
        const TEMP_SLOPE = patternInfo["temp_slope"];
        const TEMP_CONST = patternInfo["temp_const"];

        
        // Slice rawValue with TPMS_LENGTH into an array
        const rawValueArray = rawValue.match(new RegExp('.{1,' + TPMS_LENGTH + '}', 'g'));

        const output = [];
        for (let i = 0; i < rawValueArray.length; i++) {
            // Get tire temp value from 5-6
            let tire_temp = (TEMP_SLOPE * parseInt(rawValueArray[i].slice(4, 6), 16)) + TEMP_CONST;
            if (tire_temp < 0) {
                tire_temp = 0;
            }
            output.push({name: `tire_temp_${i+1}`, dbtype: 'int', value: tire_temp});
            // Get  tire pressure value from 7-8
            let tire_pressure = (PRESSURE_SLOPE * parseInt(rawValueArray[i].slice(6, 8), 16)) + PRESSURE_CONST;
            if (tire_pressure < 0) {
                tire_pressure = 0;
            }
            output.push({name: `tire_pressure_${i+1}`, dbtype: 'float', value: tire_pressure});
        }

        if (output.length == 0) {
            return undefined;
        } else {
            return output;
        }
    }
}