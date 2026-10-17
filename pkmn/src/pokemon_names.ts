/** Matches today's party-menu display. MonsterNames fidelity belongs to V5. */
export function monDisplayName(mon: { nickname: string }): string {
  return mon.nickname.toUpperCase();
}
