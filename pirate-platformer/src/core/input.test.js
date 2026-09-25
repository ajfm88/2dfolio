import { describe, expect, it } from 'vitest';

import { isFormField } from './input.js';

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
    // A focused overlay button must still see Enter as the pause action.
    expect(isFormField(/** @type {EventTarget} */ ({ tagName: 'BUTTON' }))).toBe(false);
    expect(isFormField(/** @type {EventTarget} */ ({ tagName: 'CANVAS' }))).toBe(false);
    const body = { tagName: 'BODY', isContentEditable: false };
    expect(isFormField(/** @type {EventTarget} */ (body))).toBe(false);
  });

  it('treats a missing target as not a field', () => {
    expect(isFormField(null)).toBe(false);
  });
});
