// A5c3f checkpoint-03. Real trainers.json and the species table. The module stays unused.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
vi.hoisted(() => Object.assign(globalThis, { window: { addEventListener() {} } }));
import { A, BattleState, encodeText, NAME_LENGTH, PARTYMON_STRUCT_LENGTH, type SpeciesHeader } from './battle_state';
import { D } from './battle_end_state';
import { getMonHeader, getMonName } from './battle_loaders';
import { calcExperience } from './battle_calc_experience';
import { calcStat, calcStats } from './battle_calc_stats';
import { loadBattleMoveData } from './battle_move_data';
import {
  addTrainerPrizeMoney, getTrainerInformation, getTrainerName, installTrainerSpecies, readTrainer,
  speciesInternalId, trainerPicName, W_RIVAL_NAME, W_TRAINER_NO,
} from './battle_trainer_party';

const DATA = resolve(__dirname, '../../data');
const TRAINERS = JSON.parse(readFileSync(resolve(DATA, 'trainers.json'), 'utf8')) as Record<string, {
  id: number; displayName: string; baseMoney: number; pic: string;
  picOverride?: { trainerNoAtLeast: number; pic: string };
  parties: { species: string; level: number; moveOverrides?: Record<string, string> }[][];
}>;
const MOVES = JSON.parse(readFileSync(resolve(DATA, 'moves.json'), 'utf8')) as Record<string, { id: number; pp: number }>;
const PP_OF = new Map(Object.values(MOVES).map(move => [move.id, move.pp]));
const PLAYER = encodeText('ASH@1234567');

beforeAll(async () => { await loadBattleMoveData(); });

function fresh(): BattleState {
  const s = new BattleState();
  s.random = () => { throw new Error('ReadTrainer drew a random number'); };
  s.wIsInBattle = 0;
  s.wLinkState = 0;
  s.mem.set(PLAYER, A.wPlayerName);
  s.mem[A.wPlayerID] = 0x12;
  s.mem[A.wPlayerID + 1] = 0x34;
  s.mem.fill(0x3c, A.wEnemyMons, A.wEnemyMons + 6 * PARTYMON_STRUCT_LENGTH);
  s.mem.fill(0x5a, A.wEnemyMonOT, A.wEnemyMonOT + 6 * NAME_LENGTH);
  s.mem.fill(0xa5, A.wEnemyMonNicks, A.wEnemyMonNicks + 6 * NAME_LENGTH);
  s.mem.fill(0xee, D.wEnemyPartyCount, D.wEnemyPartyCount + 8);
  s.mem[D.wAmountMoneyWon + 3] = 0x11;
  s.mem[D.wAmountMoneyWon + 4] = 0x11;
  s.mem[D.wAmountMoneyWon + 5] = 0x11;
  s.mem[D.wTrainerPicPointer] = 0xab;
  s.mem[D.wTrainerPicPointer + 1] = 0xcd;
  s.mem[D.wLoneAttackNo] = 0;
  return s;
}

function learned(header: SpeciesHeader, level: number): number[] {
  const moves = [...header.moves];
  for (const entry of header.learnset) {
    if (entry.level === 0 || level < entry.level) break;
    const move = entry.move & 0xff;
    if (moves.includes(move)) continue;
    const empty = moves.indexOf(0);
    if (empty >= 0) moves[empty] = move;
    else { moves.copyWithin(0, 1); moves[3] = move; }
  }
  return moves;
}

function oracle(internal: number, level: number): { bytes: number[]; moves: number[]; pp: number[] } {
  const s = new BattleState();
  installTrainerSpecies(s);
  const header = s.species(internal);
  s.wCurEnemyLevel = level;
  getMonHeader(s, internal);
  const statExp = 0xe000;
  s.mem[statExp + 11] = 0x98;
  s.mem[statExp + 12] = 0x88;
  const hp = calcStat(s, 1, 0, statExp);
  calcStats(s, 0, statExp, 0xe100);
  const exp = calcExperience(s, level);
  const moves = learned(header, level);
  const pp = moves.map(id => id === 0 ? 0 : PP_OF.get(id)!);
  const stats = [0, 1, 2, 3, 4].map(i => s.readBE(0xe100 + i * 2));
  const bytes = [
    internal, (hp >> 8) & 255, hp & 255, 0, 0, header.type1, header.type2, header.catchRate,
    ...moves, 0x12, 0x34, (exp >>> 16) & 255, (exp >>> 8) & 255, exp & 255,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x98, 0x88, ...pp, level,
    ...stats.flatMap(stat => [(stat >> 8) & 255, stat & 255]),
  ];
  return { bytes, moves, pp };
}

