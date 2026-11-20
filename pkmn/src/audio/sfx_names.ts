/**
 * Every SFX `npm run setup` extracts (rom/extractors/audio.ts SFX_HEADERS), preloaded once
 * audio starts so playSFX starts a sound in the frame it's called, as PlaySound does.
 * sfx_jingles.test.ts keeps this list equal to data/audio/sfx/.
 */
export const EXTRACTED_SFX: readonly string[] = [
  'collision', 'cut', 'enter_pc', 'get_item1', 'get_item2', 'get_key_item',
  'go_inside', 'go_outside', 'heal_ailment', 'heal_hp', 'healing_machine', 'press_ab', 'purchase', 'run', 'save', 'shrink', 'start_menu', 'swap',
  'turn_off_pc', 'turn_on_pc', 'withdraw_deposit',
  // V5g1 checkpoint-02: Audio 3's own bodies, played while a bank-$1f song is loaded (sound_ids.ts SFX_FILES).
  'enter_pc_3', 'save_3', 'turn_on_pc_3',
  // V5g3 checkpoint-03: the ledge hop and the Town Map's input.
  'ledge', 'tink',
  // Opening checkpoint-05: the title's two sounds (Audio 3 only); checkpoint 09: the star's.
  'intro_crash', 'intro_whoosh', 'shooting_star',
];
