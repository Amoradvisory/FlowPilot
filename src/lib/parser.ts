import { addDays, nextMonday, nextTuesday, nextWednesday, nextThursday, nextFriday, nextSaturday, nextSunday } from 'date-fns';
import type { ParsedInboxDraft, Priority, Project } from '$lib/types';
import { dateOnlyToIso, normalizeText } from '$lib/utils';

const WEEKDAY_MATCHERS = [
	{ tokens: ['lundi', 'monday'], build: nextMonday },
	{ tokens: ['mardi', 'tuesday'], build: nextTuesday },
	{ tokens: ['mercredi', 'wednesday'], build: nextWednesday },
	{ tokens: ['jeudi', 'thursday'], build: nextThursday },
	{ tokens: ['vendredi', 'friday'], build: nextFriday },
	{ tokens: ['samedi', 'saturday'], build: nextSaturday },
	{ tokens: ['dimanche', 'sunday'], build: nextSunday }
] as const;

const detectPriority = (rawText: string): Priority | null => {
	const normalized = normalizeText(rawText);

	if (normalized.includes('urgent') || rawText.includes('!!')) return 'critical';
	if (rawText.includes('!') || normalized.includes('priorite')) return 'important';
	return null;
};

const detectTags = (rawText: string) =>
	Array.from(rawText.matchAll(/#([\p{L}\d_-]+)/gu)).map((match) => match[1].toLowerCase());

const detectTime = (rawText: string) => {
	const timeMatch = rawText.match(/(?:^|\s)(\d{1,2})(?:h|:)(\d{0,2})/i);
	if (!timeMatch) return { hours: 9, minutes: 0 };

	const hours = Math.min(23, Number(timeMatch[1] || 0));
	const minutes = Math.min(59, Number(timeMatch[2] || 0));
	return { hours, minutes };
};

const detectDate = (rawText: string) => {
	const normalized = normalizeText(rawText);
	const { hours, minutes } = detectTime(rawText);
	const now = new Date();

	if (normalized.includes("aujourd'hui") || normalized.includes('today')) {
		return dateOnlyToIso(now.toISOString().slice(0, 10), hours, minutes);
	}

	if (normalized.includes('demain') || normalized.includes('tomorrow')) {
		return dateOnlyToIso(addDays(now, 1).toISOString().slice(0, 10), hours, minutes);
	}

	for (const matcher of WEEKDAY_MATCHERS) {
		if (matcher.tokens.some((token) => normalized.includes(token))) {
			return matcher.build(now).toISOString().replace(/:\d{2}\.\d{3}z$/i, ':00.000Z');
		}
	}

	const explicitDate = rawText.match(/(\d{4})-(\d{2})-(\d{2})/);
	if (explicitDate) {
		return dateOnlyToIso(`${explicitDate[1]}-${explicitDate[2]}-${explicitDate[3]}`, hours, minutes);
	}

	return null;
};

const detectProject = (rawText: string, projects: Project[]) => {
	const normalized = normalizeText(rawText);
	const projectMatch = normalized.match(/(?:projet|project)\s+([a-z0-9][a-z0-9\s-]+)/i);

	if (!projectMatch) return null;

	const guess = projectMatch[1].trim();
	const project = projects.find((item) => normalizeText(item.title).includes(guess));
	return project?.id ?? null;
};

export const parseInboxText = (rawText: string, projects: Project[]): ParsedInboxDraft => ({
	raw_text: rawText.trim(),
	parsed_date: detectDate(rawText),
	parsed_priority: detectPriority(rawText),
	parsed_tags: detectTags(rawText),
	project_id: detectProject(rawText, projects)
});