function prize(baseMoney: number, level: number): number[] {
  const product = baseMoney * level;
  if (product > 9999 || baseMoney >= 100) throw new Error(`oracle ${baseMoney} * ${level}`);
  const text = product.toString().padStart(4, '0');
  return [0x00, Number.parseInt(text.slice(0, 2), 16), Number.parseInt(text.slice(2), 16)];
}

function engage(s: BattleState, className: string, trainerNo: number): void {
  s.mem[D.wTrainerClass] = TRAINERS[className].id;
  s.mem[W_TRAINER_NO] = trainerNo;
  getTrainerInformation(s);
  readTrainer(s);
}

function partyBytes(s: BattleState, index: number): number[] {
  const at = A.wEnemyMons + index * PARTYMON_STRUCT_LENGTH;
  return [...s.mem.subarray(at, at + PARTYMON_STRUCT_LENGTH)];
}

describe('Forest, Brock, the rival and Rocket', () => {
  // Mutations 1, 2, 6 and 7: the party index, the DV order, one level (not a sum), byte 0 stays 0.
  it.each([
    ['BUG_CATCHER', 1, ['CATERPIE', 'CATERPIE'], [7, 7]],
    ['BUG_CATCHER', 2, ['METAPOD', 'CATERPIE', 'METAPOD'], [6, 6, 6]],
    ['BUG_CATCHER', 3, ['CATERPIE'], [10]],
    ['BUG_CATCHER', 15, ['CATERPIE', 'METAPOD'], [8, 8]],
    ['LASS', 19, ['NIDORAN_F', 'NIDORAN_M'], [6, 6]],
  ] as const)('%s trainer %i', (className, trainerNo, species, levels) => {
    const s = fresh();
    engage(s, className, trainerNo);
    const ids = species.map(name => speciesInternalId(name));
    expect(ids[0] === 0x7b || ids[0] === 0x7c || ids[0] === 0x0f).toBe(true);
    expect([...s.mem.subarray(D.wEnemyPartyCount, D.wEnemyPartyCount + 8)]).toEqual([
      species.length, ...ids, 0xff, ...Array(6 - species.length).fill(0xee),
    ]);
    species.forEach((name, index) => {
      const got = partyBytes(s, index);
      const want = oracle(speciesInternalId(name), levels[index]);
      const row = TRAINERS[className].parties[trainerNo - 1][index];
      if (row.moveOverrides) {
        for (const [slot, move] of Object.entries(row.moveOverrides)) {
          want.bytes[8 + Number(slot) - 1] = MOVES[move].id;
        }
      }
      expect(got, name).toEqual(want.bytes);
      expect(got[27]).toBe(0x98);
      expect(got[28]).toBe(0x88);
      expect(s.readBE(A.wEnemyMons + index * PARTYMON_STRUCT_LENGTH + 1)).toBe(s.readBE(A.wEnemyMons + index * PARTYMON_STRUCT_LENGTH + 34));
      expect([...s.mem.subarray(A.wEnemyMonOT + index * NAME_LENGTH, A.wEnemyMonOT + (index + 1) * NAME_LENGTH)]).toEqual(PLAYER);
    });
    expect([...s.mem.subarray(A.wEnemyMonOT + species.length * NAME_LENGTH, A.wEnemyMonOT + 6 * NAME_LENGTH)]).toEqual(Array((6 - species.length) * NAME_LENGTH).fill(0x5a));
    expect([...s.mem.subarray(A.wEnemyMonNicks, A.wEnemyMonNicks + 6 * NAME_LENGTH)]).toEqual(Array(6 * NAME_LENGTH).fill(0xa5));
    expect([...s.mem.subarray(D.wAmountMoneyWon, D.wAmountMoneyWon + 6)]).toEqual([
      ...prize(TRAINERS[className].baseMoney, levels[levels.length - 1]), 0x11, 0x11, 0x11,
    ]);
    expect(s.wCurEnemyLevel).toBe(levels[levels.length - 1]);
    expect(s.wIsInBattle).toBe(0);
    expect(s.mem[W_TRAINER_NO]).toBe(trainerNo);
    expect([...s.mem.subarray(D.wTrainerPicPointer, D.wTrainerPicPointer + 2)]).toEqual([0xab, 0xcd]);
    expect(s.mem[D.wLoneAttackNo]).toBe(0);
  });

  it('pins the internal ids the party bytes use', () => {
    expect(speciesInternalId('CATERPIE')).toBe(0x7b);
    expect(speciesInternalId('METAPOD')).toBe(0x7c);
    expect(speciesInternalId('NIDORAN_F')).toBe(0x0f);
    expect(speciesInternalId('NIDORAN_M')).toBe(0x03);
    expect(speciesInternalId('GEODUDE')).toBe(0xa9);
    expect(speciesInternalId('ONIX')).toBe(0x22);
    expect(speciesInternalId('EEVEE')).toBe(0x66);
    expect(speciesInternalId('KADABRA')).toBe(0x26);
    expect(MOVES.TACKLE).toMatchObject({ id: 33, pp: 35 });
    expect(MOVES.STRING_SHOT).toMatchObject({ id: 81, pp: 40 });
    expect(MOVES.BIND).toMatchObject({ id: 20, pp: 20 });
    expect(MOVES.BIDE).toMatchObject({ id: 117, pp: 10 });
    expect(MOVES.HARDEN).toMatchObject({ id: 106, pp: 30 });
    expect(MOVES.SCREECH).toMatchObject({ id: 103, pp: 40 });
  });

  it('copies the packed class name, 13 bytes, including the following names', () => {
    const cases: [string, string, string][] = [
      ['BUG_CATCHER', 'BUG CATCHER@L', 'BUG CATCHER@LASS@SAI'],
      ['LASS', 'LASS@SAILOR@J', ''],
      ['BROCK', 'BROCK@MISTY@L', ''],
      ['ROCKET', 'ROCKET@COOLTR', ''],
    ];
    for (const [className, thirteen, twenty] of cases) {
      const s = fresh();
      s.mem[D.wTrainerClass] = TRAINERS[className].id;
      s.mem[W_TRAINER_NO] = 1;
      getTrainerInformation(s);
      expect([...s.mem.subarray(D.wTrainerName, D.wTrainerName + 13)], className).toEqual(encodeText(thirteen));
      if (twenty) expect([...s.mem.subarray(A.wNameBuffer, A.wNameBuffer + 20)]).toEqual(encodeText(twenty));
      expect(s.wNameListType).toBe(7);
      expect(s.wPredefBank).toBe(0x0e);
      expect(s.wNamedObjectIndex).toBe(TRAINERS[className].id);
      expect([...s.mem.subarray(0xcf8c, 0xcf8e)]).toEqual([0x81, 0xcd]);
      expect(trainerPicName(s)).toBe(TRAINERS[className].pic);
      const base = TRAINERS[className].baseMoney;
      expect([...s.mem.subarray(0xd045, 0xd047)]).toEqual([
        ((Math.floor(base / 100 / 10) << 4) | Math.floor(base / 100) % 10) & 255,
        ((Math.floor((base % 100) / 10) << 4) | (base % 100) % 10) & 255,
      ]);
    }
    const bug = fresh();
    bug.mem[D.wTrainerClass] = TRAINERS.BUG_CATCHER.id;
    engage(bug, 'BUG_CATCHER', 1);
    expect([...bug.mem.subarray(A.wEnemyMons + 5, A.wEnemyMons + 8)]).toEqual([7, 7, 255]);
  });

  // Mutations 4 and 5: the slot is 1-based, and the old PP stays (Onix's empty slots stay 0, not 20 and 10).
  it('Brock is the $FF party: Onix keeps BIND and BIDE on the previous PP', () => {
    const s = fresh();
    engage(s, 'BROCK', 1);
    expect(s.mem[D.wEnemyPartyCount]).toBe(2);
    const geodude = partyBytes(s, 0);
    const onix = partyBytes(s, 1);
    expect(geodude[0]).toBe(0xa9);
    expect(geodude[33]).toBe(10);
    expect(geodude.slice(5, 7)).toEqual([5, 4]);
    expect(onix[0]).toBe(0x22);
    expect(onix[33]).toBe(12);
    expect(onix.slice(8, 12)).toEqual([MOVES.TACKLE.id, MOVES.SCREECH.id, MOVES.BIND.id, MOVES.BIDE.id]);
    expect(onix.slice(29, 33)).toEqual([MOVES.TACKLE.pp, MOVES.SCREECH.pp, 0, 0]);
    expect(onix.slice(29, 33)).not.toEqual([MOVES.TACKLE.pp, MOVES.SCREECH.pp, MOVES.BIND.pp, MOVES.BIDE.pp]);
    const want = oracle(0x22, 12);
    want.bytes[10] = MOVES.BIND.id;
    want.bytes[11] = MOVES.BIDE.id;
    expect(onix).toEqual(want.bytes);
    expect([...s.mem.subarray(D.wAmountMoneyWon, D.wAmountMoneyWon + 3)]).toEqual(prize(99, 12));
    expect(trainerPicName(s)).toBe('brock.png');
    expect([...s.mem.subarray(D.wTrainerName, D.wTrainerName + 13)]).toEqual(encodeText('BROCK@MISTY@L'));
  });

  it('the Forest bug catcher 15 writes TACKLE and STRING SHOT onto Metapod and leaves PP 0', () => {
    const s = fresh();
    engage(s, 'BUG_CATCHER', 15);
    const metapod = partyBytes(s, 1);
    expect(metapod.slice(8, 12)).toEqual([MOVES.HARDEN.id, MOVES.TACKLE.id, MOVES.STRING_SHOT.id, 0]);
    expect(metapod.slice(29, 33)).toEqual([MOVES.HARDEN.pp, 0, 0, 0]);
  });

  // Mutation 9: the rival classes copy wRivalName, including the two bytes past the 11-byte field.
  it.each(['RIVAL1', 'RIVAL2', 'RIVAL3'] as const)('%s copies the rival name, not the class name', className => {
    const s = fresh();
    s.mem.set(encodeText('BLUE@123456'), W_RIVAL_NAME);
    s.mem[A.wOptions] = 0x3c;
    s.mem[A.wObtainedBadges] = 0x01;
    s.mem.fill(0x2a, A.wNameBuffer, A.wNameBuffer + 20);
    s.mem[0xcf8c] = 0x44;
    s.mem[0xcf8d] = 0x55;
    s.wNamedObjectIndex = 0x77;
    s.wNameListType = 0x22;
    s.wPredefBank = 0x66;
    s.mem[D.wTrainerClass] = TRAINERS[className].id;
    s.mem[W_TRAINER_NO] = 1;
    getTrainerName(s);
    expect([...s.mem.subarray(D.wTrainerName, D.wTrainerName + 13)]).toEqual([...encodeText('BLUE@123456'), 0x3c, 0x01]);
    expect([...s.mem.subarray(A.wNameBuffer, A.wNameBuffer + 20)]).toEqual(Array(20).fill(0x2a));
    expect(s.wNamedObjectIndex).toBe(0x77);
    expect(s.wNameListType).toBe(0x22);
    expect(s.wPredefBank).toBe(0x66);
    expect([...s.mem.subarray(0xcf8c, 0xcf8e)]).toEqual([0x44, 0x55]);
    if (className === 'RIVAL1') {
      getTrainerInformation(s);
      readTrainer(s);
      expect(partyBytes(s, 0)[0]).toBe(0x66);
      expect(partyBytes(s, 0)[33]).toBe(5);
      expect(s.mem[D.wEnemyPartyCount]).toBe(1);
      expect([...s.mem.subarray(D.wAmountMoneyWon, D.wAmountMoneyWon + 3)]).toEqual(prize(35, 5));
      expect(trainerPicName(s)).toBe('rival1.png');
      expect([...s.mem.subarray(D.wTrainerName, D.wTrainerName + 13)]).toEqual([...encodeText('BLUE@123456'), 0x3c, 0x01]);
    }
  });

  // Mutation 10: the override starts at $2A, not $29.
  it('Rocket $29 keeps rocket.png and $2A uses jessiejames.png', () => {
    expect(TRAINERS.ROCKET.picOverride).toEqual({ trainerNoAtLeast: 42, pic: 'jessiejames.png' });
    const ordinary = fresh();
    engage(ordinary, 'ROCKET', 0x29);
    expect(trainerPicName(ordinary)).toBe('rocket.png');
    expect(ordinary.mem[D.wEnemyPartyCount]).toBe(3);
    expect([...ordinary.mem.subarray(D.wAmountMoneyWon, D.wAmountMoneyWon + 3)]).toEqual(prize(30, 32));
    const twins = fresh();
    engage(twins, 'ROCKET', 0x2a);
    expect(trainerPicName(twins)).toBe('jessiejames.png');
    expect([...twins.mem.subarray(D.wAmountMoneyWon, D.wAmountMoneyWon + 3)]).toEqual(prize(30, 14));
    expect([...twins.mem.subarray(0xd045, 0xd047)]).toEqual([0x00, 0x30]);
  });

  it('Kadabra\'s catch-rate byte is the twisted spoon', () => {
    const found = Object.values(TRAINERS).find(row => row.parties.some(party => party.some(member => member.species === 'KADABRA')));
    expect(found).toBeTruthy();
    const partyIndex = found!.parties.findIndex(party => party.some(member => member.species === 'KADABRA'));
    const mon = found!.parties[partyIndex].findIndex(member => member.species === 'KADABRA');
    const s = fresh();
    s.mem[D.wTrainerClass] = found!.id;
    s.mem[W_TRAINER_NO] = partyIndex + 1;
    getTrainerInformation(s);
    readTrainer(s);
    const base = A.wEnemyMons + mon * PARTYMON_STRUCT_LENGTH;
    expect(s.mem[base]).toBe(0x26);
    expect(s.mem[base + 7]).toBe(0x60);
  });

  it('wIsInBattle 1 copies the ten stat bytes and still calculates current HP', () => {
    const s = fresh();
    s.wIsInBattle = 1;
    for (let i = 0; i < 10; i++) s.mem[A.wEnemyMonMaxHP + i] = 0x40 + i;
    engage(s, 'BUG_CATCHER', 3);
    const mon = partyBytes(s, 0);
    const want = oracle(0x7b, 10);
    expect(mon.slice(1, 3)).toEqual(want.bytes.slice(1, 3));
    expect(mon.slice(34, 44)).toEqual([0x40, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49]);
    expect(mon.slice(34, 44)).not.toEqual(want.bytes.slice(34, 44));
  });

  it('a full party refuses the next mon and does not draw', () => {
    const s = fresh();
    s.mem[D.wEnemyPartyCount] = 6;
    s.mem[D.wEnemyPartyCount + 1] = 0x11;
    s.mem[D.wTrainerClass] = TRAINERS.BUG_CATCHER.id;
    s.mem[W_TRAINER_NO] = 1;
    s.wCurEnemyLevel = 7;
    s.wCurPartySpecies = 0x7b;
    s.wMonDataLocation = 1;
    installTrainerSpecies(s);
    // The sixth slot is already full, so ReadTrainer's own walk is the one under test via a direct class.
    getTrainerInformation(s);
    readTrainer(s);
    expect(s.mem[D.wEnemyPartyCount]).toBe(2);
  });
});

