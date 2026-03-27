import type { Note } from '$lib/types';

export type VaultAttachmentKind = 'image' | 'video' | 'audio' | 'link';

export interface VaultAttachment {
	id: string;
	kind: VaultAttachmentKind;
	title: string;
	url: string;
	mimeType: string | null;
	sizeBytes: number | null;
}

export interface VaultDocument {
	plainText: string;
	attachments: VaultAttachment[];
}

const VAULT_DOCUMENT_PREFIX = 'FLOWPILOT_VAULT_V1::';

const IMAGE_URL_PATTERN = /\.(png|jpe?g|gif|webp|svg|avif)(\?.*)?$/i;
const VIDEO_URL_PATTERN = /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i;
const AUDIO_URL_PATTERN = /\.(mp3|wav|ogg|m4a|aac|flac)(\?.*)?$/i;

const normalizeAttachment = (attachment: Partial<VaultAttachment> | null | undefined): VaultAttachment | null => {
	if (!attachment?.url?.trim()) return null;

	const title = attachment.title?.trim() || 'Ressource';
	const url = attachment.url.trim();
	const kind = attachment.kind ?? detectAttachmentKindFromUrl(url);

	return {
		id: attachment.id?.trim() || crypto.randomUUID(),
		kind,
		title,
		url,
		mimeType: attachment.mimeType?.trim() || null,
		sizeBytes: typeof attachment.sizeBytes === 'number' ? attachment.sizeBytes : null
	};
};

const sanitizeAttachments = (attachments: Array<Partial<VaultAttachment> | null | undefined>) =>
	attachments
		.map((attachment) => normalizeAttachment(attachment))
		.filter((attachment): attachment is VaultAttachment => Boolean(attachment));

export const parseVaultContent = (content: string | null | undefined): VaultDocument => {
	if (!content) {
		return { plainText: '', attachments: [] };
	}

	if (!content.startsWith(VAULT_DOCUMENT_PREFIX)) {
		return { plainText: content, attachments: [] };
	}

	try {
		const parsed = JSON.parse(content.slice(VAULT_DOCUMENT_PREFIX.length)) as Partial<VaultDocument>;
		return {
			plainText: parsed.plainText?.trim() ?? '',
			attachments: sanitizeAttachments(parsed.attachments ?? [])
		};
	} catch {
		return { plainText: content, attachments: [] };
	}
};

export const buildVaultContent = (plainText: string, attachments: VaultAttachment[]) => {
	const trimmedText = plainText.trim();
	const sanitizedAttachments = sanitizeAttachments(attachments);

	if (!trimmedText && !sanitizedAttachments.length) return null;
	if (!sanitizedAttachments.length) return trimmedText || null;

	return `${VAULT_DOCUMENT_PREFIX}${JSON.stringify({
		plainText: trimmedText,
		attachments: sanitizedAttachments
	})}`;
};

export const summarizeVaultContent = (content: string | null | undefined, maxLength = 140) => {
	const document = parseVaultContent(content);
	if (document.plainText) {
		return document.plainText.length > maxLength
			? `${document.plainText.slice(0, maxLength - 1).trimEnd()}…`
			: document.plainText;
	}
	if (document.attachments.length) {
		return `${document.attachments.length} ressource(s) jointe(s)`;
	}
	return 'Note vide';
};

export const buildCopyableVaultText = (content: string | null | undefined) => {
	const document = parseVaultContent(content);
	const attachmentLines = document.attachments.map(
		(attachment) => `${attachment.title}: ${attachment.url}`
	);
	return [document.plainText, ...attachmentLines].filter(Boolean).join('\n\n');
};

export const searchableVaultText = (note: Pick<Note, 'title' | 'content' | 'tags'>) => {
	const document = parseVaultContent(note.content);
	return [
		note.title,
		document.plainText,
		...document.attachments.flatMap((attachment) => [attachment.title, attachment.url]),
		...note.tags
	]
		.join(' ')
		.toLowerCase();
};

export const detectAttachmentKindFromUrl = (url: string): VaultAttachmentKind => {
	const normalized = url.trim().toLowerCase();
	if (normalized.startsWith('data:image/') || IMAGE_URL_PATTERN.test(normalized)) return 'image';
	if (normalized.startsWith('data:video/') || VIDEO_URL_PATTERN.test(normalized)) return 'video';
	if (normalized.startsWith('data:audio/') || AUDIO_URL_PATTERN.test(normalized)) return 'audio';
	return 'link';
};

export const isImageAttachment = (attachment: VaultAttachment) =>
	attachment.url.startsWith('data:image/') ||
	attachment.mimeType?.startsWith('image/') ||
	IMAGE_URL_PATTERN.test(attachment.url);

export const isVideoAttachment = (attachment: VaultAttachment) =>
	attachment.url.startsWith('data:video/') ||
	attachment.mimeType?.startsWith('video/') ||
	VIDEO_URL_PATTERN.test(attachment.url);

export const isAudioAttachment = (attachment: VaultAttachment) =>
	attachment.url.startsWith('data:audio/') ||
	attachment.mimeType?.startsWith('audio/') ||
	AUDIO_URL_PATTERN.test(attachment.url);

export const vaultAttachmentKindLabel = (kind: VaultAttachmentKind) =>
	({
		image: 'Image',
		video: 'Video',
		audio: 'Audio',
		link: 'Lien'
	})[kind];
