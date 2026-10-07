/** wPikachuFollowCommandBuffer: size is the newest index, $ff when empty. */
export class PikachuFollowBuffer {
  private readonly commands: number[] = [];
  private warned = false;

  get size(): number { return this.commands.length ? this.commands.length - 1 : 0xff; }
  get length(): number { return this.commands.length; }
  get newest(): number { return this.commands[this.commands.length - 1] ?? 0; }
  get newestQueued(): number { return this.commands.length >= 2 ? this.newest : 0; }
  get fast(): boolean { return this.commands.length >= 3; }

  clear(): void { this.commands.length = 0; }

  append(command: number): void {
    // A guard only: native overflow writes adjacent WRAM, which we cannot reproduce.
    if (this.commands.length === 16) {
      if (!this.warned) console.warn('Pikachu follow buffer overflow');
      this.warned = true;
      return;
    }
    this.commands.push(command);
  }

  /** Func_fcc92 retains the last command for idling; it cannot execute alone. */
  pop(): number | null {
    return this.commands.length >= 2 ? this.commands.shift()! : null;
  }
}
