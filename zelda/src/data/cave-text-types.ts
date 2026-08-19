export interface CaveTextMessage {
  readonly index: number;
  readonly textSelector: number;
  readonly lines: readonly string[];
}

export interface CaveTextData {
  readonly messages: readonly CaveTextMessage[];
}
