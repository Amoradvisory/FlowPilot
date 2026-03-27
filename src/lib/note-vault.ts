import type { Note } from '$lib/types';
import { searchableVaultText } from '$lib/vault-document';

export type VaultKind = 'note' | 'prompt' | 'snippet' | 'reference';
export type VaultColor = 'blue' | 'pink' | 'green' | 'amber' | 'violet' | 'rose' | 'slate';
export type NotePriorityLevel = 'p0' | 'p1' | 'p2' | 'p3' | 'p4';
export type NoteLifeState = 'seed' | 'active' | 'solid' | 'obsolete';
export type NoteDecayBand = 'fresh' | 'warm' | 'dormant' | 'ghost';

export interface VaultMeta {
	kind: VaultKind;
	color: VaultColor;
	pinned: boolean;
	language: string | null;
	priority: NotePriorityLevel;
	lifeState: NoteLifeState;
	plainTags: string[];
}

export interface NoteDecayMeta {
	band: NoteDecayBand;
	daysOld: number;
	immortal: boolean;
	label: string;
	icon: string;
}

export const NOTE_COLOR_OPTIONS: Array<{ value: VaultColor; label: string; accent: string }> = [
	{ value: 'blue', label: 'Cyan neon', accent: '#00D4FF' },
	{ value: 'pink', label: 'Violet electrique', accent: '#7B2FFF' },
	{ value: 'green', label: 'Vert neon', accent: '#00FF9C' },
	{ value: 'amber', label: 'Ambre', accent: '#FFB800' },
	{ value: 'violet', label: 'Indigo', accent: '#6E63FF' },
	{ value: 'rose', label: 'Rouge neon', accent: '#FF2D55' },
	{ value: 'slate', label: 'Gris bleu', accent: '#4A5580' }
];

export const NOTE_PRIORITY_OPTIONS: Array<{
	value: NotePriorityLevel;
	label: string;
	shortLabel: string;
	icon: string;
	accent: string;
	description: string;
}> = [
	{
		value: 'p0',
		label: 'Critique',
		shortLabel: 'P0',
		icon: '🔴',
		accent: '#FF2D55',
		description: 'Toujours en haut, jamais oubliee.'
	},
	{
		value: 'p1',
		label: 'Urgent',
		shortLabel: 'P1',
		icon: '🟠',
		accent: '#FF6B35',
		description: 'A traiter vite.'
	},
	{
		value: 'p2',
		label: 'Important',
		shortLabel: 'P2',
		icon: '🟡',
		accent: '#FFB800',
		description: 'Merite ton attention.'
	},
	{
		value: 'p3',
		label: 'Normal',
		shortLabel: 'P3',
		icon: '🔵',
		accent: '#00D4FF',
		description: 'Le niveau par defaut.'
	},
	{
		value: 'p4',
		label: 'Archive',
		shortLabel: 'P4',
		icon: '⚫',
		accent: '#4A5580',
		description: 'En retrait, filtre par defaut.'
	}
];

export const NOTE_LIFE_STATE_OPTIONS: Array<{
	value: NoteLifeState;
	label: string;
	icon: string;
	description: string;
}> = [
	{ value: 'seed', label: 'Graine', icon: '🌱', description: 'Idee brute, non developpee.' },
	{ value: 'active', label: 'Active', icon: '⚡', description: 'En cours de travail.' },
	{ value: 'solid', label: 'Solide', icon: '✅', description: 'Finalisee, utile, reference.' },
	{ value: 'obsolete', label: 'Obsolete', icon: '🌫️', description: 'A revisiter, archiver ou supprimer.' }
];

const META_PREFIXES = {
	kind: 'kind:',
	color: 'color:',
	language: 'lang:',
	priority: 'priority:',
	lifeState: 'state:'
} as const;

const FLAG_TAGS = {
	pinned: 'pinned'
} as const;

const uniq = <T>(items: T[]) => Array.from(new Set(items));

const readMetaTag = (tags: string[], prefix: string) =>
	tags.find((tag) => tag.startsWith(prefix))?.slice(prefix.length) ?? null;

export const withoutMetaTags = (tags: string[]) =>
	tags.filter(
		(tag) =>
			!tag.startsWith(META_PREFIXES.kind) &&
			!tag.startsWith(META_PREFIXES.color) &&
			!tag.startsWith(META_PREFIXES.language) &&
			!tag.startsWith(META_PREFIXES.priority) &&
			!tag.startsWith(META_PREFIXES.lifeState) &&
			tag !== FLAG_TAGS.pinned
	);

export const getVaultMeta = (note: Note): VaultMeta => {
	const kind = (readMetaTag(note.tags, META_PREFIXES.kind) as VaultKind | null) ?? 'note';
	const color = (readMetaTag(note.tags, META_PREFIXES.color) as VaultColor | null) ?? 'blue';
	const language = readMetaTag(note.tags, META_PREFIXES.language);
	const priority =
		(readMetaTag(note.tags, META_PREFIXES.priority) as NotePriorityLevel | null) ?? 'p3';
	const lifeState =
		(readMetaTag(note.tags, META_PREFIXES.lifeState) as NoteLifeState | null) ?? 'seed';

	return {
		kind,
		color,
		language,
		priority,
		lifeState,
		pinned: note.tags.includes(FLAG_TAGS.pinned),
		plainTags: withoutMetaTags(note.tags)
	};
};

