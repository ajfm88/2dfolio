import { beforeEach, describe, expect, it } from 'vitest';
import { isPikachuFollowingDisabled, disablePikachuFollowing, enablePikachuFollowing } from './pikachu_following';

beforeEach(() => { enablePikachuFollowing(); });

describe('pikachu_following flag', () => {
  it('starts enabled', () => { expect(isPikachuFollowingDisabled()).toBe(false); });
  it('disable sets flag', () => { disablePikachuFollowing(); expect(isPikachuFollowingDisabled()).toBe(true); });
  it('enable clears flag', () => { disablePikachuFollowing(); enablePikachuFollowing(); expect(isPikachuFollowingDisabled()).toBe(false); });

});
