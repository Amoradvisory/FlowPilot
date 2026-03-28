<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onDestroy, tick } from 'svelte';
	import { fly } from 'svelte/transition';
	import { Mic } from 'lucide-svelte';
	import Card from '$lib/components/Card.svelte';
	import NoteContentRenderer from '$lib/components/NoteContentRenderer.svelte';
	import { flowpilot, notes } from '$lib/flowpilot';
	import {
		computeNoteVelocity,
		findRelatedNotes,
		matchesNoteQuery,
		type NoteIndexItem
	} from '$lib/nexus-notes';
	import {
		buildTemplateDraft,
		NOTE_TEMPLATES,
		type NoteTemplateId
	} from '$lib/nexus-note-templates';
	import {
		buildVaultTags,
		getDecayMeta,
		getLifeStateMeta,
		getPriorityMeta,
		getVaultMeta,
		NOTE_LIFE_STATE_OPTIONS,
		NOTE_COLOR_OPTIONS,
		NOTE_PRIORITY_OPTIONS,
		noteColorClasses,
		parseTagInput,
		priorityOrder,
		type VaultMeta,
		type VaultColor,
		type NoteLifeState,
		type NotePriorityLevel
	} from '$lib/note-vault';
	import {
		buildCopyableVaultText,
		buildVaultContent,
		detectAttachmentKindFromUrl,
		isAudioAttachment,
		isImageAttachment,
		isVideoAttachment,
		parseVaultContent,
		type VaultAttachment,
		type VaultAttachmentKind,
		type VaultDocument,
		vaultAttachmentKindLabel
	} from '$lib/vault-document';
	import type { Note } from '$lib/types';

	type VaultItem = NoteIndexItem & {
		note: Note;
		meta: VaultMeta;
		document: VaultDocument;
		colors: ReturnType<typeof noteColorClasses>;
	};
	type EditorFocusTarget = 'search' | 'title' | 'content';
	type SpeechRecognitionAlternativeLike = {
		transcript: string;
	};
	type SpeechRecognitionResultLike = {
		0: SpeechRecognitionAlternativeLike;
		isFinal: boolean;
		length: number;
	};
	type SpeechRecognitionEventLike = Event & {
		resultIndex: number;
		results: ArrayLike<SpeechRecognitionResultLike>;
	};
	type SpeechRecognitionErrorEventLike = Event & {
		error?: string;
	};
	type BrowserSpeechRecognition = EventTarget & {
		continuous: boolean;
		lang: string;
		interimResults: boolean;
		maxAlternatives: number;
		onresult: ((event: SpeechRecognitionEventLike) => void) | null;
		onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
		onend: (() => void) | null;
		start: () => void;
		stop: () => void;
		abort: () => void;
	};
	type SpeechRecognitionCtor = new () => BrowserSpeechRecognition;
	type SpeechRecognitionWindow = Window & {
		SpeechRecognition?: SpeechRecognitionCtor;
		webkitSpeechRecognition?: SpeechRecognitionCtor;
	};

	const MAX_EMBED_FILE_BYTES = 5 * 1024 * 1024;
	const NOTE_GRADIENT_ACCENTS: Record<VaultColor, string> = {
		blue: '#00D4FF',
		pink: '#7B2FFF',
		green: '#00FF9C',
		amber: '#FFB800',
		violet: '#7B2FFF',
		rose: '#FF2D55',
		slate: '#4A5580'
	};

	let search = $state('');
	let colorFilter = $state<'all' | VaultColor>('all');
	let pinnedOnly = $state(false);
	let showArchived = $state(false);
	let editingId = $state<string | null>(null);
	let title = $state('');
	let content = $state('');
	let color = $state<VaultColor>('blue');
	let priority = $state<NotePriorityLevel>('p3');
	let lifeState = $state<NoteLifeState>('seed');
	let tagInput = $state('');
	let pinned = $state(false);
	let copyMessage = $state<string | null>(null);
	let attachments = $state<VaultAttachment[]>([]);
	let attachmentUrl = $state('');
	let attachmentTitle = $state('');
	let attachmentKind = $state<VaultAttachmentKind>('link');
	let mediaMessage = $state<string | null>(null);
	let mediaMessageTone = $state<'error' | 'info'>('info');
	let fileInput = $state<HTMLInputElement | null>(null);
	let searchInput = $state<HTMLInputElement | null>(null);
	let titleInput = $state<HTMLInputElement | null>(null);
	let contentTextarea = $state<HTMLTextAreaElement | null>(null);
	let handledRouteQuery = $state('');
	let speechRecognition = $state<BrowserSpeechRecognition | null>(null);
	let isListening = $state(false);

	const vaultItems = $derived(
		$notes
			.filter((note) => !note.deleted_at)
			.map((note): VaultItem | null => {
				const meta = getVaultMeta(note);
				if (meta.kind !== 'note') return null;
				const document = parseVaultContent(note.content);
				return {
					note,
					meta,
					document,
					colors: noteColorClasses(meta.color)
				};
			})
			.filter((item): item is VaultItem => Boolean(item))
			.sort((left, right) => {
				if (left.meta.pinned !== right.meta.pinned)
					return Number(right.meta.pinned) - Number(left.meta.pinned);
				if (left.meta.priority !== right.meta.priority)
					return priorityOrder(left.meta.priority) - priorityOrder(right.meta.priority);
				return new Date(right.note.updated_at).getTime() - new Date(left.note.updated_at).getTime();
			})
	);

	const filteredItems = $derived(
		vaultItems.filter((item: VaultItem) => {
			if (!showArchived && item.meta.priority === 'p4') return false;
			if (colorFilter !== 'all' && item.meta.color !== colorFilter) return false;
			if (pinnedOnly && !item.meta.pinned) return false;
			return matchesNoteQuery(item, search);
		})
	);

	const ghostNoteCount = $derived(
		vaultItems.filter((item: VaultItem) => getDecayMeta(item.note, item.meta).band === 'ghost')
			.length
	);
	const mediaNoteCount = $derived(
		vaultItems.filter((item: VaultItem) => item.document.attachments.length > 0).length
	);
	const velocity = $derived(computeNoteVelocity(vaultItems));
	const relatedNoteMap = $derived.by(
		() => new Map(vaultItems.map((item) => [item.note.id, findRelatedNotes(item, vaultItems, 3)]))
	);
	const templateContext = $derived({
		now: new Date(),
		similarTitles: (search.trim() ? filteredItems : vaultItems)
			.filter((item: VaultItem) => item.note.id !== editingId)
			.map((item: VaultItem) => item.note.title)
			.slice(0, 3),
		hotTag: velocity.hotTag,
		todayCount: velocity.createdToday,
		weekCount: velocity.createdThisWeek
	});
	const voiceSupported = $derived(
		browser &&
			Boolean(
				(window as SpeechRecognitionWindow).SpeechRecognition ||
				(window as SpeechRecognitionWindow).webkitSpeechRecognition
			)
	);

	const setMediaMessage = (message: string | null, tone: 'error' | 'info' = 'info') => {
		mediaMessage = message;
		mediaMessageTone = tone;
	};

	const noteHeaderGradientStyle = (noteColor: VaultColor) => {
		const accent = NOTE_GRADIENT_ACCENTS[noteColor];
		return `background: linear-gradient(135deg, ${accent}2e 0%, ${accent}0a 100%);`;
	};

	const formatBytes = (value: number | null) => {
		if (!value) return null;
		return value >= 1024 * 1024
			? `${(value / (1024 * 1024)).toFixed(1)} Mo`
			: `${Math.max(1, Math.round(value / 1024))} Ko`;
	};

	const attachmentFallbackTitle = (url: string, kind: VaultAttachmentKind) => {
		try {
			const parsed = new URL(url);
			return parsed.hostname.replace(/^www\./, '') || vaultAttachmentKindLabel(kind);
		} catch {
			return vaultAttachmentKindLabel(kind);
		}
	};

	const resetForm = () => {
		if (isListening) {
			speechRecognition?.stop();
			isListening = false;
		}
		editingId = null;
		title = '';
		content = '';
		color = 'blue';
		priority = 'p3';
		lifeState = 'seed';
		tagInput = '';
		pinned = false;
		attachments = [];
		attachmentUrl = '';
		attachmentTitle = '';
		attachmentKind = 'link';
		setMediaMessage(null);
	};

	const focusEditorTarget = async (target: EditorFocusTarget = 'title') => {
		await tick();
		if (target === 'search') {
			searchInput?.focus();
			searchInput?.select();
			return;
		}
		if (target === 'content') {
			contentTextarea?.focus();
			contentTextarea?.setSelectionRange(content.length, content.length);
			return;
		}
		titleInput?.focus();
		titleInput?.select();
	};

	const speechRecognitionCtor = (): SpeechRecognitionCtor | null => {
		if (!browser) return null;
		const speechWindow = window as SpeechRecognitionWindow;
		return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
	};

	const ensureSpeechRecognition = () => {
		const Ctor = speechRecognitionCtor();
		if (!Ctor) return null;
		if (speechRecognition) return speechRecognition;

		const recognition = new Ctor();
		recognition.lang = 'fr-FR';
		recognition.continuous = true;
		recognition.interimResults = false;
		recognition.maxAlternatives = 1;
		recognition.onresult = (event) => {
			const transcriptParts: string[] = [];
			for (let index = event.resultIndex; index < event.results.length; index += 1) {
				const result = event.results[index];
				const transcript = result?.[0]?.transcript?.trim();
				if (result?.isFinal && transcript) {
					transcriptParts.push(transcript);
				}
			}

			if (transcriptParts.length) {
				const nextTranscript = transcriptParts.join('\n');
				content = content.trimEnd() ? `${content.trimEnd()}\n${nextTranscript}` : nextTranscript;
				void focusEditorTarget('content');
			}
		};
		recognition.onerror = (event) => {
			isListening = false;
			setMediaMessage(
				`Dictée vocale interrompue${event.error ? ` (${event.error})` : ''}.`,
				'error'
			);
		};
		recognition.onend = () => {
			isListening = false;
		};

		speechRecognition = recognition;
		return recognition;
	};

	const toggleVoiceCapture = async () => {
		const recognition = ensureSpeechRecognition();
		if (!recognition) {
			setMediaMessage('Web Speech API indisponible sur cet appareil.', 'error');
			return;
		}

		if (isListening) {
			recognition.stop();
			isListening = false;
			setMediaMessage('Dictée vocale arretee.');
			return;
		}

		try {
			recognition.start();
			isListening = true;
			setMediaMessage('Dictée vocale active. Parle maintenant.');
			await focusEditorTarget('content');
		} catch {
			setMediaMessage('Impossible de demarrer la dictée vocale.', 'error');
		}
	};

	const parseFocusTarget = (value: string | null): EditorFocusTarget =>
		value === 'search' || value === 'content' || value === 'title' ? value : 'title';

	const startEdit = (id: string) => {
		const current = vaultItems.find((item: VaultItem) => item.note.id === id);
		if (!current) return;
		editingId = id;
		title = current.note.title;
		content = current.document.plainText;
		color = current.meta.color;
		priority = current.meta.priority;
		lifeState = current.meta.lifeState;
		tagInput = current.meta.plainTags.join(', ');
		pinned = current.meta.pinned;
		attachments = current.document.attachments.map((attachment) => ({ ...attachment }));
		attachmentUrl = '';
		attachmentTitle = '';
		attachmentKind = 'link';
		setMediaMessage(null);
	};

	const applyTemplate = async (templateId: NoteTemplateId) => {
		const draft = buildTemplateDraft(templateId, templateContext);
		editingId = null;
		title = draft.title;
		content = draft.content;
		color = draft.color;
		priority = draft.priority;
		lifeState = draft.lifeState;
		tagInput = draft.tags.join(', ');
		pinned = false;
		attachments = [];
		attachmentUrl = '';
		attachmentTitle = '';
		attachmentKind = 'link';
		setMediaMessage(
			`Template ${NOTE_TEMPLATES.find((template) => template.id === templateId)?.label ?? 'charge'} applique.`
		);
		await focusEditorTarget(templateId === 'meeting' ? 'title' : 'content');
	};

	const addLinkAttachment = () => {
		const url = attachmentUrl.trim();
		if (!url) return;
		const detectedKind =
			attachmentKind === 'link' ? detectAttachmentKindFromUrl(url) : attachmentKind;
		attachments = [
			...attachments,
			{
				id: crypto.randomUUID(),
				kind: detectedKind,
				title: attachmentTitle.trim() || attachmentFallbackTitle(url, detectedKind),
				url,
				mimeType: null,
				sizeBytes: null
			}
		];
		attachmentUrl = '';
		attachmentTitle = '';
		attachmentKind = 'link';
		setMediaMessage('Ressource ajoutee a la note.');
	};

	const removeAttachment = (id: string) => {
		attachments = attachments.filter((attachment) => attachment.id !== id);
	};

	const openMediaPicker = () => {
		fileInput?.click();
	};

	const readFileAsDataUrl = (file: File) =>
		new Promise<string>((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(String(reader.result ?? ''));
			reader.onerror = () => reject(reader.error);
			reader.readAsDataURL(file);
		});

	const kindFromMimeType = (mimeType: string): VaultAttachmentKind => {
		if (mimeType.startsWith('image/')) return 'image';
		if (mimeType.startsWith('video/')) return 'video';
		if (mimeType.startsWith('audio/')) return 'audio';
		return 'link';
	};

	const ingestFiles = async (files: File[]) => {
		const incoming: VaultAttachment[] = [];
		let rejectedCount = 0;

		for (const file of files) {
			if (file.size > MAX_EMBED_FILE_BYTES) {
				rejectedCount += 1;
				continue;
			}

			try {
				const dataUrl = await readFileAsDataUrl(file);
				incoming.push({
					id: crypto.randomUUID(),
					kind: kindFromMimeType(file.type),
					title: file.name,
					url: dataUrl,
					mimeType: file.type || null,
					sizeBytes: file.size
				});
			} catch {
				rejectedCount += 1;
			}
		}

		if (incoming.length) {
			attachments = [...attachments, ...incoming];
			setMediaMessage(
				`${incoming.length} media(s) ajoute(s)${rejectedCount ? `, ${rejectedCount} ignore(s)` : ''}.`,
				rejectedCount ? 'error' : 'info'
			);
			return;
		}

		if (rejectedCount) {
			setMediaMessage(
				`Impossible d'ajouter ces medias. Limite actuelle: ${formatBytes(MAX_EMBED_FILE_BYTES)} par fichier. // V2: storage dedie.`,
				'error'
			);
		}
	};

	const handleMediaSelection = async (event: Event) => {
		const input = event.currentTarget as HTMLInputElement;
		const files = Array.from(input.files ?? []);
		if (!files.length) return;
		await ingestFiles(files);
		input.value = '';
	};

	const submit = async () => {
		const trimmedContent = content.trim();
		const nextTitle =
			title.trim() ||
			trimmedContent.split('\n')[0].trim().slice(0, 72) ||
			attachments[0]?.title ||
			'Nouvelle note';

		const payload = {
			title: nextTitle,
			content: buildVaultContent(trimmedContent, attachments),
			project_id: null,
			tags: buildVaultTags({
				kind: 'note',
				color,
				pinned,
				priority,
				lifeState,
				plainTags: parseTagInput(tagInput)
			})
		};

		if (editingId) {
			await flowpilot.updateNote(editingId, payload);
		} else {
			await flowpilot.createNote(payload);
		}

		resetForm();
	};

	const togglePinned = async (id: string) => {
		const current = vaultItems.find((item: VaultItem) => item.note.id === id);
		if (!current) return;
		await flowpilot.updateNote(id, {
			tags: buildVaultTags({
				kind: 'note',
				color: current.meta.color,
				pinned: !current.meta.pinned,
				priority: current.meta.priority,
				lifeState: current.meta.lifeState,
				plainTags: current.meta.plainTags
			})
		});
	};

	const duplicate = async (id: string) => {
		const current = vaultItems.find((item: VaultItem) => item.note.id === id);
		if (!current) return;
		await flowpilot.createNote({
			title: `${current.note.title} copie`,
			content: current.note.content,
			project_id: null,
			tags: current.note.tags
		});
	};

	const copyContent = async (id: string, value: string | null) => {
		if (!browser) return;
		const copyable = buildCopyableVaultText(value);
		if (!copyable) return;
		await navigator.clipboard.writeText(copyable);
		copyMessage = id;
		setTimeout(() => {
			if (copyMessage === id) copyMessage = null;
		}, 1600);
	};

	onDestroy(() => {
		speechRecognition?.abort();
	});

	$effect(() => {
		if (page.url.pathname !== '/vault') return;

		const params = page.url.searchParams;
		const query = params.toString();
		if (!query) {
			handledRouteQuery = '';
			return;
		}

		const routeToken = `${page.url.pathname}?${query}`;
		if (handledRouteQuery === routeToken) return;
		handledRouteQuery = routeToken;

		void (async () => {
			const focusTarget = parseFocusTarget(params.get('focus'));
			const editId = params.get('edit');
			const templateId = params.get('template') as NoteTemplateId | null;
			const shouldReset = params.get('new') === '1';

			if (editId) {
				startEdit(editId);
				await focusEditorTarget(focusTarget === 'search' ? 'title' : focusTarget);
			} else if (templateId && NOTE_TEMPLATES.some((template) => template.id === templateId)) {
				await applyTemplate(templateId);
				if (focusTarget !== 'content') {
					await focusEditorTarget(focusTarget);
				}
			} else if (shouldReset) {
				resetForm();
				await focusEditorTarget(focusTarget);
			} else {
				await focusEditorTarget(focusTarget);
			}

			await goto('/vault', {
				replaceState: true,
				noScroll: true,
				keepFocus: true
			});
		})();
	});
