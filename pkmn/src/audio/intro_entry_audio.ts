// Unused entry timing owner. The reviewed foreground publishes at the native PlayMusic store points.
import { introMusicUpdateCycles } from './intro_music_timing';
import { introSetupAudioCycles, INTRO_SETUP_SOUND_ID } from './intro_setup_audio_timing';
import { INTRO_YELLOW_MUSIC_ID } from '../menus/intro_helper_timing';
import type { IntroAudioOwner, IntroAudioPredictor, IntroAudioPublication } from '../menus/intro_foreground_runner';
import type { MusicData, MusicEngine } from './music_engine';
import type { SfxEngine } from './sfx_engine';

export class IntroEntryAudio implements IntroAudioOwner {
  version = 0;

  constructor(
    private readonly music: MusicEngine,
    private readonly sfx: SfxEngine,
    private readonly song: MusicData,
    private readonly audioBank: number,
    private readonly lowHealthAlarm: number,
  ) {}

  selectPredictor(): IntroAudioPredictor {
    return this.music.isPlaying() ? 'movie' : 'setup';
  }

  forecast(predictor: IntroAudioPredictor): number {
    if (predictor === 'movie') return introMusicUpdateCycles(this.music, this.song);
    return introSetupAudioCycles({
      music: this.music,
      sfx: this.sfx,
      channel5SoundId: this.sfx.observeChannel(5)?.active ? INTRO_SETUP_SOUND_ID : 0,
      audioBank: this.audioBank,
      lowHealthAlarm: this.lowHealthAlarm,
    });
  }

  update(): void {
    this.music.tick(this.sfx);
    this.sfx.tick();
    this.version++;
  }

  publish(kind: IntroAudioPublication, field: string, value: number): void {
    const channel = Number(/^wChannelSoundIDs\.(\d)$/.exec(field)?.[1]);
    if (kind === 'setup-sfx-cleared') {
      if (value !== 0 || ![5, 6, 7, 8].includes(channel)) throw new RangeError('Invalid intro SFX publication');
      this.sfx.clearChannelsForPriority([channel]);
    } else {
      if (value !== INTRO_YELLOW_MUSIC_ID || ![1, 2, 3].includes(channel)) throw new RangeError('Invalid intro music publication');
      if (!this.music.isPlaying()) {
        this.music.play(this.song);
        // The existing engine loads the entire song. Only channels whose IDs have been stored may tick.
        for (const { id } of this.song.channels) this.music.getChannel(id)!.active = false;
      }
      this.music.getChannel(channel)!.active = true;
    }
    this.version++;
  }
}
