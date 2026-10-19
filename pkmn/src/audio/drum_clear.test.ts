import { describe, expect, it } from 'vitest';
import { rig, musicData } from '../test/audio_rig';
import { PlaySound } from './play_sound';
import { engineHost } from './request_host';
import { MUSIC_IDS as M, musicNameForSound } from './sound_ids';

// Map-music CP3 item 5 (note 63 §10.11): PlaySound's CHAN5–8 ID clear also drops a music drum
// hit under way (channel 8's occupancy), with no hardware write of its own. Built on the
// production host (engineHost), not the request rig's copy.
function inDrumHit(id: { id: number; bank: number } = M.routes3) {
  const r = rig();
  const clears: number[] = [];
  const base = engineHost(r.synth, r.music, r.sfx, (soundId, bank) => {
    const name = musicNameForSound(soundId, bank);
    if (name) r.music.play(musicData(name));
  });
  const requests = new PlaySound({ ...base, clearSfxIds: () => { clears.push(r.synth.update); base.clearSfxIds(); } });
  requests.noAudioFadeOut = true;
  requests.playMusic(id); r.update();
  for (let n = 0; !r.music.channel8DrumBusy && n < 3000; n++) r.update();
  expect(r.music.channel8DrumBusy).toBe(true);
  return { ...r, requests, clears };
}

describe('the ID clear on a drum-heavy track (Routes3)', () => {
  it('frees channel 8 at once without touching the hardware, and the track plays on', () => {
    const r = inDrumHit();
    r.requests.fadeControl = 10; // a fade is under way, so the new ID queues instead of replacing the song
    r.synth.log = []; const clears = r.clears.length;
    expect(r.requests.playNewSound(M.pkmnhealed.id)).toBe('queued');
    expect(r.clears).toHaveLength(clears + 1);
    expect(r.music.channel8DrumBusy).toBe(false);
    expect(r.synth.log).toEqual([]); // not Audio2_StopAllAudio, not a mute
    const from = r.synth.update; r.run(60);
    expect(r.music.isPlaying()).toBe(true);
    expect(r.synth.at('noise').filter(u => u > from).length).toBeGreaterThan(2); // later drum hits still sound
  });

  it('an ordinary dropped SFX leaves the drum hit alone', () => {
    const r = inDrumHit();
    r.requests.fadeControl = 10; const before = r.clears.length;
    expect(r.requests.playSound(0xb4)).toBe('dropped');
    expect(r.clears).toHaveLength(before); expect(r.music.channel8DrumBusy).toBe(true);
  });

  it('the clear changes nothing but the occupancy: later hits end exactly as in a run that never had one', () => {
    const control = inDrumHit(), cleared = inDrumHit();
    cleared.requests.fadeControl = 10; cleared.requests.playNewSound(M.pkmnhealed.id);
    const a = control.synth.update, b = cleared.synth.update;
    control.run(40); cleared.run(40);
    const noise = (r: typeof control, from: number) => r.synth.log.filter(w => w.m === 'noise' && w.u > from).map(w => w.a.join());
    const c = noise(control, a), d = noise(cleared, b);
    // The freed channel can only start a hit sooner, never drop one
    expect(d.length).toBeGreaterThanOrEqual(c.length);
    expect(d.slice(d.length - c.length)).toEqual(c);
  });
});