describe('prize money and getMonName', () => {
  // Mutation 8: without the fill the low byte stays $98.
  it('a carry fills $99 from the middle byte', () => {
    const s = fresh();
    s.mem[0xd045] = 0x99;
    s.mem[0xd046] = 0x99;
    s.wCurEnemyLevel = 2;
    addTrainerPrizeMoney(s);
    expect([...s.mem.subarray(D.wAmountMoneyWon, D.wAmountMoneyWon + 6)]).toEqual([0x00, 0x99, 0x99, 0x11, 0x11, 0x11]);
  });

  // The next add uses the de AddBCD left behind, so bytes past the total change and byte +3 does not.
  it('a carry leaves de where the fill stopped, and the next add misses the total', () => {
    const s = fresh();
    s.mem[0xd045] = 0x99;
    s.mem[0xd046] = 0x99;
    s.wCurEnemyLevel = 3;
    addTrainerPrizeMoney(s);
    expect([...s.mem.subarray(D.wAmountMoneyWon, D.wAmountMoneyWon + 6)]).toEqual([0x00, 0x99, 0x99, 0x11, 0x99, 0x99]);
  });

  // Mutation 11.
  it('getMonName pads 10 bytes with @, writes @ at +10, and leaves +11..+19', () => {
    const s = new BattleState();
    s.mem.fill(0xab, A.wNameBuffer, A.wNameBuffer + 20);
    getMonName(s, { name: 'DITTO', base: [1, 1, 1, 1, 1], type1: 0, type2: 0, catchRate: 1, baseExp: 1, moves: [0, 0, 0, 0], learnset: [] });
    expect([...s.mem.subarray(A.wNameBuffer, A.wNameBuffer + 11)]).toEqual(encodeText('DITTO@@@@@@'));
    expect([...s.mem.subarray(A.wNameBuffer + 11, A.wNameBuffer + 20)]).toEqual(Array(9).fill(0xab));
    getMonName(s, { name: 'RATTATA', base: [1, 1, 1, 1, 1], type1: 0, type2: 0, catchRate: 1, baseExp: 1, moves: [0, 0, 0, 0], learnset: [] });
    expect([...s.mem.subarray(A.wNameBuffer, A.wNameBuffer + 11)]).toEqual(encodeText('RATTATA@@@@'));
    expect(s.mem[A.wNameBuffer + 11]).toBe(0xab);
  });

  // Mutation 3: the final CalcStats call is b = 0. Party bytes cannot see b = 1 after the EV clear.
  it('CalcStats is called with b = 0', () => {
    const source = readFileSync(resolve(__dirname, 'battle_trainer_party.ts'), 'utf8');
    expect(source).toContain('calcStats(state, 0,');
    expect(source).not.toContain('calcStats(state, 1,');
    expect(source).toContain('calcStat(state, 1, 0,');
    expect(source).toContain('wLearningMovesFromDayCare] = 0');
  });
});

