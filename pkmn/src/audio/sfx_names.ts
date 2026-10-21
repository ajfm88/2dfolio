/**
 * Every SFX `npm run setup` extracts (rom/extractors/audio.ts SFX_HEADERS), preloaded once
 * audio starts so playSFX starts a sound in the frame it's called, as PlaySound does.
 * sfx_jingles.test.ts keeps this list equal to data/audio/sfx/.
 */
export const EXTRACTED_SFX: readonly string[] = [
  'collision', 'cut', 'enter_pc', 'get_item1', 'get_item2', 'get_key_item',
  'go_inside', 'go_outside', 'heal_ailment', 'heal_hp', 'healing_machine', 'press_ab', 'purchase', 'run', 'save', 'shrink', 'start_menu', 'swap',
  'turn_off_pc', 'turn_on_pc', 'withdraw_deposit',
];
