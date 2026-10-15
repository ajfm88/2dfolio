import type { TextProgramsFile, TextPrograms } from '../rom/extractors/text_programs';

let data: TextProgramsFile = { programs: {}, textPointers: {} };
export async function loadTextPrograms(): Promise<void> {
  const response = await fetch('text_programs.json');
  if (!response.ok) throw new Error(`text programs: HTTP ${response.status}`);
  data = await response.json() as TextProgramsFile;
}
export function getTextPrograms(): TextPrograms { return data.programs; }
export function getTextProgramData(): TextProgramsFile { return data; }
