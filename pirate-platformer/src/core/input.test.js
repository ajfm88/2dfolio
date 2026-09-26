import { describe, expect, it } from 'vitest';

import { isButtonActivation, isFormField, stepButton } from './input.js';

describe('isFormField', () => {
  it('claims keys for inputs, textareas and selects', () => {
    expect(isFormField(/** @type {EventTarget} */ ({ tagName: 'INPUT' }))).toBe(true);
    expect(isFormField(/** @type {EventTarget} */ ({ tagName: 'TEXTAREA' }))).toBe(true);
    expect(isFormField(/** @type {EventTarget} */ ({ tagName: 'SELECT' }))).toBe(true);
  });

  it('claims keys for contenteditable elements', () => {
    const div = { tagName: 'DIV', isContentEditable: true };
    expect(isFormField(/** @type {EventTarget} */ (div))).toBe(true);
  });

  it('leaves buttons, the canvas and the body to the game', () => {
    // Buttons own only Enter and Space (isButtonActivation); M and arrows still count.
    expect(isFormField(/** @type {EventTarget} */ ({ tagName: 'BUTTON' }))).toBe(false);
    expect(isFormField(/** @type {EventTarget} */ ({ tagName: 'CANVAS' }))).toBe(false);
    const body = { tagName: 'BODY', isContentEditable: false };
    expect(isFormField(/** @type {EventTarget} */ (body))).toBe(false);
  });

  it('treats a missing target as not a field', () => {
    expect(isFormField(null)).toBe(false);
  });
});

describe('isButtonActivation', () => {
  const button = /** @type {EventTarget} */ ({ tagName: 'BUTTON' });

  it('leaves Enter and Space on a focused button to the button', () => {
    expect(isButtonActivation(button, 'Enter')).toBe(true);
    expect(isButtonActivation(button, 'NumpadEnter')).toBe(true);
    expect(isButtonActivation(button, 'Space')).toBe(true);
  });

  it('still lets M and the arrows reach the game from a focused button', () => {
    expect(isButtonActivation(button, 'KeyM')).toBe(false);
    expect(isButtonActivation(button, 'ArrowLeft')).toBe(false);
  });

  it('keeps Enter as the pause action away from buttons', () => {
    const canvas = /** @type {EventTarget} */ ({ tagName: 'CANVAS' });
    const body = /** @type {EventTarget} */ ({ tagName: 'BODY' });
    expect(isButtonActivation(canvas, 'Enter')).toBe(false);
    expect(isButtonActivation(body, 'Space')).toBe(false);
    expect(isButtonActivation(null, 'Enter')).toBe(false);
  });
});

describe('stepButton', () => {
  const fresh = () => ({ held: false, pressed: false, released: false });

  it('turns a press released within one frame into one press and one release', () => {
    const b = fresh();
    stepButton(b, false, true);
    expect(b).toEqual({ held: true, pressed: true, released: false });
    stepButton(b, false, false);
    expect(b).toEqual({ held: false, pressed: false, released: true });
    stepButton(b, false, false);
    expect(b).toEqual({ held: false, pressed: false, released: false });
  });

  it('behaves as a plain level for an ordinary hold', () => {
    const b = fresh();
    stepButton(b, true, true);
    expect(b.pressed).toBe(true);
    stepButton(b, true, false);
    expect(b).toEqual({ held: true, pressed: false, released: false });
    stepButton(b, false, false);
    expect(b).toEqual({ held: false, pressed: false, released: true });
  });

  it('never presses twice for one hold', () => {
    const b = fresh();
    stepButton(b, true, true);
    stepButton(b, true, true);
    expect(b.pressed).toBe(false);
    expect(b.held).toBe(true);
  });

  it('does nothing without a press', () => {
    const b = fresh();
    stepButton(b, false, false);
    expect(b).toEqual(fresh());
  });
});
