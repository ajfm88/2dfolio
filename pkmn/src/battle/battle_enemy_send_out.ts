// Unused enemy-side ports. pret core.asm:901–927,1315–1482; note70 checkpoint-05b.
import { decodeNick, LINK_STATE_BATTLING, type BattleState } from './battle_state';
import { D } from './battle_end_state';
import { flagAction, hasMonFainted } from './battle_end_helpers';
import { getMonHeader, loadEnemyMonData } from './battle_loaders';
import { loadMonFrontSprite, slideTrainerPicOffScreen, loadHudTilePatterns } from './battle_slides';
import { drawEnemyHud } from './battle_hud_state';
import { displayTwoOptionMenu } from './battle_two_option';
import { playCryCue } from './battle_voice_cues';
import { BattleUnsupportedState } from './battle_move_data';
import { choosePartyForSendOut, clearSendOutSprites, setSendOutBattlePalette, switchPlayerMon,
  type PlayerSendOutHost } from './battle_send_out';
import type { Program } from './battle_menu_context';
import type { BattleRenderTiles, RawImage } from './battle_screen_render';

// Pinned symbols573535d; OAM and sprite-pattern storage stay with the screen/renderer owners.
export const ENEMY_SEND_CELLS = { wEnemyPartySpecies: 0xd89c, wBaseCoordX: 0xd080, wBaseCoordY: 0xd081,
  wHUDPokeballGfxOffsetX: 0xcd3e, wHUDGraphicsTiles: 0xcd3f, wdef4: 0xdef4 } as const;

export interface EnemySendOutHost extends PlayerSendOutHost {
  frontPicture(state: BattleState): string;
  /** The existing renderer's sprite atlas and preloaded committed gfx/battle/balls.png. */
  renderTiles: Pick<BattleRenderTiles, 'sprites'>;
  pokeballTiles: RawImage;
}

type CopyQueue = { copyTiles(total: number, write: (index: number) => void): Generator<void> };

/** draw_hud_pokeball_gfx.asm:9–17,35–120,138–168. One real four-tile copy, then HUD and six OAM writes. */
export function* drawEnemyPokeballs(state: BattleState, host: EnemySendOutHost): Program {
  const atlas = host.renderTiles.sprites, source = host.pokeballTiles;
  const data = new Uint8ClampedArray(atlas.data), across = atlas.width >>> 3, sourceAcross = source.width >>> 3;
  if (!across || !sourceAcross || source.width * source.height < 4 * 64 || atlas.width * atlas.height < 0x35 * 64)
    throw new BattleUnsupportedState('pokeball sprite atlas');
  // Replace the atlas reference when the VBlank copy completes: the renderer caches decoded tiles by image identity.
  for (const _ of (host.screen as unknown as CopyQueue).copyTiles(4, index => {
    const tile = 0x31 + index;
    for (let y=0; y<8; y++) for (let x=0; x<8; x++) for (let component=0; component<4; component++) {
      const src = ((Math.floor(index/sourceAcross)*8+y)*source.width+(index%sourceAcross)*8+x)*4+component;
      const dst = ((Math.floor(tile/across)*8+y)*atlas.width+(tile%across)*8+x)*4+component;
      data[dst] = source.data[src];
    }
    if (index === 3) host.renderTiles.sprites = { width: atlas.width, height: atlas.height, data };
  })) { void _; yield 'serviced'; }
  const e=ENEMY_SEND_CELLS;
  state.setBytes(e.wHUDGraphicsTiles,[0x73,0x74,0x78],3);
  host.screen.put(1,2,0x73); host.screen.put(1,3,0x74);
  for(let x=2;x<10;x++) host.screen.put(x,3,0x76); host.screen.put(10,3,0x78);
  state.mem.fill(0x34,D.wBuffer,D.wBuffer+6);
  const count=state.mem[D.wEnemyPartyCount] || 256;
  for(let slot=0;slot<count;slot++) {
    const base=(D.wEnemyMons+44*slot)&65535;
    const alive=state.mem[(base+1)&65535] | state.mem[(base+2)&65535];
    state.mem[(D.wBuffer+slot)&65535]=!alive?0x33:state.mem[(base+4)&65535]?0x32:0x31;
  }
  state.mem[e.wBaseCoordX]=0x48; state.mem[e.wBaseCoordY]=0x20;
  state.mem[e.wHUDPokeballGfxOffsetX]=0xf8; state.mem[e.wdef4]=1;
  for(let slot=0;slot<6;slot++) {
    host.screen.setOam(6+slot,{ y:state.mem[e.wBaseCoordY],x:state.mem[e.wBaseCoordX],tile:state.mem[D.wBuffer+slot],attributes:1 });
    state.mem[e.wBaseCoordX]=(state.mem[e.wBaseCoordX]-8)&255;
  }
}

/** core.asm:1315–1328. Unlike FirstMon, reset both participation bytes before setting the active player's bits. */
export function* enemySendOut(state: BattleState, host: EnemySendOutHost): Program {
  state.mem[D.wPartyGainExpFlags]=0; flagAction(state,D.wPartyGainExpFlags,1,state.wPlayerMonNumber);
  state.mem[D.wPartyFoughtCurrentEnemyFlags]=0; flagAction(state,D.wPartyFoughtCurrentEnemyFlags,1,state.wPlayerMonNumber);
  yield* enemySendOutFirstMon(state,host);
}

