// Map text added after the frozen text baselines (A5b, A5c1, A5c3d checkpoint-03, A5c3e checkpoint-02). Those tests
// prove their own checkpoint's additions and that nothing else changed; later maps' programs and TextPointers tables
// are listed here once, each with its slice, so the old proofs keep their scope. Every label is checked against
// pret's symbols in battle_text_data.test.ts.

/** V3 checkpoint-01 (notes/88-v3-plan.md §7): Museum 1F, Museum 2F and Pewter Gym. */
export const LATER_MAP_PROGRAMS: readonly string[] = [
  'PewterGymBrockWaitTakeThisText', '_PewterGymBrockWaitTakeThisText', 'PewterGymReceivedTM34Text',
  '_PewterGymReceivedTM34Text', '_TM34ExplanationText', 'PewterGymTM34NoRoomText', '_PewterGymTM34NoRoomText',
  'Museum1FPrintGamblerText.Text', '_Museum1FGamblerText', 'Museum1FPrintScientist3Text.Text', '_Museum1FScientist3Text',
  'Museum1FPrintOldAmberText.Text', '_Museum1FOldAmberText',
  'Museum2FYoungsterText', '_Museum2FYoungsterText', 'Museum2FGrampsText', '_Museum2FGrampsText',
  'Museum2FScientistText', '_Museum2FScientistText', 'Museum2FBrunetteGirlText', '_Museum2FBrunetteGirlText',
  'Museum2FSpaceShuttleSignText', '_Museum2FSpaceShuttleSignText', 'Museum2FMoonStoneSignText', '_Museum2FMoonStoneSignText',
  // V3 checkpoint-02a (§16): the ticket scientist's nine texts.
  ...['ComeAgain', 'WouldYouLikeToComeIn', 'ThankYou', 'DontHaveEnoughMoney', 'DoYouKnowWhatAmberIs', 'TheresALabSomewhere',
    'AmberIsFossilizedTreeSap', 'GoToOtherSide', 'TakePlentyOfTime'].flatMap(name =>
    [`Museum1FPrintScientist1Text.${name}Text`, `_Museum1FScientist1${name}Text`]),
];

/** The same slice's TextPointers tables. */
export const LATER_MAP_TABLES: readonly string[] = ['Museum1F_TextPointers', 'Museum2F_TextPointers', 'PewterGym_TextPointers'];

/** A copy of `record` without the keys in `keys`. */
export function without<T>(record: Record<string, T>, keys: readonly string[]): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !keys.includes(key)));
}
