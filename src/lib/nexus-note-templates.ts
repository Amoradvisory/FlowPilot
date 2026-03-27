import type { NoteLifeState, NotePriorityLevel, VaultColor } from '$lib/note-vault';

export type NoteTemplateId =
	| 'meeting'
	| 'bug-report'
	| 'product-idea'
	| 'daily-review'
	| 'weekly-review';

export interface NoteTemplate {
	id: NoteTemplateId;
	label: string;
	description: string;
	color: VaultColor;
	priority: NotePriorityLevel;
	lifeState: NoteLifeState;
	tags: string[];
}

export interface NoteTemplateContext {
	now?: Date;
	similarTitles?: string[];
	hotTag?: string | null;
	todayCount?: number;
	weekCount?: number;
}

export interface NoteTemplateDraft {
	title: string;
	content: string;
	color: VaultColor;
	priority: NotePriorityLevel;
	lifeState: NoteLifeState;
	tags: string[];
}

export const NOTE_TEMPLATES: NoteTemplate[] = [
	{
		id: 'meeting',
		label: 'Reunion',
		description: 'Compte-rendu pret a remplir avec actions.',
		color: 'pink',
		priority: 'p2',
		lifeState: 'active',
		tags: ['meeting']
	},
	{
		id: 'bug-report',
		label: 'Bug report',
		description: 'Rapport de bug structure, contexte inclus.',
		color: 'rose',
		priority: 'p1',
		lifeState: 'active',
		tags: ['bug', 'incident']
	},
	{
		id: 'product-idea',
		label: 'Idee produit',
		description: 'Structure rapide pour transformer une intuition en piste.',
		color: 'violet',
		priority: 'p3',
		lifeState: 'seed',
		tags: ['idea', 'product']
	},
	{
		id: 'daily-review',
		label: 'Daily review',
		description: 'Revue rapide de la journee.',
		color: 'blue',
		priority: 'p2',
		lifeState: 'solid',
		tags: ['review', 'daily']
	},
	{
		id: 'weekly-review',
		label: 'Bilan semaine',
		description: 'Vue synthese des notes et decisions de la semaine.',
		color: 'green',
		priority: 'p2',
		lifeState: 'solid',
		tags: ['review', 'weekly']
	}
];

const formatDate = (value: Date) =>
	new Intl.DateTimeFormat('fr-FR', {
		weekday: 'long',
		day: '2-digit',
		month: 'long',
		year: 'numeric'
	}).format(value);

const formatTime = (value: Date) =>
	new Intl.DateTimeFormat('fr-FR', {
		hour: '2-digit',
		minute: '2-digit'
	}).format(value);

const startOfWeek = (value: Date) => {
	const date = new Date(value);
	const day = date.getDay();
	const delta = day === 0 ? -6 : 1 - day;
	date.setDate(date.getDate() + delta);
	date.setHours(0, 0, 0, 0);
	return date;
};

const endOfWeek = (value: Date) => {
	const date = startOfWeek(value);
	date.setDate(date.getDate() + 6);
	return date;
};

const similarSection = (titles: string[]) =>
	titles.length
		? titles.map((title) => `- ${title}`).join('\n')
		: '- Rien a rapprocher pour l instant';

export const buildTemplateDraft = (
	id: NoteTemplateId,
	context: NoteTemplateContext = {}
): NoteTemplateDraft => {
	const now = context.now ?? new Date();
	const similarTitles = context.similarTitles?.slice(0, 3) ?? [];
	const hotTag = context.hotTag ? `#${context.hotTag}` : 'Aucun sujet dominant';
	const todayCount = context.todayCount ?? 0;
	const weekCount = context.weekCount ?? 0;
	const weekStart = startOfWeek(now);
	const weekEnd = endOfWeek(now);
	const meta = NOTE_TEMPLATES.find((template) => template.id === id) ?? NOTE_TEMPLATES[0];

	switch (id) {
		case 'meeting':
			return {
				title: `Reunion - ${formatDate(now)}`,
				content: [
					`Date: ${formatDate(now)}`,
					`Heure: ${formatTime(now)}`,
					'Participants:',
					'- ',
					'Objectif:',
					'- ',
					'Notes:',
					'- ',
					'Actions:',
					'- [ ] '
				].join('\n'),
				color: meta.color,
				priority: meta.priority,
				lifeState: meta.lifeState,
				tags: meta.tags
			};
		case 'bug-report':
			return {
				title: `Bug report - ${formatDate(now)}`,
				content: [
					`Date: ${formatDate(now)}`,
					`Heure: ${formatTime(now)}`,
					'Contexte:',
					'- Appareil / OS:',
					'- Ecran / page:',
					'Etapes pour reproduire:',
					'1. ',
					'2. ',
					'3. ',
					'Resultat attendu:',
					'- ',
					'Resultat observe:',
					'- ',
					'Pieces jointes:',
					'- '
				].join('\n'),
				color: meta.color,
				priority: meta.priority,
				lifeState: meta.lifeState,
				tags: meta.tags
			};
		case 'product-idea':
			return {
				title: `Idee produit - ${formatDate(now)}`,
				content: [
					`Capturee le: ${formatDate(now)} a ${formatTime(now)}`,
					'Probleme observe:',
					'- ',
					'Angle / intuition:',
					'- ',
					'Notes proches:',
					similarSection(similarTitles),
					'Prochaine action:',
					'- [ ] '
				].join('\n'),
				color: meta.color,
				priority: meta.priority,
				lifeState: meta.lifeState,
				tags: meta.tags
			};
		case 'daily-review':
			return {
				title: `Daily review - ${formatDate(now)}`,
				content: [
					`Date: ${formatDate(now)}`,
					`Notes capturees aujourd hui: ${todayCount}`,
					'Sujet chaud:',
					`- ${hotTag}`,
					'Ce qui a avance:',
					'- ',
					'Ce qui bloque:',
					'- ',
					'A traiter demain:',
					'- [ ] '
				].join('\n'),
				color: meta.color,
				priority: meta.priority,
				lifeState: meta.lifeState,
				tags: meta.tags
			};
		case 'weekly-review':
			return {
				title: `Bilan semaine - ${formatDate(now)}`,
				content: [
					`Semaine: ${formatDate(weekStart)} -> ${formatDate(weekEnd)}`,
					`Notes creees cette semaine: ${weekCount}`,
					'Sujet chaud:',
					`- ${hotTag}`,
					'Points marquants:',
					'- ',
					'Decisions:',
					'- ',
					'Priorites semaine prochaine:',
					'- [ ] ',
					'- [ ] ',
					'- [ ] '
				].join('\n'),
				color: meta.color,
				priority: meta.priority,
				lifeState: meta.lifeState,
				tags: meta.tags
			};
	}
};
