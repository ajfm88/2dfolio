# Unit 12 — Audio

## What This Unit Builds

A single `AudioContext` audio engine in `core/audio.js`: decoded CC0 buffers,
unlock on the first user gesture, one-shot SFX playback, looping music with a
fade on scene change, and master music/sfx volume controls. Six sound effects
wired to gameplay events — jump, coin pickup, damage taken, shooter fire and
enemy stomp — plus background music that loops during play.

**Depends on:** Unit 11.

## The Audio Files

Seven CC0 files are already packed by Unit 01 into `public/assets/audio/`. This
unit adds no new assets and does not touch `tools/` or `public/assets/`.

| File | Size | SPW usage | Our usage |
| --- | --- | --- | --- |
| `jump.wav` | 24 KB | `player.py` floor jump + wall jump | Player jump |
| `coin.wav` | 36 KB | `level.py` item pickup | Collectible pickup |
| `damage.wav` | 58 KB | `level.py` hit collision | Player takes damage |
| `pearl.wav` | 91 KB | `level.py` create_pearl | Shooter fires |
| `hit.wav` | 9 KB | *not used by SPW* | Enemy stomped |
| `attack.wav` | 34 KB | `player.py` sword attack | *unused in v1* |
| `starlight_city.mp3` | 2.5 MB | `main.py` bg music, looped at 0.5 vol | Background music |

`attack.wav` stays unused — sword combat is out of scope. `hit.wav` is a short
impact sound that SPW packed but never played; it fits the stomp-to-kill event
that SPW did not have. That is a new assignment, not a port.

## Architecture

`core/audio.js` sits beside `loop.js`, `viewport.js`, `camera.js` and
`input.js`. Like them it is an engine service: it manages a browser API, knows
nothing about pirates, and imports nothing from `data/`, `game/`, `level/`,
`maker/`, `ui/` or `storage/` (invariant 11). It does not touch `document` —
only `core/input.js` and `core/viewport.js` may do that.

```
AudioBufferSourceNode ─→ perPlayGain ─→ sfxGain ─→ destination
AudioBufferSourceNode (loop) ─→ musicGain ─→ destination
```