/** core.asm:1331–1482. Enemy arrival precedes the selected player switch. */
export function* enemySendOutFirstMon(state: BattleState, host: EnemySendOutHost): Program {
  state.mem.fill(0,D.wEnemyStatsToDouble,D.wEnemyStatsToDouble+5);
  state.wEnemyDisabledMove=state.wEnemyDisabledMoveNumber=state.wEnemyMonMinimized=0;
  state.mem[D.wPlayerUsedMove]=state.mem[D.wPlayerUsedMove+1]=0;
  state.mem[D.wAICount]=0xff; state.wPlayerBattleStatus1&=~0x20;
  yield* slideTrainerPicOffScreen(state,host.screen,18,0,8);
  yield* host.printText('PrintEmptyString.emptyString'); host.saveScreenTilesToBuffer1();
  if(state.wLinkState===LINK_STATE_BATTLING) throw new BattleUnsupportedState('link');
  let slot=0xff;
  for(;;) {
    slot=(slot+1)&255;
    if(slot===state.wEnemyMonPartyPos) continue;
    state.wWhichPokemon=slot;
    const at=(D.wEnemyMons+44*slot+1)&65535;
    if(state.mem[at] | state.mem[(at+1)&65535]) break;
  }
  state.wCurEnemyLevel=state.mem[D.wEnemyMon1Level+44*slot];
  state.wEnemyMonSpecies2=state.wCurPartySpecies=state.mem[ENEMY_SEND_CELLS.wEnemyPartySpecies+slot];
  loadEnemyMonData(state);
  state.writeBE(D.wLastSwitchInEnemyMonHP,state.wEnemyMonHP);
  state.wCurrentMenuItem=1;
  if(state.wFirstMonsNotOutYet!==1 && state.mem[D.wPartyCount]!==1 && !(state.mem[D.wOptions]&0x40)) {
    yield* host.printText('TrainerAboutToUseText', { trainerName:decodeNick(state.mem,D.wTrainerName),
      enemyMonNick:decodeNick(state.mem,D.wEnemyMonNick) });
    state.mem[D.wTextBoxID]=0x14;
    yield* displayTwoOptionMenu(state,host,0,7,8,1);
    if(state.wCurrentMenuItem===0) {
      state.mem[D.wPartyMenuTypeOrMessageID]=2;
      let choice=yield* choosePartyForSendOut(state,host,true);
      for(;;) {
        state.wCurrentMenuItem=1;
        if(choice.carry) break;
        if(state.wWhichPokemon===state.wPlayerMonNumber) {
          yield* host.partyView.printBattleChoiceText('AlreadyOutText',{battleMonNick:decodeNick(state.mem,D.wBattleMonNick)});
        } else if(!(yield* hasMonFainted(state,{printText:program=>host.partyView.printBattleChoiceText(program)})).zero) {
          state.wCurrentMenuItem=0; break;
        }
        choice=yield* choosePartyForSendOut(state,host,false);
      }
      host.screen.bgp=host.screen.obp0=host.screen.obp1=0;
      yield* loadHudTilePatterns(host.screen); host.loadScreenTilesFromBuffer1();
    }
  }
  clearSendOutSprites(host);
  for(let y=0;y<4;y++) for(let x=0;x<11;x++) host.screen.put(x,y,' ');
  yield* setSendOutBattlePalette(state,host);
  host.screen.bgp=0xe4; host.screen.obp0=0xd0;
  yield* host.printText('TrainerSentOutText',{trainerName:decodeNick(state.mem,D.wTrainerName),
    enemyMonNick:decodeNick(state.mem,D.wEnemyMonNick)});
  state.wCurPartySpecies=state.wCurSpecies=state.wEnemyMonSpecies2; getMonHeader(state,state.wCurSpecies);
  yield* loadMonFrontSprite(host.screen,host.frontPicture(state));
  state.mem[D.hStartTileID]=0xcf; host.sendingOutMon(state,15,6);
  playCryCue(host.voice,state.wEnemyMonSpecies2);
  yield* drawEnemyHud(state,host.screen);
  if(state.wCurrentMenuItem!==0) return;
  state.mem[D.wPartyGainExpFlags]=state.mem[D.wPartyFoughtCurrentEnemyFlags]=0;
  host.saveScreenTilesToBuffer1(); yield* switchPlayerMon(state,host);
}

/** core.asm:901–927. Non-link replacement returns NZ; the rejected link branch precedes exchange writes. */
export function* replaceFaintedEnemyMon(state: BattleState,host:EnemySendOutHost):Program<{zero:boolean}> {
  const old=state.wEnemyHPBarColor; state.wEnemyHPBarColor=0;
  if(old!==0) yield* setSendOutBattlePalette(state,host);
  host.screen.obp0=host.screen.obp1=0xe4;
  yield* drawEnemyPokeballs(state,host);
  if(state.wLinkState===LINK_STATE_BATTLING) throw new BattleUnsupportedState('link');
  yield* enemySendOut(state,host);
  state.wEnemyMoveNum=state.wActionResultOrTookBattleTurn=state.wAILayer2Encouragement=0;
  return {zero:false};
}
