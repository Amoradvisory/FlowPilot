import type { Note } from '$lib/types';
import {
	getDecayMeta,
	type NoteLifeState,
	type NotePriorityLevel,
	type VaultColor,
	type VaultMeta
} from '$lib/note-vault';
import type { VaultDocument } from '$lib/vault-document';

export type QuickCaptureCommand = 'todo' | 'meeting' | 'idea' | 'later' | null;

export interface NoteIndexItem {
	note: Pick<Note, 'id' | 'title' | 'content' | 'tags' | 'created_at' | 'updated_at'>;
	meta: VaultMeta;
	document: VaultDocument;
}

export interface QuickCapturePreset {
	command: QuickCaptureCommand;
	cleanText: string;
	tags: string[];
	priority: NotePriorityLevel;
	lifeState: NoteLifeState;
	color: VaultColor;
	contextLabel: string;
}

export interface SmartCollection<T> {
	key: string;
	label: string;
	description: string;
	accent: string;
	items: T[];
}

export interface NoteVelocityStats {
	createdToday: number;
	createdThisWeek: number;
	createdThisMonth: number;
	peakHourLabel: string;
	hotTag: string | null;
	streakDays: number;
	seedToSolidLabel: string;
}

const COMMAND_PRESETS: Record<
	Exclude<QuickCaptureCommand, null>,
	{
		tag: string;
		priority: NotePriorityLevel;
		lifeState: NoteLifeState;
		color: VaultColor;
		contextLabel: string;
	}
> = {
	todo: {
		tag: 'todo',
		priority: 'p2',
		lifeState: 'active',
		color: 'amber',
		contextLabel: 'Action'
	},
	meeting: {
		tag: 'meeting',
		priority: 'p3',
		lifeState: 'active',
		color: 'pink',
		contextLabel: 'Meeting'
	},
	idea: {
		tag: 'idea',
		priority: 'p3',
		lifeState: 'seed',
		color: 'violet',
		contextLabel: 'Idea'
	},
	later: {
		tag: 'later',
		priority: 'p4',
		lifeState: 'obsolete',
		color: 'slate',
		contextLabel: 'Later'
	}
};

const PRIORITY_ALIASES: Record<string, NotePriorityLevel> = {
	p0: 'p0',
	critique: 'p0',
	critical: 'p0',
	p1: 'p1',
	urgent: 'p1',
	urgence: 'p1',
	p2: 'p2',
	important: 'p2',
	p3: 'p3',
	normal: 'p3',
	p4: 'p4',
	archive: 'p4',
	later: 'p4'
};

const LIFE_STATE_ALIASES: Record<string, NoteLifeState> = {
	seed: 'seed',
	graine: 'seed',
	idea: 'seed',
	brouillon: 'seed',
	active: 'active',
	cours: 'active',
	solid: 'solid',
	solide: 'solid',
	final: 'solid',
	obsolete: 'obsolete',
	archive: 'obsolete',
	obsoletee: 'obsolete'
};

const normalizeTag = (value: string) =>
	value
		.trim()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/^#+/, '')
		.replace(/\s+/g, '-')
		.replace(/[^a-z0-9/_-]/g, '')
		.replace(/-{2,}/g, '-')
		.replace(/\/{2,}/g, '/')
		.replace(/^[-/]+|[-/]+$/g, '');

const unique = <T>(items: T[]) => Array.from(new Set(items));

const dayKey = (value: string) => new Date(value).toISOString().slice(0, 10);

const daysBetween = (value: string) =>
	Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / (1000 * 60 * 60 * 24)));

const parseBooleanToken = (value: string) => ['1', 'true', 'yes', 'oui', 'y'].includes(value);

const parseCommand = (value: string): { command: QuickCaptureCommand; text: string } => {
	const match = value.match(/^\s*\/(todo|meeting|idea|later)\b/i);
	if (!match) return { command: null, text: value.trim() };
	return {
		command: match[1].toLowerCase() as Exclude<QuickCaptureCommand, null>,
		text: value.slice(match[0].length).trim()
	};
};

const stripInlineTags = (value: string) => {
	const tags: string[] = [];
	const text = value.replace(
		/(^|\s)#([a-zA-Z0-9/_-]+)/g,
		(_whole, leading: string, raw: string) => {
			const normalized = normalizeTag(raw);
			if (normalized) tags.push(normalized);
			return leading;
		}
	);
	return {
		text: text.replace(/\s{2,}/g, ' ').trim(),
		tags: unique(tags)
	};
};

const inferPriority = (value: string, fallback: NotePriorityLevel) => {
	const normalized = value.toLowerCase();
	if (
		normalized.match(/\bp0\b/) ||
		normalized.includes('critique') ||
		normalized.includes('critical')
	)
		return 'p0';
	if (normalized.match(/\bp1\b/) || normalized.includes('urgent') || normalized.includes('!!'))
		return 'p1';
	if (normalized.match(/\bp2\b/) || normalized.includes('important')) return 'p2';
	if (
		normalized.match(/\bp4\b/) ||
		normalized.includes('/later') ||
		normalized.includes(' a revoir plus tard')
	)
		return 'p4';
	return fallback;
};

