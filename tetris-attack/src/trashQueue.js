class TrashQueue {
  constructor(receivingGame) {
    this.pendingTrash = []
    this.receivingGame = receivingGame;
  }

  addTrash(trashBlock) {
    this.pendingTrash.push(trashBlock);
  }

  flush() {
    if (this.receivingGame) {
      this.pendingTrash.forEach(t => this.receivingGame.board.addTrashBlock(t));
    }
    this.pendingTrash = [];
  }
}

export { TrashQueue };