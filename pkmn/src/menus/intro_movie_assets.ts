// Opening checkpoint-12a (note 123): unused until the movie is wired in checkpoint-12b.
import { preloadMusic } from '../audio';
import { getRawImageData } from '../renderer';
import type { YellowIntroData } from '../rom/extractors/yellow_intro';
import type { OpeningImage } from './opening_screen';

export interface IntroMovieAssets {
  objects: OpeningImage;
  background: OpeningImage;
  data: YellowIntroData;
}

/** Warm the two sheets, literal tables and music before boot; the caller owns the resulting assets. */
export async function loadIntroMovieAssets(
  image: (url: string) => Promise<OpeningImage> = getRawImageData,
): Promise<IntroMovieAssets> {
  const [objects, background, response] = await Promise.all([
    image('/gfx/intro/yellow_intro_2.png'),
    image('/gfx/intro/yellow_intro_1.png'),
    fetch('yellow_intro.json'),
    preloadMusic('yellowintro'),
  ]);
  if (!response.ok) throw new Error('Failed to load yellow_intro.json');
  return { objects, background, data: await response.json() as YellowIntroData };
}
