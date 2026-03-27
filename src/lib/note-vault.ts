import type { Note } from '$lib/types';
import { searchableVaultText } from '$lib/vault-document';

export type VaultKind = 'note' | 'prompt' | 'snippet' | 'reference';
export type VaultColor = 'blue' | 'pink' | 'green' | 'amber' | 'violet' | 'rose' | 'slate';

export interface VaultMeta {
	kind: VaultKind;
	color: VaultColor;
	pinned: boolean;
	language: string | null;
	plainTags: string[];
}

export const NOTE_KIND_OPTIONS: Array<{ value: VaultKind; label: string; description: string }> = [
	{ value: 'note', label: 'Note', description: 'Idee, capture, memo ou texte libre.' },
	{ value: 'prompt', label: 'Prompt', description: 'Instructions pour modeles de langage.' },
	{ value: 'snippet', label: 'Snippet', description: 'Code, commandes, regex, SQL, scripts.' },
	{ value: 'reference', label: 'Reference', description: 'Procedure, playbook, documentation personnelle.' }
];

export const NOTE_COLOR_OPTIONS: Array<{ value: VaultColor; label: string; accent: string }> = [
	{ value: 'blue', label: 'Bleu neon', accent: '#3399FF' },
	{ value: 'pink', label: 'Rose flash', accent: '#FF4FD8' },
	{ value: 'green', label: 'Vert', accent: '#22c55e' },
	{ value: 'amber', label: 'Ambre', accent: '#f59e0b' },
	{ value: 'violet', label: 'Violet', accent: '#8b5cf6' },
	{ value: 'rose', label: 'Rouge rose', accent: '#fb7185' },
	{ value: 'slate', label: 'Slate', accent: '#94a3b8' }
];

export const NOTE_TEMPLATES: Array<{
	id: string;
	title: string;
	label: string;
	kind: VaultKind;
	color: VaultColor;
	language?: string;
	content: string;
}> = [
	{
		id: 'prompt-system',
		title: 'Prompt systeme',
		label: 'Ajouter un prompt',
		kind: 'prompt',
		color: 'pink',
		content:
			'Role:\\nContexte:\\nObjectif:\\nContraintes:\\nFormat de sortie attendu:\\nExemples utiles:\\n'
	},
	{
		id: 'snippet-shell',
		title: 'Snippet terminal',
		label: 'Ajouter un snippet',
		kind: 'snippet',
		color: 'blue',
		language: 'bash',
		content: 'Commande:\\n\\nExplication:\\n\\nQuand l utiliser:\\n'
	},
	{
		id: 'reference-playbook',
		title: 'Playbook personnel',
		label: 'Ajouter une procedure',
		kind: 'reference',
		color: 'green',
		content: 'Contexte:\\nEtapes:\\nPoints d attention:\\nVerification finale:\\n'
	}
];

const META_PREFIXES = {
	kind: 'kind:',
	color: 'color:',
	language: 'lang:'
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
			tag !== FLAG_TAGS.pinned
	);

export const getVaultMeta = (note: Note): VaultMeta => {
	const kind = (readMetaTag(note.tags, META_PREFIXES.kind) as VaultKind | null) ?? 'note';
	const color = (readMetaTag(note.tags, META_PREFIXES.color) as VaultColor | null) ?? 'blue';
	const language = readMetaTag(note.tags, META_PREFIXES.language);

	return {
		kind,
		color,
		language,
		pinned: note.tags.includes(FLAG_TAGS.pinned),
		plainTags: withoutMetaTags(note.tags)
	};
};

export const buildVaultTags = (input: {
	kind: VaultKind;
	color: VaultColor;
	pinned: boolean;
	language?: string | null;
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
				tag !== FLAG_TAGS.pinned
		);

	return uniq([
		...plainTags,
		`${META_PREFIXES.kind}${input.kind}`,
		`${META_PREFIXES.color}${input.color}`,
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
			card: 'border-[#3399FF]/28 bg-[radial-gradient(circle_at_top_right,rgba(51,153,255,0.18),transparent_42%),#111]',
			chip: 'border-[#3399FF]/30 bg-[#3399FF]/12 text-[#8fcaff]',
			dot: 'bg-[#3399FF]'
		},
		pink: {
			card: 'border-[#FF4FD8]/28 bg-[radial-gradient(circle_at_top_right,rgba(255,79,216,0.18),transparent_42%),#111]',
			chip: 'border-[#FF4FD8]/30 bg-[#FF4FD8]/12 text-[#ff9de9]',
			dot: 'bg-[#FF4FD8]'
		},
		green: {
			card: 'border-emerald-400/24 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.16),transparent_42%),#111]',
			chip: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
			dot: 'bg-emerald-400'
		},
		amber: {
			card: 'border-amber-400/24 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.16),transparent_42%),#111]',
			chip: 'border-amber-400/25 bg-amber-400/10 text-amber-200',
			dot: 'bg-amber-400'
		},
		violet: {
			card: 'border-violet-400/24 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.16),transparent_42%),#111]',
			chip: 'border-violet-400/25 bg-violet-400/10 text-violet-200',
			dot: 'bg-violet-400'
		},
		rose: {
			card: 'border-rose-400/24 bg-[radial-gradient(circle_at_top_right,rgba(251,113,133,0.16),transparent_42%),#111]',
			chip: 'border-rose-400/25 bg-rose-400/10 text-rose-200',
			dot: 'bg-rose-400'
		},
		slate: {
			card: 'border-slate-400/20 bg-[radial-gradient(circle_at_top_right,rgba(148,163,184,0.14),transparent_42%),#111]',
			chip: 'border-slate-400/20 bg-slate-400/10 text-slate-200',
			dot: 'bg-slate-400'
		}
	})[color];

export const vaultKindLabel = (kind: VaultKind) =>
	NOTE_KIND_OPTIONS.find((option) => option.value === kind)?.label ?? 'Note';

export const defaultTitleForKind = (kind: VaultKind) =>
	({
		note: 'Nouvelle note',
		prompt: 'Nouveau prompt',
		snippet: 'Nouveau snippet',
		reference: 'Nouvelle reference'
	})[kind];