describe('link', () => {
  it('GetTrainerName and GetTrainerInformation throw, and ReadTrainer returns', () => {
    const s = fresh();
    s.wLinkState = 1;
    s.mem[D.wTrainerClass] = TRAINERS.BUG_CATCHER.id;
    s.mem[W_TRAINER_NO] = 1;
    s.mem[D.wEnemyPartyCount] = 0x5a;
    expect(() => getTrainerName(s)).toThrow(/link battle/);
    expect(() => getTrainerInformation(s)).toThrow(/link battle/);
    readTrainer(s);
    expect(s.mem[D.wEnemyPartyCount]).toBe(0x5a);
    expect([...s.mem.subarray(A.wEnemyMonNicks, A.wEnemyMonNicks + 6)]).toEqual(Array(6).fill(0xa5));
  });
});

describe.skipIf(!process.env.ROM_PATH)('TrainerDataPointers', () => {
  it('walks all 47 classes and matches each parties array length', () => {
    const rom = readFileSync(process.env.ROM_PATH!);
    const sym = execFileSync('git', ['-C', resolve(__dirname, '../../../refs/pokeyellow'), 'show', '573535d:pokeyellow.sym'], { encoding: 'utf8', windowsHide: true });
    const symbols = new Map([...sym.matchAll(/^([\da-f]+):([\da-f]+) (\S+)$/gmi)].map(match => [match[3], [Number.parseInt(match[1], 16), Number.parseInt(match[2], 16)] as const]));
    const table = symbols.get('TrainerDataPointers');
    const end = symbols.get('TrainerAI');
    expect(table).toEqual([0x0e, 0x5dd1]);
    expect(end?.[0]).toBe(0x0e);
    const bank = table![0];
    const fileAt = (addr: number) => bank * 0x4000 + (addr & 0x3fff);
    const tableAt = fileAt(table![1]);
    const pointers: number[] = [];
    for (let i = 0; i < 47; i++) pointers.push(fileAt(rom[tableAt + i * 2] | (rom[tableAt + i * 2 + 1] << 8)));
    const endAt = fileAt(end![1]);
    const byId = new Map(Object.values(TRAINERS).map(row => [row.id, row]));
    expect(byId.size).toBe(47);
    for (let classIndex = 0; classIndex < 47; classIndex++) {
      const offset = pointers[classIndex];
      const shared = pointers.slice(classIndex + 1).includes(offset);
      let count = 0;
      if (!shared) {
        let endOffset = endAt;
        for (const pointer of pointers) if (pointer > offset && pointer < endOffset) endOffset = pointer;
        let at = offset;
        while (at < endOffset) {
          if (rom[at] === 0xff) {
            at++;
            let members = 0;
            while (rom[at] !== 0) { members++; at += 2; }
            at++;
            if (members > 0) count++;
          } else {
            at++;
            let members = 0;
            while (rom[at] !== 0) { members++; at++; }
            at++;
            if (members > 0) count++;
          }
        }
      }
      expect(byId.get(classIndex + 1)!.parties.length, `class ${classIndex + 1}`).toBe(count);
    }
  });
});
