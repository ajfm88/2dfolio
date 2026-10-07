/**
 * Every SFX `npm run setup` extracts (rom/extractors/audio.ts SFX_HEADERS), preloaded once
 * audio starts so playSFX starts a sound in the frame it's called, as PlaySound does.
 * sfx_names.test.ts keeps this list equal to data/audio/sfx/.
 */
export const EXTRACTED_SFX: readonly string[] = [
  'collision', 'cut', 'get_item1', 'get_item2', 'go_inside', 'go_outside',
  'press_ab', 'purchase', 'save', 'start_menu', 'swap', 'withdraw_deposit',
];
