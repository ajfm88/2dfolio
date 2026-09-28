import castawayBeach from './campaign/01-castaway-beach.json';
import crabbyShallows from './campaign/02-crabby-shallows.json';
import spikeRidge from './campaign/03-spike-ridge.json';
import pearlReef from './campaign/04-pearl-reef.json';
import starfallCliffs from './campaign/05-starfall-cliffs.json';
import cannonCove from './campaign/06-cannon-cove.json';

/**
 * The campaign in play order. Each file is a level exported from the maker (Export
 * file); `campaign.test.js` holds them to that.
 *
 * `id` is the progress key, and it overrides the file's own id, so a tuned level
 * re-exported from the maker drops in unchanged. It stays with its level, not its
 * position, if the order ever changes.
 *
 * @type {{ id: string, data: import('../types.js').LevelData }[]}
 */
export const campaign = [
  { id: 'campaign_01', data: castawayBeach },
  { id: 'campaign_02', data: crabbyShallows },
  { id: 'campaign_03', data: spikeRidge },
  { id: 'campaign_04', data: pearlReef },
  { id: 'campaign_05', data: starfallCliffs },
  { id: 'campaign_06', data: cannonCove },
];
