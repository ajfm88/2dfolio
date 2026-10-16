// DisplayPokemartDialogue (home/text_script.asm): greeting, then DisplayPokemartDialogue_.
import type { ScriptCommand } from '../script/types';
import { registerTextScript } from './text_handlers';

export function buildMartScript(items: readonly string[]): ScriptCommand[] {
  return [
    { type: 'displayOpen' },
    { type: 'printText', program: 'PokemartGreetingText', box: 'new' },
    { type: 'pokemart', items: [...items] },
    { type: 'displayClose', outerWait: true },
  ];
}

registerTextScript('mart', ctx => buildMartScript(ctx.shopItems ?? []));
