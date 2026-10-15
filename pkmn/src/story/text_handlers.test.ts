import { describe, expect, it } from 'vitest';
import { displayTextID, getTextHandler, registerTextHandler } from './text_handlers';
import type { TextHandlerContext } from './text_handlers';
import { Bag } from '../items';

describe('text handler foundation', () => {
  it('evaluates the registered handler from live context and rejects duplicate entries', () => {
    registerTextHandler('FixtureMap', 1, ctx => displayTextID([{ type: 'printText',
      program: ctx.hasFlag('CHANGED') ? 'after' : 'before' }]));
    const flags = new Set<string>();
    const ctx: TextHandlerContext = { hasFlag: f => flags.has(f), bag: new Bag(), ownedCount: 0,
      facing: 'up', step: { x: 0, y: 0 }, party: [] };
    const handler = getTextHandler('FixtureMap', 1)!;
    expect(handler(ctx)[1]).toEqual({ type: 'printText', program: 'before' });
    flags.add('CHANGED');
    expect(handler(ctx)[1]).toEqual({ type: 'printText', program: 'after' });
    expect(getTextHandler('FixtureMap', 2)).toBeUndefined();
    expect(getTextHandler('FixtureMap', undefined)).toBeUndefined();
    expect(() => registerTextHandler('FixtureMap', 1, handler)).toThrow('duplicate');
  });
  it('wraps a body with explicit automatic-box and outer-wait defaults/options', () => {
    const body = [{ type: 'healParty' } as const];
    expect(displayTextID(body)).toEqual([{ type: 'displayOpen', autoBox: true }, ...body,
      { type: 'displayClose', outerWait: true }]);
    expect(displayTextID(body, { autoBox: false, outerWait: false })).toEqual([
      { type: 'displayOpen', autoBox: false }, ...body, { type: 'displayClose', outerWait: false }]);
  });
});
