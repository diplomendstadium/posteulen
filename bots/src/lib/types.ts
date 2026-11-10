/** v0.8: what the control-centre API returns (backend/src/central/routes.ts). */
export interface Numbers {
  readonly sent: number;
  readonly delivered: number;
  readonly read: number;
  readonly replies: number;
}

export interface BotView {
  readonly id: string;
  readonly name: string;
  readonly state: 'draft' | 'active' | 'paused';
  readonly character: string;
  readonly home: { lat: number; lon: number } | null;
  readonly owlMode: 'own' | 'loan';
  readonly owlSpecies: string | null;
  readonly owlName: string | null;
  readonly owlSex: 'f' | 'm';
  readonly motivation: number;
  readonly restHours: number;
  readonly playerOwls: boolean;
  readonly problems: string[];
  readonly stats: { total: Numbers; recent: Numbers };
  readonly planned: number;
}

export interface LetterTexts {
  first: string;
  follow: string;
}

export interface EventLetter {
  parchment: 'small' | 'large';
  owlMode: 'default' | 'own' | 'loan';
  texts: { de: LetterTexts; en: LetterTexts };
  media: string[];
}

export type EventGift = { gold: number } | { species: string } | null;

export interface EventView {
  readonly id: string;
  readonly dueAt: number;
  readonly state: 'planned' | 'running' | 'archived' | 'skipped';
  readonly move: { lat: number; lon: number } | null;
  readonly letter: EventLetter | null;
  readonly gift: EventGift;
  readonly context: string;
  readonly startedAt: number | null;
  readonly archivedAt: number | null;
  readonly stats: Numbers & { recipients: number };
  /** v0.8.3: first and last arrival at a player (estimated: planned by the server). */
  readonly reach: {
    readonly first: { readonly at: number; readonly estimated: boolean };
    readonly last: { readonly at: number; readonly estimated: boolean };
    readonly players: number;
  } | null;
}

export interface MapOwl {
  readonly bot: string;
  readonly botName: string;
  readonly owl: string;
  readonly species: string;
  readonly lat: number;
  readonly lon: number;
  readonly state: 'flying' | 'resting' | 'returning';
  readonly sleeping: boolean;
}

export interface MapHome {
  readonly id: string;
  readonly name: string;
  readonly state: string;
  readonly lat: number;
  readonly lon: number;
}
