export const MAX_OBSERVATIONS = 6;
export const MAX_NOTE_LENGTH = 240;

export type ObservationSignal = 'worked' | 'blocked' | 'try';

export type DemoObservation = {
	id: string;
	signal: ObservationSignal;
	note: string;
	capturedAt: string;
	nextAction: string;
};

type ObservationInput = {
	id: string;
	signal: ObservationSignal;
	note: string;
	capturedAt: string;
};

const signals = new Set<ObservationSignal>(['worked', 'blocked', 'try']);

const isSignal = (value: unknown): value is ObservationSignal =>
	typeof value === 'string' && signals.has(value as ObservationSignal);

const normalizeNote = (value: string) =>
	value.trim().replace(/\s+/g, ' ').slice(0, MAX_NOTE_LENGTH);

const deriveNextAction = (signal: ObservationSignal, note: string) => {
	switch (signal) {
		case 'worked':
			return `Capitaliser : ${note}`;
		case 'blocked':
			return `Clarifier la consigne : ${note}`;
		case 'try':
			return `Tester au prochain cours : ${note}`;
	}
};

export const createObservation = ({
	id,
	signal,
	note,
	capturedAt
}: ObservationInput): DemoObservation => {
	const normalizedNote = normalizeNote(note);

	if (!normalizedNote) {
		throw new Error('Une observation utile est requise.');
	}

	if (!id.trim() || !capturedAt.trim() || !isSignal(signal)) {
		throw new Error('La capture de démonstration est incomplète.');
	}

	return {
		id: id.trim(),
		signal,
		note: normalizedNote,
		capturedAt,
		nextAction: deriveNextAction(signal, normalizedNote)
	};
};

export const addObservation = (
	history: DemoObservation[],
	observation: DemoObservation
): DemoObservation[] => [observation, ...history].slice(0, MAX_OBSERVATIONS);

export const restoreObservations = (raw: string | null): DemoObservation[] => {
	if (!raw) return [];

	try {
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];

		return parsed
			.flatMap((entry): DemoObservation[] => {
				if (!entry || typeof entry !== 'object') return [];
				const candidate = entry as Record<string, unknown>;
				if (
					typeof candidate.id !== 'string' ||
					typeof candidate.note !== 'string' ||
					typeof candidate.capturedAt !== 'string' ||
					!isSignal(candidate.signal)
				) {
					return [];
				}

				try {
					return [
						createObservation({
							id: candidate.id,
							signal: candidate.signal,
							note: candidate.note,
							capturedAt: candidate.capturedAt
						})
					];
				} catch {
					return [];
				}
			})
			.slice(0, MAX_OBSERVATIONS);
	} catch {
		return [];
	}
};