- Two master `GainNode`s: `sfxGain` (controls the user's SFX volume) and
  `musicGain` (controls the user's music volume). Both connect to
  `ctx.destination`.
- **SFX**: each `playSfx` call creates an `AudioBufferSourceNode`, connects it
  through a per-play `GainNode` (the sound's own mix level) into `sfxGain`, and
  calls `start()`. The source auto-disposes after playback; no manual cleanup
  and no pooling needed — Web Audio handles concurrent plays natively.
- **Music**: one `AudioBufferSourceNode` with `loop: true`, connected through
  `musicGain`. `playMusic` fades in; `stopMusic` fades out using
  `linearRampToValueAtTime` on the gain — no JS timer in the game loop.
- **Unlock**: `AudioContext` begins suspended (watchlist item 2). The audio
  module exposes `resume()`, which the App wires to `input.onFirstGesture` so
  the `ctx.resume()` call lands inside the user gesture call stack.

Volume persistence is Unit 17 (the settings store does not exist yet). This unit
exposes volume getters/setters that default to sensible values; the App can pass
initial values once Unit 17 provides them.

## Deliverables

### `src/core/audio.js` — the audio engine

```js
export function createAudio()
```

Returns an audio handle. Every method is safe to call at any time — before
`load` completes, while the context is suspended, or after a failed load. This
removes every need for callers to guard audio availability.

#### `async load(manifest)`

`manifest` is `Record<string, { src: string, volume?: number }>`. Fetches each
`src` via `fetch`, decodes the `arrayBuffer` with `ctx.decodeAudioData`, stores
the resulting `AudioBuffer` keyed by its id. The optional `volume` (0–1,
default 1.0) is the sound's authored mix level, stored alongside the buffer.

Creates the `AudioContext` lazily inside `load` — never before. iOS Safari
requires context creation to follow a user gesture or to happen before the first
`resume`; creating it inside `load` (which the App calls on boot, before any
gesture) is fine because the context starts suspended and `resume` is called
later from the gesture.

If any single fetch or decode fails, log it and continue — a missing sound
degrades to silence, never to a thrown error.

#### `resume()`

Calls `ctx.resume()` if the context exists and is `'suspended'`. Safe to call
multiple times; safe if the context is already running. Returns the promise from
`ctx.resume()` so the caller can await it if it wants (but none does in this
unit).

#### `playSfx(id)`

If the buffer for `id` is not loaded, or the context is not running, return
silently. Otherwise:

```js
const source = ctx.createBufferSource();
source.buffer = buffers.get(id);
const gain = ctx.createGain();
gain.gain.value = sfxVolume * soundVolume;   // master × authored mix
gain.connect(ctx.destination);
source.connect(gain);
source.start();
```

No explicit teardown — `AudioBufferSourceNode` becomes eligible for GC once it
finishes. No cap on concurrent plays: the game's natural event density (a jump
or a coin every few hundred milliseconds) never produces cacophony. If it does,
a later polish pass can cap per-id concurrency; building it speculatively is
overengineering.

#### `playMusic(id)`

If the same track is already playing, no-op. If a different track is playing,
crossfade: fade the old track's gain to 0 over `FADE_MS` (500 ms), then stop
it; simultaneously start the new track at gain 0 and ramp to `musicVolume` over
`FADE_MS`. If nothing is playing, start the new track at gain 0 and ramp to
`musicVolume`.

The music source node is `loop: true`. Keep a reference to the current music
source and its gain so `stopMusic` and `playMusic` can manipulate them.

#### `stopMusic(fadeMs?)`

Fade the current music gain to 0 over `fadeMs` (default `FADE_MS`), then call
`source.stop()`. Clear the current-music reference. Safe when nothing is
playing.

#### `sfxVolume` / `musicVolume` (get / set)

Getter returns the current value. Setter clamps to `[0, 1]` and updates the
master `GainNode.gain.value`. The music setter also adjusts a currently playing
track's gain immediately, so the slider feels instant.

Default values: `sfxVolume = 0.7`, `musicVolume = 0.4`.

#### Constants (module-level, not exported)

```js
const FADE_MS = 500;
```

### `src/core/input.js` — first-gesture callback

Add an `onFirstGesture(cb)` API, symmetrical with the existing
`onTouchDetected(cb)`. A `gestured` flag starts false. In both `onKeyDown` and
`onPointerDown`, when the flag is false, set it true and invoke every registered
callback **synchronously** — this keeps `AudioContext.resume()` inside the
browser's user-gesture call stack, which is what makes the unlock work. After
firing, clear the callback array (identical to how `onTouchDetected` clears
`touchCbs` once fired).

`onFirstGesture` returns an unsubscribe function. If the gesture has already
happened, invoke the callback immediately and return a no-op unsubscribe.

The existing `onTouchDetected` is not changed, because it fires on the first
**touch** specifically, not on any gesture (keyboard does not count as touch).
Both can coexist.

### `src/data/sounds.js` — audio manifest

A declarative sound map. Analogous to `palette.js` and `themes.js`: pure data,
no behaviour.

```js
export const sounds = {
  jump:   { src: '/assets/audio/jump.wav' },
  coin:   { src: '/assets/audio/coin.wav', volume: 0.4 },
  damage: { src: '/assets/audio/damage.wav', volume: 0.6 },
  pearl:  { src: '/assets/audio/pearl.wav', volume: 0.8 },
  hit:    { src: '/assets/audio/hit.wav', volume: 0.7 },
  music:  { src: '/assets/audio/starlight_city.mp3' },
};
```

Per-sound `volume` (0–1, default 1.0) is the **authored mix level** — how loud
this sound is relative to others at the same master SFX volume. SPW sets
`coin_sound.set_volume(0.4)` and `damage_sound.set_volume(0.5)` for the same
reason: coin plays frequently and should stay subtle; damage is important
feedback but not startling. The values above are starting points; adjust during
the play-test verification.

`attack.wav` is deliberately absent — it is the sword combat sound and has no
trigger in v1.

Music has no authored `volume` because the master `musicVolume` (0.4 default)
handles the balance; the music buffer plays at 1.0 through `musicGain`.

### `src/main.js` — create and wire audio

1. Import `createAudio` from `core/audio.js` and `sounds` from `data/sounds.js`.
2. Create the audio handle at the top, alongside viewport and input.
3. Call `audio.load(sounds)` in parallel with `loadAtlas(atlasJson)` — both are
   independent fetches. The game starts as soon as the atlas loads; audio loading
   may finish slightly later, and `playSfx` is a silent no-op until then.
4. Wire `input.onFirstGesture(() => audio.resume())`.
5. Pass `audio` to the play scene through `enterLevel` params.

```js
const audio = createAudio();
input.onFirstGesture(() => audio.resume());

Promise.all([
  loadAtlas(atlasJson),
  audio.load(sounds),
]).then(([loaded]) => {
  atlas = loaded;
  enterLevel();
}).catch((err) => {
  console.error('Failed to load:', err);
});
```

The `audio` object itself is passed to the scene, but `main.js` is the only
module that calls `audio.load` and `audio.resume`. Scenes and entities interact
through `playSfx` and `playMusic` / `stopMusic` only.

### `src/game/play-scene.js` — music lifecycle and audio threading

The scene receives `audio` in its params (alongside level, theme, atlas, etc.).

- **`enter`**: after `createWorld`, call `audio.playMusic('music')`. If the
  context is still suspended (no gesture yet), `playMusic` is a no-op; the
  music will start once `resume()` is called. This is the correct degradation:
  the player hears nothing until they interact, then the music fades in.
- **`exit`**: call `audio.stopMusic()` to fade out.
- **Pass `playSfx` into `createWorld`**: `audio.playSfx` becomes the fifth
  argument. The scene is the bridge between the engine's audio and the game's
  world — it knows both, so neither has to import the other.

Update `PlaySceneParams` to include `audio` typed as the return of
`createAudio`.

### `src/game/world.js` — `playSfx` on the handle

`createWorld` gains a fifth parameter:

```js
export function createWorld(level, theme, atlas, keys, playSfx = () => {}) {
```

The default no-op means existing callers (tests) work unchanged.

1. Put `playSfx` on the world handle alongside `atlas`, `level`, `player`,
   `stats`, `spawnFx` and `spawnEntity`.
2. Pass `playSfx` to the `Player` constructor as a sixth argument.

### `src/game/player.js` — jump sound

The constructor gains a sixth parameter `playSfx = () => {}` (same no-op
default so tests work). Store it as `this.playSfx`.

In `doJump()` — the existing method that applies the jump velocity and is
called from both the floor-jump and wall-jump paths — add one line at the top:

```js
this.playSfx('jump');
```

This fires on every jump: floor, wall, and buffered. SPW plays `jump_sound` in
both the floor and wall jump paths of `player.py move()`, so this is a direct
port.

### `src/game/collectibles.js` — pickup sound

In `Collectible.update()`, inside the existing `intersects` block (where
`alive` is set to false and the fx clip is spawned), add:

```js
this.world.playSfx('coin');
```

**All** collectibles play `coin.wav` — coins, diamonds, skull and potions. SPW
uses one `coin_sound` for all items. The audio is a small chime that reads as
"you picked something up", not literally "a coin fell".

The `WorldHandle` typedef gains `playSfx: (id: string) => void`.

### `src/game/hazards/spikes.js` — damage sound

In `Spikes.update()`, where `stats.hurt()` is called, use its return value:

```js
if (this.world.stats.hurt(tuning.hazardDamage)) {
  this.world.playSfx('damage');
}
```

`stats.hurt()` already returns `true` when damage is applied and `false` when
blocked by invulnerability. The sound plays only on real damage — no stuttering
sound when the player grinds on spikes during invuln.

The local `WorldHandle` typedef gains `playSfx`.

### `src/game/entities/walker-enemy.js` — stomp and damage sounds

In `WalkerEnemy.touchPlayer()`, two triggers:

1. **Stomp** — inside the `fromAbove && stompable && intersects` block, after
   `player.bounce()` and before `this.enter('dying')`:
   ```js
   this.world.playSfx('hit');
   ```

2. **Contact damage** — inside the `damages && intersects(damageBox)` block,
   wrap the existing `stats.hurt()` call to check its return:
   ```js
   if (this.world.stats.hurt(tuning.hazardDamage)) {
     this.world.playSfx('damage');
   }
   ```

The local `WorldHandle` typedef gains `playSfx`.

### `src/game/hazards/shooter.js` — fire sound

In the `Shooter` update's fire-frame block — the one guarded by
`Math.floor(this.frameIndex) === entry.fireFrame && !this.hasFired` — add:

```js
this.world.playSfx('pearl');
```

Both the Cannon and the Seashell play `pearl.wav`. SPW plays `pearl_sound` in
`create_pearl` (which only the Shell calls), and the sound is a generic
projectile-launch whoosh, not literally a pearl pop. It reads correctly for a
cannonball too. If separate fire sounds are ever wanted, that is a new audio
asset, not a code change.

The local `WorldHandle` typedef gains `playSfx`.

### `src/game/hazards/projectile.js` — impact damage sound

In `Projectile.update()`, where the player-overlap check calls `stats.hurt()`,
use its return:

```js
if (this.world.stats.hurt(tuning.hazardDamage)) {
  this.world.playSfx('damage');
}
```

The sound plays only when the projectile actually deals damage, not when it hits
an invulnerable player. The projectile still dies either way (it already did).

The local `WorldHandle` typedef gains `playSfx`.

### Tests

**No new test file.** `core/audio.js` wraps the Web Audio API, which is not
available in Vitest's Node environment. Testing it would require mocking the
entire `AudioContext` graph, which would test the mock, not the audio. Audio is
verified by running the game — the same rule that applies to rendering, DOM and
scenes (code standards § Testing).

**Existing tests must pass unchanged.** The only signatures that change are
`createWorld` and `Player`, both of which gain an optional parameter with a
no-op default. Every test that calls them without the new parameter continues to
work. Run `npm test` and assert the same 155 passing.

### `src/data/sounds.js` location

`data/` is "declarative data with no behaviour beyond factory references"
(architecture doc). A manifest of `{ id → path + volume }` is exactly that. It
parallels `palette.js` (entity registry), `themes.js` (theme data) and
`tuning.js` (gameplay numbers).

## Sound trigger summary

| Event | Sound id | Trigger module | Trigger line | SPW equivalent |
| --- | --- | --- | --- | --- |
| Player jumps (floor or wall) | `jump` | `player.js` | `doJump()` | `player.py move()` both branches |
| Collectible picked up | `coin` | `collectibles.js` | `update()` overlap block | `level.py item_collision()` |
| Player takes damage (spikes) | `damage` | `spikes.js` | `update()` hurt block | `level.py hit_collision()` |
| Player takes damage (walker) | `damage` | `walker-enemy.js` | `touchPlayer()` damage block | `level.py hit_collision()` |
| Player takes damage (projectile) | `damage` | `projectile.js` | `update()` overlap block | `level.py hit_collision()` |
| Shooter fires | `pearl` | `shooter.js` | fire-frame guard block | `level.py create_pearl()` |
| Enemy stomped to death | `hit` | `walker-enemy.js` | `touchPlayer()` stomp block | *new — SPW has no stomp* |
| Background music starts | `music` | `play-scene.js` | `enter()` | `main.py bg_music.play(-1)` |
| Background music stops | — | `play-scene.js` | `exit()` | *no equivalent — SPW never stops* |

## Music behaviour

v1 has one music track. The system supports any number (the manifest is
extensible, and `playMusic(id)` crossfades), but only `'music'` is loaded now.

- **Scene enter**: `audio.playMusic('music')`. If the context is still
  suspended (no user gesture yet), the call is buffered — `resume()` will start
  it when triggered. The player never needs to tap twice.
- **Scene exit** (death restart or future scene switch): `audio.stopMusic()`.
  A 500 ms fade-out prevents the music from cutting sharply.
- **Re-enter** after death: `playMusic('music')` is called again. If the track
  faded out, it fades back in. If it's still fading, the new call cancels the
  fade and ramps back up. A rapid death-restart loop doesn't produce silence
  gaps — the music stays up because `playMusic` with the same id is a no-op
  when the track is still audible.

**Actually, music should not restart on death.** The current restart flow is:
`scene.unmountUI()` → `scene.exit()` → `enterLevel()` → `scene.enter()`. If
`exit` fades the music and `enter` fades it back in, the player hears a brief
dip on every death. That's bad. So: **`stopMusic` is called only on a true
scene change** (future: transitioning to level select or the maker), **not on
death/restart**. The play scene's `exit` can take a parameter or the App can
manage the distinction. For now, since the only "scene change" is death/restart
within the same scene, the simplest correct behaviour is:

- `enter`: if music is not already playing, start it.
- `exit`: no-op on music. The App or a future scene manager calls `stopMusic`
  when leaving play mode entirely.
- This means `playMusic('music')` is called on every enter, and its
  same-track-no-op guard makes the re-enter free.

## Not Built

- `attack.wav` usage. Sword combat is out of scope.
- Volume persistence to `localStorage`. Unit 17 builds the settings store;
  this unit exposes the getters/setters it will read.
- Volume sliders in the settings UI. Unit 19.
- A different music track per theme, per level, or for the maker.
- Positional or panned audio.
- Music ducking during pause (the music simply keeps playing while paused; a
  volume duck is polish if ever wanted).
- `AudioWorklet` or any streaming decoder. The CC0 files are small enough to
  decode in full.
- An audio sprite sheet. Seven separate files total ~2.8 MB; the atlas pattern
  (many strips) is for sprites where there are hundreds. Audio has seven.
- Changes to `tools/`, `public/assets/`, `atlas.json`, `schema.js`, `codec.js`,
  `autotile.js`, `parallax.js`, `render.js`, `stats.js`, `flag.js`, or any CSS.

## Docs To Update In The Same Change

- **`context/2-architecture.md`**
  - Stack table: add `Audio | Web Audio API | Decoded buffers, one AudioContext,
    pooled sfx, looping music, volumes`.
  - `src/core/` description: add `audio` to the list of engine modules.
  - Health and Coins section: note that `playSfx` is on the world handle,
    alongside `spawnFx` and `spawnEntity`.
  - Entity Registry: note that the spawn handle carries `playSfx`.
- **`context/4-code-standards.md`**
  - § File Organization: add `audio.js` to `src/core/`, add `sounds.js` to
    `src/data/`.
  - § Async: note that `audio.load` is an async boot call, like atlas loading.
- **`context/6-progress-tracker.md`** — mark Unit 12 complete with decisions.
- **`context/7-current-issues.md`** — log anything found and not fixed.

## Verification Checklist

- [ ] `npm test` — 155 prior, all passing unchanged (no new test file; no
      parameter change breaks existing calls)
- [ ] `npm run build` — no errors
- [ ] **AudioContext unlock**: on a fresh load (hard refresh), the first
      keypress or tap starts audio. Before that, no sound plays and no console
      error appears. Verified in Chrome and Firefox (Safari if available).
- [ ] **Jump sound** plays on every floor jump and every wall jump, once per
      jump, not on landing
- [ ] **Coin sound** plays on every collectible pickup (coins, diamonds, skull,
      potions) — one chime per item
- [ ] **Damage sound** plays when the player takes damage from spikes, from an
      enemy, or from a projectile — once per hit, not during invulnerability
      (standing on spikes while invulnerable is silent)
- [ ] **Fire sound** plays once per shooter fire cycle (not six times per frame
      3), for both Cannon and Seashell
- [ ] **Stomp sound** plays when an enemy is stomped to death
- [ ] **Background music** starts on the first level enter, loops seamlessly,
      and does not restart or dip on death/restart
- [ ] Setting `sfxVolume` to 0 silences all effects; setting `musicVolume` to 0
      silences the music. Neither produces an error or a stall.
- [ ] No console errors or warnings during a normal run
- [ ] No frame-time regression — audio plays fire-and-forget; nothing in the
      update or render loop waits on audio
- [ ] Verified at a phone-sized viewport (touch controls + audio) and a desktop
      viewport (keyboard + audio)
- [ ] Everything from Units 07–11 still behaves: pit, water, flag, wall-jump,
      coyote, buffer, drop-through, treasure, spikes, all three enemies, all
      shooters, HUD, touch controls
- [ ] Docs above updated in the same change
