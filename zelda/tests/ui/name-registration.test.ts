import { describe, it, expect } from 'vitest';
import { NameRegistrationScreen } from '../../src/ui/name-registration.js';
import { Action, type InputManager } from '../../src/core/input.js';
import { createEmptySlot, type SaveSlot } from '../../src/save/save-manager.js';

function fakeInput(opts: { held?: Action[]; just?: Action[] } = {}): InputManager {
  const held = new Set(opts.held ?? []);
  const just = new Set(opts.just ?? []);
  return {
    isHeld: (a: Action) => held.has(a),
    isJustPressed: (a: Action) => just.has(a),
  } as unknown as InputManager;
}

function emptySlots(): SaveSlot[] {
  return [createEmptySlot(), createEmptySlot(), createEmptySlot()];
}

describe('NameRegistrationScreen', () => {
  it('starts on the first editable slot with an empty buffer', () => {
    const s = new NameRegistrationScreen();
    s.reset(emptySlots());
    expect(s.slotCursorIndex).toBe(0);
    expect(s.nameOf(0).trim()).toBe('');
    expect(s.boardIndex).toBe(0); // 'A'
  });

  it('A writes the highlighted char and advances the name cursor', () => {
    const s = new NameRegistrationScreen();
    s.reset(emptySlots());
    s.update(fakeInput({ just: [Action.Attack] })); // write 'A' at pos 0
    s.update(fakeInput({ just: [Action.Attack] })); // write 'A' at pos 1
    expect(s.nameOf(0).startsWith('AA')).toBe(true);
  });

  it('name cursor wraps after 8 characters', () => {
    const s = new NameRegistrationScreen();
    s.reset(emptySlots());
    for (let i = 0; i < 8; i++) s.update(fakeInput({ just: [Action.Attack] }));
    // 9th write lands back at position 0 (still 'A').
    s.update(fakeInput({ just: [Action.Attack] }));
    expect(s.nameOf(0)).toBe('AAAAAAAA');
  });

  it('B advances the name cursor without writing', () => {
    const s = new NameRegistrationScreen();
    s.reset(emptySlots());
    s.update(fakeInput({ just: [Action.Item] }));   // skip position 0
    s.update(fakeInput({ just: [Action.Attack] })); // write 'A' at position 1
    expect(s.nameOf(0)[0]).toBe(' ');
    expect(s.nameOf(0)[1]).toBe('A');
  });

  it('Select cycles slots, skipping already-registered ones, and reaches END', () => {
    const slots = emptySlots();
    slots[1] = { name: 'ZELDA', quest: 1, registered: true, deaths: 0 };
    const s = new NameRegistrationScreen();
    s.reset(slots);
    expect(s.slotCursorIndex).toBe(0);        // first editable
    s.update(fakeInput({ just: [Action.Select] }));
    expect(s.slotCursorIndex).toBe(2);        // skipped registered slot 1
    s.update(fakeInput({ just: [Action.Select] }));
    expect(s.slotCursorIndex).toBe(3);        // END
    s.update(fakeInput({ just: [Action.Select] }));
    expect(s.slotCursorIndex).toBe(0);        // wraps back to first editable
  });

  it('Start on END commits registrations for edited slots only', () => {
    const s = new NameRegistrationScreen();
    s.reset(emptySlots());
    s.update(fakeInput({ just: [Action.Attack] })); // slot 0 name = 'A...'
    // move cursor to END (0 -> 1 -> 2 -> END)
    s.update(fakeInput({ just: [Action.Select] }));
    s.update(fakeInput({ just: [Action.Select] }));
    s.update(fakeInput({ just: [Action.Select] }));
    expect(s.slotCursorIndex).toBe(3);
    s.update(fakeInput({ just: [Action.Start] }));
    expect(s.done).toBe(true);
    expect([...s.registrations]).toEqual([{ slot: 0, name: 'A' }]);
  });

  it('DAS auto-repeat: first move on press, next after 16 held frames', () => {
    const s = new NameRegistrationScreen();
    s.reset(emptySlots());
    s.update(fakeInput({ held: [Action.Right] }));  // frame 1 → move once
    expect(s.boardIndex).toBe(1);
    for (let i = 0; i < 15; i++) s.update(fakeInput({ held: [Action.Right] })); // frames 2..16
    expect(s.boardIndex).toBe(1); // no repeat yet
    s.update(fakeInput({ held: [Action.Right] })); // frame 17 → first repeat
    expect(s.boardIndex).toBe(2);
  });

  it('does not move the board while parked on END', () => {
    const s = new NameRegistrationScreen();
    s.reset(emptySlots());
    for (let i = 0; i < 3; i++) s.update(fakeInput({ just: [Action.Select] })); // → END
    s.update(fakeInput({ held: [Action.Right] }));
    expect(s.boardIndex).toBe(0);
  });
});
