<script lang="ts">
	import { browser } from '$app/environment';
	import Card from '$lib/components/Card.svelte';
	import { flowpilot, notes, projects } from '$lib/flowpilot';
	import type { Note, Project } from '$lib/types';
	import {
		buildVaultTags,
		defaultTitleForKind,
		getVaultMeta,
		matchVaultQuery,
		NOTE_COLOR_OPTIONS,
		noteColorClasses,
		NOTE_KIND_OPTIONS,
		NOTE_TEMPLATES,
		parseTagInput,
		type VaultMeta,
		type VaultColor,
		type VaultKind,
		vaultKindLabel
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

	type VaultItem = {
		note: Note;
		meta: VaultMeta;
		project: Project | null;
		document: VaultDocument;
		colors: ReturnType<typeof noteColorClasses>;
	};

	const MAX_EMBED_FILE_BYTES = 5 * 1024 * 1024;

	let search = $state('');
	let kindFilter = $state<'all' | VaultKind>('all');
	let colorFilter = $state<'all' | VaultColor>('all');
	let pinnedOnly = $state(false);
	let editingId = $state<string | null>(null);
	let title = $state('');
	let content = $state('');
	let kind = $state<VaultKind>('note');
	let color = $state<VaultColor>('blue');
	let language = $state('');
	let tagInput = $state('');
	let projectId = $state('');
	let pinned = $state(false);
	let copyMessage = $state<string | null>(null);
	let attachments = $state<VaultAttachment[]>([]);
	let attachmentUrl = $state('');
	let attachmentTitle = $state('');
	let attachmentKind = $state<VaultAttachmentKind>('link');
	let quickCaptureText = $state('');
	let quickCaptureAttachments = $state<VaultAttachment[]>([]);
	let quickCaptureMessage = $state<string | null>(null);
	let quickCaptureMessageTone = $state<'error' | 'info'>('info');
	let lastQuickCaptureId = $state<string | null>(null);
	let mediaMessage = $state<string | null>(null);
	let mediaMessageTone = $state<'error' | 'info'>('info');
	let fileInput: HTMLInputElement | null = null;
	let quickCameraInput: HTMLInputElement | null = null;
	let quickMediaInput: HTMLInputElement | null = null;

	const vaultItems = $derived(
		$notes
			.filter((note) => !note.deleted_at)
			.map((note): VaultItem => {
				const meta = getVaultMeta(note);
				const document = parseVaultContent(note.content);
				return {
					note,
					meta,
					project: $projects.find((project) => project.id === note.project_id) ?? null,
					document,
					colors: noteColorClasses(meta.color)
				};
			})
			.sort((left, right) => {
				if (left.meta.pinned !== right.meta.pinned) return Number(right.meta.pinned) - Number(left.meta.pinned);
				return new Date(right.note.updated_at).getTime() - new Date(left.note.updated_at).getTime();
			})
	);

	const filteredItems = $derived(
		vaultItems.filter((item: VaultItem) => {
			if (kindFilter !== 'all' && item.meta.kind !== kindFilter) return false;
			if (colorFilter !== 'all' && item.meta.color !== colorFilter) return false;
			if (pinnedOnly && !item.meta.pinned) return false;
			return matchVaultQuery(item.note, search);
		})
	);

	const recentQuickCaptures = $derived(
		vaultItems
			.filter((item: VaultItem) => item.meta.kind === 'note' && item.meta.plainTags.includes('capture-rapide'))
			.slice(0, 4)
	);

	const pinnedCount = $derived(vaultItems.filter((item: VaultItem) => item.meta.pinned).length);
	const promptCount = $derived(
		vaultItems.filter((item: VaultItem) => item.meta.kind === 'prompt').length
	);
	const snippetCount = $derived(
		vaultItems.filter((item: VaultItem) => item.meta.kind === 'snippet').length
	);
	const referenceCount = $derived(
		vaultItems.filter((item: VaultItem) => item.meta.kind === 'reference').length
	);

	const setMediaMessage = (message: string | null, tone: 'error' | 'info' = 'info') => {
		mediaMessage = message;
		mediaMessageTone = tone;
	};

	const setQuickCaptureMessage = (message: string | null, tone: 'error' | 'info' = 'info') => {
		quickCaptureMessage = message;
		quickCaptureMessageTone = tone;
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

	const resetQuickCapture = () => {
		quickCaptureText = '';
		quickCaptureAttachments = [];
		setQuickCaptureMessage(null);
		if (quickCameraInput) quickCameraInput.value = '';
		if (quickMediaInput) quickMediaInput.value = '';
	};

	const quickCaptureTitle = () => {
		const firstLine = quickCaptureText.trim().split('\n')[0]?.trim();
		if (firstLine) return firstLine.slice(0, 72);
		if (quickCaptureAttachments[0]?.title) return quickCaptureAttachments[0].title;
		return `Capture rapide ${new Date().toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
	};

	const resetForm = () => {
		editingId = null;
		title = '';
		content = '';
		kind = 'note';
		color = 'blue';
		language = '';
		tagInput = '';
		projectId = '';
		pinned = false;
		attachments = [];
		attachmentUrl = '';
		attachmentTitle = '';
		attachmentKind = 'link';
		setMediaMessage(null);
	};

	const loadTemplate = (templateId: string) => {
		const template = NOTE_TEMPLATES.find((item) => item.id === templateId);
		if (!template) return;
		editingId = null;
		title = template.title;
		content = template.content;
		kind = template.kind;
		color = template.color;
		language = template.language ?? '';
		tagInput = '';
		projectId = '';
		pinned = template.kind !== 'snippet';
		attachments = [];
		setMediaMessage(null);
	};

	const startEdit = (id: string) => {
		const current = vaultItems.find((item: VaultItem) => item.note.id === id);
		if (!current) return;
		editingId = id;
		title = current.note.title;
		content = current.document.plainText;
		kind = current.meta.kind;
		color = current.meta.color;
		language = current.meta.language ?? '';
		tagInput = current.meta.plainTags.join(', ');
		projectId = current.note.project_id ?? '';
		pinned = current.meta.pinned;
		attachments = current.document.attachments.map((attachment) => ({ ...attachment }));
		attachmentUrl = '';
		attachmentTitle = '';
		attachmentKind = 'link';
		setMediaMessage(null);
	};

	const addLinkAttachment = () => {
		const url = attachmentUrl.trim();
		if (!url) return;
		const detectedKind = attachmentKind === 'link' ? detectAttachmentKindFromUrl(url) : attachmentKind;
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
		setMediaMessage('Ressource ajoutee au Vault.');
	};

	const removeAttachment = (id: string) => {
		attachments = attachments.filter((attachment) => attachment.id !== id);
	};

	const openMediaPicker = () => {
		fileInput?.click();
	};

	const openQuickCamera = () => {
		quickCameraInput?.click();
	};

	const openQuickMediaPicker = () => {
		quickMediaInput?.click();
	};

	const removeQuickAttachment = (id: string) => {
		quickCaptureAttachments = quickCaptureAttachments.filter((attachment) => attachment.id !== id);
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

	const ingestFiles = async (
		files: File[],
		append: (incoming: VaultAttachment[]) => void,
		setMessage: (message: string | null, tone?: 'error' | 'info') => void
	) => {
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
			append(incoming);
			setMessage(
				`${incoming.length} media(s) ajoute(s)${rejectedCount ? `, ${rejectedCount} ignore(s)` : ''}.`,
				rejectedCount ? 'error' : 'info'
			);
			return;
		}

		if (rejectedCount) {
			setMessage(
				`Impossible d'ajouter ces medias. Limite actuelle: ${formatBytes(MAX_EMBED_FILE_BYTES)} par fichier. // V2: storage dedie.`,
				'error'
			);
		}
	};

	const handleMediaSelection = async (event: Event) => {
		const input = event.currentTarget as HTMLInputElement;
		const files = Array.from(input.files ?? []);
		if (!files.length) return;
		await ingestFiles(
			files,
			(incoming) => {
				attachments = [...attachments, ...incoming];
			},
			setMediaMessage
		);
		input.value = '';
	};

	const handleQuickCaptureSelection = async (event: Event) => {
		const input = event.currentTarget as HTMLInputElement;
		const files = Array.from(input.files ?? []);
		if (!files.length) return;
		await ingestFiles(
			files,
			(incoming) => {
				quickCaptureAttachments = [...quickCaptureAttachments, ...incoming];
			},
			setQuickCaptureMessage
		);
		input.value = '';
	};

	const submitQuickCapture = async () => {
		if (!quickCaptureText.trim() && !quickCaptureAttachments.length) return;

		const savedNote = await flowpilot.createNote({
			title: quickCaptureTitle(),
			content: buildVaultContent(quickCaptureText, quickCaptureAttachments),
			tags: buildVaultTags({
				kind: 'note',
				color: 'slate',
				pinned: false,
				plainTags: ['capture-rapide']
			})
		});

		lastQuickCaptureId = savedNote?.id ?? null;
		resetQuickCapture();
		setQuickCaptureMessage('Capture rapide ajoutee au Vault. Elle apparait juste en dessous.');
	};

	const submit = async () => {
		const trimmedContent = content.trim();
		const plainTags = parseTagInput(tagInput);
		const nextTitle =
			title.trim() ||
			trimmedContent.split('\n')[0].trim().slice(0, 72) ||
			attachments[0]?.title ||
			defaultTitleForKind(kind);

		const payload = {
			title: nextTitle,
			content: buildVaultContent(trimmedContent, attachments),
			project_id: projectId || null,
			tags: buildVaultTags({
				kind,
				color,
				pinned,
				language,
				plainTags
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
				kind: current.meta.kind,
				color: current.meta.color,
				pinned: !current.meta.pinned,
				language: current.meta.language,
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
			project_id: current.note.project_id,
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
</script>

<div class="space-y-4">
	<Card
		tone="active"
		class="overflow-hidden border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(51,153,255,0.16),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(255,79,216,0.12),transparent_38%),#0f1117]"
	>
		<div class="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
			<div>
				<p class="text-xs uppercase tracking-[0.22em] text-[#8fcaff]">Capture rapide</p>
				<h1 class="mt-3 text-3xl font-semibold text-white">Une idee, une note ou une photo en quelques secondes</h1>
				<p class="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">
					Utilise ce bloc pour capturer vite, sans passer par les prompts ni l'editeur complet.
				</p>

				<textarea
					class="mt-4 min-h-[180px] w-full rounded-3xl border border-white/10 bg-black/20 px-4 py-4 text-sm leading-6 text-white outline-none transition focus:border-[#3399FF]/40"
					placeholder="Note rapide, idee, chose a ne pas oublier..."
					bind:value={quickCaptureText}
				></textarea>

				<div class="mt-4 flex flex-wrap gap-2">
					<button
						class="rounded-2xl bg-[#3399FF] px-4 py-3 text-sm font-semibold text-white shadow-[0_0_18px_rgba(51,153,255,0.15)]"
						type="button"
						onclick={submitQuickCapture}
					>
						Sauver la note
					</button>
					<button
						class="rounded-2xl border border-white/10 px-4 py-3 text-sm text-white"
						type="button"
						onclick={openQuickCamera}
					>
						Prendre une photo
					</button>
					<button
						class="rounded-2xl bg-[#FF4FD8] px-4 py-3 text-sm font-medium text-white shadow-[0_0_18px_rgba(255,79,216,0.14)]"
						type="button"
						onclick={openQuickMediaPicker}
					>
						Ajouter un media
					</button>
				</div>

				<input
					class="hidden"
					type="file"
					accept="image/*"
					capture="environment"
					bind:this={quickCameraInput}
					onchange={handleQuickCaptureSelection}
				/>
				<input
					class="hidden"
					type="file"
					accept="image/*,video/*,audio/*"
					multiple
					bind:this={quickMediaInput}
					onchange={handleQuickCaptureSelection}
				/>

				{#if quickCaptureMessage}
					<p class={`mt-3 text-sm ${quickCaptureMessageTone === 'error' ? 'text-rose-300' : 'text-[#8fcaff]'}`}>
						{quickCaptureMessage}
					</p>
				{/if}

				{#if recentQuickCaptures.length}
					<div class="mt-5 rounded-3xl border border-white/8 bg-black/20 p-4">
						<div class="flex items-center justify-between gap-3">
							<div>
								<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Dernieres captures rapides</p>
								<p class="mt-2 text-sm text-zinc-400">
									Retrouve tout de suite les dernieres notes saisies ici.
								</p>
							</div>
							<p class="text-xs uppercase tracking-[0.16em] text-zinc-500">
								{recentQuickCaptures.length} visible(s)
							</p>
						</div>

						<div class="mt-4 space-y-3">
							{#each recentQuickCaptures as item}
								<button
									class={`w-full rounded-2xl border px-4 py-3 text-left transition ${
										item.note.id === lastQuickCaptureId
											? 'border-[#3399FF]/40 bg-[#3399FF]/10 shadow-[0_0_20px_rgba(51,153,255,0.12)]'
											: 'border-white/8 bg-white/[0.03] hover:border-white/14'
									}`}
									type="button"
									onclick={() => startEdit(item.note.id)}
								>
									<div class="flex items-start justify-between gap-3">
										<div class="min-w-0">
											<p class="truncate text-sm font-medium text-white">{item.note.title}</p>
											{#if item.document.plainText}
												<p class="mt-1 max-h-10 overflow-hidden text-sm leading-5 text-zinc-400">
													{item.document.plainText}
												</p>
											{:else if item.document.attachments.length}
												<p class="mt-1 text-sm text-zinc-400">
													{item.document.attachments.length} media(s) joint(s)
												</p>
											{/if}
										</div>
										<div class="shrink-0 text-right">
											<p class="text-xs uppercase tracking-[0.16em] text-zinc-500">
												{item.note.id === lastQuickCaptureId ? 'Nouvelle' : 'Capture'}
											</p>
											<p class="mt-1 text-xs text-zinc-400">
												{new Date(item.note.updated_at).toLocaleTimeString('fr-FR', {
													hour: '2-digit',
													minute: '2-digit'
												})}
											</p>
										</div>
									</div>
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<div class="rounded-3xl border border-white/8 bg-black/20 p-4">
				<div class="flex items-center justify-between gap-3">
					<div>
						<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Pieces jointes rapides</p>
						<p class="mt-2 text-sm text-zinc-400">
							{quickCaptureAttachments.length} media(s) pret(s) a etre sauves avec la note.
						</p>
					</div>
					{#if quickCaptureAttachments.length}
						<button
							class="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300"
							type="button"
							onclick={resetQuickCapture}
						>
							Vider
						</button>
					{/if}
				</div>

				{#if quickCaptureAttachments.length}
					<div class="mt-4 grid gap-3 sm:grid-cols-2">
						{#each quickCaptureAttachments as attachment}
							<div class="overflow-hidden rounded-2xl border border-white/8 bg-black/25">
								{#if isImageAttachment(attachment)}
									<img class="h-36 w-full object-cover" src={attachment.url} alt={attachment.title} />
								{:else}
									<div class="flex h-36 items-center justify-center bg-white/[0.03] px-4 text-center text-sm text-zinc-300">
										{vaultAttachmentKindLabel(attachment.kind)}
									</div>
								{/if}
								<div class="flex items-center justify-between gap-3 px-4 py-3">
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
										onclick={() => removeQuickAttachment(attachment.id)}
									>
										Retirer
									</button>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="mt-4 rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center">
						<p class="text-sm text-zinc-400">
							Ajoute une photo du telephone ou un media rapide, puis sauvegarde ta capture.
						</p>
					</div>
				{/if}
			</div>
		</div>
	</Card>

	<Card
		tone="active"
		class="overflow-hidden border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(51,153,255,0.18),transparent_38%),radial-gradient(circle_at_top_right,rgba(255,79,216,0.14),transparent_36%),#101114]"
	>
		<div class="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
			<div class="max-w-3xl">
				<p class="text-xs uppercase tracking-[0.22em] text-[#8fcaff]">Vault</p>
				<h1 class="mt-3 text-3xl font-semibold text-white">Notes, prompts, snippets et references</h1>
				<p class="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">
					Transforme FlowPilot en base personnelle moderne: idees, system prompts, snippets de code,
					playbooks et references utiles, avec couleurs, pinning et copie rapide.
				</p>
			</div>

			<div class="grid gap-3 sm:grid-cols-3">
				{#each NOTE_TEMPLATES as template}
					<button
						class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left text-sm text-white transition hover:border-white/20 hover:bg-white/[0.04]"
						type="button"
						onclick={() => loadTemplate(template.id)}
					>
						<p class="font-medium">{template.label}</p>
						<p class="mt-1 text-xs text-zinc-400">{template.title}</p>
					</button>
				{/each}
			</div>
		</div>
	</Card>

	<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
		<Card class="bg-[linear-gradient(135deg,rgba(255,79,216,0.08),transparent_65%),#111]">
			<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Prompts</p>
			<p class="mt-2 text-3xl font-semibold text-white">{promptCount}</p>
		</Card>
		<Card class="bg-[linear-gradient(135deg,rgba(51,153,255,0.08),transparent_65%),#111]">
			<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Snippets</p>
			<p class="mt-2 text-3xl font-semibold text-white">{snippetCount}</p>
		</Card>
		<Card class="bg-[linear-gradient(135deg,rgba(34,197,94,0.08),transparent_65%),#111]">
			<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">References</p>
			<p class="mt-2 text-3xl font-semibold text-white">{referenceCount}</p>
		</Card>
		<Card class="bg-[linear-gradient(135deg,rgba(245,158,11,0.08),transparent_65%),#111]">
			<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Pinglees</p>
			<p class="mt-2 text-3xl font-semibold text-white">{pinnedCount}</p>
		</Card>
	</div>

	<div class="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
		<Card class="xl:sticky xl:top-24">
			<div class="flex items-center justify-between gap-3">
				<div>
					<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Editeur</p>
					<h2 class="mt-2 text-xl font-semibold text-white">
						{editingId ? 'Modifier un element du Vault' : 'Ajouter un element du Vault'}
					</h2>
				</div>
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

			<div class="mt-4 space-y-4">
				<input
					class="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-[#3399FF]/40"
					placeholder="Titre"
					bind:value={title}
				/>

				<div class="grid gap-3 md:grid-cols-2">
					<select
						class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
						bind:value={kind}
					>
						{#each NOTE_KIND_OPTIONS as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
					<select
						class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
						bind:value={projectId}
					>
						<option value="">Aucun projet</option>
						{#each $projects.filter((project) => !project.deleted_at) as project}
							<option value={project.id}>{project.title}</option>
						{/each}
					</select>
				</div>

				<div>
					<p class="mb-2 text-xs uppercase tracking-[0.2em] text-zinc-500">Couleur</p>
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

				{#if kind === 'snippet'}
					<input
						class="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-[#3399FF]/40"
						placeholder="Langage ou format (ex: js, sql, bash)"
						bind:value={language}
					/>
				{/if}

				<input
					class="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-[#3399FF]/40"
					placeholder="Tags libres, separes par virgules ou #"
					bind:value={tagInput}
				/>

				<div class="rounded-3xl border border-white/8 bg-[linear-gradient(135deg,rgba(255,79,216,0.06),transparent_55%),rgba(255,255,255,0.01)] p-4">
					<div class="flex flex-col gap-3">
						<div>
							<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Medias et liens</p>
							<p class="mt-2 text-sm text-zinc-400">
								Ajoute une video, une image, un audio, ou un lien utile directement dans la note.
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
								class="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-[#3399FF]/40"
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
								class="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-[#3399FF]/40"
								placeholder="Titre optionnel pour la ressource"
								bind:value={attachmentTitle}
							/>
							<button
								class="rounded-2xl bg-[#FF4FD8] px-4 py-3 text-sm font-medium text-white shadow-[0_0_18px_rgba(255,79,216,0.14)]"
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
							<p class={`text-sm ${mediaMessageTone === 'error' ? 'text-rose-300' : 'text-[#8fcaff]'}`}>
								{mediaMessage}
							</p>
						{/if}

						{#if attachments.length}
							<div class="grid gap-2">
								{#each attachments as attachment}
									<div class="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
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
					class="min-h-[220px] w-full rounded-3xl border border-white/10 bg-black/20 px-4 py-4 text-sm leading-6 text-white outline-none transition focus:border-[#3399FF]/40"
					placeholder="Contenu complet de la note, du prompt, du snippet ou de la reference"
					bind:value={content}
				></textarea>

				<label class="flex items-center gap-3 rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-zinc-300">
					<input class="h-4 w-4 accent-[#FF4FD8]" type="checkbox" bind:checked={pinned} />
					Pingler pour garder cet element en haut
				</label>

				<div class="flex flex-wrap gap-2">
					<button
						class="rounded-2xl bg-[#3399FF] px-4 py-3 text-sm font-semibold text-white shadow-[0_0_18px_rgba(51,153,255,0.15)]"
						type="button"
						onclick={submit}
					>
						{editingId ? 'Mettre a jour' : 'Ajouter au Vault'}
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
						class="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-[#3399FF]/40"
						placeholder="Rechercher dans le Vault"
						bind:value={search}
					/>

					<div class="flex flex-wrap gap-2">
						<button
							class={`rounded-full px-3 py-2 text-xs font-medium transition ${kindFilter === 'all' ? 'bg-white text-black' : 'border border-white/10 text-zinc-300'}`}
							type="button"
							onclick={() => (kindFilter = 'all')}
						>
							Tout
						</button>
						{#each NOTE_KIND_OPTIONS as option}
							<button
								class={`rounded-full px-3 py-2 text-xs font-medium transition ${kindFilter === option.value ? 'bg-[#3399FF] text-white' : 'border border-white/10 text-zinc-300'}`}
								type="button"
								onclick={() => (kindFilter = option.value)}
							>
								{option.label}
							</button>
						{/each}
					</div>

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

					<label class="flex items-center gap-3 text-sm text-zinc-300">
						<input class="h-4 w-4 accent-[#FF4FD8]" type="checkbox" bind:checked={pinnedOnly} />
						Afficher seulement les elements epingles
					</label>
				</div>
			</Card>

			<div class="grid gap-4 lg:grid-cols-2">
				{#if filteredItems.length}
					{#each filteredItems as item}
						<Card class={`overflow-hidden ${item.colors.card}`}>
							<div class="flex items-start justify-between gap-3">
								<div class="flex items-center gap-2">
									<span class={`h-2.5 w-2.5 rounded-full ${item.colors.dot}`}></span>
									<span class={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] ${item.colors.chip}`}>
										{vaultKindLabel(item.meta.kind)}
									</span>
									{#if item.meta.pinned}
										<span class="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-amber-200">
											Pin
										</span>
									{/if}
									{#if item.meta.language}
										<span class="rounded-full border border-white/10 px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-zinc-300">
											{item.meta.language}
										</span>
									{/if}
								</div>

								<div class="flex flex-wrap justify-end gap-2">
									<button class="rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-300" type="button" onclick={() => copyContent(item.note.id, item.note.content)}>
										{copyMessage === item.note.id ? 'Copie' : 'Copier'}
									</button>
									<button class="rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-300" type="button" onclick={() => startEdit(item.note.id)}>
										Editer
									</button>
									<button class="rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-300" type="button" onclick={() => togglePinned(item.note.id)}>
										{item.meta.pinned ? 'Unpin' : 'Pin'}
									</button>
									<button class="rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-300" type="button" onclick={() => duplicate(item.note.id)}>
										Dupliquer
									</button>
									<button class="rounded-full border border-red-500/20 px-2.5 py-1 text-xs text-red-300" type="button" onclick={() => flowpilot.deleteNote(item.note.id)}>
										Supprimer
									</button>
								</div>
							</div>

							<h2 class="mt-4 text-xl font-semibold text-white">{item.note.title}</h2>
							{#if item.project}
								<p class="mt-2 text-xs uppercase tracking-[0.16em] text-zinc-400">
									Projet lie: {item.project.title}
								</p>
							{/if}

							{#if item.document.plainText}
								<pre class="mt-4 max-h-56 overflow-auto whitespace-pre-wrap rounded-2xl border border-white/6 bg-black/25 px-4 py-3 font-sans text-sm leading-6 text-zinc-200">{item.document.plainText}</pre>
							{:else if !item.document.attachments.length}
								<p class="mt-4 text-sm text-zinc-500">Contenu vide.</p>
							{/if}

							{#if item.document.attachments.length}
								<div class="mt-4 space-y-3">
									{#each item.document.attachments as attachment}
										<div class="overflow-hidden rounded-2xl border border-white/8 bg-black/25">
											<div class="flex items-center justify-between gap-3 border-b border-white/6 px-4 py-3">
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
													<audio class="w-full" src={attachment.url} controls preload="metadata"></audio>
												</div>
											{:else}
												<div class="px-4 py-4">
													<p class="break-all text-sm text-zinc-300">{attachment.url}</p>
												</div>
											{/if}
										</div>
									{/each}
								</div>
							{/if}

							{#if item.meta.plainTags.length}
								<div class="mt-4 flex flex-wrap gap-2">
									{#each item.meta.plainTags as tag}
										<span class="rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-300">
											#{tag}
										</span>
									{/each}
								</div>
							{/if}

							<p class="mt-4 text-xs text-zinc-500">
								Mis a jour le {new Date(item.note.updated_at).toLocaleString('fr-FR')}
							</p>
						</Card>
					{/each}
				{:else}
					<Card class="lg:col-span-2">
						<p class="text-lg font-medium text-white">Le Vault est vide pour ce filtre</p>
						<p class="mt-2 text-sm text-zinc-400">
							Ajoute une note, un prompt ou un snippet, ou assouplis les filtres actifs.
						</p>
					</Card>
				{/if}
			</div>
		</div>
	</div>
</div>
