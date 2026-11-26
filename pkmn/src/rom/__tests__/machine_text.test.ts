import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TEXT_PROGRAM_SYMBOLS } from '../text_program_symbols';
import type { TextProgramsFile } from '../extractors/text_programs';

const entries = [
  ['BootedUpTMText',3,0x6483,0x6ce1], ['BootedUpHMText',3,0x6488,0x6cf2],
  ['TeachMachineMoveText',3,0x648d,0x6d04], ['MonCannotLearnMachineMoveText',3,0x6492,0x6d30],
  ['AlreadyKnowsText',11,0x7d65,0x6ef6],
] as const;
const data = readFileSync(resolve('data/text_programs.json'),'utf8');
const programs = (JSON.parse(data) as TextProgramsFile).programs;
describe('machine teaching text', () => {
  it('keeps root/far programs and dynamic nickname and move operands in both mirrors', () => {
    expect(readFileSync(resolve('static/text_programs.json'),'utf8')).toBe(data);
    for (const [name,bank,address,target] of entries) {
      expect(TEXT_PROGRAM_SYMBOLS).toContainEqual([name,bank,address,true]);
      expect(TEXT_PROGRAM_SYMBOLS).toContainEqual([`_${name}`,0x2d,target,false]);
      expect(programs[name]).toEqual([{op:'far',program:`_${name}`}]);
    }
    expect(programs._TeachMachineMoveText.filter(op => op.op === 'ram')).toEqual([{op:'ram',binding:'stringBuffer'},{op:'ram',binding:'stringBuffer'}]);
    expect(programs._MonCannotLearnMachineMoveText.filter(op => op.op === 'ram')).toEqual([{op:'ram',binding:'nameBuffer'},{op:'ram',binding:'stringBuffer'},{op:'ram',binding:'stringBuffer'}]);
    expect(programs._AlreadyKnowsText.filter(op => op.op === 'ram')).toEqual([{op:'ram',binding:'nameBuffer'},{op:'ram',binding:'stringBuffer'}]);
    expect(programs.PartyMenuUseTMText).toEqual([{op:'far',program:'_PartyMenuUseTMText'}]);
    expect(programs._PartyMenuUseTMText).toEqual([{op:'text',text:'Teach to which\nPOKéMON?<DONE>'}]);
  });
  it.skipIf(!process.env.ROM_PATH)('pins root pointers against pret symbols and owned ROM', () => {
    const rom = readFileSync(resolve(process.env.ROM_PATH!));
    const symbols = execFileSync('git',['-C',resolve('../refs/pokeyellow'),'show','origin/symbols:pokeyellow.sym'],{encoding:'utf8'});
    expect(symbols).toContain('04:5a47 PartyMenuUseTMText');
    expect(symbols).toContain('28:4177 _PartyMenuUseTMText');
    expect([...rom.subarray(4*0x4000+0x1a47,4*0x4000+0x1a4c)]).toEqual([0x17,0x77,0x41,0x28,0x50]);
    expect([...rom.subarray(0x28*0x4000+0x177,0x28*0x4000+0x17b)]).toEqual([0x00,0x93,0xa4,0xa0]);
    for (const [name,bank,address,target] of entries) {
      expect(symbols).toContain(`${bank.toString(16).padStart(2,'0')}:${address.toString(16)} ${name}`);
      expect(symbols).toContain(`2d:${target.toString(16)} _${name}`);
      const off=bank*0x4000+(address&0x3fff);
      expect([...rom.subarray(off,off+5)]).toEqual([0x17,target&255,target>>8,0x2d,0x50]);
      const far=0x2d*0x4000+(target&0x3fff);
      expect([...rom.subarray(far,far+4)]).toEqual(name === 'MonCannotLearnMachineMoveText' || name === 'AlreadyKnowsText'
        ? [0x01,0x6d,0xcd,0x00] : name === 'TeachMachineMoveText' ? [0x00,0x88,0xb3,0x7f] : [0x00,0x81,0xae,0xae]);
    }
  });
});
