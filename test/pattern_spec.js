const Pattern = require('../src/pattern.js');
const Expect = require('chai').expect;


describe('Pattern', () => {
  describe('GetValueU8', () => {

    const patternInfo = {
        "name": "TEST",
        "description": "TEST",
        "dbtype": "U8",
        "tables": {
            "0": {
                "name": "U8_Single_Bit_Test",
                "description": "U8_Single_Bit_Test",
                "dbtype": "int",
            },
            "1~2": {
                "name": "U8_Double_Bit_Test",
                "description": "U8_Double_Bit_Test",
                "dbtype": "int",
            },
            "3~5": {
                "name": "U8_Tripple_Bit_Test",
                "description": "U8_Tripple_Bit_Test",
                "dbtype": "int",
            }
        }
    };
    const pattern = new Pattern({
            "TEST": patternInfo
        });

    it('should return undefined for input value outside of range', () => {
        const rawValue = '300';
        const output = pattern.GetValueU8(rawValue, patternInfo);
        Expect(output).to.be.undefined;
    });
    
    it('should return parsed tables value for valid input value', () => {
        const rawValue = '127'; //1111111
        const output = pattern.GetValueU8(rawValue, patternInfo);
        Expect(output).to.eql([
            { name: 'U8_Single_Bit_Test', dbtype: 'int', value: 1 },
            { name: 'U8_Double_Bit_Test', dbtype: 'int', value: 3 },
            { name: 'U8_Tripple_Bit_Test', dbtype: 'int', value: 7 }
        ]);
    });
    
  });

  describe('GetValueTPMS', () => {
    const patternInfo = {
        "name": "tpms",
        "description": "TPMS",
        "dbtype": "tpms",
        "pressure_slope": 0.3625,
        "pressure_const": 0,
        "temp_slope": 3,
        "temp_const": -424
    };
    const pattern = new Pattern({
            "TM": patternInfo
        });

    it('should return undefined if input char is not in tpms format (not 8 char)', () => {
        const rawValue = '1234ABCD123';
        const output = pattern.GetValueTPMS(rawValue, patternInfo);
        Expect(output).to.be.undefined;
    });
    
    it('should return tire pressure and temp for valid input', () => {
        const rawValue = 'D0DC9911';
        const output = pattern.GetValueTPMS(rawValue, patternInfo);
        Expect(output).to.have.deep.members([
            { name: 'tire_pressure_1', dbtype: 'float', value: 6.1625 },
            { name: 'tire_temp_1', dbtype: 'int', value: 35 },
        ]);
    });

    it('should able to handle mutilple tire pressure and temp', () => {
        const rawValue = '13E29AA0A0AC9E84';
        const output = pattern.GetValueTPMS(rawValue, patternInfo);
        Expect(output).to.have.deep.members([
            { name: 'tire_pressure_1', dbtype: 'float', value: 58 },
            { name: 'tire_temp_1', dbtype: 'int', value: 38 },
            { name: 'tire_pressure_2', dbtype: 'float', value:  47.85},
            { name: 'tire_temp_2', dbtype: 'int', value: 50 },
        ]);
    });

    it('should able to handle negative value', () => {
        const rawValue = '13E28084';
        const output = pattern.GetValueTPMS(rawValue, patternInfo);
        Expect(output).to.have.deep.members([
            { name: 'tire_pressure_1', dbtype: 'float', value: 47.85 },
            { name: 'tire_temp_1', dbtype: 'int', value: 0 },
        ]);
    });
  });
});