export const buildVaultTags = (input: {
	kind: VaultKind;
	color: VaultColor;
	pinned: boolean;
	language?: string | null;
	priority?: NotePriorityLevel | null;
	lifeState?: NoteLifeState | null;
	plainTags?: string[];
}) => {
	const plainTags = (input.plainTags ?? [])
		.map((tag) => tag.trim())
		.filter(Boolean)
		.filter(
			(tag) =>
				!tag.startsWith(META_PREFIXES.kind) &&
				!tag.startsWith(META_PREFIXES.color) &&
				!tag.startsWith(META_PREFIXES.language) &&
				!tag.startsWith(META_PREFIXES.priority) &&
				!tag.startsWith(META_PREFIXES.lifeState) &&
				tag !== FLAG_TAGS.pinned
		);

	return uniq([
		...plainTags,
		`${META_PREFIXES.kind}${input.kind}`,
		`${META_PREFIXES.color}${input.color}`,
		`${META_PREFIXES.priority}${input.priority ?? 'p3'}`,
		`${META_PREFIXES.lifeState}${input.lifeState ?? 'seed'}`,
		...(input.language ? [`${META_PREFIXES.language}${input.language.trim().toLowerCase()}`] : []),
		...(input.pinned ? [FLAG_TAGS.pinned] : [])
	]);
};

export const parseTagInput = (value: string) =>
	uniq(
		value
			.split(/[\n,#]/)
			.map((tag) => tag.trim())
			.filter(Boolean)
	);

export const matchVaultQuery = (note: Note, query: string) => {
	if (!query.trim()) return true;
	return searchableVaultText(note).includes(query.trim().toLowerCase());
};

export const noteColorClasses = (color: VaultColor) =>
	({
		blue: {
			card: 'border-[#00D4FF]/28 bg-[radial-gradient(circle_at_top_right,rgba(0,212,255,0.16),transparent_42%),rgba(15,22,41,0.92)]',
			chip: 'border-[#00D4FF]/30 bg-[#00D4FF]/10 text-[#8feeff]',
			dot: 'bg-[#00D4FF]'
		},
		pink: {
			card: 'border-[#7B2FFF]/28 bg-[radial-gradient(circle_at_top_right,rgba(123,47,255,0.16),transparent_42%),rgba(15,22,41,0.92)]',
			chip: 'border-[#7B2FFF]/30 bg-[#7B2FFF]/12 text-[#ccb1ff]',
			dot: 'bg-[#7B2FFF]'
		},
		green: {
			card: 'border-[#00FF9C]/24 bg-[radial-gradient(circle_at_top_right,rgba(0,255,156,0.14),transparent_42%),rgba(15,22,41,0.92)]',
			chip: 'border-[#00FF9C]/25 bg-[#00FF9C]/10 text-[#baffea]',
			dot: 'bg-[#00FF9C]'
		},
		amber: {
			card: 'border-[#FFB800]/24 bg-[radial-gradient(circle_at_top_right,rgba(255,184,0,0.14),transparent_42%),rgba(15,22,41,0.92)]',
			chip: 'border-[#FFB800]/25 bg-[#FFB800]/10 text-[#ffe29a]',
			dot: 'bg-[#FFB800]'
		},
		violet: {
			card: 'border-[#6E63FF]/24 bg-[radial-gradient(circle_at_top_right,rgba(110,99,255,0.14),transparent_42%),rgba(15,22,41,0.92)]',
			chip: 'border-[#6E63FF]/25 bg-[#6E63FF]/10 text-[#d2ceff]',
			dot: 'bg-[#6E63FF]'
		},
		rose: {
			card: 'border-[#FF2D55]/24 bg-[radial-gradient(circle_at_top_right,rgba(255,45,85,0.14),transparent_42%),rgba(15,22,41,0.92)]',
			chip: 'border-[#FF2D55]/25 bg-[#FF2D55]/10 text-[#ffb3c1]',
			dot: 'bg-[#FF2D55]'
		},
		slate: {
			card: 'border-[#4A5580]/22 bg-[radial-gradient(circle_at_top_right,rgba(74,85,128,0.14),transparent_42%),rgba(15,22,41,0.92)]',
			chip: 'border-[#4A5580]/25 bg-[#4A5580]/10 text-[#b5c0eb]',
			dot: 'bg-[#4A5580]'
		}
	})[color];

export const getPriorityMeta = (priority: NotePriorityLevel) =>
	NOTE_PRIORITY_OPTIONS.find((option) => option.value === priority) ?? NOTE_PRIORITY_OPTIONS[3];

export const getLifeStateMeta = (lifeState: NoteLifeState) =>
	NOTE_LIFE_STATE_OPTIONS.find((option) => option.value === lifeState) ?? NOTE_LIFE_STATE_OPTIONS[0];

export const getDecayMeta = (note: Pick<Note, 'updated_at'>, meta: Pick<VaultMeta, 'pinned' | 'priority'>): NoteDecayMeta => {
	if (meta.pinned || meta.priority === 'p0' || meta.priority === 'p1') {
		return {
			band: 'fresh',
			daysOld: 0,
			immortal: true,
			label: 'Immortelle',
			icon: '📌'
		};
	}

	const updated = new Date(note.updated_at).getTime();
	const daysOld = Math.max(0, Math.floor((Date.now() - updated) / (1000 * 60 * 60 * 24)));

	if (daysOld <= 7) {
		return { band: 'fresh', daysOld, immortal: false, label: 'Fraiche', icon: '✨' };
	}
	if (daysOld <= 30) {
		return { band: 'warm', daysOld, immortal: false, label: 'Tiede', icon: '🌤️' };
	}
	if (daysOld <= 90) {
		return { band: 'dormant', daysOld, immortal: false, label: 'Dormante', icon: '❄️' };
	}
	return { band: 'ghost', daysOld, immortal: false, label: 'Fantome', icon: '👻' };
};

export const priorityOrder = (priority: NotePriorityLevel) =>
	({
		p0: 0,
		p1: 1,
		p2: 2,
		p3: 3,
		p4: 4
	})[priority];