const inferLifeState = (value: string, fallback: NoteLifeState) => {
	const normalized = value.toLowerCase();
	if (normalized.includes('obsolete') || normalized.includes('archive')) return 'obsolete';
	if (normalized.includes('solide') || normalized.includes('final')) return 'solid';
	if (normalized.includes('todo') || normalized.includes('a faire') || normalized.includes('[ ]'))
		return 'active';
	return fallback;
};

const inferColor = (
	command: QuickCaptureCommand,
	priority: NotePriorityLevel,
	hasMedia: boolean
): VaultColor => {
	if (command && COMMAND_PRESETS[command]) return COMMAND_PRESETS[command].color;
	if (priority === 'p0') return 'rose';
	if (priority === 'p1') return 'amber';
	if (hasMedia) return 'green';
	return 'blue';
};

const extractContextTags = (value: string) => {
	const tags: string[] = [];
	const normalized = value.toLowerCase();
	if (/https?:\/\//.test(normalized)) tags.push('web-clip');
	if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(value)) tags.push('contact');
	if (
		normalized.includes('```') ||
		normalized.includes('const ') ||
		normalized.includes('function ') ||
		normalized.includes('class ') ||
		normalized.includes('=>')
	) {
		tags.push('code');
	}
	if (normalized.includes('[ ]') || normalized.includes('todo') || normalized.includes('a faire')) {
		tags.push('action');
	}
	return unique(tags.map(normalizeTag).filter(Boolean));
};

export const analyzeQuickCapture = (value: string, attachmentCount = 0): QuickCapturePreset => {
	const commandResult = parseCommand(value);
	const tagResult = stripInlineTags(commandResult.text);
	const preset = commandResult.command ? COMMAND_PRESETS[commandResult.command] : null;
	const priority = inferPriority(tagResult.text, preset?.priority ?? 'p3');
	const lifeState = inferLifeState(tagResult.text, preset?.lifeState ?? 'seed');
	const color = inferColor(commandResult.command, priority, attachmentCount > 0);

	return {
		command: commandResult.command,
		cleanText: tagResult.text,
		tags: unique(
			[
				'capture-rapide',
				...(preset ? [preset.tag] : []),
				...(attachmentCount > 0 ? ['media'] : []),
				...extractContextTags(tagResult.text),
				...tagResult.tags
			].filter(Boolean)
		),
		priority,
		lifeState,
		color,
		contextLabel:
			preset?.contextLabel ??
			(attachmentCount > 0 ? 'Media note' : tagResult.tags.length ? 'Tagged note' : 'Quick note')
	};
};

const buildSearchIndex = (item: NoteIndexItem) =>
	[
		item.note.title,
		item.document.plainText,
		...item.meta.plainTags,
		item.meta.priority,
		item.meta.lifeState,
		item.meta.color,
		item.meta.pinned ? 'pinned epingle' : '',
		item.document.attachments.length ? 'media image video audio link capture photo' : '',
		...item.document.attachments.flatMap((attachment) => [
			attachment.title,
			attachment.url,
			attachment.kind
		])
	]
		.join(' ')
		.toLowerCase();

const matchesFilterToken = (item: NoteIndexItem, token: string) => {
	const [rawKey, ...rest] = token.split(':');
	const key = rawKey.toLowerCase();
	const value = rest.join(':').trim().toLowerCase();

	if (!value) return true;

	switch (key) {
		case 'tag':
		case 'tags':
			return item.meta.plainTags.some((tag) => tag.includes(normalizeTag(value)));
		case 'priority':
		case 'prio':
		case 'p':
			return item.meta.priority === (PRIORITY_ALIASES[value] ?? value);
		case 'state':
		case 'life':
			return item.meta.lifeState === (LIFE_STATE_ALIASES[value] ?? value);
		case 'color':
			return item.meta.color === value;
		case 'media':
		case 'has':
			return key === 'has' && value === 'media'
				? item.document.attachments.length > 0
				: parseBooleanToken(value)
					? item.document.attachments.length > 0
					: item.document.attachments.length === 0;
		case 'pinned':
		case 'pin':
			return parseBooleanToken(value) ? item.meta.pinned : !item.meta.pinned;
		case 'decay':
			return getDecayMeta(item.note, item.meta).band === value;
		default:
			return buildSearchIndex(item).includes(token.toLowerCase());
	}
};

export const matchesNoteQuery = (item: NoteIndexItem, query: string) => {
	const trimmed = query.trim().toLowerCase();
	if (!trimmed) return true;
	const tokens = trimmed.split(/\s+/).filter(Boolean);
	const searchIndex = buildSearchIndex(item);
	return tokens.every((token) =>
		token.includes(':') ? matchesFilterToken(item, token) : searchIndex.includes(token)
	);
};

