// Text programs extracted for A5b (notes/23-a5b-plan.md §4.1, DECISIONS #45).
// Transcribed from pret's pokeyellow.sym (`git -C refs/pokeyellow show origin/symbols:pokeyellow.sym`)
// by a dev-time audit of the in-scope callers' ASM: every program they print (their own
// text labels, plus `ld hl, Label` references), and every `text_far` child reachable from them.
// Programs that open with `text_asm` are TypeScript handlers and aren't listed.
// [label, bank, address, root]. A root is printed by a caller from the first text row; the
// rest are only reached through `text_far`. The extractor reads each from the ROM; a FAR
// pointer to an address not listed here fails extraction.
// Added by hand from the same sym file: the home-bank map signs (home/overworld_text.asm, for the
// TextPointers call table), and the Mart greeting, party menu messages and item field/toss texts
// that the current menus show (home/text_script.asm, engine/menus/party_menu.asm,
// engine/items/item_effects.asm), and the medicine results in PartyMenuItemUseMessagePointers
// (party_menu.asm; RareCandyText waits for its item, A5b1 review R-1).

export const TEXT_PROGRAM_SYMBOLS: readonly (readonly [string, number, number, boolean])[] = [
  // A5c3e checkpoint-02; naming_screen.asm AskName and item_effects.asm's catch/empty-party paths.
  ["DoYouWantToNicknameText", 0x01, 0x62C8, true],
  ["_DoYouWantToNicknameText", 0x28, 0x499A, false],
  ["DontHavePokemonText", 0x03, 0x6527, true],
  ["_DontHavePokemonText", 0x2D, 0x6E56, false],
  // A5c3d checkpoint-03; home/trainers.asm:374-379, data/text/text_1.asm:16-19.
  ["TrainerEndBattleText", 0x00, 0x336B, true],
  ["_TrainerNameText", 0x26, 0x4045, false],
  ["AccessedOaksPCText", 0x07, 0x62DF, true],
  ["GetDexRatedText", 0x07, 0x62D4, true],
  ["ClosedOaksPCText", 0x07, 0x62D9, true],
  ["_AccessedOaksPCText", 0x28, 0x4741, false],
  ["_GetDexRatedText", 0x28, 0x4704, false],
  ["_ClosedOaksPCText", 0x28, 0x4722, false],
  ["AccessedBillsPCText", 0x05, 0x7DAC, true], // engine/menus/pc.asm
  ["AccessedMyPCText", 0x05, 0x7DB6, true], // engine/menus/pc.asm
  ["AccessedSomeonesPCText", 0x05, 0x7DB1, true], // engine/menus/pc.asm
  ["AntidoteText", 0x04, 0x5A56, true], // engine/menus/party_menu.asm
  ["AwakeningText", 0x04, 0x5A6A, true], // engine/menus/party_menu.asm
  ["BluesHouseDaisyBagFullText", 0x06, 0x5CB8, true], // scripts/BluesHouse.asm
  ["BluesHouseDaisyOfferMapText", 0x06, 0x5CAD, true], // scripts/BluesHouse.asm
  ["BluesHouseDaisyRivalAtLabText", 0x06, 0x5CA8, true], // scripts/BluesHouse.asm
  ["BluesHouseDaisyUseMapText", 0x06, 0x5CBD, true], // scripts/BluesHouse.asm
  ["BluesHouseDaisyWalkingText", 0x06, 0x5CC2, true], // scripts/BluesHouse.asm
  ["BluesHouseTownMapText", 0x06, 0x5CC7, true], // scripts/BluesHouse.asm
  ["BoxFullText", 0x08, 0x583F, true], // engine/pokemon/bills_pc.asm
  ["BurnHealText", 0x04, 0x5A60, true], // engine/menus/party_menu.asm
  ["CannotGetOffHereText", 0x04, 0x5FD9, true], // engine/menus/start_sub_menus.asm
  ["CannotUseItemsHereText", 0x04, 0x5FD4, true], // engine/menus/start_sub_menus.asm
  ["CantCarryMoreText", 0x01, 0x7A00, true], // engine/menus/players_pc.asm
  ["CantDepositLastMonText", 0x08, 0x583A, true], // engine/pokemon/bills_pc.asm
  ["CantTakeMonText", 0x08, 0x584E, true], // engine/pokemon/bills_pc.asm
  ["ChooseABoxText", 0x1C, 0x7D10, true], // engine/menus/save.asm
  ["DepositHowManyText", 0x01, 0x79D8, true], // engine/menus/players_pc.asm
  ["DepositWhichMonText", 0x08, 0x5830, true], // engine/pokemon/bills_pc.asm
  ["DiglettsCaveRoute2FishingGuruText", 0x07, 0x57C4, true], // scripts/DiglettsCaveRoute2.asm
  ["DroppedHiddenCoinsText", 0x1D, 0x6149, true], // engine/events/hidden_items.asm
  ["FileDataDestroyedText", 0x1C, 0x798F, true], // engine/menus/save.asm
  ["FoundHiddenCoinsText", 0x1D, 0x6143, true], // engine/events/hidden_items.asm
  ["FoundHiddenItemText", 0x1D, 0x6050, true], // engine/events/hidden_items.asm
  ["FoundItemText", 0x01, 0x4D9A, true], // engine/events/pick_up_item.asm
  ["FullHealText", 0x04, 0x5A6F, true], // engine/menus/party_menu.asm
  ["GameSavedText", 0x1C, 0x7ADB, true], // engine/menus/save.asm
  ["GotMapText", 0x06, 0x5CB2, true], // scripts/BluesHouse.asm
  ["HiddenItemBagFullText", 0x1D, 0x6089, true], // engine/events/hidden_items.asm
  ["HisNameIsText", 0x01, 0x6765, true], // engine/movie/oak_speech/oak_speech2.asm
  ["IceHealText", 0x04, 0x5A65, true], // engine/menus/party_menu.asm
  ["IntroducePlayerText", 0x01, 0x5FC8, true], // engine/movie/oak_speech/oak_speech.asm
  ["IntroduceRivalText", 0x01, 0x5FCD, true], // engine/movie/oak_speech/oak_speech.asm
  ["IsItOKToTossItemText", 0x03, 0x669E, true], // engine/items/item_effects.asm
  ["ItemUseNoEffectText", 0x03, 0x6509, true], // engine/items/item_effects.asm
  ["ItemUseNotTimeText", 0x03, 0x64FF, true], // engine/items/item_effects.asm
  ["ItemUseNotYoursToUseText", 0x03, 0x6504, true], // engine/items/item_effects.asm
  ["ItemWasStoredText", 0x01, 0x79DD, true], // engine/menus/players_pc.asm
  ["JustAMomentText", 0x08, 0x58A7, true], // engine/pokemon/bills_pc.asm
  ["LinkCableHelpText1", 0x17, 0x5D02, true], // engine/events/hidden_events/school_blackboard.asm
  ["LinkCableHelpText2", 0x17, 0x5D07, true], // engine/events/hidden_events/school_blackboard.asm
  ["LinkCableInfoText1", 0x17, 0x5D42, true], // engine/events/hidden_events/school_blackboard.asm
  ["LinkCableInfoText2", 0x17, 0x5D47, true], // engine/events/hidden_events/school_blackboard.asm
  ["LinkCableInfoText3", 0x17, 0x5D4C, true], // engine/events/hidden_events/school_blackboard.asm
  ["LinkMenuEmptyText", 0x01, 0x68A5, true], // engine/movie/oak_speech/oak_speech2.asm
  ["LooksContentText", 0x01, 0x6EEB, true], // engine/events/pokecenter.asm
  ["MartSignText", 0x00, 0x23E5, true], // home/overworld_text.asm
  ["MonIsTakenOutText", 0x08, 0x5844, true], // engine/pokemon/bills_pc.asm
  ["MonWasReleasedText", 0x08, 0x5862, true], // engine/pokemon/bills_pc.asm
  ["MonWasStoredText", 0x08, 0x5835, true], // engine/pokemon/bills_pc.asm
  ["NeedYourPokemonText", 0x01, 0x6EDB, true], // engine/events/pokecenter.asm
  ["NoMonText", 0x08, 0x5849, true], // engine/pokemon/bills_pc.asm
  ["NoPokemonText", 0x3A, 0x4E1F, true], // engine/printer/printer.asm (A5b7e CP1)
  ["NoMoreRoomForItemText", 0x01, 0x4DA0, true], // engine/events/pick_up_item.asm
  ["NoRoomToStoreText", 0x01, 0x79E7, true], // engine/menus/players_pc.asm
  ["NothingStoredText", 0x01, 0x79FB, true], // engine/menus/players_pc.asm
  ["NothingToDepositText", 0x01, 0x79E2, true], // engine/menus/players_pc.asm
  ["OakSpeechText1", 0x01, 0x5FB9, true], // engine/movie/oak_speech/oak_speech.asm
  ["OakSpeechText2", 0x01, 0x5FBE, true], // engine/movie/oak_speech/oak_speech.asm
  ["OakSpeechText3", 0x01, 0x5FD2, true], // engine/movie/oak_speech/oak_speech.asm
  ["OaksLabEeveePokeBallText.Text", 0x07, 0x49A7, true], // scripts/OaksLab.asm
  ["OaksLabGirlText.Text", 0x07, 0x4AC2, true], // scripts/OaksLab.asm
  ["OaksLabOak1Text.ComeSeeMeSometimesText", 0x07, 0x4A9A, true], // scripts/OaksLab.asm
  ["OaksLabOak1Text.DeliverParcelText", 0x07, 0x4A81, true], // scripts/OaksLab.asm
  ["OaksLabOak1Text.GivePokeballsText", 0x07, 0x4A90, true], // scripts/OaksLab.asm
  ["OaksLabOak1Text.GoAheadItsYours", 0x07, 0x4A72, true], // scripts/OaksLab.asm
  ["OaksLabOak1Text.HowIsYourPokedexComingText", 0x07, 0x4A9F, true], // scripts/OaksLab.asm
  ["OaksLabOak1Text.PokemonAroundTheWorldText", 0x07, 0x4A8B, true], // scripts/OaksLab.asm
  ["OaksLabOak1Text.YouShouldTalkToIt", 0x07, 0x4A7C, true], // scripts/OaksLab.asm
  ["OaksLabOak1Text.YourPokemonCanFightText", 0x07, 0x4A77, true], // scripts/OaksLab.asm
  ["OaksLabOak2Text", 0x07, 0x4AB3, true], // scripts/OaksLab.asm
  ["OaksLabOakBePatientText.Text", 0x07, 0x4AFE, true], // scripts/OaksLab.asm
  ["OaksLabOakChooseMonText.Text", 0x07, 0x4AE0, true], // scripts/OaksLab.asm
  ["OaksLabOakDontGoAwayYetText.Text", 0x07, 0x4B9A, true], // scripts/OaksLab.asm
  ["OaksLabOakGivesText", 0x07, 0x4B85, true], // scripts/OaksLab.asm
  ["OaksLabOakGotPokedexText", 0x07, 0x4C03, true], // scripts/OaksLab.asm
  ["OaksLabOakIHaveARequestText", 0x07, 0x4BF9, true], // scripts/OaksLab.asm
  ["OaksLabOakMyInventionPokedexText", 0x07, 0x4BFE, true], // scripts/OaksLab.asm
  ["OaksLabOakThatWasMyDreamText", 0x07, 0x4C09, true], // scripts/OaksLab.asm
  ["OaksLabPikachuDislikesPokeballsText1.Text", 0x07, 0x4BDB, true], // scripts/OaksLab.asm
  ["OaksLabPikachuDislikesPokeballsText2.Text", 0x07, 0x4BEA, true], // scripts/OaksLab.asm
  ["OaksLabPokedexText.Text", 0x07, 0x4AAE, true], // scripts/OaksLab.asm
  ["OaksLabReceivedText", 0x07, 0x4B8A, true], // scripts/OaksLab.asm
  ["OaksLabRivalAmIGreatOrWhatText", 0x07, 0x4BB3, true], // scripts/OaksLab.asm
  ["OaksLabRivalFedUpWithWaitingText.Text", 0x07, 0x4AD1, true], // scripts/OaksLab.asm
  ["OaksLabRivalGrampsText", 0x07, 0x4BEF, true], // scripts/OaksLab.asm
  ["OaksLabRivalIPickedTheWrongPokemonText", 0x07, 0x4BAE, true], // scripts/OaksLab.asm
  ["OaksLabRivalIllTakeYouOnText.Text", 0x07, 0x4BA9, true], // scripts/OaksLab.asm
  ["OaksLabRivalLeaveItAllToMeText", 0x07, 0x4C0E, true], // scripts/OaksLab.asm
  ["OaksLabRivalMyPokemonHasGrownStrongerText", 0x07, 0x4BF4, true], // scripts/OaksLab.asm
  ["OaksLabRivalSmellYouLaterText.Text", 0x07, 0x4BC2, true], // scripts/OaksLab.asm
  ["OaksLabRivalTakesText1", 0x07, 0x4B25, true], // scripts/OaksLab.asm
  ["OaksLabRivalTakesText2", 0x07, 0x4B2A, true], // scripts/OaksLab.asm
  ["OaksLabRivalTakesText3", 0x07, 0x4B30, true], // scripts/OaksLab.asm
  ["OaksLabRivalTakesText4", 0x07, 0x4B35, true], // scripts/OaksLab.asm
  ["OaksLabRivalTakesText5", 0x07, 0x4B3A, true], // scripts/OaksLab.asm
  ["OaksLabRivalText.GrampsIsntAroundText", 0x07, 0x497D, true], // scripts/OaksLab.asm
  ["OaksLabRivalText.IllGetABetterPokemonThanYou", 0x07, 0x4982, true], // scripts/OaksLab.asm
  ["OaksLabRivalText.MyPokemonLooksStrongerText", 0x07, 0x4987, true], // scripts/OaksLab.asm
  ["OaksLabRivalWhatAboutMeText.Text", 0x07, 0x4AEF, true], // scripts/OaksLab.asm
  ["OaksLabScientistText.Text", 0x07, 0x4C1D, true], // scripts/OaksLab.asm
  ["OlderFileWillBeErasedText", 0x1C, 0x7AE0, true], // engine/menus/save.asm
  ["OnceReleasedText", 0x08, 0x585D, true], // engine/pokemon/bills_pc.asm
  ["PalletTownFisherText", 0x06, 0x5011, true], // scripts/PalletTown.asm
  ["PalletTownGirlText", 0x06, 0x500C, true], // scripts/PalletTown.asm
  ["PalletTownOakComeWithMe", 0x06, 0x5007, true], // scripts/PalletTown.asm
  ["PalletTownOakText.HeyWaitDontGoOutText", 0x06, 0x4FDC, true], // scripts/PalletTown.asm
  ["PalletTownOakText.ThatWasCloseText", 0x06, 0x4FFD, true], // scripts/PalletTown.asm
  ["PalletTownOakText.WhewText", 0x06, 0x5002, true], // scripts/PalletTown.asm
  ["PalletTownOaksLabSignText", 0x06, 0x5016, true], // scripts/PalletTown.asm
  ["PalletTownPlayersHouseSignText", 0x06, 0x5020, true], // scripts/PalletTown.asm
  ["PalletTownRivalsHouseSignText", 0x06, 0x5025, true], // scripts/PalletTown.asm
  ["PalletTownSignText", 0x06, 0x501B, true], // scripts/PalletTown.asm
  ["ParlyzHealText", 0x04, 0x5A5B, true], // engine/menus/party_menu.asm
  ["PartyMenuBattleText", 0x04, 0x5A42, true], // engine/menus/party_menu.asm
  ["PartyMenuItemUseText", 0x04, 0x5A3D, true], // engine/menus/party_menu.asm
  ["PartyMenuNormalText", 0x04, 0x5A38, true], // engine/menus/party_menu.asm
  ["PartyMenuSwapMonText", 0x04, 0x5A4C, true], // engine/menus/party_menu.asm
  ["PartyMenuText_12cc", 0x00, 0x12cc, true], // home/pokemon.asm — sleeping Pikachu selection (V2c CP2)
  ["PikachuUnhappyText", 0x08, 0x5853, true], // engine/pokemon/bills_pc.asm
  ["PokeCenterSignText", 0x00, 0x23EA, true], // home/overworld_text.asm
  ["PokemartAnythingElseText", 0x01, 0x6BC3, true], // engine/events/pokemart.asm
  ["PokemartBoughtItemText", 0x01, 0x6B9B, true], // engine/events/pokemart.asm
  ["PokemartBuyingGreetingText", 0x01, 0x6B91, true], // engine/events/pokemart.asm
  ["PokemartGreetingText", 0x00, 0x2938, true], // home/text_script.asm
  ["PokemartItemBagEmptyText", 0x01, 0x6BB4, true], // engine/events/pokemart.asm
  ["PokemartItemBagFullText", 0x01, 0x6BA5, true], // engine/events/pokemart.asm
  ["PokemartNotEnoughMoneyText", 0x01, 0x6BA0, true], // engine/events/pokemart.asm
  ["PokemartTellBuyPriceText", 0x01, 0x6B96, true], // engine/events/pokemart.asm
  ["PokemartTellSellPriceText", 0x01, 0x6BAF, true], // engine/events/pokemart.asm
  ["PokemartThankYouText", 0x01, 0x6BBE, true], // engine/events/pokemart.asm
  ["PokemartUnsellableItemText", 0x01, 0x6BB9, true], // engine/events/pokemart.asm
  ["PokemonCenterFarewellText", 0x01, 0x6EE5, true], // engine/events/pokecenter.asm
  ["PokemonCenterWelcomeText", 0x01, 0x6ED0, true], // engine/events/pokecenter.asm
  ["PokemonFightingFitText", 0x01, 0x6EE0, true], // engine/events/pokecenter.asm
  ["PokemonSellingGreetingText", 0x01, 0x6BAA, true], // engine/events/pokemart.asm
  ["PotionText", 0x04, 0x5A51, true], // engine/menus/party_menu.asm
  ["RedsHouse1FMomLookingGreatText", 0x3C, 0x5BBF, true], // scripts/RedsHouse1F_2.asm
  ["RedsHouse1FMomYouShouldRestText", 0x3C, 0x5BBA, true], // scripts/RedsHouse1F_2.asm
  ["RedsHouse1FPrintMomText.WakeUpText", 0x3C, 0x5B82, true], // scripts/RedsHouse1F_2.asm
  ["RedsHouse1FPrintTVText.StandByMeMovieText", 0x3C, 0x5BD6, true], // scripts/RedsHouse1F_2.asm
  ["RedsHouse1FPrintTVText.WrongSideText", 0x3C, 0x5BDB, true], // scripts/RedsHouse1F_2.asm
  ["ReleaseWhichMonText", 0x08, 0x5858, true], // engine/pokemon/bills_pc.asm
  ["ReviveText", 0x04, 0x5A74, true], // engine/menus/party_menu.asm
  ["Route1PrintSignText.text", 0x3C, 0x5B22, true], // scripts/Route1_2.asm
  ["Route1PrintYoungster1Text.AlsoGotPokeballsText", 0x3C, 0x5B05, true], // scripts/Route1_2.asm
  ["Route1PrintYoungster1Text.GotPotionText", 0x3C, 0x5AFF, true], // scripts/Route1_2.asm
  ["Route1PrintYoungster1Text.MartSampleText", 0x3C, 0x5AFA, true], // scripts/Route1_2.asm
  ["Route1PrintYoungster1Text.NoRoomText", 0x3C, 0x5B0A, true], // scripts/Route1_2.asm
  ["Route1PrintYoungster2Text.text", 0x3C, 0x5B16, true], // scripts/Route1_2.asm
  ["Route22PrintPokemonLeagueSignText.text", 0x3C, 0x5B6E, true], // scripts/Route22_2.asm
  ["Route22Rival1DefeatedText", 0x14, 0x4FAB, true], // scripts/Route22.asm
  ["Route22Rival1VictoryText", 0x14, 0x4FB0, true], // scripts/Route22.asm
  ["Route22Rival2DefeatedText", 0x14, 0x50CE, true], // scripts/Route22.asm
  ["Route22Rival2VictoryText", 0x14, 0x50D3, true], // scripts/Route22.asm
  ["Route22RivalAfterBattleText1", 0x3C, 0x5B42, true], // scripts/Route22_2.asm
  ["Route22RivalAfterBattleText2", 0x3C, 0x5B62, true], // scripts/Route22_2.asm
  ["Route22RivalBeforeBattleText1", 0x3C, 0x5B3D, true], // scripts/Route22_2.asm
  ["Route22RivalBeforeBattleText2", 0x3C, 0x5B5D, true], // scripts/Route22_2.asm
  ["Route2DiglettsCaveSignText", 0x15, 0x5507, true], // scripts/Route2.asm
  ["Route2GateOaksAideText.FlashExplanationText", 0x17, 0x5520, true], // scripts/Route2Gate.asm
  ["Route2GateYoungsterText", 0x17, 0x5525, true], // scripts/Route2Gate.asm
  ["Route2SignText", 0x15, 0x5502, true], // scripts/Route2.asm
  ["Route2TradeHouseScientistText", 0x07, 0x57FE, true], // scripts/Route2TradeHouse.asm
  ["SavingText", 0x1C, 0x7AD6, true], // engine/menus/save.asm
  ["ShallWeHealYourPokemonText", 0x01, 0x6ED5, true], // engine/events/pokecenter.asm
  ["SleepingPikachuText2", 0x08, 0x560E, true], // engine/pokemon/bills_pc.asm
  ["StartMenu_Pokemon.cannotFlyHereText", 0x04, 0x5E30, true], // engine/menus/start_sub_menus.asm
  ["StartMenu_Pokemon.cannotUseTeleportNowText", 0x04, 0x5E2B, true], // engine/menus/start_sub_menus.asm
  ["StartMenu_Pokemon.flashLightsAreaText", 0x04, 0x5DD0, true], // engine/menus/start_sub_menus.asm
  ["StartMenu_Pokemon.newBadgeRequiredText", 0x04, 0x5E93, true], // engine/menus/start_sub_menus.asm
  ["StartMenu_Pokemon.notHealthyEnoughText", 0x04, 0x5E7F, true], // engine/menus/start_sub_menus.asm
  ["StartMenu_Pokemon.warpToLastPokemonCenterText", 0x04, 0x5E26, true], // engine/menus/start_sub_menus.asm
  ["SwitchOnText", 0x08, 0x5826, true], // engine/pokemon/bills_pc.asm
  ["TMNotebook", 0x14, 0x6904, true], // engine/events/hidden_events/school_notebooks.asm
  ["TMNotebookText", 0x27, 0x6AAE, false], // data/text/text_2.asm
  ["ThrewAwayItemText", 0x03, 0x6699, true], // engine/items/item_effects.asm
  ["TooImportantToTossText", 0x03, 0x66A3, true], // engine/items/item_effects.asm
  ["TossHowManyText", 0x01, 0x7A0A, true], // engine/menus/players_pc.asm
  ["TownMapText", 0x03, 0x7AA0, true], // engine/events/hidden_events/town_map.asm
  ["TurnPageText", 0x14, 0x6949, true], // engine/events/hidden_events/school_notebooks.asm
  ["TurnedOnPC1Text", 0x05, 0x7DA7, true], // engine/menus/pc.asm
  ["TurnedOnPC2Text", 0x01, 0x79C9, true], // engine/menus/players_pc.asm
  ["ViridianBlackboardBurnText", 0x17, 0x5E49, true], // engine/events/hidden_events/school_blackboard.asm
  ["ViridianBlackboardFrozenText", 0x17, 0x5E4E, true], // engine/events/hidden_events/school_blackboard.asm
  ["ViridianBlackboardPoisonText", 0x17, 0x5E3F, true], // engine/events/hidden_events/school_blackboard.asm
  ["ViridianBlackboardPrlzText", 0x17, 0x5E44, true], // engine/events/hidden_events/school_blackboard.asm
  ["ViridianBlackboardSleepText", 0x17, 0x5E3A, true], // engine/events/hidden_events/school_blackboard.asm
  ["ViridianCityFisherYouCanHaveThisText", 0x2D, 0x47DC, false], // text/ViridianCity.asm
  ["ViridianCityOldMan2Text.HadMyCoffeeNowText", 0x06, 0x52AF, true], // scripts/ViridianCity.asm
  ["ViridianCityOldMan2Text.LosingMyTouchText", 0x06, 0x52B4, true], // scripts/ViridianCity.asm
  ["ViridianCityOldManYouNeedToWeakenTheTargetText", 0x06, 0x5287, true], // scripts/ViridianCity.asm
  ["ViridianCityPrintFisherText.ReceivedTM42Text", 0x3C, 0x597E, true], // scripts/ViridianCity_2.asm
  ["ViridianCityPrintFisherText.TM42ExplanationText", 0x3C, 0x5984, true], // scripts/ViridianCity_2.asm
  ["ViridianCityPrintFisherText.TM42NoRoomText", 0x3C, 0x5989, true], // scripts/ViridianCity_2.asm
  ["ViridianCityPrintFisherText.YouCanHaveThisText", 0x3C, 0x5979, true], // scripts/ViridianCity_2.asm
  ["ViridianCityPrintGambler1Text.GymAlwaysClosedText", 0x3C, 0x58DF, true], // scripts/ViridianCity_2.asm
  ["ViridianCityPrintGambler1Text.GymLeaderReturnedText", 0x3C, 0x58E4, true], // scripts/ViridianCity_2.asm
  ["ViridianCityPrintGirlText.HasntHadHisCoffeeYetText", 0x3C, 0x5922, true], // scripts/ViridianCity_2.asm
  ["ViridianCityPrintGirlText.WhenIGoShopText", 0x3C, 0x5927, true], // scripts/ViridianCity_2.asm
  ["ViridianCityPrintGymLockedText.text", 0x3C, 0x59FC, true], // scripts/ViridianCity_2.asm
  ["ViridianCityPrintGymSignText.text", 0x3C, 0x59F0, true], // scripts/ViridianCity_2.asm
  ["ViridianCityPrintOldManSleepyText.PrivatePropertyText", 0x3C, 0x5945, true], // scripts/ViridianCity_2.asm
  ["ViridianCityPrintOldManText.NotGoodEnoughForYouText", 0x3C, 0x59C0, true], // scripts/ViridianCity_2.asm
  ["ViridianCityPrintOldManText.WantMeToShowYouAgainText", 0x3C, 0x59B6, true], // scripts/ViridianCity_2.asm
  ["ViridianCityPrintOldManText.WatchCloselyText", 0x3C, 0x59BB, true], // scripts/ViridianCity_2.asm
  ["ViridianCityPrintSignText.text", 0x3C, 0x59CC, true], // scripts/ViridianCity_2.asm
  ["ViridianCityPrintTrainerTips1Text.text", 0x3C, 0x59D8, true], // scripts/ViridianCity_2.asm
  ["ViridianCityPrintTrainerTips2Text.text", 0x3C, 0x59E4, true], // scripts/ViridianCity_2.asm
  ["ViridianCityPrintYoungster1Text.text", 0x3C, 0x58C2, true], // scripts/ViridianCity_2.asm
  ["ViridianCityPrintYoungster2Text.CaterpieAndWeedleDescriptionText", 0x3C, 0x590C, true], // scripts/ViridianCity_2.asm
  ["ViridianCityPrintYoungster2Text.OkThenText", 0x3C, 0x5907, true], // scripts/ViridianCity_2.asm
  ["ViridianCityPrintYoungster2Text.YouWantToKnowAboutText", 0x3C, 0x5902, true], // scripts/ViridianCity_2.asm
  ["ViridianCityYoungster2CaterpieAndWeedleDescriptionText", 0x2D, 0x46CD, false], // text/ViridianCity.asm
  ["ViridianCityYoungster2OkThenText", 0x2D, 0x46BF, false], // text/ViridianCity.asm
  ["ViridianForestCooltrainerFAfterBattleText", 0x18, 0x51CD, true], // scripts/ViridianForest.asm
  ["ViridianForestCooltrainerFBattleText", 0x18, 0x51C3, true], // scripts/ViridianForest.asm
  ["ViridianForestCooltrainerFEndBattleText", 0x18, 0x51C8, true], // scripts/ViridianForest.asm
  ["ViridianForestNorthGateGrampsText", 0x17, 0x549D, true], // scripts/ViridianForestNorthGate.asm
  ["ViridianForestNorthGateSuperNerdText", 0x17, 0x5498, true], // scripts/ViridianForestNorthGate.asm
  ["ViridianForestPrintLeavingSignText.text", 0x3C, 0x656B, true], // scripts/ViridianForest_2.asm
  ["ViridianForestPrintTrainerTips1Text.text", 0x3C, 0x652F, true], // scripts/ViridianForest_2.asm
  ["ViridianForestPrintTrainerTips2Text.text", 0x3C, 0x6547, true], // scripts/ViridianForest_2.asm
  ["ViridianForestPrintTrainerTips3Text.text", 0x3C, 0x6553, true], // scripts/ViridianForest_2.asm
  ["ViridianForestPrintTrainerTips4Text.text", 0x3C, 0x655F, true], // scripts/ViridianForest_2.asm
  ["ViridianForestPrintUseAntidoteSignText.text", 0x3C, 0x653B, true], // scripts/ViridianForest_2.asm
  ["ViridianForestSouthGateGirlText", 0x17, 0x556E, true], // scripts/ViridianForestSouthGate.asm
  ["ViridianForestSouthGateLittleGirlText", 0x17, 0x5573, true], // scripts/ViridianForestSouthGate.asm
  ["ViridianForestYoungster1Text", 0x18, 0x516F, true], // scripts/ViridianForest.asm
  ["ViridianForestYoungster2AfterBattleText", 0x18, 0x51A0, true], // scripts/ViridianForest.asm
  ["ViridianForestYoungster2BattleText", 0x18, 0x5196, true], // scripts/ViridianForest.asm
  ["ViridianForestYoungster2EndBattleText", 0x18, 0x519B, true], // scripts/ViridianForest.asm
  ["ViridianForestYoungster3AfterBattleText", 0x18, 0x51AF, true], // scripts/ViridianForest.asm
  ["ViridianForestYoungster3BattleText", 0x18, 0x51A5, true], // scripts/ViridianForest.asm
  ["ViridianForestYoungster3EndBattleText", 0x18, 0x51AA, true], // scripts/ViridianForest.asm
  ["ViridianForestYoungster4AfterBattleText", 0x18, 0x51BE, true], // scripts/ViridianForest.asm
  ["ViridianForestYoungster4BattleText", 0x18, 0x51B4, true], // scripts/ViridianForest.asm
  ["ViridianForestYoungster4EndBattleText", 0x18, 0x51B9, true], // scripts/ViridianForest.asm
  ["ViridianForestYoungster5AfterBattleText", 0x18, 0x51DC, true], // scripts/ViridianForest.asm
  ["ViridianForestYoungster5BattleText", 0x18, 0x51D2, true], // scripts/ViridianForest.asm
  ["ViridianForestYoungster5EndBattleText", 0x18, 0x51D7, true], // scripts/ViridianForest.asm
  ["ViridianForestYoungster6Text", 0x18, 0x51E1, true], // scripts/ViridianForest.asm
  ["ViridianMartClerkParcelQuestText", 0x07, 0x4D27, true], // scripts/ViridianMart.asm
  ["ViridianMartClerkSayHiToOakText", 0x07, 0x4D1D, true], // scripts/ViridianMart.asm
  ["ViridianMartClerkYouCameFromPalletTownText", 0x07, 0x4D22, true], // scripts/ViridianMart.asm
  ["ViridianMartCooltrainerMText", 0x07, 0x4D32, true], // scripts/ViridianMart.asm
  ["ViridianMartYoungsterText", 0x07, 0x4D2D, true], // scripts/ViridianMart.asm
  ["ViridianNicknameHouseBaldingGuyText", 0x07, 0x4DDE, true], // scripts/ViridianNicknameHouse.asm
  ["ViridianNicknameHouseLittleGirlText", 0x07, 0x4DE3, true], // scripts/ViridianNicknameHouse.asm
  ["ViridianNicknameHouseSpearowText.Text", 0x07, 0x4DFA, true], // scripts/ViridianNicknameHouse.asm
  ["ViridianNicknameHouseSpearySignText", 0x07, 0x4DFF, true], // scripts/ViridianNicknameHouse.asm
  ["ViridianPokecenterCooltrainerMText", 0x11, 0x4273, true], // scripts/ViridianPokecenter.asm
  ["ViridianPokecenterGentlemanText", 0x11, 0x426E, true], // scripts/ViridianPokecenter.asm
  ["ViridianSchoolBlackboardText1", 0x17, 0x5E06, true], // engine/events/hidden_events/school_blackboard.asm
  ["ViridianSchoolBlackboardText2", 0x17, 0x5E0B, true], // engine/events/hidden_events/school_blackboard.asm
  ["ViridianSchoolHouseBrunetteGirlText", 0x07, 0x4D83, true], // scripts/ViridianSchoolHouse.asm
  ["ViridianSchoolHousePrintCooltrainerFText.text", 0x3C, 0x5C16, true], // scripts/ViridianSchoolHouse_2.asm
  ["ViridianSchoolHousePrintLittleGirlText.text", 0x3C, 0x5C0A, true], // scripts/ViridianSchoolHouse_2.asm
  ["ViridianSchoolNotebookText1", 0x14, 0x6954, true], // engine/events/hidden_events/school_notebooks.asm
  ["ViridianSchoolNotebookText2", 0x14, 0x6959, true], // engine/events/hidden_events/school_notebooks.asm
  ["ViridianSchoolNotebookText3", 0x14, 0x695E, true], // engine/events/hidden_events/school_notebooks.asm
  ["ViridianSchoolNotebookText4", 0x14, 0x6963, true], // engine/events/hidden_events/school_notebooks.asm
  ["ViridianSchoolNotebookText5", 0x14, 0x694E, true], // engine/events/hidden_events/school_notebooks.asm
  ["WhatDoYouWantText", 0x01, 0x79CE, true], // engine/menus/players_pc.asm
  ["WhatText", 0x08, 0x582B, true], // engine/pokemon/bills_pc.asm
  ["WhatToDepositText", 0x01, 0x79D3, true], // engine/menus/players_pc.asm
  ["WhatToTossText", 0x01, 0x7A05, true], // engine/menus/players_pc.asm
  ["WhatToWithdrawText", 0x01, 0x79EC, true], // engine/menus/players_pc.asm
  ["WhenYouChangeBoxText", 0x1C, 0x7C52, true], // engine/menus/save.asm
  ["WithdrawHowManyText", 0x01, 0x79F1, true], // engine/menus/players_pc.asm
  ["WithdrewItemText", 0x01, 0x79F6, true], // engine/menus/players_pc.asm
  ["WouldYouLikeToSaveText", 0x1C, 0x7AD1, true], // engine/menus/save.asm
  ["YourNameIsText", 0x01, 0x671D, true], // engine/movie/oak_speech/oak_speech2.asm
  ["_AccessedBillsPCText", 0x28, 0x4281, false], // data/text/text_3.asm
  ["_AccessedMyPCText", 0x28, 0x42E8, false], // data/text/text_3.asm
  ["_AccessedSomeonesPCText", 0x28, 0x42B3, false], // data/text/text_3.asm
  ["_AntidoteText", 0x28, 0x41B9, false], // data/text/text_3.asm
  ["_AwakeningText", 0x28, 0x4216, false], // data/text/text_3.asm
  ["_BluesHouseDaisyBagFullText", 0x2A, 0x45E0, false], // text/BluesHouse.asm
  ["_BluesHouseDaisyOfferMapText", 0x2A, 0x4590, false], // text/BluesHouse.asm
  ["_BluesHouseDaisyRivalAtLabText", 0x2A, 0x456F, false], // text/BluesHouse.asm
  ["_BluesHouseDaisyUseMapText", 0x2A, 0x4603, false], // text/BluesHouse.asm
  ["_BluesHouseDaisyWalkingText", 0x2A, 0x4630, false], // text/BluesHouse.asm
  ["_BluesHouseTownMapText", 0x2A, 0x466F, false], // text/BluesHouse.asm
  ["_BoxFullText", 0x28, 0x4522, false], // data/text/text_3.asm
  ["_BurnHealText", 0x28, 0x41EB, false], // data/text/text_3.asm
  ["_CannotFlyHereText", 0x2D, 0x4105, false], // data/text/text_8.asm
  ["_CannotGetOffHereText", 0x2D, 0x4166, false], // data/text/text_8.asm
  ["_CannotUseItemsHereText", 0x2D, 0x414C, false], // data/text/text_8.asm
  ["_CannotUseTeleportNowText", 0x2D, 0x40E9, false], // data/text/text_8.asm
  ["_CantCarryMoreText", 0x28, 0x4417, false], // data/text/text_3.asm
  ["_CantDepositLastMonText", 0x28, 0x4501, false], // data/text/text_3.asm
  ["_CantTakeMonText", 0x28, 0x4580, false], // data/text/text_3.asm
  ["_ChooseABoxText", 0x29, 0x76DD, false], // data/text/text_4.asm
  ["_DepositHowManyText", 0x28, 0x4363, false], // data/text/text_3.asm
  ["_DepositWhichMonText", 0x28, 0x44CE, false], // data/text/text_3.asm
  ["_DiglettsCaveRoute2FishingGuruText", 0x28, 0x4C90, false], // text/DiglettsCaveRoute2.asm
  ["_DroppedHiddenCoinsText", 0x27, 0x7413, false], // data/text/text_2.asm
  ["_FileDataDestroyedText", 0x29, 0x7613, false], // data/text/text_4.asm
  ["_FlashLightsAreaText", 0x2D, 0x40A7, false], // data/text/text_8.asm
  ["_FoundHiddenCoins2Text", 0x27, 0x73FB, false], // data/text/text_2.asm
  ["_FoundHiddenCoinsText", 0x27, 0x73E3, false], // data/text/text_2.asm
  ["_FoundHiddenItemText", 0x27, 0x73A8, false], // data/text/text_2.asm
  ["_FoundItemText", 0x26, 0x4119, false], // data/text/text_1.asm
  ["_FullHealText", 0x28, 0x4224, false], // data/text/text_3.asm
  ["_GameSavedText", 0x29, 0x765D, false], // data/text/text_4.asm
  ["_GotMapText", 0x2A, 0x45CF, false], // text/BluesHouse.asm
  ["_HiddenItemBagFullText", 0x27, 0x73B9, false], // data/text/text_2.asm
  ["_HisNameIsText", 0x28, 0x49DF, false], // data/text/text_3.asm
  ["_IceHealText", 0x28, 0x4202, false], // data/text/text_3.asm
  ["_IntroducePlayerText", 0x28, 0x48AE, false], // data/text/text_3.asm
  ["_IntroduceRivalText", 0x28, 0x48C9, false], // data/text/text_3.asm
  ["_IsItOKToTossItemText", 0x2D, 0x6EBD, false], // data/text/text_9.asm
  ["_ItemUseNoEffectText", 0x2D, 0x6DAB, false], // data/text/text_9.asm
  ["_ItemUseNotTimeText", 0x2D, 0x6D68, false], // data/text/text_9.asm
  ["_ItemUseNotYoursToUseText", 0x2D, 0x6D92, false], // data/text/text_9.asm
  ["_ItemWasStoredText", 0x28, 0x436E, false], // data/text/text_3.asm
  ["_JustAMomentText", 0x27, 0x6A9E, false], // data/text/text_2.asm
  ["_LinkCableHelpText1", 0x27, 0x6ED9, false], // data/text/text_2.asm
  ["_LinkCableHelpText2", 0x27, 0x6EFF, false], // data/text/text_2.asm
  ["_LinkCableInfoText1", 0x27, 0x6F23, false], // data/text/text_2.asm
  ["_LinkCableInfoText2", 0x27, 0x6F95, false], // data/text/text_2.asm
  ["_LinkCableInfoText3", 0x27, 0x6FC0, false], // data/text/text_2.asm
  ["_LooksContentText", 0x2C, 0x7830, false], // data/text/text_7.asm
  ["_MartSignText", 0x26, 0x40D2, false], // data/text/text_1.asm
  ["_MonIsTakenOutText", 0x28, 0x4543, false], // data/text/text_3.asm
  ["_MonWasReleasedText", 0x28, 0x460F, false], // data/text/text_3.asm
  ["_MonWasStoredText", 0x28, 0x44E3, false], // data/text/text_3.asm
  ["_NeedYourPokemonText", 0x2C, 0x77D3, false], // data/text/text_7.asm
  ["_NewBadgeRequiredText", 0x2D, 0x412E, false], // data/text/text_8.asm
  ["_NoMonText", 0x28, 0x4561, false], // data/text/text_3.asm
  ["_NoPokemonText", 0x28, 0x4C77, false], // data/text/text_3.asm (A5b7e CP1)
  ["_NoMoreRoomForItemText", 0x26, 0x412A, false], // data/text/text_1.asm
  ["_NoRoomToStoreText", 0x28, 0x43A4, false], // data/text/text_3.asm
  ["_NotHealthyEnoughText", 0x2D, 0x4119, false], // data/text/text_8.asm
  ["_NothingStoredText", 0x28, 0x43FD, false], // data/text/text_3.asm
  ["_NothingToDepositText", 0x28, 0x4386, false], // data/text/text_3.asm
  ["_OakSpeechText1", 0x28, 0x47BA, false], // data/text/text_3.asm
  ["_OakSpeechText2A", 0x28, 0x4814, false], // data/text/text_3.asm
  ["_OakSpeechText2B", 0x28, 0x4848, false], // data/text/text_3.asm
  ["_OakSpeechText3", 0x28, 0x492C, false], // data/text/text_3.asm
  ["_OaksLabGirlText", 0x2A, 0x4B4A, false], // text/OaksLab.asm
  ["_OaksLabGivePokeballsExplanationText", 0x2A, 0x49BE, false], // text/OaksLab.asm
  ["_OaksLabOak1ComeSeeMeSometimesText", 0x2A, 0x4A7D, false], // text/OaksLab.asm
  ["_OaksLabOak1DeliverParcelText", 0x2A, 0x4802, false], // text/OaksLab.asm
  ["_OaksLabOak1GoAheadItsYours", 0x2A, 0x4754, false], // text/OaksLab.asm
  ["_OaksLabOak1HowIsYourPokedexComingText", 0x2A, 0x4AC8, false], // text/OaksLab.asm
  ["_OaksLabOak1ParcelThanksText", 0x2A, 0x48A8, false], // text/OaksLab.asm
  ["_OaksLabOak1PokemonAroundTheWorldText", 0x2A, 0x4911, false], // text/OaksLab.asm
  ["_OaksLabOak1ReceivedPokeballsText", 0x2A, 0x4939, false], // text/OaksLab.asm
  ["_OaksLabOak1YouShouldTalkToIt", 0x2A, 0x47D0, false], // text/OaksLab.asm
  ["_OaksLabOak1YourPokemonCanFightText", 0x2A, 0x476F, false], // text/OaksLab.asm
  ["_OaksLabOak2Text", 0x2A, 0x4B47, false], // text/OaksLab.asm
  ["_OaksLabOakBePatientText", 0x2A, 0x4CC2, false], // text/OaksLab.asm
  ["_OaksLabOakChooseMonText", 0x2A, 0x4BBE, false], // text/OaksLab.asm
  ["_OaksLabOakDontGoAwayYetText", 0x2A, 0x4E53, false], // text/OaksLab.asm
  ["_OaksLabOakGivesText", 0x2A, 0x4DD2, false], // text/OaksLab.asm
  ["_OaksLabOakGotPokedexText", 0x2A, 0x5132, false], // text/OaksLab.asm
  ["_OaksLabOakIHaveARequestText", 0x2A, 0x5062, false], // text/OaksLab.asm
  ["_OaksLabOakMyInventionPokedexText", 0x2A, 0x50B0, false], // text/OaksLab.asm
  ["_OaksLabOakThatWasMyDreamText", 0x2A, 0x516C, false], // text/OaksLab.asm
  ["_OaksLabPikachuDislikesPokeballsText1", 0x2A, 0x4F4A, false], // text/OaksLab.asm
  ["_OaksLabPikachuDislikesPokeballsText2", 0x2A, 0x4F56, false], // text/OaksLab.asm
  ["_OaksLabPokedexText", 0x2A, 0x4B15, false], // text/OaksLab.asm
  ["_OaksLabReceivedText", 0x2A, 0x4E3D, false], // text/OaksLab.asm
  ["_OaksLabRivalAmIGreatOrWhatText", 0x2A, 0x4EDD, false], // text/OaksLab.asm
  ["_OaksLabRivalFedUpWithWaitingText", 0x2A, 0x4B9A, false], // text/OaksLab.asm
  ["_OaksLabRivalGrampsIsntAroundText", 0x2A, 0x468F, false], // text/OaksLab.asm
  ["_OaksLabRivalGrampsText", 0x2A, 0x5020, false], // text/OaksLab.asm
  ["_OaksLabRivalIPickedTheWrongPokemonText", 0x2A, 0x4EAF, false], // text/OaksLab.asm
  ["_OaksLabRivalIllGetABetterPokemonThanYou", 0x2A, 0x46DB, false], // text/OaksLab.asm
  ["_OaksLabRivalIllTakeYouOnText", 0x2A, 0x4E70, false], // text/OaksLab.asm
  ["_OaksLabRivalLeaveItAllToMeText", 0x2A, 0x5249, false], // text/OaksLab.asm
  ["_OaksLabRivalMyPokemonHasGrownStrongerText", 0x2A, 0x502C, false], // text/OaksLab.asm
  ["_OaksLabRivalMyPokemonLooksStrongerText", 0x2A, 0x4706, false], // text/OaksLab.asm
  ["_OaksLabRivalSmellYouLaterText", 0x2A, 0x4EFB, false], // text/OaksLab.asm
  ["_OaksLabRivalTakesText1", 0x2A, 0x4CEF, false], // text/OaksLab.asm
  ["_OaksLabRivalTakesText2", 0x2A, 0x4D10, false], // text/OaksLab.asm
  ["_OaksLabRivalTakesText3", 0x2A, 0x4D27, false], // text/OaksLab.asm
  ["_OaksLabRivalTakesText4", 0x2A, 0x4D44, false], // text/OaksLab.asm
  ["_OaksLabRivalTakesText5", 0x2A, 0x4D61, false], // text/OaksLab.asm
  ["_OaksLabRivalWhatAboutMeText", 0x2A, 0x4CA2, false], // text/OaksLab.asm
  ["_OaksLabScientistText", 0x2A, 0x52F3, false], // text/OaksLab.asm
  ["_OaksLabThatsAPokeball", 0x2A, 0x472D, false], // text/OaksLab.asm
  ["_OlderFileWillBeErasedText", 0x29, 0x7670, false], // data/text/text_4.asm
  ["_OnceReleasedText", 0x28, 0x45E4, false], // data/text/text_3.asm
  ["_PalletTownFisherText", 0x2D, 0x43C9, false], // text/PalletTown.asm
  ["_PalletTownGirlText", 0x2D, 0x4388, false], // text/PalletTown.asm
  ["_PalletTownOakComeWithMe", 0x2D, 0x4311, false], // text/PalletTown.asm
  ["_PalletTownOakHeyWaitDontGoOutText", 0x2D, 0x42B0, false], // text/PalletTown.asm
  ["_PalletTownOakThatWasCloseText", 0x2D, 0x42CF, false], // text/PalletTown.asm
  ["_PalletTownOakWhewText", 0x2D, 0x4303, false], // text/PalletTown.asm
  ["_PalletTownOaksLabSignText", 0x2D, 0x4420, false], // text/PalletTown.asm
  ["_PalletTownPlayersHouseSignText", 0x2D, 0x4462, false], // text/PalletTown.asm
  ["_PalletTownRivalsHouseSignText", 0x2D, 0x446D, false], // text/PalletTown.asm
  ["_PalletTownSignText", 0x2D, 0x4437, false], // text/PalletTown.asm
  ["_ParlyzHealText", 0x28, 0x41D3, false], // data/text/text_3.asm
  ["_PartyMenuBattleText", 0x28, 0x4160, false], // data/text/text_3.asm
  ["_PartyMenuItemUseText", 0x28, 0x4147, false], // data/text/text_3.asm
  ["_PartyMenuNormalText", 0x28, 0x4137, false], // data/text/text_3.asm
  ["_PartyMenuSwapMonText", 0x28, 0x418D, false], // data/text/text_3.asm
  ["_PikachuUnhappyText", 0x28, 0x45B2, false], // data/text/text_3.asm
  ["_PokeCenterSignText", 0x26, 0x40FC, false], // data/text/text_1.asm
  ["_PokemartAnythingElseText", 0x2C, 0x761E, false], // data/text/text_7.asm
  ["_PokemartBoughtItemText", 0x2C, 0x753E, false], // data/text/text_7.asm
  ["_PokemartBuyingGreetingText", 0x2C, 0x750D, false], // data/text/text_7.asm
  ["_PokemartGreetingText", 0x2C, 0x74A1, false], // data/text/text_7.asm
  ["_PokemartItemBagEmptyText", 0x2C, 0x75D4, false], // data/text/text_7.asm
  ["_PokemartItemBagFullText", 0x2C, 0x7575, false], // data/text/text_7.asm
  ["_PokemartNotEnoughMoneyText", 0x2C, 0x7558, false], // data/text/text_7.asm
  ["_PokemartTellBuyPriceText", 0x2C, 0x751E, false], // data/text/text_7.asm
  ["_PokemartTellSellPriceText", 0x2C, 0x75B3, false], // data/text/text_7.asm
  ["_PokemartThankYouText", 0x2C, 0x7612, false], // data/text/text_7.asm
  ["_PokemartUnsellableItemText", 0x2C, 0x75F5, false], // data/text/text_7.asm
  ["_PokemonCenterFarewellText", 0x2C, 0x7815, false], // data/text/text_7.asm
  ["_PokemonCenterWelcomeText", 0x2C, 0x7772, false], // data/text/text_7.asm
  ["_PokemonFightingFitText", 0x2C, 0x77ED, false], // data/text/text_7.asm
  ["_PokemonSellingGreetingText", 0x2C, 0x7595, false], // data/text/text_7.asm
  ["_PotionText", 0x28, 0x419F, false], // data/text/text_3.asm
  ["_RedsHouse1FMomLookingGreatText", 0x2A, 0x44C7, false], // text/RedsHouse1F.asm
  ["_RedsHouse1FMomWakeUpText", 0x2A, 0x440C, false], // text/RedsHouse1F.asm
  ["_RedsHouse1FMomYouShouldRestText", 0x2A, 0x4471, false], // text/RedsHouse1F.asm
  ["_RedsHouse1FTVStandByMeMovieText", 0x2A, 0x450A, false], // text/RedsHouse1F.asm
  ["_RedsHouse1FTVWrongSideText", 0x2A, 0x455C, false], // text/RedsHouse1F.asm
  ["_ReleaseWhichMonText", 0x28, 0x45CF, false], // data/text/text_3.asm
  ["_ReviveText", 0x28, 0x423B, false], // data/text/text_3.asm
  ["_Route1SignText", 0x28, 0x6D32, false], // text/Route1.asm
  ["_Route1Youngster1AlsoGotPokeballsText", 0x28, 0x6C64, false], // text/Route1.asm
  ["_Route1Youngster1GotPotionText", 0x28, 0x6C55, false], // text/Route1.asm
  ["_Route1Youngster1MartSampleText", 0x28, 0x6BD1, false], // text/Route1.asm
  ["_Route1Youngster1NoRoomText", 0x28, 0x6C8E, false], // text/Route1.asm
  ["_Route1Youngster2Text", 0x28, 0x6CB1, false], // text/Route1.asm
  ["_Route22PokemonLeagueSignText", 0x29, 0x6C41, false], // text/Route22.asm
  ["_Route22Rival1DefeatedText", 0x29, 0x6907, false], // text/Route22.asm
  ["_Route22Rival1VictoryText", 0x29, 0x6923, false], // text/Route22.asm
  ["_Route22Rival2DefeatedText", 0x29, 0x6963, false], // text/Route22.asm
  ["_Route22Rival2VictoryText", 0x29, 0x6980, false], // text/Route22.asm
  ["_Route22RivalAfterBattleText1", 0x29, 0x6A88, false], // text/Route22.asm
  ["_Route22RivalAfterBattleText2", 0x29, 0x6BC4, false], // text/Route22.asm
  ["_Route22RivalBeforeBattleText1", 0x29, 0x69E6, false], // text/Route22.asm
  ["_Route22RivalBeforeBattleText2", 0x29, 0x6B0D, false], // text/Route22.asm
  ["_Route2DiglettsCaveSignText", 0x28, 0x6D7C, false], // text/Route2.asm
  ["_Route2GateOaksAideFlashExplanationText", 0x28, 0x4DE5, false], // text/Route2Gate.asm
  ["_Route2GateYoungsterText", 0x28, 0x4E15, false], // text/Route2Gate.asm
  ["_Route2SignText", 0x28, 0x6D57, false], // text/Route2.asm
  ["_Route2TradeHouseScientistText", 0x28, 0x4DA1, false], // text/Route2TradeHouse.asm
  ["_SavingText", 0x29, 0x7652, false], // data/text/text_4.asm
  ["_ShallWeHealYourPokemonText", 0x2C, 0x77B9, false], // data/text/text_7.asm
  ["_SleepingPikachuText1", 0x28, 0x411b, false], // data/text/text_3.asm (V2c CP2)
  ["_SleepingPikachuText2", 0x28, 0x449F, false], // data/text/text_3.asm
  ["_SwitchOnText", 0x28, 0x44BB, false], // data/text/text_3.asm
  ["_ThrewAwayItemText", 0x2D, 0x6EAA, false], // data/text/text_9.asm
  ["_TooImportantToTossText", 0x2D, 0x6ED6, false], // data/text/text_9.asm
  ["_TossHowManyText", 0x28, 0x4457, false], // data/text/text_3.asm
  ["_TownMapText", 0x27, 0x74E9, false], // data/text/text_2.asm
  ["_TurnPageText", 0x27, 0x6B20, false], // data/text/text_2.asm
  ["_TurnedOnPC1Text", 0x28, 0x426C, false], // data/text/text_3.asm
  ["_TurnedOnPC2Text", 0x28, 0x4317, false], // data/text/text_3.asm
  ["_ViridianBlackboardBurnText", 0x27, 0x718D, false], // data/text/text_2.asm
  ["_ViridianBlackboardFrozenText", 0x27, 0x7207, false], // data/text/text_2.asm
  ["_ViridianBlackboardPoisonText", 0x27, 0x70B6, false], // data/text/text_2.asm
  ["_ViridianBlackboardPrlzText", 0x27, 0x7123, false], // data/text/text_2.asm
  ["_ViridianBlackboardSleepText", 0x27, 0x704A, false], // data/text/text_2.asm
  ["_ViridianCityFisherReceivedTM42Text", 0x2D, 0x488C, false], // text/ViridianCity.asm
  ["_ViridianCityFisherTM42ExplanationText", 0x2D, 0x489F, false], // text/ViridianCity.asm
  ["_ViridianCityFisherTM42NoRoomText", 0x2D, 0x48C9, false], // text/ViridianCity.asm
  ["_ViridianCityGambler1GymAlwaysClosedText", 0x2D, 0x4629, false], // text/ViridianCity.asm
  ["_ViridianCityGambler1GymLeaderReturnedText", 0x2D, 0x4666, false], // text/ViridianCity.asm
  ["_ViridianCityGirlHasntHadHisCoffeeYetText", 0x2D, 0x4717, false], // text/ViridianCity.asm
  ["_ViridianCityGirlWhenIGoShopText", 0x2D, 0x4752, false], // text/ViridianCity.asm
  ["_ViridianCityGymLockedText", 0x2D, 0x4A98, false], // text/ViridianCity.asm
  ["_ViridianCityGymSignText", 0x2D, 0x4A80, false], // text/ViridianCity.asm
  ["_ViridianCityOldManHadMyCoffeeNowText", 0x2D, 0x44A4, false], // text/ViridianCity.asm
  ["_ViridianCityOldManLosingMyTouchText", 0x2D, 0x4553, false], // text/ViridianCity.asm
  ["_ViridianCityOldManNotGoodEnoughForYouText", 0x2D, 0x4947, false], // text/ViridianCity.asm
  ["_ViridianCityOldManSleepyPrivatePropertyText", 0x2D, 0x47A7, false], // text/ViridianCity.asm
  ["_ViridianCityOldManWantMeToShowYouAgainText", 0x2D, 0x48EB, false], // text/ViridianCity.asm
  ["_ViridianCityOldManWatchCloselyText", 0x2D, 0x4922, false], // text/ViridianCity.asm
  ["_ViridianCityOldManYouNeedToWeakenTheTargetText", 0x2D, 0x4478, false], // text/ViridianCity.asm
  ["_ViridianCitySignText", 0x2D, 0x496A, false], // text/ViridianCity.asm
  ["_ViridianCityTrainerTips1Text", 0x2D, 0x4997, false], // text/ViridianCity.asm
  ["_ViridianCityTrainerTips2Text", 0x2D, 0x49FA, false], // text/ViridianCity.asm
  ["_ViridianCityYoungster1Text", 0x2D, 0x45BD, false], // text/ViridianCity.asm
  ["_ViridianCityYoungster2YouWantToKnowAboutText", 0x2D, 0x4686, false], // text/ViridianCity.asm
  ["_ViridianForestCooltrainerFAfterBattleText", 0x26, 0x450A, false], // text/ViridianForest.asm
  ["_ViridianForestCooltrainerFBattleText", 0x26, 0x44DE, false], // text/ViridianForest.asm
  ["_ViridianForestCooltrainerFEndBattleText", 0x26, 0x44FA, false], // text/ViridianForest.asm
  ["_ViridianForestLeavingSignText", 0x26, 0x4757, false], // text/ViridianForest.asm
  ["_ViridianForestNorthGateGrampsText", 0x28, 0x4D46, false], // text/ViridianForestNorthGate.asm
  ["_ViridianForestNorthGateSuperNerdText", 0x28, 0x4CE6, false], // text/ViridianForestNorthGate.asm
  ["_ViridianForestSouthGateGirlText", 0x28, 0x4E51, false], // text/ViridianForestSouthGate.asm
  ["_ViridianForestSouthGateLittleGirlText", 0x28, 0x4E94, false], // text/ViridianForestSouthGate.asm
  ["_ViridianForestTrainerTips1Text", 0x26, 0x45FA, false], // text/ViridianForest.asm
  ["_ViridianForestTrainerTips2Text", 0x26, 0x4674, false], // text/ViridianForest.asm
  ["_ViridianForestTrainerTips3Text", 0x26, 0x46B6, false], // text/ViridianForest.asm
  ["_ViridianForestTrainerTips4Text", 0x26, 0x4703, false], // text/ViridianForest.asm
  ["_ViridianForestUseAntidoteSignText", 0x26, 0x4643, false], // text/ViridianForest.asm
  ["_ViridianForestYoungster1Text", 0x26, 0x4333, false], // text/ViridianForest.asm
  ["_ViridianForestYoungster2AfterBattleText", 0x26, 0x43B9, false], // text/ViridianForest.asm
  ["_ViridianForestYoungster2BattleText", 0x26, 0x436F, false], // text/ViridianForest.asm
  ["_ViridianForestYoungster2EndBattleText", 0x26, 0x439E, false], // text/ViridianForest.asm
  ["_ViridianForestYoungster3AfterBattleText", 0x26, 0x4422, false], // text/ViridianForest.asm
  ["_ViridianForestYoungster3BattleText", 0x26, 0x43DA, false], // text/ViridianForest.asm
  ["_ViridianForestYoungster3EndBattleText", 0x26, 0x4409, false], // text/ViridianForest.asm
  ["_ViridianForestYoungster4AfterBattleText", 0x26, 0x448C, false], // text/ViridianForest.asm
  ["_ViridianForestYoungster4BattleText", 0x26, 0x444F, false], // text/ViridianForest.asm
  ["_ViridianForestYoungster4EndBattleText", 0x26, 0x446F, false], // text/ViridianForest.asm
  ["_ViridianForestYoungster5AfterBattleText", 0x26, 0x4581, false], // text/ViridianForest.asm
  ["_ViridianForestYoungster5BattleText", 0x26, 0x453F, false], // text/ViridianForest.asm
  ["_ViridianForestYoungster5EndBattleText", 0x26, 0x456D, false], // text/ViridianForest.asm
  ["_ViridianForestYoungster6Text", 0x26, 0x45B7, false], // text/ViridianForest.asm
  ["_ViridianMartClerkParcelQuestText", 0x2A, 0x5781, false], // text/ViridianMart.asm
  ["_ViridianMartClerkSayHiToOakText", 0x2A, 0x573E, false], // text/ViridianMart.asm
  ["_ViridianMartClerkYouCameFromPalletTownText", 0x2A, 0x5760, false], // text/ViridianMart.asm
  ["_ViridianMartCooltrainerMText", 0x2A, 0x5805, false], // text/ViridianMart.asm
  ["_ViridianMartYoungsterText", 0x2A, 0x57DD, false], // text/ViridianMart.asm
  ["_ViridianNicknameHouseBaldingGuyText", 0x2A, 0x58C8, false], // text/ViridianNicknameHouse.asm
  ["_ViridianNicknameHouseLittleGirlText", 0x2A, 0x591E, false], // text/ViridianNicknameHouse.asm
  ["_ViridianNicknameHouseSpearowText", 0x2A, 0x5938, false], // text/ViridianNicknameHouse.asm
  ["_ViridianNicknameHouseSpearySignText", 0x2A, 0x594A, false], // text/ViridianNicknameHouse.asm
  ["_ViridianPokecenterCooltrainerMText", 0x2A, 0x56F0, false], // text/ViridianPokecenter.asm
  ["_ViridianPokecenterGentlemanText", 0x2A, 0x56A9, false], // text/ViridianPokecenter.asm
  ["_ViridianSchoolBlackboardText1", 0x27, 0x6FE8, false], // data/text/text_2.asm
  ["_ViridianSchoolBlackboardText2", 0x27, 0x7026, false], // data/text/text_2.asm
  ["_ViridianSchoolHouseBrunetteGirlText", 0x2A, 0x5832, false], // text/ViridianSchoolHouse.asm
  ["_ViridianSchoolHouseCooltrainerFText", 0x2A, 0x5897, false], // text/ViridianSchoolHouse.asm
  ["_ViridianSchoolHouseLittleGirlText", 0x2A, 0x585D, false], // text/ViridianSchoolHouse.asm
  ["_ViridianSchoolNotebookText1", 0x27, 0x6B54, false], // data/text/text_2.asm
  ["_ViridianSchoolNotebookText2", 0x27, 0x6BF7, false], // data/text/text_2.asm
  ["_ViridianSchoolNotebookText3", 0x27, 0x6C6E, false], // data/text/text_2.asm
  ["_ViridianSchoolNotebookText4", 0x27, 0x6CDD, false], // data/text/text_2.asm
  ["_ViridianSchoolNotebookText5", 0x27, 0x6B30, false], // data/text/text_2.asm
  ["_WarpToLastPokemonCenterText", 0x2D, 0x40CA, false], // data/text/text_8.asm
  ["_WhatDoYouWantText", 0x28, 0x432C, false], // data/text/text_3.asm
  ["_WhatText", 0x28, 0x44C7, false], // data/text/text_3.asm
  ["_WhatToDepositText", 0x28, 0x4345, false], // data/text/text_3.asm
  ["_WhatToTossText", 0x28, 0x4437, false], // data/text/text_3.asm
  ["_WhatToWithdrawText", 0x28, 0x43C2, false], // data/text/text_3.asm
  ["_WhenYouChangeBoxText", 0x29, 0x769E, false], // data/text/text_4.asm
  ["_WithdrawHowManyText", 0x28, 0x43E1, false], // data/text/text_3.asm
  ["_WithdrewItemText", 0x28, 0x43EC, false], // data/text/text_3.asm
  ["_WouldYouLikeToSaveText", 0x29, 0x7630, false], // data/text/text_4.asm
  ["_YourNameIsText", 0x28, 0x49C4, false], // data/text/text_3.asm
  // A5b7g2 CP1 (notes/54-a5b7g-plan.md §5.2): hidden-event and bookshelf texts. Roots are
  // TextPredefs entries (data/text_predef_pointers.asm, checked against 00:3f67 in the ROM)
  // and the `ld hl` operands of the two text_asm bookshelf routines, which aren't listed.
  ["PushStartText", 0x07, 0x62F9, true], // engine/events/hidden_events/oaks_lab_posters.asm
  ["SaveOptionText", 0x07, 0x6317, true], // engine/events/hidden_events/oaks_lab_posters.asm
  ["StrengthsAndWeaknessesText", 0x07, 0x631C, true], // engine/events/hidden_events/oaks_lab_posters.asm
  ["OakLabEmailText", 0x07, 0x6693, true], // engine/events/hidden_events/oaks_lab_email.asm
  ["RedBedroomSNESText", 0x17, 0x5BB6, true], // engine/events/hidden_events/reds_room.asm
  ["ViridianCityPokecenterBenchGuyText", 0x18, 0x667B, true], // engine/events/hidden_events/bench_guys.asm
  ["BookcaseText", 0x18, 0x66E9, true], // engine/events/hidden_events/blues_room.asm
  ["IndigoPlateauStatuesText1", 0x03, 0x7A67, true], // engine/events/hidden_events/indigo_plateau_statues.asm
  ["IndigoPlateauStatuesText2", 0x03, 0x7A6C, true], // engine/events/hidden_events/indigo_plateau_statues.asm
  ["IndigoPlateauStatuesText3", 0x03, 0x7A71, true], // engine/events/hidden_events/indigo_plateau_statues.asm
  ["PokemonBooksText", 0x03, 0x7A91, true], // engine/events/hidden_events/book_or_sculpture.asm
  ["DiglettSculptureText", 0x03, 0x7A96, true], // engine/events/hidden_events/book_or_sculpture.asm
  ["ElevatorText", 0x03, 0x7A9B, true], // engine/events/hidden_events/elevator.asm
  ["PokemonStuffText", 0x03, 0x7AD3, true], // engine/events/hidden_events/pokemon_stuff.asm
  ["_ViridianCityPokecenterGuyText", 0x27, 0x60A0, false], // data/text/text_2.asm
  ["_BookcaseText", 0x27, 0x6492, false], // data/text/text_2.asm
  ["_PushStartText", 0x27, 0x64C5, false], // data/text/text_2.asm
  ["_SaveOptionText", 0x27, 0x64E3, false], // data/text/text_2.asm
  ["_StrengthsAndWeaknessesText", 0x27, 0x650B, false], // data/text/text_2.asm
  ["_OakLabEmailText", 0x27, 0x6911, false], // data/text/text_2.asm
  ["_RedBedroomSNESText", 0x27, 0x6DD8, false], // data/text/text_2.asm
  ["_IndigoPlateauStatuesText1", 0x27, 0x742F, false], // data/text/text_2.asm
  ["_IndigoPlateauStatuesText2", 0x27, 0x743F, false], // data/text/text_2.asm
  ["_IndigoPlateauStatuesText3", 0x27, 0x746E, false], // data/text/text_2.asm
  ["_PokemonBooksText", 0x27, 0x7499, false], // data/text/text_2.asm
  ["_DiglettSculptureText", 0x27, 0x74B6, false], // data/text/text_2.asm
  ["_ElevatorText", 0x27, 0x74D3, false], // data/text/text_2.asm
  ["_PokemonStuffText", 0x27, 0x74F7, false], // data/text/text_2.asm
  // V2 Pewter programs and FAR children; pret symbols, note 60 §13.1.
  ["PewterCityCooltrainerFText", 0x06, 0x5464, true],
  ["_PewterCityCooltrainerFText", 0x2D, 0x4AB6, false],
  ["PewterCityCooltrainerMText", 0x06, 0x5469, true],
  ["_PewterCityCooltrainerMText", 0x2D, 0x4B17, false],
  ["PewterCitySuperNerd1Text.DidYouCheckOutMuseumText", 0x06, 0x54AE, true],
  ["_PewterCitySuperNerd1DidYouCheckOutMuseumText", 0x2D, 0x4B8D, false],
  ["PewterCitySuperNerd1Text.WerentThoseFossilsAmazingText", 0x06, 0x54B3, true],
  ["_PewterCitySuperNerd1WerentThoseFossilsAmazingText", 0x2D, 0x4BAC, false],
  ["PewterCitySuperNerd1Text.YouHaveToGoText", 0x06, 0x54B8, true],
  ["_PewterCitySuperNerd1YouHaveToGoText", 0x2D, 0x4BD9, false],
  ["PewterCitySuperNerd1ItsRightHereText", 0x06, 0x54BD, true],
  ["_PewterCitySuperNerd1ItsRightHereText", 0x2D, 0x4BFD, false],
  ["PewterCitySuperNerd2Text.DoYouKnowWhatImDoingText", 0x06, 0x54E4, true],
  ["_PewterCitySuperNerd2DoYouKnowWhatImDoingText", 0x2D, 0x4C4B, false],
  ["PewterCitySuperNerd2Text.ThatsRightText", 0x06, 0x54E9, true],
  ["_PewterCitySuperNerd2ThatsRightText", 0x2D, 0x4C6F, false],
  ["PewterCitySuperNerd2Text.ImSprayingRepelText", 0x06, 0x54EE, true],
  ["_PewterCitySuperNerd2ImSprayingRepelText", 0x2D, 0x4C8C, false],
  ["PewterCityYoungsterText.YoureATrainerFollowMeText", 0x06, 0x551A, true],
  ["_PewterCityYoungsterYoureATrainerFollowMeText", 0x2D, 0x4CBE, false],
  ["PewterCityYoungsterGoTakeOnBrockText", 0x06, 0x551F, true],
  ["_PewterCityYoungsterGoTakeOnBrockText", 0x2D, 0x4D05, false],
  ["PewterCityTrainerTipsText", 0x06, 0x5524, true],
  ["_PewterCityTrainerTipsText", 0x2D, 0x4D35, false],
  ["PewterCityPoliceNoticeSignText", 0x06, 0x5529, true],
  ["_PewterCityPoliceNoticeSignText", 0x2D, 0x4D81, false],
  ["PewterCityMuseumSignText", 0x06, 0x552E, true],
  ["_PewterCityMuseumSignText", 0x2D, 0x4DE8, false],
  ["PewterCityGymSignText", 0x06, 0x5533, true],
  ["_PewterCityGymSignText", 0x2D, 0x4E02, false],
  ["PewterCitySignText", 0x06, 0x5538, true],
  ["_PewterCitySignText", 0x2D, 0x4E43, false],
  ["PewterMartYoungsterText.Text", 0x1D, 0x4503, true],
  ["_PewterMartYoungsterText", 0x2A, 0x6C9D, false],
  ["PewterMartSuperNerdText.Text", 0x1D, 0x4512, true],
  ["_PewterMartSuperNerdText", 0x2A, 0x6CFC, false],
  ["PewterPokecenterGentlemanText", 0x17, 0x4493, true],
  ["_PewterPokecenterGentlemanText", 0x2A, 0x6DF4, false],
  ["PewterPokecenterPrintCooltrainerFText.text", 0x3C, 0x5D9F, true],
  ["_PewterPokecenterText3", 0x2A, 0x6E34, false],
  ["PewterJigglypuff.Text", 0x3C, 0x5E19, true],
  ["_PewterPokecenterJigglypuffText", 0x2A, 0x6EAB, false],
  ["PewterNidoranHouseNidoranText", 0x07, 0x4E46, true],
  ["_PewterNidoranHouseNidoranText", 0x2A, 0x6BBF, false],
  ["PewterNidoranHouseLittleBoyText", 0x07, 0x4E56, true],
  ["_PewterNidoranHouseLittleBoyText", 0x2A, 0x6BD2, false],
  ["PewterNidoranHouseMiddleAgedManText", 0x07, 0x4E5B, true],
  ["_PewterNidoranHouseMiddleAgedManText", 0x2A, 0x6BE0, false],
  ["PewterSpeechHouseGamblerText", 0x07, 0x4E99, true],
  ["_PewterSpeechHouseGamblerText", 0x2A, 0x6D46, false],
  ["PewterSpeechHouseYoungsterText", 0x07, 0x4E9E, true],
  ["_PewterSpeechHouseYoungsterText", 0x2A, 0x6D9E, false],
  ["PewterCityPokecenterBenchGuyText", 0x18, 0x6680, true],
  ["_PewterCityPokecenterGuyText", 0x27, 0x60D5, false],
  // A5c1 CP2: battle entries and FAR children (note 66 §10.2).
  ["_AIBattleWithdrawText", 0x27, 0x5E5B, false], // data/text/text_2.asm
  ["_AIBattleUseItemText", 0x27, 0x5E72, false], // data/text/text_2.asm
  ["_OutOfSafariBallsText", 0x27, 0x7511, false], // data/text/text_2.asm
  ["_WildRanText", 0x27, 0x753E, false], // data/text/text_2.asm
  ["_EnemyRanText", 0x27, 0x754F, false], // data/text/text_2.asm
  ["_HurtByPoisonText", 0x27, 0x7561, false], // data/text/text_2.asm
  ["_HurtByBurnText", 0x27, 0x7575, false], // data/text/text_2.asm
  ["_HurtByLeechSeedText", 0x27, 0x758B, false], // data/text/text_2.asm
  ["_EnemyMonFaintedText", 0x27, 0x759F, false], // data/text/text_2.asm
  ["_MoneyForWinningText", 0x27, 0x75B5, false], // data/text/text_2.asm
  ["_TrainerDefeatedText", 0x27, 0x75D1, false], // data/text/text_2.asm
  ["_PlayerMonFaintedText", 0x27, 0x75E4, false], // data/text/text_2.asm
  ["_UseNextMonText", 0x27, 0x75F2, false], // data/text/text_2.asm
  ["_Rival1WinText", 0x27, 0x7602, false], // data/text/text_2.asm
  ["_PlayerBlackedOutText2", 0x27, 0x7620, false], // data/text/text_2.asm
  ["_TrainerAboutToUseText", 0x27, 0x765C, false], // data/text/text_2.asm
  ["_TrainerSentOutText", 0x27, 0x768C, false], // data/text/text_2.asm
  ["_NoWillText", 0x27, 0x76A1, false], // data/text/text_2.asm
  ["_CantEscapeText", 0x27, 0x76BB, false], // data/text/text_2.asm
  ["_NoRunningText", 0x27, 0x76C9, false], // data/text/text_2.asm
  ["_GotAwayText", 0x27, 0x76F7, false], // data/text/text_2.asm
  ["_RunAwayText", 0x27, 0x7709, false], // data/text/text_2.asm
  ["_ItemsCantBeUsedHereText", 0x27, 0x771B, false], // data/text/text_2.asm
  ["_AlreadyOutText", 0x27, 0x7735, false], // data/text/text_2.asm
  ["_MoveNoPPText", 0x27, 0x774A, false], // data/text/text_2.asm
  ["_MoveDisabledText", 0x27, 0x7765, false], // data/text/text_2.asm
  ["_NoMovesLeftText", 0x27, 0x777C, false], // data/text/text_2.asm
  ["_MultiHitText", 0x27, 0x7794, false], // data/text/text_2.asm
  ["_ScaredText", 0x27, 0x77B1, false], // data/text/text_2.asm
  ["_GetOutText", 0x27, 0x77CD, false], // data/text/text_2.asm
  ["_FastAsleepText", 0x27, 0x77EB, false], // data/text/text_2.asm
  ["_WokeUpText", 0x27, 0x77FE, false], // data/text/text_2.asm
  ["_IsFrozenText", 0x27, 0x780A, false], // data/text/text_2.asm
  ["_FullyParalyzedText", 0x27, 0x781E, false], // data/text/text_2.asm
  ["_FlinchedText", 0x27, 0x7833, false], // data/text/text_2.asm
  ["_MustRechargeText", 0x27, 0x7840, false], // data/text/text_2.asm
  ["_DisabledNoMoreText", 0x27, 0x7852, false], // data/text/text_2.asm
  ["_IsConfusedText", 0x27, 0x7868, false], // data/text/text_2.asm
  ["_HurtItselfText", 0x27, 0x7878, false], // data/text/text_2.asm
  ["_ConfusedNoMoreText", 0x27, 0x789A, false], // data/text/text_2.asm
  ["_SavingEnergyText", 0x27, 0x78B0, false], // data/text/text_2.asm
  ["_UnleashedEnergyText", 0x27, 0x78C5, false], // data/text/text_2.asm
  ["_ThrashingAboutText", 0x27, 0x78DA, false], // data/text/text_2.asm
  ["_AttackContinuesText", 0x27, 0x78EF, false], // data/text/text_2.asm
  ["_CantMoveText", 0x27, 0x7905, false], // data/text/text_2.asm
  ["_MoveIsDisabledText", 0x27, 0x7913, false], // data/text/text_2.asm
  ["_ActorNameText", 0x27, 0x792A, false], // data/text/text_2.asm
  ["_UsedMove1Text", 0x27, 0x792E, false], // data/text/text_2.asm
  ["_UsedMove2Text", 0x27, 0x7937, false], // data/text/text_2.asm
  ["_UsedInsteadText", 0x27, 0x7940, false], // data/text/text_2.asm
  ["_MoveNameText", 0x27, 0x794C, false], // data/text/text_2.asm
  ["_EndUsedMove1Text", 0x27, 0x7951, false], // data/text/text_2.asm
  ["_EndUsedMove2Text", 0x27, 0x7954, false], // data/text/text_2.asm
  ["_EndUsedMove3Text", 0x27, 0x7957, false], // data/text/text_2.asm
  ["_EndUsedMove4Text", 0x27, 0x795A, false], // data/text/text_2.asm
  ["_EndUsedMove5Text", 0x27, 0x795D, false], // data/text/text_2.asm
  ["_AttackMissedText", 0x27, 0x7960, false], // data/text/text_2.asm
  ["_KeptGoingAndCrashedText", 0x27, 0x7973, false], // data/text/text_2.asm
  ["_UnaffectedText", 0x27, 0x798E, false], // data/text/text_2.asm
  ["_DoesntAffectMonText", 0x27, 0x799E, false], // data/text/text_2.asm
  ["_CriticalHitText", 0x27, 0x79B3, false], // data/text/text_2.asm
  ["_OHKOText", 0x27, 0x79C2, false], // data/text/text_2.asm
  ["_LoafingAroundText", 0x27, 0x79CF, false], // data/text/text_2.asm
  ["_BeganToNapText", 0x27, 0x79E7, false], // data/text/text_2.asm
  ["_WontObeyText", 0x27, 0x79FA, false], // data/text/text_2.asm
  ["_TurnedAwayText", 0x27, 0x7A0A, false], // data/text/text_2.asm
  ["_IgnoredOrdersText", 0x27, 0x7A1C, false], // data/text/text_2.asm
  ["_SubstituteTookDamageText", 0x27, 0x7A31, false], // data/text/text_2.asm
  ["_SubstituteBrokeText", 0x27, 0x7A54, false], // data/text/text_2.asm
  ["_BuildingRageText", 0x27, 0x7A6A, false], // data/text/text_2.asm
  ["_MirrorMoveFailedText", 0x27, 0x7A80, false], // data/text/text_2.asm
  ["_HitXTimesText", 0x27, 0x7A99, false], // data/text/text_2.asm
  ["_GainedText", 0x27, 0x7AAC, false], // data/text/text_2.asm
  ["_WithExpAllText", 0x27, 0x7ABA, false], // data/text/text_2.asm
  ["_BoostedText", 0x27, 0x7ACB, false], // data/text/text_2.asm
  ["_ExpPointsText", 0x27, 0x7AD8, false], // data/text/text_2.asm
  ["_GrewLevelText", 0x27, 0x7AEB, false], // data/text/text_2.asm
  ["_SuperEffectiveText", 0x27, 0x7B07, false], // data/text/text_2.asm
  ["_NotVeryEffectiveText", 0x27, 0x7B1D, false], // data/text/text_2.asm
  ["_SafariZoneEatingText", 0x27, 0x7B38, false], // data/text/text_2.asm
  ["_SafariZoneAngryText", 0x27, 0x7B4F, false], // data/text/text_2.asm
  ["_WildMonAppearedText", 0x27, 0x7B65, false], // data/text/text_2.asm
  ["_HookedMonAttackedText", 0x27, 0x7B7B, false], // data/text/text_2.asm
  ["_EnemyAppearedText", 0x28, 0x4000, false], // data/text/text_3.asm
  ["_TrainerWantsToFightText", 0x28, 0x400F, false], // data/text/text_3.asm
  ["_UnveiledGhostText", 0x28, 0x4024, false], // data/text/text_3.asm
  ["_GhostCantBeIDdText", 0x28, 0x404F, false], // data/text/text_3.asm
  ["_GoText", 0x28, 0x406D, false], // data/text/text_3.asm
  ["_DoItText", 0x28, 0x4074, false], // data/text/text_3.asm
  ["_GetmText", 0x28, 0x407E, false], // data/text/text_3.asm
  ["_EnemysWeakText", 0x28, 0x4087, false], // data/text/text_3.asm
  ["_PlayerMon1Text", 0x28, 0x40A1, false], // data/text/text_3.asm
  ["_PlayerMon2Text", 0x28, 0x40A7, false], // data/text/text_3.asm
  ["_EnoughText", 0x28, 0x40AE, false], // data/text/text_3.asm
  ["_OKExclamationText", 0x28, 0x40B8, false], // data/text/text_3.asm
  ["_GoodText", 0x28, 0x40BE, false], // data/text/text_3.asm
  ["_ComeBackText", 0x28, 0x40C6, false], // data/text/text_3.asm
  ["_PickUpPayDayMoneyText", 0x28, 0x40D3, false], // data/text/text_3.asm
  ["_FellAsleepText", 0x2A, 0x401A, false], // data/text/text_5.asm
  ["_AlreadyAsleepText", 0x2A, 0x402A, false], // data/text/text_5.asm
  ["_PoisonedText", 0x2A, 0x403E, false], // data/text/text_5.asm
  ["_BadlyPoisonedText", 0x2A, 0x404F, false], // data/text/text_5.asm
  ["_BurnedText", 0x2A, 0x4063, false], // data/text/text_5.asm
  ["_FrozenText", 0x2A, 0x4072, false], // data/text/text_5.asm
  ["_FireDefrostedText", 0x2A, 0x4087, false], // data/text/text_5.asm
  ["_MonsStatsRoseText", 0x2A, 0x409A, false], // data/text/text_5.asm
  ["_GreatlyRoseText", 0x2A, 0x40A5, false], // data/text/text_5.asm
  ["_RoseText", 0x2A, 0x40B0, false], // data/text/text_5.asm
  ["_MonsStatsFellText", 0x2A, 0x40B8, false], // data/text/text_5.asm
  ["_GreatlyFellText", 0x2A, 0x40C3, false], // data/text/text_5.asm
  ["_FellText", 0x2A, 0x40CE, false], // data/text/text_5.asm
  ["_RanFromBattleText", 0x2A, 0x40D6, false], // data/text/text_5.asm
  ["_RanAwayScaredText", 0x2A, 0x40EA, false], // data/text/text_5.asm
  ["_WasBlownAwayText", 0x2A, 0x40FE, false], // data/text/text_5.asm
  ["_ChargeMoveEffectText", 0x2A, 0x4111, false], // data/text/text_5.asm
  ["_MadeWhirlwindText", 0x2A, 0x4115, false], // data/text/text_5.asm
  ["_TookInSunlightText", 0x2A, 0x4129, false], // data/text/text_5.asm
  ["_LoweredItsHeadText", 0x2A, 0x413D, false], // data/text/text_5.asm
  ["_SkyAttackGlowingText", 0x2A, 0x4151, false], // data/text/text_5.asm
  ["_FlewUpHighText", 0x2A, 0x415F, false], // data/text/text_5.asm
  ["_DugAHoleText", 0x2A, 0x416F, false], // data/text/text_5.asm
  ["_BecameConfusedText", 0x2A, 0x417D, false], // data/text/text_5.asm
  ["_MimicLearnedMoveText", 0x2A, 0x4191, false], // data/text/text_5.asm
  ["_MoveWasDisabledText", 0x2A, 0x41A3, false], // data/text/text_5.asm
  ["_NothingHappenedText", 0x2A, 0x41BB, false], // data/text/text_5.asm
  ["_NoEffectText", 0x2A, 0x41CE, false], // data/text/text_5.asm
  ["_ButItFailedText", 0x2A, 0x41DA, false], // data/text/text_5.asm
  ["_DidntAffectText", 0x2A, 0x41EC, false], // data/text/text_5.asm
  ["_IsUnaffectedText", 0x2A, 0x4200, false], // data/text/text_5.asm
  ["_ParalyzedMayNotAttackText", 0x2A, 0x4212, false], // data/text/text_5.asm
  ["_SubstituteText", 0x2A, 0x4234, false], // data/text/text_5.asm
  ["_HasSubstituteText", 0x2A, 0x424E, false], // data/text/text_5.asm
  ["_TooWeakSubstituteText", 0x2A, 0x4263, false], // data/text/text_5.asm
  ["_WasSeededText", 0x2A, 0x4283, false], // data/text/text_5.asm
  ["_EvadedAttackText", 0x2A, 0x4292, false], // data/text/text_5.asm
  ["_HitWithRecoilText", 0x2A, 0x42A4, false], // data/text/text_5.asm
  ["_ConvertedTypeText", 0x2A, 0x42B9, false], // data/text/text_5.asm
  ["_StatusChangesEliminatedText", 0x2A, 0x42D0, false], // data/text/text_5.asm
  ["_GettingPumpedText", 0x2A, 0x42F4, false], // data/text/text_5.asm
  ["_StartedSleepingEffect", 0x2A, 0x4308, false], // data/text/text_5.asm
  ["_FellAsleepBecameHealthyText", 0x2A, 0x431D, false], // data/text/text_5.asm
  ["_RegainedHealthText", 0x2A, 0x4340, false], // data/text/text_5.asm
  ["_TransformedText", 0x2A, 0x4354, false], // data/text/text_5.asm
  ["_LightScreenProtectedText", 0x2A, 0x436F, false], // data/text/text_5.asm
  ["_ReflectGainedArmorText", 0x2A, 0x4396, false], // data/text/text_5.asm
  ["_ShroudedInMistText", 0x2A, 0x43A7, false], // data/text/text_5.asm
  ["_CoinsScatteredText", 0x2A, 0x43BD, false], // data/text/text_5.asm
  ["_SuckedHealthText", 0x2A, 0x43DA, false], // data/text/text_5.asm
  ["_DreamWasEatenText", 0x2A, 0x43F1, false], // data/text/text_5.asm
  ["_LearnedMove1Text", 0x2C, 0x7640, false], // data/text/text_7.asm
  ["_WhichMoveToForgetText", 0x2C, 0x7655, false], // data/text/text_7.asm
  ["_AbandonLearningText", 0x2C, 0x7676, false], // data/text/text_7.asm
  ["_DidNotLearnText", 0x2C, 0x768F, false], // data/text/text_7.asm
  ["_TryingToLearnText", 0x2C, 0x76A9, false], // data/text/text_7.asm
  ["_OneTwoAndText", 0x2C, 0x771E, false], // data/text/text_7.asm
  ["_PoofText", 0x2C, 0x772C, false], // data/text/text_7.asm
  ["_ForgotAndText", 0x2C, 0x7735, false], // data/text/text_7.asm
  ["_HMCantDeleteText", 0x2C, 0x7752, false], // data/text/text_7.asm
  ["_ItemUseBallText00", 0x2D, 0x69D9, false], // data/text/text_9.asm
  ["_ItemUseBallText01", 0x2D, 0x6A0F, false], // data/text/text_9.asm
  ["_ItemUseBallText02", 0x2D, 0x6A25, false], // data/text/text_9.asm
  ["_ItemUseBallText03", 0x2D, 0x6A41, false], // data/text/text_9.asm
  ["_ItemUseBallText04", 0x2D, 0x6A62, false], // data/text/text_9.asm
  ["_ItemUseBallText05", 0x2D, 0x6A7F, false], // data/text/text_9.asm
  ["_ItemUseBallText07", 0x2D, 0x6A9E, false], // data/text/text_9.asm
  ["_ItemUseBallText08", 0x2D, 0x6AC0, false], // data/text/text_9.asm
  ["_ItemUseBallText06", 0x2D, 0x6AE5, false], // data/text/text_9.asm
  ["_ThrewBaitText", 0x2D, 0x6B7A, false], // data/text/text_9.asm
  ["_ThrewRockText", 0x2D, 0x6B8E, false], // data/text/text_9.asm
  ["_PlayedFluteNoEffectText", 0x2D, 0x6B9F, false], // data/text/text_9.asm
  ["_FluteWokeUpText", 0x2D, 0x6BCE, false], // data/text/text_9.asm
  ["_PlayedFluteHadEffectText", 0x2D, 0x6BEA, false], // data/text/text_9.asm
  ["_RestorePPWhichTechniqueText", 0x2D, 0x6C84, false], // data/text/text_9.asm
  ["_PPRestoredText", 0x2D, 0x6CCF, false], // data/text/text_9.asm
  ["_ThrowBallAtTrainerMonText1", 0x2D, 0x6DC5, false], // data/text/text_9.asm
  ["_ThrowBallAtTrainerMonText2", 0x2D, 0x6DE4, false], // data/text/text_9.asm
  ["_BoxFullCannotThrowBallText", 0x2D, 0x6E2B, false], // data/text/text_9.asm
  ["_ItemUseText001", 0x2D, 0x6E6E, false], // data/text/text_9.asm
  ["_ItemUseText002", 0x2D, 0x6E77, false], // data/text/text_9.asm
  ["WildMonAppearedText", 0x3D, 0x40C7, true], // engine/battle/common_text.asm
  ["HookedMonAttackedText", 0x3D, 0x40CC, true], // engine/battle/common_text.asm
  ["EnemyAppearedText", 0x3D, 0x40D1, true], // engine/battle/common_text.asm
  ["TrainerWantsToFightText", 0x3D, 0x40D6, true], // engine/battle/common_text.asm
  ["UnveiledGhostText", 0x3D, 0x40DB, true], // engine/battle/common_text.asm
  ["GhostCantBeIDdText", 0x3D, 0x40E0, true], // engine/battle/common_text.asm
  ["GoText", 0x3D, 0x413A, true], // engine/battle/common_text.asm
  ["DoItText", 0x3D, 0x4141, true], // engine/battle/common_text.asm
  ["GetmText", 0x3D, 0x4148, true], // engine/battle/common_text.asm
  ["EnemysWeakText", 0x3D, 0x414F, true], // engine/battle/common_text.asm
  ["PlayerMon1Text", 0x3D, 0x4158, true], // engine/battle/common_text.asm
  ["PlayerMon2Text", 0x3D, 0x4163, true], // engine/battle/common_text.asm
  ["EnoughText", 0x3D, 0x41B1, true], // engine/battle/common_text.asm
  ["OKExclamationText", 0x3D, 0x41B8, true], // engine/battle/common_text.asm
  ["GoodText", 0x3D, 0x41BF, true], // engine/battle/common_text.asm
  ["ComeBackText", 0x3D, 0x41CA, true], // engine/battle/common_text.asm
  ["StartBattle.outOfSafariBallsText", 0x0F, 0x41BE, true], // engine/battle/core.asm
  ["WildRanText", 0x0F, 0x423F, true], // engine/battle/core.asm
  ["EnemyRanText", 0x0F, 0x4244, true], // engine/battle/core.asm
  ["HurtByPoisonText", 0x0F, 0x4444, true], // engine/battle/core.asm
  ["HurtByBurnText", 0x0F, 0x4449, true], // engine/battle/core.asm
  ["HurtByLeechSeedText", 0x0F, 0x444E, true], // engine/battle/core.asm
  ["EnemyMonFaintedText", 0x0F, 0x4654, true], // engine/battle/core.asm
  ["MoneyForWinningText", 0x0F, 0x4706, true], // engine/battle/core.asm
  ["TrainerDefeatedText", 0x0F, 0x470B, true], // engine/battle/core.asm
  ["PlayerMonFaintedText", 0x0F, 0x47FA, true], // engine/battle/core.asm
  ["UseNextMonText", 0x0F, 0x4837, true], // engine/battle/core.asm
  ["Rival1WinText", 0x0F, 0x48E9, true], // engine/battle/core.asm
  ["PlayerBlackedOutText2", 0x0F, 0x48EE, true], // engine/battle/core.asm
  ["TrainerAboutToUseText", 0x0F, 0x4ADE, true], // engine/battle/core.asm
  ["TrainerSentOutText", 0x0F, 0x4AE3, true], // engine/battle/core.asm
  ["NoWillText", 0x0F, 0x4B19, true], // engine/battle/core.asm
  ["CantEscapeText", 0x0F, 0x4C01, true], // engine/battle/core.asm
  ["NoRunningText", 0x0F, 0x4C06, true], // engine/battle/core.asm
  ["GotAwayText", 0x0F, 0x4C0B, true], // engine/battle/core.asm
  ["DisplayBattleMenu.RunAwayText", 0x0F, 0x50DF, true], // engine/battle/core.asm
  ["ItemsCantBeUsedHereText", 0x0F, 0x51C8, true], // engine/battle/core.asm
  ["AlreadyOutText", 0x0F, 0x52FC, true], // engine/battle/core.asm
  ["MoveNoPPText", 0x0F, 0x54AE, true], // engine/battle/core.asm
  ["MoveDisabledText", 0x0F, 0x54B3, true], // engine/battle/core.asm
  ["NoMovesLeftText", 0x0F, 0x559B, true], // engine/battle/core.asm
  ["MultiHitText", 0x0F, 0x5977, true], // engine/battle/core.asm
  ["ScaredText", 0x0F, 0x59A2, true], // engine/battle/core.asm
  ["GetOutText", 0x0F, 0x59A7, true], // engine/battle/core.asm
  ["FastAsleepText", 0x0F, 0x5BAF, true], // engine/battle/core.asm
  ["WokeUpText", 0x0F, 0x5BB4, true], // engine/battle/core.asm
  ["IsFrozenText", 0x0F, 0x5BB9, true], // engine/battle/core.asm
  ["FullyParalyzedText", 0x0F, 0x5BBE, true], // engine/battle/core.asm
  ["FlinchedText", 0x0F, 0x5BC3, true], // engine/battle/core.asm
  ["MustRechargeText", 0x0F, 0x5BC8, true], // engine/battle/core.asm
  ["DisabledNoMoreText", 0x0F, 0x5BCD, true], // engine/battle/core.asm
  ["IsConfusedText", 0x0F, 0x5BD2, true], // engine/battle/core.asm
  ["HurtItselfText", 0x0F, 0x5BD7, true], // engine/battle/core.asm
  ["ConfusedNoMoreText", 0x0F, 0x5BDC, true], // engine/battle/core.asm
  ["SavingEnergyText", 0x0F, 0x5BE1, true], // engine/battle/core.asm
  ["UnleashedEnergyText", 0x0F, 0x5BE6, true], // engine/battle/core.asm
  ["ThrashingAboutText", 0x0F, 0x5BEB, true], // engine/battle/core.asm
  ["AttackContinuesText", 0x0F, 0x5BF0, true], // engine/battle/core.asm
  ["CantMoveText", 0x0F, 0x5BF5, true], // engine/battle/core.asm
  ["MoveIsDisabledText", 0x0F, 0x5C1A, true], // engine/battle/core.asm
  ["AttackMissedText", 0x0F, 0x5DB4, true], // engine/battle/core.asm
  ["KeptGoingAndCrashedText", 0x0F, 0x5DB9, true], // engine/battle/core.asm
  ["UnaffectedText", 0x0F, 0x5DBE, true], // engine/battle/core.asm
  ["DoesntAffectMonText", 0x0F, 0x5DC9, true], // engine/battle/core.asm
  ["CriticalHitText", 0x0F, 0x5DF0, true], // engine/battle/core.asm
  ["OHKOText", 0x0F, 0x5DF5, true], // engine/battle/core.asm
  ["LoafingAroundText", 0x0F, 0x5F28, true], // engine/battle/core.asm
  ["BeganToNapText", 0x0F, 0x5F2D, true], // engine/battle/core.asm
  ["WontObeyText", 0x0F, 0x5F32, true], // engine/battle/core.asm
  ["TurnedAwayText", 0x0F, 0x5F37, true], // engine/battle/core.asm
  ["IgnoredOrdersText", 0x0F, 0x5F3C, true], // engine/battle/core.asm
  ["SubstituteTookDamageText", 0x0F, 0x641E, true], // engine/battle/core.asm
  ["SubstituteBrokeText", 0x0F, 0x6423, true], // engine/battle/core.asm
  ["BuildingRageText", 0x0F, 0x646A, true], // engine/battle/core.asm
  ["MirrorMoveFailedText", 0x0F, 0x6496, true], // engine/battle/core.asm
  ["HitXTimesText", 0x0F, 0x6A0D, true], // engine/battle/core.asm
  ["PrintEmptyString.emptyString", 0x0F, 0x7026, true], // engine/battle/core.asm
  ["SuperEffectiveText", 0x0B, 0x7D38, true], // engine/battle/display_effectiveness.asm
  ["NotVeryEffectiveText", 0x0B, 0x7D3D, true], // engine/battle/display_effectiveness.asm
  ["FellAsleepText", 0x0F, 0x71C8, true], // engine/battle/effects.asm
  ["AlreadyAsleepText", 0x0F, 0x71CD, true], // engine/battle/effects.asm
  ["PoisonedText", 0x0F, 0x7262, true], // engine/battle/effects.asm
  ["BadlyPoisonedText", 0x0F, 0x7267, true], // engine/battle/effects.asm
  ["BurnedText", 0x0F, 0x738E, true], // engine/battle/effects.asm
  ["FrozenText", 0x0F, 0x7393, true], // engine/battle/effects.asm
  ["FireDefrostedText", 0x0F, 0x73D9, true], // engine/battle/effects.asm
  ["MonsStatsRoseText", 0x0F, 0x74DE, true], // engine/battle/effects.asm
  ["GreatlyRoseText", 0x0F, 0x74F8, true], // engine/battle/effects.asm
  ["RoseText", 0x0F, 0x74FD, true], // engine/battle/effects.asm
  ["MonsStatsFellText", 0x0F, 0x7617, true], // engine/battle/effects.asm
  ["GreatlyFellText", 0x0F, 0x7634, true], // engine/battle/effects.asm
  ["FellText", 0x0F, 0x7639, true], // engine/battle/effects.asm
  ["RanFromBattleText", 0x0F, 0x77B8, true], // engine/battle/effects.asm
  ["RanAwayScaredText", 0x0F, 0x77BD, true], // engine/battle/effects.asm
  ["WasBlownAwayText", 0x0F, 0x77C2, true], // engine/battle/effects.asm
  ["ChargeMoveEffectText", 0x0F, 0x78A3, true], // engine/battle/effects.asm
  ["MadeWhirlwindText", 0x0F, 0x78D4, true], // engine/battle/effects.asm
  ["TookInSunlightText", 0x0F, 0x78D9, true], // engine/battle/effects.asm
  ["LoweredItsHeadText", 0x0F, 0x78DE, true], // engine/battle/effects.asm
  ["SkyAttackGlowingText", 0x0F, 0x78E3, true], // engine/battle/effects.asm
  ["FlewUpHighText", 0x0F, 0x78E8, true], // engine/battle/effects.asm
  ["DugAHoleText", 0x0F, 0x78ED, true], // engine/battle/effects.asm
  ["BecameConfusedText", 0x0F, 0x797C, true], // engine/battle/effects.asm
  ["MimicLearnedMoveText", 0x0F, 0x7A52, true], // engine/battle/effects.asm
  ["MoveWasDisabledText", 0x0F, 0x7AE4, true], // engine/battle/effects.asm
  ["NothingHappenedText", 0x0F, 0x7B19, true], // engine/battle/effects.asm
  ["NoEffectText", 0x0F, 0x7B24, true], // engine/battle/effects.asm
  ["ButItFailedText", 0x0F, 0x7B34, true], // engine/battle/effects.asm
  ["DidntAffectText", 0x0F, 0x7B3F, true], // engine/battle/effects.asm
  ["IsUnaffectedText", 0x0F, 0x7B44, true], // engine/battle/effects.asm
  ["ParalyzedMayNotAttackText", 0x0F, 0x7B4F, true], // engine/battle/effects.asm
  ["PickUpPayDayMoneyText", 0x04, 0x7835, true], // engine/battle/end_of_battle.asm
  ["GainedText", 0x15, 0x54C6, true], // engine/battle/experience.asm
  ["WithExpAllText", 0x15, 0x54DF, true], // engine/battle/experience.asm
  ["BoostedText", 0x15, 0x54E8, true], // engine/battle/experience.asm
  ["ExpPointsText", 0x15, 0x54EC, true], // engine/battle/experience.asm
  ["GrewLevelText", 0x15, 0x54F1, true], // engine/battle/experience.asm
  ["_InitBattleCommon.emptyString", 0x3D, 0x6159, true], // engine/battle/init_battle.asm
  ["ConvertedTypeText", 0x04, 0x7997, true], // engine/battle/move_effects/conversion.asm
  ["SuckedHealthText", 0x01, 0x7784, true], // engine/battle/move_effects/drain_hp.asm
  ["DreamWasEatenText", 0x01, 0x7789, true], // engine/battle/move_effects/drain_hp.asm
  ["GettingPumpedText", 0x3D, 0x62B4, true], // engine/battle/move_effects/focus_energy.asm
  ["StatusChangesEliminatedText", 0x04, 0x7A1D, true], // engine/battle/move_effects/haze.asm
  ["StartedSleepingEffect", 0x3D, 0x6370, true], // engine/battle/move_effects/heal.asm
  ["FellAsleepBecameHealthyText", 0x3D, 0x6375, true], // engine/battle/move_effects/heal.asm
  ["RegainedHealthText", 0x3D, 0x637A, true], // engine/battle/move_effects/heal.asm
  ["WasSeededText", 0x0A, 0x7E03, true], // engine/battle/move_effects/leech_seed.asm
  ["EvadedAttackText", 0x0A, 0x7E08, true], // engine/battle/move_effects/leech_seed.asm
  ["ShroudedInMistText", 0x3D, 0x64D3, true], // engine/battle/move_effects/mist.asm
  ["CoinsScatteredText", 0x3D, 0x655D, true], // engine/battle/move_effects/pay_day.asm
  ["HitWithRecoilText", 0x04, 0x7968, true], // engine/battle/move_effects/recoil.asm
  ["LightScreenProtectedText", 0x3D, 0x649D, true], // engine/battle/move_effects/reflect_light_screen.asm
  ["ReflectGainedArmorText", 0x3D, 0x64A2, true], // engine/battle/move_effects/reflect_light_screen.asm
  ["SubstituteText", 0x05, 0x7CA1, true], // engine/battle/move_effects/substitute.asm
  ["HasSubstituteText", 0x05, 0x7CA6, true], // engine/battle/move_effects/substitute.asm
  ["TooWeakSubstituteText", 0x05, 0x7CAB, true], // engine/battle/move_effects/substitute.asm
  ["TransformedText", 0x3D, 0x6458, true], // engine/battle/move_effects/transform.asm
  ["SafariZoneEatingText", 0x01, 0x4141, true], // engine/battle/safari_zone.asm
  ["SafariZoneAngryText", 0x01, 0x4146, true], // engine/battle/safari_zone.asm
  ["AIBattleWithdrawText", 0x0E, 0x6817, true], // engine/battle/trainer_ai.asm
  ["AIBattleUseItemText", 0x0E, 0x68DA, true], // engine/battle/trainer_ai.asm
  ["UsedMoveText", 0x0F, 0x5C6D, true], // engine/battle/used_move_text.asm
  ["UsedMove1Text", 0x0F, 0x5C9F, true], // engine/battle/used_move_text.asm
  ["UsedMove2Text", 0x0F, 0x5CA6, true], // engine/battle/used_move_text.asm
  ["UsedMoveText_CheckObedience.UsedInsteadText", 0x0F, 0x5CB5, true], // engine/battle/used_move_text.asm
  ["MoveNameText", 0x0F, 0x5CBE, true], // engine/battle/used_move_text.asm
  ["EndUsedMove1Text", 0x0F, 0x5CDE, true], // engine/battle/used_move_text.asm
  ["EndUsedMove2Text", 0x0F, 0x5CE3, true], // engine/battle/used_move_text.asm
  ["EndUsedMove3Text", 0x0F, 0x5CE8, true], // engine/battle/used_move_text.asm
  ["EndUsedMove4Text", 0x0F, 0x5CED, true], // engine/battle/used_move_text.asm
  ["EndUsedMove5Text", 0x0F, 0x5CF2, true], // engine/battle/used_move_text.asm
  ["ItemUseBall.emptyString", 0x03, 0x5696, true], // engine/items/item_effects.asm
  ["ItemUseBallText00", 0x03, 0x5697, true], // engine/items/item_effects.asm
  ["ItemUseBallText01", 0x03, 0x569C, true], // engine/items/item_effects.asm
  ["ItemUseBallText02", 0x03, 0x56A1, true], // engine/items/item_effects.asm
  ["ItemUseBallText03", 0x03, 0x56A6, true], // engine/items/item_effects.asm
  ["ItemUseBallText04", 0x03, 0x56AB, true], // engine/items/item_effects.asm
  ["ItemUseBallText05", 0x03, 0x56B0, true], // engine/items/item_effects.asm
  ["ItemUseBallText07", 0x03, 0x56B7, true], // engine/items/item_effects.asm
  ["ItemUseBallText08", 0x03, 0x56BC, true], // engine/items/item_effects.asm
  ["ItemUseBallText06", 0x03, 0x56C1, true], // engine/items/item_effects.asm
  ["ThrewBaitText", 0x03, 0x5DC5, true], // engine/items/item_effects.asm
  ["ThrewRockText", 0x03, 0x5DCA, true], // engine/items/item_effects.asm
  ["PlayedFluteNoEffectText", 0x03, 0x60BA, true], // engine/items/item_effects.asm
  ["FluteWokeUpText", 0x03, 0x60BF, true], // engine/items/item_effects.asm
  ["PlayedFluteHadEffectText", 0x03, 0x60C4, true], // engine/items/item_effects.asm
  ["RestorePPWhichTechniqueText", 0x03, 0x635D, true], // engine/items/item_effects.asm
  ["PPRestoredText", 0x03, 0x636C, true], // engine/items/item_effects.asm
  ["ThrowBallAtTrainerMonText1", 0x03, 0x650E, true], // engine/items/item_effects.asm
  ["ThrowBallAtTrainerMonText2", 0x03, 0x6513, true], // engine/items/item_effects.asm
  ["BoxFullCannotThrowBallText", 0x03, 0x6522, true], // engine/items/item_effects.asm
  ["ItemUseText00", 0x03, 0x652C, true], // engine/items/item_effects.asm
  ["LearnedMove1Text", 0x01, 0x6D31, true], // engine/pokemon/learn_move.asm
  ["WhichMoveToForgetText", 0x01, 0x6D38, true], // engine/pokemon/learn_move.asm
  ["AbandonLearningText", 0x01, 0x6D3D, true], // engine/pokemon/learn_move.asm
  ["DidNotLearnText", 0x01, 0x6D42, true], // engine/pokemon/learn_move.asm
  ["TryingToLearnText", 0x01, 0x6D47, true], // engine/pokemon/learn_move.asm
  ["OneTwoAndText", 0x01, 0x6D4C, true], // engine/pokemon/learn_move.asm
  ["PoofText", 0x01, 0x6D88, true], // engine/pokemon/learn_move.asm
  ["ForgotAndText", 0x01, 0x6D8D, true], // engine/pokemon/learn_move.asm
  ["HMCantDeleteText", 0x01, 0x6D92, true], // engine/pokemon/learn_move.asm
];