</script>

<div class="space-y-4">
	<Card
		tone="active"
		class="overflow-hidden border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(0,212,255,0.18),transparent_38%),radial-gradient(circle_at_top_right,rgba(123,47,255,0.12),transparent_34%),#101114]"
	>
		<div class="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
			<div class="max-w-3xl">
				<p class="text-xs tracking-[0.22em] text-[#8fcaff] uppercase">Bibliotheque</p>
				<h1 class="mt-3 text-3xl font-semibold text-white">
					Toutes les notes, sans dossiers rigides
				</h1>
				<p class="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">
					Recherche avancee, priorites chromees, etat de vie, decay visible et liens implicites
					entre les notes.
				</p>
			</div>

			<div class="grid gap-3 sm:grid-cols-3">
				<div class="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
					<p class="text-xs tracking-[0.16em] text-zinc-500 uppercase">Notes</p>
					<p class="mt-2 text-2xl font-semibold text-white">{vaultItems.length}</p>
				</div>
				<div class="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
					<p class="text-xs tracking-[0.16em] text-zinc-500 uppercase">Media</p>
					<p class="mt-2 text-2xl font-semibold text-white">{mediaNoteCount}</p>
				</div>
				<div class="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
					<p class="text-xs tracking-[0.16em] text-zinc-500 uppercase">Fantomes</p>
					<p class="mt-2 text-2xl font-semibold text-white">{ghostNoteCount}</p>
				</div>
			</div>
		</div>
	</Card>

	<div class="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
		<Card class="xl:sticky xl:top-24">
			<div class="flex items-center justify-between gap-3">
				<div>
					<p class="text-xs tracking-[0.2em] text-zinc-500 uppercase">Editeur</p>
					<h2 class="mt-2 text-xl font-semibold text-white">
						{editingId ? 'Modifier une note' : 'Ajouter une note'}
					</h2>
				</div>
				<div class="flex items-center gap-2">
					<button
						class={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm transition ${
							isListening
								? 'voice-live border-[#FF2D55]/50 bg-[#FF2D55]/14 text-white'
								: 'border-white/10 text-zinc-300 hover:border-white/20 hover:text-white'
						} ${!voiceSupported ? 'cursor-not-allowed opacity-50' : ''}`}
						type="button"
						disabled={!voiceSupported}
						onclick={() => void toggleVoiceCapture()}
					>
						<Mic size={16} strokeWidth={2} />
						<span>{isListening ? 'Voix active' : 'Voix'}</span>
					</button>
					{#if editingId}
						<button
							class="rounded-2xl border border-white/10 px-3 py-2 text-sm text-zinc-300"
							type="button"
							onclick={resetForm}
						>
							Annuler
						</button>
					{/if}
				</div>
			</div>

			<div class="mt-4 space-y-4">
				<input
					bind:this={titleInput}
					class="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white transition outline-none focus:border-[#00D4FF]/40"
					placeholder="Titre"
					bind:value={title}
				/>

				<div class="rounded-3xl border border-white/8 bg-black/15 p-4">
					<div class="flex items-start justify-between gap-4">
						<div>
							<p class="text-xs tracking-[0.2em] text-zinc-500 uppercase">Templates intelligents</p>
							<p class="mt-2 text-sm text-zinc-400">
								Des bases solides pour reunion, bug, idee produit ou revue. Remplissage partiel avec
								le contexte de tes notes.
							</p>
						</div>
						<button
							class="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300"
							type="button"
							onclick={() => void focusEditorTarget('content')}
						>
							Ctrl+Shift+N
						</button>
					</div>
					<div class="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
						{#each NOTE_TEMPLATES as template}
							{@const templatePriority = NOTE_PRIORITY_OPTIONS.find(
								(option) => option.value === template.priority
							)}
							<button
								class="rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-left transition hover:border-white/16"
								type="button"
								onclick={() => void applyTemplate(template.id)}
							>
								<div class="flex items-center justify-between gap-3">
									<p class="text-sm font-medium text-white">{template.label}</p>
									<span
										class="rounded-full border px-2 py-0.5 text-[11px]"
										style={`border-color: ${templatePriority?.accent ?? '#8fcaff'}44; background: ${templatePriority?.accent ?? '#8fcaff'}18; color: ${templatePriority?.accent ?? '#8fcaff'};`}
									>
										{template.priority.toUpperCase()}
									</span>
								</div>
								<p class="mt-2 text-sm text-zinc-400">{template.description}</p>
							</button>
						{/each}
					</div>
				</div>

				<div>
					<p class="mb-2 text-xs tracking-[0.2em] text-zinc-500 uppercase">Couleur</p>
					<div class="flex flex-wrap gap-2">
						{#each NOTE_COLOR_OPTIONS as option}
							<button
								class={`rounded-full border px-3 py-2 text-xs font-medium transition ${color === option.value ? 'border-white/30 text-white shadow-[0_0_18px_rgba(255,255,255,0.08)]' : 'border-white/10 text-zinc-400'}`}
								style={`background: linear-gradient(135deg, ${option.accent}22, rgba(17,17,17,0.95));`}
								type="button"
								onclick={() => (color = option.value)}
							>
								{option.label}
							</button>
						{/each}
					</div>
				</div>

				<div>
					<p class="mb-2 text-xs tracking-[0.2em] text-zinc-500 uppercase">Priorite chromee</p>
					<div class="flex flex-wrap gap-2">
						{#each NOTE_PRIORITY_OPTIONS as option}
							<button
								class={`rounded-full border px-3 py-2 text-xs font-medium transition ${priority === option.value ? 'text-white shadow-[0_0_18px_rgba(255,255,255,0.08)]' : 'border-white/10 text-zinc-400'}`}
								style={`border-color: ${priority === option.value ? `${option.accent}66` : ''}; background: linear-gradient(135deg, ${option.accent}22, rgba(15,22,41,0.95));`}
								type="button"
								onclick={() => (priority = option.value)}
							>
								{option.icon}
								{option.shortLabel}
							</button>
						{/each}
					</div>
				</div>

				<div>
					<p class="mb-2 text-xs tracking-[0.2em] text-zinc-500 uppercase">Etat de vie</p>
					<div class="flex flex-wrap gap-2">
						{#each NOTE_LIFE_STATE_OPTIONS as option}
							<button
								class={`rounded-full border px-3 py-2 text-xs font-medium transition ${lifeState === option.value ? 'border-white/30 bg-white/8 text-white' : 'border-white/10 text-zinc-400'}`}
								type="button"
								onclick={() => (lifeState = option.value)}
							>
								{option.icon}
								{option.label}
							</button>
						{/each}
					</div>
				</div>

				<input
					class="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white transition outline-none focus:border-[#00D4FF]/40"
					placeholder="Tags libres, separes par virgules ou #"
					bind:value={tagInput}
				/>

				<div
					class="rounded-3xl border border-white/8 bg-[linear-gradient(135deg,rgba(123,47,255,0.08),transparent_55%),rgba(255,255,255,0.01)] p-4"
				>
					<div class="flex flex-col gap-3">
						<div>
							<p class="text-xs tracking-[0.2em] text-zinc-500 uppercase">Medias et liens</p>
							<p class="mt-2 text-sm text-zinc-400">
								Ajoute une image, une video, un audio ou un lien directement dans la note.
							</p>
						</div>

						<div class="grid gap-3 md:grid-cols-[0.9fr_1.3fr_auto]">
							<select
								class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
								bind:value={attachmentKind}
							>
								<option value="link">Lien</option>
								<option value="image">Image</option>
								<option value="video">Video</option>
								<option value="audio">Audio</option>
							</select>
							<input
								class="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white transition outline-none focus:border-[#00D4FF]/40"
								placeholder="URL d une ressource, video ou page importante"
								bind:value={attachmentUrl}
							/>
							<button
								class="rounded-2xl border border-white/10 px-4 py-3 text-sm text-white"
								type="button"
								onclick={addLinkAttachment}
							>
								Ajouter le lien
							</button>
						</div>

						<div class="grid gap-3 md:grid-cols-[1fr_auto]">
							<input
								class="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white transition outline-none focus:border-[#00D4FF]/40"
								placeholder="Titre optionnel pour la ressource"
								bind:value={attachmentTitle}
							/>
							<button
								class="rounded-2xl bg-[#7B2FFF] px-4 py-3 text-sm font-medium text-white shadow-[0_0_18px_rgba(123,47,255,0.18)]"
								type="button"
								onclick={openMediaPicker}
							>
								Importer un media
							</button>
						</div>

						<input
							class="hidden"
							type="file"
							accept="image/*,video/*,audio/*"
							multiple
							bind:this={fileInput}
							onchange={handleMediaSelection}
						/>

						{#if mediaMessage}
							<p
								class={`text-sm ${mediaMessageTone === 'error' ? 'text-rose-300' : 'text-[#8fcaff]'}`}
							>
								{mediaMessage}
							</p>
						{/if}

						{#if attachments.length}
							<div class="grid gap-2">
								{#each attachments as attachment}
									<div
										class="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/20 px-4 py-3"
									>
										<div class="min-w-0">
											<p class="truncate text-sm font-medium text-white">{attachment.title}</p>
											<p class="mt-1 text-xs text-zinc-400">
												{vaultAttachmentKindLabel(attachment.kind)}
												{#if formatBytes(attachment.sizeBytes)}
													- {formatBytes(attachment.sizeBytes)}
												{/if}
											</p>
										</div>
										<button
											class="rounded-full border border-red-500/20 px-3 py-1 text-xs text-red-300"
											type="button"
											onclick={() => removeAttachment(attachment.id)}
										>
											Retirer
										</button>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>

				<textarea
					bind:this={contentTextarea}
					class="min-h-[240px] w-full rounded-3xl border border-white/10 bg-black/20 px-4 py-4 text-sm leading-6 text-white transition outline-none focus:border-[#00D4FF]/40"
					placeholder="Contenu de la note, commentaire de photo, memo ou idee detaillee"
					bind:value={content}
				></textarea>

				<div
					class="rounded-3xl border border-white/8 bg-[linear-gradient(135deg,rgba(0,212,255,0.08),transparent_58%),rgba(255,255,255,0.01)] p-4"
				>
					<p class="text-xs tracking-[0.2em] text-zinc-500 uppercase">Apercu vivant</p>
					<p class="mt-2 text-sm text-zinc-400">
						Checklists, citations, formules, tableaux et blocs de code prennent forme avant meme
						l'enregistrement.
					</p>
					<div class="mt-4 rounded-2xl border border-white/8 bg-black/20 p-4">
						<NoteContentRenderer text={content} />
					</div>
				</div>

				<label
					class="flex items-center gap-3 rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-zinc-300"
				>
					<input class="h-4 w-4 accent-[#7B2FFF]" type="checkbox" bind:checked={pinned} />
					Pingler pour garder cette note en haut
				</label>

				<div class="flex flex-wrap gap-2">
					<button
						class="rounded-2xl bg-[#00D4FF] px-4 py-3 text-sm font-semibold text-[#0A0E1A] shadow-[0_0_18px_rgba(0,212,255,0.2)]"
						type="button"
						onclick={submit}
					>
						{editingId ? 'Mettre a jour' : 'Ajouter la note'}
					</button>
					<button
						class="rounded-2xl border border-white/10 px-4 py-3 text-sm text-zinc-300"
						type="button"
						onclick={resetForm}
					>
						Vider
					</button>
				</div>
			</div>
		</Card>

		<div class="space-y-4">
			<Card class="bg-[#111]">
				<div class="flex flex-col gap-3">
					<input
						bind:this={searchInput}
						class="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white transition outline-none focus:border-[#00D4FF]/40"
						placeholder="Recherche globale: budget, tag:client-x, priority:p1, state:seed, media:yes"
						bind:value={search}
					/>

					<div class="flex flex-wrap gap-2">
						<button
							class={`rounded-full px-3 py-2 text-xs font-medium transition ${colorFilter === 'all' ? 'bg-white text-black' : 'border border-white/10 text-zinc-300'}`}
							type="button"
							onclick={() => (colorFilter = 'all')}
						>
							Toutes les couleurs
						</button>
						{#each NOTE_COLOR_OPTIONS as option}
							<button
								class={`rounded-full border px-3 py-2 text-xs font-medium transition ${colorFilter === option.value ? 'border-white/30 text-white' : 'border-white/10 text-zinc-300'}`}
								style={`background: linear-gradient(135deg, ${option.accent}22, rgba(17,17,17,0.95));`}
								type="button"
								onclick={() => (colorFilter = option.value)}
							>
								{option.label}
							</button>
						{/each}
					</div>

					<div class="grid gap-3 md:grid-cols-2">
						<label class="flex items-center gap-3 text-sm text-zinc-300">
							<input class="h-4 w-4 accent-[#7B2FFF]" type="checkbox" bind:checked={pinnedOnly} />
							Afficher seulement les notes epinglees
						</label>

						<label class="flex items-center gap-3 text-sm text-zinc-300">
							<input class="h-4 w-4 accent-[#00D4FF]" type="checkbox" bind:checked={showArchived} />
							Afficher aussi les notes archivees P4
						</label>
					</div>
				</div>
			</Card>

			<div class="vault-masonry">
				{#if filteredItems.length}
					{#each filteredItems as item, index (item.note.id)}
						<div class="vault-masonry-item" in:fly={{ y: 16, duration: 200, delay: index * 25 }}>
							<Card class={`overflow-hidden ${item.colors.card}`} padding="p-0">
								<div
									class="h-12 border-b border-white/8"
									style={noteHeaderGradientStyle(item.meta.color)}
								></div>
								<div class="p-5">
									<div class="flex items-start justify-between gap-3">
										<div class="flex items-center gap-2">
											<span class={`h-2.5 w-2.5 rounded-full ${item.colors.dot}`}></span>
											<span
												class={`rounded-full border px-2.5 py-1 text-[11px] tracking-[0.16em] uppercase ${item.colors.chip}`}
												>Note</span
											>
											<span
												class={`rounded-full border px-2.5 py-1 text-[11px] tracking-[0.16em] uppercase ${item.meta.priority === 'p0' ? 'animate-pulse' : ''}`}
												style={`border-color: ${getPriorityMeta(item.meta.priority).accent}44; background: ${getPriorityMeta(item.meta.priority).accent}18; color: ${getPriorityMeta(item.meta.priority).accent};`}
											>
												{getPriorityMeta(item.meta.priority).shortLabel}
											</span>
											<span
												class="rounded-full border border-white/10 px-2 py-1 text-[11px] tracking-[0.16em] text-zinc-300 uppercase"
											>
												{getLifeStateMeta(item.meta.lifeState).icon}
												{getLifeStateMeta(item.meta.lifeState).label}
											</span>
											{#if item.meta.pinned}
												<span
													class="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-[11px] tracking-[0.16em] text-amber-200 uppercase"
												>
													Pin
												</span>
											{/if}
											<span
												class="rounded-full border border-white/10 px-2 py-1 text-[11px] tracking-[0.16em] text-zinc-400 uppercase"
											>
												{getDecayMeta(item.note, item.meta).label}
											</span>
										</div>

										<div class="flex flex-wrap justify-end gap-2">
											<button
												class="rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-300"
												type="button"
												onclick={() => copyContent(item.note.id, item.note.content)}
											>
												{copyMessage === item.note.id ? 'Copie' : 'Copier'}
											</button>
											<button
												class="rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-300"
												type="button"
												onclick={() => startEdit(item.note.id)}
											>
												Editer
											</button>
											<button
												class="rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-300"
												type="button"
												onclick={() => togglePinned(item.note.id)}
											>
												{item.meta.pinned ? 'Unpin' : 'Pin'}
											</button>
											<button
												class="rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-300"
												type="button"
												onclick={() => duplicate(item.note.id)}
											>
												Dupliquer
											</button>
											<button
												class="rounded-full border border-red-500/20 px-2.5 py-1 text-xs text-red-300"
												type="button"
												onclick={() => flowpilot.deleteNote(item.note.id)}
											>
												Supprimer
											</button>
										</div>
									</div>

									<h2 class="mt-4 text-xl font-semibold text-white">{item.note.title}</h2>

									{#if item.document.plainText}
										<div class="mt-4 rounded-2xl border border-white/6 bg-black/25 p-4">
											<NoteContentRenderer text={item.document.plainText} compact />
										</div>
									{:else if !item.document.attachments.length}
										<p class="mt-4 text-sm text-zinc-500">Contenu vide.</p>
									{/if}

									{#if item.document.attachments.length}
										<div class="mt-4 space-y-3">
											{#each item.document.attachments as attachment}
												<div class="overflow-hidden rounded-2xl border border-white/8 bg-black/25">
													<div
														class="flex items-center justify-between gap-3 border-b border-white/6 px-4 py-3"
													>
														<div>
															<p class="text-sm font-medium text-white">{attachment.title}</p>
															<p class="mt-1 text-xs text-zinc-400">
																{vaultAttachmentKindLabel(attachment.kind)}
																{#if formatBytes(attachment.sizeBytes)}
																	- {formatBytes(attachment.sizeBytes)}
																{/if}
															</p>
														</div>
														<a
															class="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300"
															href={attachment.url}
															target="_blank"
															rel="noreferrer"
														>
															Ouvrir
														</a>
													</div>

													{#if isImageAttachment(attachment)}
														<img
															class="max-h-72 w-full object-cover"
															src={attachment.url}
															alt={attachment.title}
														/>
													{:else if isVideoAttachment(attachment)}
														<!-- svelte-ignore a11y_media_has_caption -->
														<video
															class="max-h-72 w-full bg-black"
															src={attachment.url}
															controls
															preload="metadata"
														></video>
													{:else if isAudioAttachment(attachment)}
														<div class="px-4 py-4">
															<audio class="w-full" src={attachment.url} controls preload="metadata"
															></audio>
														</div>
													{:else}
														<div class="px-4 py-4">
															<p class="text-sm break-all text-zinc-300">{attachment.url}</p>
														</div>
													{/if}
												</div>
											{/each}
										</div>
									{/if}

									{#if item.meta.plainTags.length}
										<div class="mt-4 flex flex-wrap gap-2">
											{#each item.meta.plainTags as tag}
												<span
													class="rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-300"
												>
													#{tag}
												</span>
											{/each}
										</div>
									{/if}

									{#if (relatedNoteMap.get(item.note.id)?.length ?? 0) > 0}
										<div class="mt-4 rounded-2xl border border-white/8 bg-black/20 p-4">
											<p class="text-xs tracking-[0.16em] text-zinc-500 uppercase">
												Liens implicites
											</p>
											<div class="mt-3 flex flex-wrap gap-2">
												{#each relatedNoteMap.get(item.note.id) ?? [] as related}
													<button
														class="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300"
														type="button"
														onclick={() => startEdit(related.note.id)}
													>
														{related.note.title}
													</button>
												{/each}
											</div>
										</div>
									{/if}

									<p class="mt-4 text-xs text-zinc-500">
										Mis a jour le {new Date(item.note.updated_at).toLocaleString('fr-FR')} - {getDecayMeta(
											item.note,
											item.meta
										).daysOld} jour(s)
									</p>
								</div>
							</Card>
						</div>
					{/each}
				{:else}
					<Card>
						<p class="text-lg font-medium text-white">Aucune note pour ce filtre</p>
						<p class="mt-2 text-sm text-zinc-400">
							Ajoute une note, une photo commentee, ou assouplis les filtres actifs.
						</p>
					</Card>
				{/if}
			</div>
		</div>
	</div>
</div>
