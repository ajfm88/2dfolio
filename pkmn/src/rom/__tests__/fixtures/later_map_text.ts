// Map text added after the frozen text baselines (A5b, A5c1, A5c3d checkpoint-03, A5c3e checkpoint-02). Those tests
// prove their own checkpoint's additions and that nothing else changed; later maps' programs and TextPointers tables
// are listed here once, each with its slice, so the old proofs keep their scope. Every label is checked against
// pret's symbols in battle_text_data.test.ts.

/** V3 checkpoint-01 (notes/88-v3-plan.md §7): Museum 1F, Museum 2F and Pewter Gym. */
export const LATER_MAP_PROGRAMS: readonly string[] = [
  // V3 checkpoint-04: Route 3.
  'Route3SuperNerdText',
  '_Route3Text1',
  'Route3Youngster1BattleText',
  '_Route3Youngster1BattleText',
  'Route3Youngster1EndBattleText',
  '_Route3Youngster1EndBattleText',
  'Route3Youngster1AfterBattleText',
  '_Route3Youngster1AfterBattleText',
  'Route3Youngster2BattleText',
  '_Route3Youngster2BattleText',
  'Route3Youngster2EndBattleText',
  '_Route3Youngster2EndBattleText',
  'Route3Youngster2AfterBattleText',
  '_Route3Youngster2AfterBattleText',
  'Route3CooltrainerF1BattleText',
  '_Route3CooltrainerF1BattleText',
  'Route3CooltrainerF1EndBattleText',
  '_Route3CooltrainerF1EndBattleText',
  'Route3CooltrainerF1AfterBattleText',
  '_Route3CooltrainerF1AfterBattleText',
  'Route3Youngster3BattleText',
  '_Route3Youngster3BattleText',
  'Route3Youngster3EndBattleText',
  '_Route3Youngster3EndBattleText',
  'Route3Youngster3AfterBattleText',
  '_Route3Youngster3AfterBattleText',
  'Route3CooltrainerF2BattleText',
  '_Route3CooltrainerF2BattleText',
  'Route3CooltrainerF2EndBattleText',
  '_Route3CooltrainerF2EndBattleText',
  'Route3CooltrainerF2AfterBattleText',
  '_Route3CooltrainerF2AfterBattleText',
  'Route3Youngster4BattleText',
  '_Route3Youngster4BattleText',
  'Route3Youngster4EndBattleText',
  '_Route3Youngster4EndBattleText',
  'Route3Youngster4AfterBattleText',
  '_Route3Youngster4AfterBattleText',
  'Route3Youngster5BattleText',
  '_Route3Youngster5BattleText',
  'Route3Youngster5EndBattleText',
  '_Route3Youngster5EndBattleText',
  'Route3Youngster5AfterBattleText',
  '_Route3Youngster5AfterBattleText',
  'Route3CooltrainerF3BattleText',
  '_Route3CooltrainerF3BattleText',
  'Route3CooltrainerF3EndBattleText',
  '_Route3CooltrainerF3EndBattleText',
  'Route3CooltrainerF3AfterBattleText',
  '_Route3CooltrainerF3AfterBattleText',
  'Route3SignText',
  '_Route3SignText',

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
  // V3 checkpoint-03b: Brock.
  'PewterGymBrockText.PreBattleText', '_PewterGymBrockPreBattleText', 'PewterGymBrockText.PostBattleAdviceText',
  '_PewterGymBrockPostBattleAdviceText', 'PewterGymBrockReceivedBoulderBadgeText',
  '_PewterGymBrockReceivedBoulderBadgeText', '_PewterGymBrockBoulderBadgeInfoText',
  // V3 checkpoint-03a: the Jr. Trainer, the guide and the statues.
  ...['CooltrainerMBattle', 'CooltrainerMEndBattle', 'CooltrainerMAfterBattle', 'GuidePreAdvice', 'GuideBeginAdvice', 'GuideAdvice',
    'GuideFreeService', 'GuidePostBattle', 'GuyPikachu'].flatMap(name => [`PewterGym${name}Text`, `_PewterGym${name}Text`]),
  ...['GymStatueText1', '_GymStatueText1', 'GymStatueText2', '_GymStatueText2'],
  // V3 checkpoint-02c: the fossils.
  ...['Aerodactyl', 'Kabutops'].flatMap(name => [`${name}FossilText`, `_${name}FossilText`]),
  // V3 checkpoint-02b (§24): the Old Amber scientist and the 2F hiker.
  ...['TakeThisToAPokemonLab', 'ReceivedOldAmber', 'GetTheOldAmberCheck', 'YouDontHaveSpace'].flatMap(name =>
    [`Museum1FPrintScientist2Text.${name}Text`, `_Museum1FScientist2${name}Text`]),
  ...[1, 2, 3].flatMap(n => [`Museum2FHikerText${n}`, `_Museum2FHikerText${n}`]),
];

/** The same slice's TextPointers tables. */
export const LATER_MAP_TABLES: readonly string[] = ['Route3_TextPointers', 'Museum1F_TextPointers', 'Museum2F_TextPointers', 'PewterGym_TextPointers'];

/** A copy of `record` without the keys in `keys`. */
export function without<T>(record: Record<string, T>, keys: readonly string[]): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !keys.includes(key)));
}
