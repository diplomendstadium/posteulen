/** v1.1: the teams of the post office (SPEC 9.6) for the help, e.g. "A: Sperbereule, …". */
import { LOAN_TEAMS, speciesName } from '../species.ts';

export function teamList(language: 'de' | 'en'): string {
  return Object.entries(LOAN_TEAMS)
    .map(
      ([team, species]) => `${team}: ${species.map((id) => speciesName(id, language)).join(', ')}`,
    )
    .join('; ');
}
