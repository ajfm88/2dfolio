import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { expect,it } from 'vitest';
import { BinaryReader } from '../binary_reader';
import { extractSfx,extractSfxAt,SFX_HEADERS } from '../extractors/audio';
import { SFX_IDS,sfxNameForSound } from '../../audio/sound_ids';
const ch5=[236,3,16,90,36,240,0,5,16,8,36,0,0,0,47,240,0,5,33,0,0,0,255];
const ch6=[236,3,36,240,1,4,36,0,0,0,47,240,1,4,33,0,0,0,255];
it('preloads the denied sound ID in both field banks with identical mirrors',()=>{
 expect(SFX_IDS.denied).toBe(0xa5);expect(sfxNameForSound(0xa5,2)).toBe('denied');expect(sfxNameForSound(0xa5,0x1f)).toBe('denied');
 expect(readFileSync('data/audio/sfx/denied.json')).toEqual(readFileSync('static/audio/sfx/denied.json'));
});
it.skipIf(!process.env.ROM_PATH)('pins denied headers and source channel bytes from owned ROM',()=>{
 const rom=readFileSync(resolve(process.env.ROM_PATH!)),reader=new BinaryReader(Uint8Array.from(rom).buffer);
 const syms=execFileSync('git',['-C',resolve('../refs/pokeyellow'),'show','origin/symbols:pokeyellow.sym'],{encoding:'utf8'});
 for(const symbol of ['02:41ef SFX_Denied_1','02:45bd SFX_Denied_1_Ch5','02:45d4 SFX_Denied_1_Ch6','1f:4597 SFX_Denied_3_Ch5','1f:45ae SFX_Denied_3_Ch6'])expect(syms).toContain(symbol);
 const at=(bank:number,addr:number)=>bank*0x4000+(addr&0x3fff);
 expect([...rom.subarray(at(2,0x41ef),at(2,0x41ef)+6)]).toEqual([68,189,69,5,212,69]);
 for(const [bank,addr,bytes] of [[2,0x45bd,ch5],[2,0x45d4,ch6],[31,0x4597,ch5],[31,0x45ae,ch6]] as const)expect([...rom.subarray(at(bank,addr),at(bank,addr)+bytes.length)]).toEqual(bytes);
 expect(SFX_HEADERS.denied).toEqual({bank:2,addr:0x41ef});
 const expected=JSON.parse(readFileSync('data/audio/sfx/denied.json','utf8'));
 expect(extractSfx(reader,'denied')).toEqual(expected);expect(extractSfxAt(reader,31,0x41ef)).toEqual(expected);
});
