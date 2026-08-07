export interface OverworldScreen {
  readonly id: number;
  readonly row: number;
  readonly col: number;
  readonly uniqueRoomId: number;
  readonly tiles: readonly (readonly number[])[];
}

export interface SquareTable {
  readonly primary: readonly number[];
  readonly secondary: readonly (readonly number[])[];
}

export interface OverworldData {
  readonly screens: readonly OverworldScreen[];
  readonly squareTable: SquareTable;
}
