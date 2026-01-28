/**
 * @fileoverview Utilities functions
 *
 * @description
 * Utilities functions to help process data from Atrack GPS trackers.
 *
 * @module utilities
 * @author Atrack
 * @version 1.0.0
 */
module.exports = {
    /**
     * Gets the value from the given inputBuffer according to the given startIndex and type.
     * The value is returned as an array of two elements, the first element is the value, the second element is the next index.
     * If the type is not specified, it is 'Int'.
     * If the type is 'BigUint64BE', the value is parsed as a big unsigned integer.
     * If the type is 'Int', the value is parsed as an integer.
     *
     * @param {Buffer} inputBuffer - The input buffer to extract value from.
     * @param {number} startIndex - The starting index to extract value from.
     * @param {string} [type='Int'] - The type of the value to extract.
     * @return {Array} The extracted value and the next index.
     */
    GetHeaderValueBinary: function(inputBuffer, startIndex, type='Int') {
        const endIndex = inputBuffer.indexOf(',', startIndex);
        const dataArray = inputBuffer.subarray(startIndex, endIndex);
        let output = undefined;
        switch (type) {
          case 'BigUint64BE':
            output = dataArray.readBigUint64BE(0);
            break;
          case 'Int':
            output = parseInt(dataArray.toString('hex'), 16);
            break;
          default:
            output = dataArray;  
        }
        return [output, endIndex + 1];
    },
      
    /**
     * Gets the value from the given inputBuffer according to the given startIndex and type.
     * The value is returned as an array of two elements, the first element is the value, the second element is the next index.
     * If the type is not specified, it is 'String'.
     * If the type is 'Int', the value is parsed as an integer.
     *
     * @param {Buffer} inputBuffer - The input buffer to extract value from.
     * @param {number} startIndex - The starting index to extract value from.
     * @param {string} [type='String'] - The type of the value to extract.
     * @return {Array} The extracted value and the next index.
     */
    GetHeaderValueAscii: function(inputBuffer, startIndex, type='String') {
        const endIndex = inputBuffer.indexOf(',', startIndex);
        let output = inputBuffer.subarray(startIndex, endIndex).toString('ascii');
        if (type === 'Int') {
          output = parseInt(output);
        }
        return [output, endIndex + 1];
    },
      
    /**
     * Parses a string as a float with the given number of decimal places.
     *
     * If the string is not long enough, it is padded with zeros on the left.
     * If the string is too long, the extra decimal places are kept.
     *
     * @param {string | number} strNum - The string or number to parse as a float.
     * @param {number} decimalPoint - The number of decimal places to parse.
     * @return {number} The parsed float value.
     */
    ParseFloatDecimal: function(strNum, decimalPoint) {
      if (typeof strNum === 'number') {
        strNum = strNum.toString();
      }
      let insertIndex = strNum.length - decimalPoint;
      if (insertIndex < 0) {
          return parseFloat(`0.${strNum.padStart(decimalPoint,'0')}`);
      } else {
          let input_int = strNum.slice(0,insertIndex);
          let input_dec = strNum.slice(insertIndex);
          return parseFloat(`${input_int}.${input_dec}`);
      }
    },

    /**
     * Checks if a string is null or contains only spaces.
     *
     * @param {string} str - The string to check.
     * @return {boolean} True if the string is null or contains only spaces, false otherwise.
     */
    IsStringEmptyOrSpaces: function(str){
        return str === null || str.match(/^ *$/) !== null;
    },

    /**
     * Gets a slice of bits from the given inputNum according to the given binaryLength and slice.
     * The slice can be either a single bit index, or a range of bit indices in the format "start~end".
     * If the slice is a range, the start and end indices are inclusive.
     * If signed is set to true, the output is parsed as a signed integer.
     *
     * @param {number} inputNum - The input number to extract bits from.
     * @param {number} binaryLength - The length of the binary string to extract bits from.
     * @param {string | number} slice - The slice of bits to extract.
     * @param {boolean} [signed=false] - Whether to parse the output as a signed integer.
     * @return {number | undefined} The extracted bits, or undefined if the slice is invalid.
     */
    GetIntSliceFromBinary: function(inputNum, binaryLength, slice, signed=false) {
      let output = undefined;
      // Convert inputNum to binary string
      let binaryString = inputNum.toString(2);
      
      // Check if input binary length is more than binaryLength
      if (binaryString.length > binaryLength) {
        return undefined;
      } else if (binaryString.length < binaryLength) {
        // Pad zero to the left until input binary length is equal to binaryLength
        binaryString = binaryString.padStart(binaryLength, '0');
      } else {
        // Do nothing (input binary length is equal to binaryLength)
      }

      // Check slice
      // Example
      // 0~3 = slice bit 0 to bit 3
      // 6 = only bit 6
      if (slice.includes('~')) {
        // Multiple bit slice
        let [start, end] = slice.split('~');
        start = parseInt(start);
        end = parseInt(end);
        if (start < end && start >= 0 && end < binaryLength) {
          let inverse_start = binaryLength - parseInt(end) - 1;
          let inverse_end = binaryLength - parseInt(start);
          output = binaryString.slice(inverse_start, inverse_end)
        }
      } else if (typeof slice === 'string' && !isNaN(parseInt(slice)) && parseInt(slice) < binaryLength) {
        // Only one bit slice
        output = binaryString[binaryLength - parseInt(slice) - 1];
      }
      

      if (output != undefined) {
        if (signed) {
          output = this.ParseBinaryToSinged(output);
        } else {
          output = this.ParseBinaryToUnsigned(output);
        }
      }
      return output;
    },

    /**
    * This function translate bit binary string to singed number 
    * @param {string} binaryString
    */
    ParseBinaryToSinged: function(binaryString) {
      // Check if the binary string is empty or not a valid binary string
      if (!binaryString || !/^[01]+$/.test(binaryString) || binaryString.length === 1) {
          throw new Error('Invalid binary string');
      }
  
      // Determine the sign of the integer based on the most significant bit
      const sign = binaryString[0] === '1' ? -1 : 1;
  
      // If the number is negative (most significant bit is 1),
      // calculate its absolute value using two's complement
      let absoluteValue = parseInt(binaryString, 2);
  
      if (sign === -1) {
          const bitLength = binaryString.length;
          const maxValue = 2 ** bitLength;
          absoluteValue = maxValue - absoluteValue;
      }
  
      // Apply the sign to the absolute value to get the signed integer
      const signedInt = sign * absoluteValue;
  
      return signedInt;
  },

  /**
  * This function translate bit binary string to unsinged number 
  * @param {string} binaryString
  */
  ParseBinaryToUnsigned: function(binaryString) {
    return parseInt(binaryString, 2);
  },

  /**
   * Converts a hexadecimal string to a binary string
   * @param {string} hexString - The hexadecimal string to convert
   * @param {number} [size=8] - The minimum length of the output binary string
   * @returns {string} - The binary string representation of the input hexadecimal string
   */
  ParseHexStringToBinary: function(hexString, size=8) {
    return (parseInt(hexString, 16).toString(2)).padStart(size, '0');
  },

  /**
   * Converts a hexadecimal string to a signed integer
   * @param {string} hexString - The hexadecimal string to convert
   * @param {number} [size=8] - The minimum length of the output binary string
   * @returns {number|undefined} The signed integer representation of the input hexadecimal string, or undefined if the conversion fails
   */
  ParseHexStringToSignedInt: function(hexString, size=8) {
    let output = undefined
    let binaryString = this.ParseHexStringToBinary(hexString, size);
    if (binaryString != undefined) {
      output = this.ParseBinaryToSinged(binaryString);
    }
    return output;
  },

  /**
   * Concatenates subArray to mainArray. The mainArray is modified in-place.
   * @param {Array} mainArray - The array to be modified.
   * @param {Array} subArray - The array to be concatenated.
   */
  ConcatConstArray: function(mainArray, subArray) {
    subArray.forEach(element => {
      mainArray.push(element);
    });
  }
};