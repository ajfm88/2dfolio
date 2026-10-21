import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { TEXT_B, TextScreen } from './text_printer';
import { gainedText, monsStatsRoseText, TextProgramRunner, withExpAllText } from './text_runner';
import type { TextAsmState, TextBindings, TextReturn } from './text_runner';
import { substituteNames } from '../core/player_state';
import type { TextPrograms, TextProgramsFile } from '../rom/extractors/text_programs';

const file = JSON.parse(readFileSync(resolve(__dirname, '../../data/text_programs.json'), 'utf8')) as TextProgramsFile;

function rig(programs: TextPrograms, down = 0) {
  const input = { down };
  const read = vi.fn();
  const ports = {
    buttons: () => input.down, speed: () => 1, soundFinished: () => true,
    joypadRead: read, beep: vi.fn(), playSound: vi.fn(), cry: vi.fn(),
  };
  const screen = new TextScreen(ports, down);
  const runner = new TextProgramRunner(screen, programs, ports);
  const row = (n = 2) => screen.buffer.slice(n * 20 + 1, n * 20 + 19).join('').trimEnd();
  return { input, read, ports, screen, runner, row };
}

/** Accept each ManualTextScroll. Delay3 does not read; the press must be a new edge. */
function drive(run: Generator<void, TextReturn>, input: { down: number }, screen: TextScreen): TextReturn {
  let step = run.next();
  for (let frame = 0; !step.done && frame < 300; frame++) {
    if (screen.waiting) input.down = input.down === 0 ? TEXT_B : 0;
    step = run.next();
  }
  if (!step.done) throw new Error('text did not finish');
  return step.value;
}

const side = { whoseTurn: 0, battleMonNick: 'PIKACHU', enemyMonNick: 'PIDGEY' };

describe('TX_LOW (home/text.asm TextCommand_LOW)', () => {
  it('sets BC to (1, 16) and continues, without printing or drawing a box', () => {
    const r = rig({ P: [{ op: 'text', text: 'AB' }, { op: 'low' }, { op: 'text', text: 'C' }] });
    expect(r.runner.run('P', {}, true).next()).toEqual({ done: true, value: 'returned' });
    expect(r.screen.bc()).toEqual({ column: 2, row: 16 });
    expect(r.row()).toBe('AB');
    expect(r.row(4)).toBe('C');
    expect(r.screen.buffer.join('')).not.toMatch(/[┌┐└┘─│]/);
  });

  it('runs the committed ItemUseText00 across the two lines', () => {
    const r = rig(file.programs);
    expect(r.runner.run('ItemUseText00', { stringBuffer: 'POTION' }, true).next().done).toBe(true);
    expect(r.row()).toBe(substituteNames('<PLAYER> used'));
    expect(r.row(4)).toBe('POTION!');
  });
});

describe('TX_NUM with 1 digit (home/print_num.asm:61–97)', () => {
  it.each([0, 1, 5, 9, 10, 100, 255])('prints %i from the left-aligned walk, including a value past 9', hits => {
    const r = rig({ P: [
      { op: 'decimal', binding: 'playerNumHits', bytes: 1, digits: 1 },
      { op: 'text', text: '!' },
    ] });
    const run = r.runner.run('P', { playerNumHits: hits });
    expect(run.next().done).toBe(false);
    // PrintNumber writes immediately, so the whole number is already on screen.
    expect(r.row()).toBe(`${hits}!`);
    expect(r.read).toHaveBeenCalledTimes(1);
  });

  it('rejects a value that does not fit in the one byte', () => {
    const r = rig({ P: [{ op: 'decimal', binding: 'playerNumHits', bytes: 1, digits: 1 }] });
    expect(() => r.runner.run('P', { playerNumHits: 256 }).next())
      .toThrow('invalid numeric text binding playerNumHits in P');
  });

  it('runs the committed hit-count programs', () => {
    const player = rig(file.programs);
    expect(drive(player.runner.run('MultiHitText', { playerNumHits: 10 }, true), player.input, player.screen))
      .toBe('returned');
    expect(player.row()).toBe('Hit the enemy');
    expect(player.row(4)).toBe('10 times!');
    const enemy = rig(file.programs);
    expect(drive(enemy.runner.run('HitXTimesText', { enemyNumHits: 0 }, true), enemy.input, enemy.screen))
      .toBe('returned');
    expect(enemy.row()).toBe('Hit 0 times!');
  });
});

describe('<USER> and <TARGET> (home/text.asm:147–185)', () => {
  it.each([
    ['<USER>', 0, 'XPIKACHUY'],
    ['<USER>', 1, 'XEnemy PIDGEYY'],
    ['<TARGET>', 0, 'XEnemy PIDGEYY'],
    ['<TARGET>', 1, 'XPIKACHUY'],
  ] as const)('%s with whoseTurn %i expands while the string continues', (token, whoseTurn, expected) => {
    const r = rig({ P: [{ op: 'text', text: `X${token}Y` }] });
    r.runner.setBattleNames({ ...side, whoseTurn });
    expect(r.runner.run('P', {}, true).next().done).toBe(true);
    expect(r.row()).toBe(expected);
  });

  it('without a battle side the tokens stay glyphs', () => {
    const r = rig({ P: [{ op: 'text', text: '<USER> <TARGET>' }] });
    expect(r.runner.run('P', {}, true).next().done).toBe(true);
    expect(r.row()).toBe('<USER> <TARGET>');
  });

  it('places the committed poison and burn lines from text-features.json', () => {
    const poison = rig(file.programs);
    poison.runner.setBattleNames(side);
    expect(drive(poison.runner.run('_HurtByPoisonText', {}, true), poison.input, poison.screen)).toBe('returned');
    expect(poison.row()).toBe("PIKACHU's");
    expect(poison.row(4)).toBe('hurt by poison!');
    const burned = rig(file.programs);
    burned.runner.setBattleNames({ ...side, whoseTurn: 1 });
    expect(drive(burned.runner.run('_BurnedText', {}, true), burned.input, burned.screen)).toBe('returned');
    expect(burned.row()).toBe('PIKACHU');
    expect(burned.row(4)).toBe('was burned!');
  });
});