export const buildSmartCollections = <T extends NoteIndexItem>(
	items: T[]
): SmartCollection<T>[] => {
	const today = new Date().toISOString().slice(0, 10);
	return [
		{
			key: 'morning',
			label: 'Notes de ce matin',
			description: 'Tout ce qui a ete capture aujourd hui avant midi.',
			accent: '#00D4FF',
			items: items.filter((item) => {
				const created = new Date(item.note.created_at);
				return created.toISOString().slice(0, 10) === today && created.getHours() < 12;
			})
		},
		{
			key: 'stale-seeds',
			label: 'Graines a revisiter',
			description: 'Idees brutes qui trainent depuis plus de 7 jours.',
			accent: '#7B2FFF',
			items: items.filter(
				(item) => item.meta.lifeState === 'seed' && daysBetween(item.note.updated_at) > 7
			)
		},
		{
			key: 'critical',
			label: 'Pression haute',
			description: 'Notes P0 ou P1 qui ne doivent jamais sortir du radar.',
			accent: '#FF2D55',
			items: items.filter((item) => item.meta.priority === 'p0' || item.meta.priority === 'p1')
		},
		{
			key: 'media',
			label: 'Memoire visuelle',
			description: 'Notes avec image, audio, video ou lien embarque.',
			accent: '#00FF9C',
			items: items.filter((item) => item.document.attachments.length > 0)
		},
		{
			key: 'ghost',
			label: 'Decay queue',
			description: 'Notes fantomes qui demandent une decision.',
			accent: '#4A5580',
			items: items.filter((item) => getDecayMeta(item.note, item.meta).band === 'ghost')
		}
	].filter((group) => group.items.length > 0);
};

export const computeNoteVelocity = <T extends NoteIndexItem>(items: T[]): NoteVelocityStats => {
	const now = Date.now();
	const today = new Date().toISOString().slice(0, 10);
	const weekCutoff = now - 7 * 24 * 60 * 60 * 1000;
	const monthCutoff = now - 30 * 24 * 60 * 60 * 1000;
	const createdToday = items.filter((item) => dayKey(item.note.created_at) === today).length;
	const createdThisWeek = items.filter(
		(item) => new Date(item.note.created_at).getTime() >= weekCutoff
	).length;
	const createdThisMonth = items.filter(
		(item) => new Date(item.note.created_at).getTime() >= monthCutoff
	).length;

	const hourCounts = new Map<number, number>();
	for (const item of items) {
		const hour = new Date(item.note.created_at).getHours();
		hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
	}
	const [peakHour = 0] =
		[...hourCounts.entries()].sort((left, right) => right[1] - left[1] || left[0] - right[0])[0] ??
		[];
	const peakHourLabel =
		hourCounts.size > 0 ? `${String(peakHour).padStart(2, '0')}:00` : 'Pas assez de recul';

	const tagCounts = new Map<string, number>();
	for (const item of items.filter(
		(entry) => new Date(entry.note.created_at).getTime() >= weekCutoff
	)) {
		for (const tag of item.meta.plainTags) {
			tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
		}
	}
	const hotTag =
		[...tagCounts.entries()].sort(
			(left, right) => right[1] - left[1] || left[0].localeCompare(right[0])
		)[0]?.[0] ?? null;

	const daysWithNotes = new Set(items.map((item) => dayKey(item.note.created_at)));
	let streakDays = 0;
	for (let offset = 0; offset < 60; offset += 1) {
		const candidate = new Date(now - offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
		if (!daysWithNotes.has(candidate)) break;
		streakDays += 1;
	}

	const seedCount = items.filter((item) => item.meta.lifeState === 'seed').length;
	const solidCount = items.filter((item) => item.meta.lifeState === 'solid').length;
	const seedToSolidLabel = seedCount > 0 ? `${solidCount}/${seedCount}` : `${solidCount}/0`;

	return {
		createdToday,
		createdThisWeek,
		createdThisMonth,
		peakHourLabel,
		hotTag,
		streakDays,
		seedToSolidLabel
	};
};

export const findRelatedNotes = <T extends NoteIndexItem>(
	target: T,
	items: T[],
	limit = 3
): T[] => {
	const titleNeedle = target.note.title.trim().toLowerCase();
	const targetTags = new Set(target.meta.plainTags);

	return items
		.filter((item) => item.note.id !== target.note.id)
		.map((item) => {
			let score = 0;
			for (const tag of item.meta.plainTags) {
				if (targetTags.has(tag)) score += 3;
			}
			if (titleNeedle && item.document.plainText.toLowerCase().includes(titleNeedle)) score += 4;
			if (
				item.note.title.toLowerCase().includes(titleNeedle) ||
				titleNeedle.includes(item.note.title.toLowerCase())
			) {
				score += 2;
			}
			if (item.meta.color === target.meta.color) score += 1;
			return { item, score };
		})
		.filter((entry) => entry.score > 0)
		.sort((left, right) => right.score - left.score)
		.slice(0, limit)
		.map((entry) => entry.item);
};
