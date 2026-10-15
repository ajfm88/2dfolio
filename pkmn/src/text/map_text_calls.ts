import { getTextProgramData } from './program_data';
import type { TextProgramsFile } from '../rom/extractors/text_programs';

/** Current map's TextPointers label; Lab/Mart have source-selected second tables. */
export function mapTextTable(mapName: string, alternate = false): string {
  return `${mapName}_TextPointers${alternate ? '2' : ''}`;
}
export function mapTextKind(mapName: string, textId: number | undefined,
  data: TextProgramsFile = getTextProgramData(), alternate = false): 'text' | 'printText' | undefined {
  const call = mapTextCall(mapName, textId, data, alternate);
  return call?.call === 'text' || call?.call === 'printText' ? call.call : undefined;
}
export function mapTextCall(mapName: string, textId: number | undefined,
  data: TextProgramsFile = getTextProgramData(), alternate = false) {
  if (textId === undefined) return undefined;
  return data.textPointers[mapTextTable(mapName, alternate)]?.[textId - 1];
}
