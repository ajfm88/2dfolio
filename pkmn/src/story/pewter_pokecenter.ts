import { registerTextHandler, displayTextID } from './text_handlers';
import { fadeOutAndStopMusic } from '../audio';
import { isStarterPikachu } from '../pikachu/pikachu_follower';
import { disablePikachuFollowing } from '../pikachu/pikachu_following';

// PewterPokecenter text_id 3: the Jigglypuff song (pokecenter.asm:5, _PewterJigglypuff_).
// The Jigglypuff spins through DOWN→LEFT→UP→RIGHT every 24 frames while CHAN1+CHAN2 are
// active; the first exit check is at S+408 (17 total image writes). Afterwards, if the
// starter is alive and healthy, DisablePikachuFollowingPlayer is set.
registerTextHandler('PewterPokecenter', 3, ctx => {
  const party = ctx.party;
  return displayTextID([
    { type: 'printText', program: 'PewterJigglypuff.Text', box: 'new' },
    { type: 'callback', fn: () => { fadeOutAndStopMusic(0); } },
    { type: 'wait', frames: 32 },
    { type: 'jigglypuffSpin', npcId: 'jigglypuff' },
    { type: 'wait', frames: 48 },
    { type: 'restoreMapMusic', waitForCurrent: true },
    { type: 'callback', fn: () => {
      const starter = party.find(isStarterPikachu);
      if (starter && starter.currentHp > 0 && !starter.status) disablePikachuFollowing();
    } },
  ], { outerWait: false });
});