describe('text_asm registry (home/text.asm TextCommand_START_ASM)', () => {
  it('runs the returned program on this screen and does not continue past the op', () => {
    const seen: TextAsmState[] = [];
    const r = rig({
      P: [{ op: 'text', text: 'A' }, { op: 'asm' }, { op: 'text', text: 'WRONG' }],
      C: [{ op: 'text', text: 'B' }],
    });
    r.runner.registerAsm('P', state => { seen.push(state); return 'C'; });
    expect(r.runner.run('P', {}, true).next()).toEqual({ done: true, value: 'returned' });
    expect(seen).toEqual([{ label: 'P', column: 2, row: 14 }]);
    expect(r.row()).toBe('AB');
  });

  it('continues after the op when the handler returns nothing', () => {
    const r = rig({ P: [{ op: 'text', text: 'A' }, { op: 'asm' }, { op: 'text', text: 'B' }] });
    r.runner.registerAsm('P', () => undefined);
    expect(r.runner.run('P', {}, true).next()).toEqual({ done: true, value: 'returned' });
    expect(r.row()).toBe('AB');
  });

  it('an unregistered committed overworld root still returns asm', () => {
    const r = rig(file.programs);
    expect(r.runner.run('PewterNidoranHouseNidoranText', {}, true).next())
      .toEqual({ done: true, value: 'asm' });
    expect(r.row()).toBe('NIDORAN: Bowbow!');
  });
});

describe('DoneText cursor (home/text.asm:221–228)', () => {
  it('leaves BC where the string began, so the next glyph overwrites its first tile', () => {
    const r = rig({ P: [{ op: 'text', text: 'Hi<DONE>' }] });
    expect(r.runner.run('P', {}, true).next()).toEqual({ done: true, value: 'returned' });
    expect(r.row()).toBe('Hi');
    expect(r.screen.bc()).toEqual({ column: 1, row: 14 });
    r.screen.placeString('Z', true).next();
    expect(r.row()).toBe('Zi');
  });
});

describe('MonsStatsRoseText and GainedText handlers', () => {
  const rose = (effect: number, whoseTurn = 0) => {
    const r = rig(file.programs);
    r.runner.setBattleNames({ ...side, whoseTurn });
    r.runner.registerAsm('MonsStatsRoseText', monsStatsRoseText(effect));
    const bindings: TextBindings = { stringBuffer: 'ATTACK' };
    expect(drive(r.runner.run('MonsStatsRoseText', bindings, true), r.input, r.screen)).toBe('returned');
    return r;
  };

  it('below ATTACK_DOWN1_EFFECT prints RoseText on the same screen', () => {
    const r = rose(0x11);
    expect(r.row()).toBe("PIKACHU's");
    expect(r.row(4)).toBe('ATTACK rose!');
  });

  it('the enemy turn places Enemy before the nick on that same line', () => {
    const r = rose(0x11, 1);
    expect(r.row()).toBe("Enemy PIDGEY's");
    expect(r.row(4)).toBe('ATTACK rose!');
  });

  it.each([0x12, 0xff])('effect %s (>= ATTACK_DOWN1_EFFECT) prints the greatly line', effect => {
    const r = rose(effect);
    expect(r.row()).toBe('ATTACK');
    expect(r.row(4)).toBe('greatly rose!');
  });

  function gain(boostExpByExpAll: number, gainBoostedExp: number) {
    const r = rig(file.programs);
    r.runner.registerAsm('GainedText', gainedText(boostExpByExpAll, gainBoostedExp));
    r.runner.registerAsm('WithExpAllText', withExpAllText());
    const bindings: TextBindings = { nameBuffer: 'PIKACHU', expAmountGained: 100 };
    expect(drive(r.runner.run('GainedText', bindings, true), r.input, r.screen)).toBe('returned');
    return r;
  }

  it('EXP.ALL wins over the boosted flag, including a value other than 1', () => {
    for (const flag of [1, 2]) {
      const r = gain(flag, 1);
      expect(r.row()).toBe('with EXP.ALL,');
      expect(r.row(4)).toBe('100 EXP. Points!');
    }
  });

  it('a boosted gain with no EXP.ALL prints BoostedText', () => {
    const r = gain(0, 5);
    expect(r.row()).toBe('a boosted');
    expect(r.row(4)).toBe('100 EXP. Points!');
  });

  it('otherwise prints ExpPointsText on the second line', () => {
    const r = gain(0, 0);
    expect(r.row()).toBe('PIKACHU gained');
    expect(r.row(4)).toBe('100 EXP. Points!');
  });

  it('WithExpAllText alone continues at ExpPointsText', () => {
    const r = rig(file.programs);
    r.runner.registerAsm('WithExpAllText', withExpAllText());
    expect(drive(r.runner.run('WithExpAllText', { expAmountGained: 100 }, true), r.input, r.screen))
      .toBe('returned');
    expect(r.row(4)).toBe('100 EXP. Points!');
  });
});