// Every TextPointers table of the in-scope maps: [label, bank, address, entries], the count
// read from the ASM (`dw`/`dw_const` lines, `const_def` included). OaksLab and ViridianMart
// switch their map's table to the second one (wCurMapTextPtr) after a story event.
export const TEXT_POINTER_TABLES: readonly (readonly [string, number, number, number])[] = [
  ["BluesHouse_TextPointers", 0x06, 0x5C55, 3],
  ["DiglettsCaveRoute2_TextPointers", 0x07, 0x57C2, 1],
  ["OaksLab_TextPointers", 0x07, 0x4910, 27],
  ["OaksLab_TextPointers2", 0x07, 0x4946, 9],
  ["PalletTown_TextPointers", 0x06, 0x4FAA, 8],
  ["RedsHouse1F_TextPointers", 0x12, 0x4106, 2],
  ["RedsHouse2F_TextPointers", 0x17, 0x40C7, 0],
  ["Route1_TextPointers", 0x07, 0x435C, 3],
  ["Route22_TextPointers", 0x14, 0x5169, 3],
  ["Route2Gate_TextPointers", 0x17, 0x54E1, 2],
  ["Route2TradeHouse_TextPointers", 0x07, 0x57FA, 2],
  ["Route2_TextPointers", 0x15, 0x54FA, 4],
  ["ViridianCity_TextPointers", 0x06, 0x5213, 16],
  ["ViridianForestNorthGate_TextPointers", 0x17, 0x5494, 2],
  ["ViridianForestSouthGate_TextPointers", 0x17, 0x556A, 2],
  ["ViridianForest_TextPointers", 0x18, 0x5112, 16],
  ["ViridianMart_TextPointers", 0x07, 0x4D0D, 5],
  ["ViridianMart_TextPointers2", 0x07, 0x4D17, 3],
  ["ViridianNicknameHouse_TextPointers", 0x07, 0x4DD6, 4],
  ["ViridianPokecenter_TextPointers", 0x11, 0x4263, 5],
  ["ViridianSchoolHouse_TextPointers", 0x07, 0x4D7D, 3],
  // V2 Pewter, scripts/Pewter*.asm.
  ["PewterCity_TextPointers", 0x06, 0x5448, 14],
  ["PewterPokecenter_TextPointers", 0x17, 0x4486, 6],
  ["PewterMart_TextPointers", 0x1D, 0x44F3, 3],
  ["PewterNidoranHouse_TextPointers", 0x07, 0x4E40, 3],
  ["PewterSpeechHouse_TextPointers", 0x07, 0x4E95, 2],
];
