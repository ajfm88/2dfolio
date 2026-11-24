/**
 * Audio2_PlaySound's battle-only adapter (audio/engine_2.asm:39–85).
 *
 * It owns the battle SFX IDs. CHAN5 deliberately reads/writes the low-health alarm
 * owner: the alarm, sound waits, and music suppression must see one byte, not copies.
 */
import { lowHealthAlarm, lowHealthChannel5, setLowHealthChannel5 } from '../audio/low_health_alarm';
import type { SfxData, SfxEngine } from '../audio/sfx_engine';
import type { MusicEngine } from '../audio/music_engine';
import type { PlaySound } from '../audio/play_sound';
import { soundFinished } from '../audio/sound_wait';
import { acceptsSfxChannel } from '../audio/sfx_priority';
import { isCry, sfxModifiers, sfxModifierState } from '../audio/sfx_modifiers';
import type { Program } from './battle_menu_context';

export interface BattleSfx {
  id: number;
  data: SfxData;
}

export class BattleAudio {
  private readonly banks: Pick<PlaySound, 'audioBank' | 'savedAudioBank'>;
  get audioBank(): number { return this.banks.audioBank; }
  set audioBank(value: number) { this.banks.audioBank = value & 0xff; }
  get savedAudioBank(): number { return this.banks.savedAudioBank; }
  set savedAudioBank(value: number) { this.banks.savedAudioBank = value & 0xff; }
  muteAudioAndPauseMusic = 0;
  get frequencyModifier(): number { return sfxModifierState.frequency; }
  set frequencyModifier(value: number) { sfxModifierState.frequency = value & 0xff; }
  get tempoModifier(): number { return sfxModifierState.tempo; }
  set tempoModifier(value: number) { sfxModifierState.tempo = value & 0xff; }
  private readonly ids = new Map<number, number>([[6, 0], [7, 0], [8, 0]]);
  private restoreHooks: (() => void) | null = null;

  constructor(private readonly sfx: SfxEngine, private readonly music: MusicEngine,
    banks: Pick<PlaySound, 'audioBank' | 'savedAudioBank'> = { audioBank: 8, savedAudioBank: 8 }) {
    this.banks = banks;
    const previous = { done: sfx.onSfxChannelDone, enabled: sfx.channelEnabled,
      note: sfx.beforeNextNote, cleared: sfx.onSoundIdsCleared, control: music.audioControl };
    this.restoreHooks = () => {
      sfx.onSfxChannelDone = previous.done; sfx.channelEnabled = previous.enabled;
      sfx.beforeNextNote = previous.note; sfx.onSoundIdsCleared = previous.cleared;
      music.audioControl = previous.control;
    };
    const prior = sfx.onSfxChannelDone;
    sfx.onSfxChannelDone = channel => { prior?.(channel); this.complete(channel); };
    sfx.channelEnabled = channel => this.channelId(channel) !== 0;
    sfx.beforeNextNote = channel => {
      if (channel !== 5 || (lowHealthAlarm() & 0x80) === 0) return false;
      // Audio1_PlayNextNote: enable output and return WITHOUT consuming sound_ret.
      sfx.enableChannelOutput(0);
      return true;
    };
    sfx.onSoundIdsCleared = () => this.clearIds();
    music.audioControl = { getMute: () => this.muteAudioAndPauseMusic,
      setMute: value => { this.muteAudioAndPauseMusic = value; } };
  }

  /** Return the page's engines to their exact previous owners; safe to call twice. */
  dispose(): void { this.restoreHooks?.(); this.restoreHooks = null; }

  channelId(channel: number): number {
    if (channel === 5) return lowHealthChannel5();
    if (channel === 8 && this.music.channel8DrumBusy) return this.music.channel8DrumId;
    return this.ids.get(channel) ?? 0;
  }

  /** CPU ID clear only: unlike sound_ret, this neither mutes hardware nor releases music. */
  clearIds(): void {
    setLowHealthChannel5(0);
    this.ids.set(6, 0); this.ids.set(7, 0); this.ids.set(8, 0);
    // Clearing wChannelSoundIDs stops software updates and releases music suppression,
    // but InitSFXVariables/this path must not perform sound_ret's hardware mute.
    this.sfx.clearChannelsForPriority([5, 6, 7, 8]);
    this.music.cancelDrum();
  }

  /**
   * The header is visited backwards. InitSFXVariables happens immediately for every
   * accepted entry; a later rejection returns before the common path writes new IDs.
   */
  play(sound: BattleSfx): boolean {
    for (const channel of [...sound.data.channels].reverse()) {
      const old = this.channelId(channel.id);
      if (!this.accepts(channel.id, sound.id, old)) return false;
      this.sfx.clearChannelsForPriority([channel.id]);
      if (channel.id === 8) this.music.cancelDrum();
      this.setId(channel.id, 0);
    }
    // This point is Audio2_PlaySound.playSoundCommon: all headers were accepted.
    const modifiers = () => sfxModifiers(this.channelId(5), this.channelId(8), this.audioBank);
    if (isCry(sound.id)) {
      for (const channel of [5, 6, 7, 8]) this.setId(channel, sound.id);
      this.sfx.installCry(sound.data, modifiers, () => isCry(this.channelId(5)), true);
      return true;
    }
    for (const channel of sound.data.channels) this.setId(channel.id, sound.id);
    this.sfx.installBattleSfx(sound.data, modifiers);
    return true;
  }

  /** learn_move.asm:214–237. The caller services every yielded frame with its audio owner. */
  *playSwap(sound: BattleSfx): Program<boolean> {
    this.muteAudioAndPauseMusic = 1;
    yield 'serviced';
    const saved = this.audioBank;
    this.audioBank = this.savedAudioBank = 0x02;
    while (!soundFinished(this.sfx, this.music, 0)) yield 'serviced';
    const played = this.play(sound);
    while (!soundFinished(this.sfx, this.music, 0)) yield 'serviced';
    this.audioBank = this.savedAudioBank = saved;
    this.muteAudioAndPauseMusic = 0;
    return played;
  }

  private accepts(channel: number, incoming: number, old: number): boolean {
    return acceptsSfxChannel(channel, incoming, old);
  }

  private setId(channel: number, id: number): void {
    if (channel === 5) setLowHealthChannel5(id); else this.ids.set(channel, id & 0xff);
  }

  private complete(channel: number): void {
    // sound_ret clears only its own ID; an intervening new sound keeps its ID intact.
    if (!this.sfx.isChannelActive(channel - 5)) this.setId(channel, 0);
  }
}
