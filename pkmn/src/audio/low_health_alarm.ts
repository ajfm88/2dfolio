// Music_DoLowHealthAlarm (audio/low_health_alarm.asm). Nothing in the game sets bit 7 until A5c3.
// The byte and the disabled flag are not saved.
import type { GBSynthesizer } from './synthesizer';

/** SFX_CRY_25 + 3. Cry25's header is 9 bytes, so this is also SFX_GET_ITEM_1's id ($86). */
export const CRY_SFX_END = 0x86;
export const DISABLE_LOW_HEALTH_ALARM = 0xff;
const ALARM_BIT = 0x80;
const TIMER_MASK = 0x7f;

const HIGH = [0x00, 0xa0, 0xe2, 0x50, 0x87] as const;
const LOW = [0x00, 0xb0, 0xe2, 0xee, 0x86] as const;
const SILENCE = [0x00, 0x00, 0x00, 0x00, 0x80] as const;

let byte = 0;
let channel5 = 0;
let disabled = false;
let synth: GBSynthesizer | null = null;

/** The engine constructed last owns the pulse-1 voice. */
export function bindAlarmSynth(next: GBSynthesizer): void {
  synth = next;
}

export function lowHealthAlarm(): number { return byte; }
export function setLowHealthAlarm(value: number): void { byte = value & 0xff; }
export function lowHealthChannel5(): number { return channel5; }
/** StopAllMusic's sound-ID clear. It does not touch the alarm byte. */
export function setLowHealthChannel5(id: number): void { channel5 = id & 0xff; }
export function isLowHealthAlarmDisabled(): boolean { return disabled; }
export function setLowHealthAlarmDisabled(value: boolean): void { disabled = value; }

export interface AlarmStep {
  before: number;
  after: number;
  tone: 'high' | 'low' | 'silence' | 'none';
  registers: string;
  channel5: number;
}

/** One invocation. $FF is checked before the enable bit. A clear bit writes nothing. */
export function doLowHealthAlarm(): AlarmStep {
  const before = byte;
  if (before === DISABLE_LOW_HEALTH_ALARM) {
    byte = 0;
    channel5 = 0;
    play(SILENCE);
    return { before, after: 0, tone: 'silence', registers: hex(SILENCE), channel5: 0 };
  }
  if ((before & ALARM_BIT) === 0) {
    return { before, after: before, tone: 'none', registers: '', channel5 };
  }
  const timer = before & TIMER_MASK;
  if (timer === 0) {
    play(HIGH);
    byte = ALARM_BIT | 30;
    return { before, after: byte, tone: 'high', registers: hex(HIGH), channel5 };
  }
  let tone: AlarmStep['tone'] = 'none';
  let registers = '';
  if (timer === 20) {
    play(LOW);
    tone = 'low';
    registers = hex(LOW);
  }
  channel5 = CRY_SFX_END;
  byte = ALARM_BIT | ((timer - 1) & TIMER_MASK);
  return { before, after: byte, tone, registers, channel5 };
}

/** The HUD writer's alarm byte and clearChan5 flag. Does not run the tone. */
export function applyHudAlarm(alarm: number, clearChan5: boolean): void {
  byte = alarm & 0xff;
  if (clearChan5) channel5 = 0;
}

/** EndLowHealthAlarm: byte 0, CHAN5 0, disabled flag 1. */
export function endLowHealthAlarm(): void {
  byte = 0;
  channel5 = 0;
  disabled = true;
}

/** RemoveFaintedPlayerMon writes $FF when bit 7 is set. The caller waits on soundFinished. */
export function faintedPlayerLowHealthAlarm(): boolean {
  if ((byte & ALARM_BIT) === 0) return false;
  byte = DISABLE_LOW_HEALTH_ALARM;
  return true;
}

/** EndOfBattle.resetVariables: byte 0 and CHAN5 0. The disabled flag stays as it is. */
export function resetLowHealthAlarm(): void {
  byte = 0;
  channel5 = 0;
}

function play(regs: readonly number[]): void {
  synth?.writePulse(0, regs[1], regs[2], regs[3], regs[4]);
}

function hex(regs: readonly number[]): string {
  return regs.map(value => value.toString(16).padStart(2, '0')).join(' ');
}
