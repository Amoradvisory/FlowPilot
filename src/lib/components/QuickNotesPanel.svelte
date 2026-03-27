<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import { flowpilot, notes } from '$lib/flowpilot';
	import {
		buildVaultTags,
		getLifeStateMeta,
		getPriorityMeta,
		getVaultMeta,
		NOTE_LIFE_STATE_OPTIONS,
		NOTE_PRIORITY_OPTIONS,
		noteColorClasses,
		type NoteLifeState,
		type NotePriorityLevel
	} from '$lib/note-vault';
	import {
		buildVaultContent,
		isImageAttachment,
		parseVaultContent,
		type VaultAttachment,
		type VaultAttachmentKind,
		vaultAttachmentKindLabel
	} from '$lib/vault-document';
	import type { Note } from '$lib/types';

	type QuickNoteItem = {
		note: Note;
		meta: ReturnType<typeof getVaultMeta>;
		document: ReturnType<typeof parseVaultContent>;
		isPinned: boolean;
		colors: ReturnType<typeof noteColorClasses>;
	};

	const MAX_EMBED_FILE_BYTES = 5 * 1024 * 1024;

	let quickCaptureText = $state('');
	let quickCaptureAttachments = $state<VaultAttachment[]>([]);
	let quickCaptureMessage = $state<string | null>(null);
	let quickCaptureMessageTone = $state<'error' | 'info'>('info');
	let lastQuickCaptureId = $state<string | null>(null);
	let quickPriority = $state<NotePriorityLevel>('p3');
	let quickLifeState = $state<NoteLifeState>('seed');
	let quickCameraInput: HTMLInputElement | null = null;
	let quickMediaInput: HTMLInputElement | null = null;

	const noteItems = $derived(
		$notes
			.filter((note) => !note.deleted_at)
			.map((note): QuickNoteItem | null => {
				const meta = getVaultMeta(note);
				if (meta.kind !== 'note') return null;
				return {
					note,
					meta,
					document: parseVaultContent(note.content),
					isPinned: meta.pinned,
					colors: noteColorClasses(meta.color)
				};
			})
			.filter((item): item is QuickNoteItem => Boolean(item))
			.sort((left, right) => new Date(right.note.updated_at).getTime() - new Date(left.note.updated_at).getTime())
	);

	const recentNotes = $derived(noteItems.slice(0, 4));

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

	const resetQuickCapture = () => {
		quickCaptureText = '';
		quickCaptureAttachments = [];
		quickPriority = 'p3';
		quickLifeState = 'seed';
		setQuickCaptureMessage(null);
		if (quickCameraInput) quickCameraInput.value = '';
		if (quickMediaInput) quickMediaInput.value = '';
	};

	const quickCaptureTitle = () => {
		const firstLine = quickCaptureText.trim().split('\n')[0]?.trim();
		if (firstLine) return firstLine.slice(0, 72);
		if (quickCaptureAttachments[0]?.title) return quickCaptureAttachments[0].title;
		return `Note rapide ${new Date().toLocaleString('fr-FR', {
			day: '2-digit',
			month: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		})}`;
	};

	const removeQuickAttachment = (id: string) => {
		quickCaptureAttachments = quickCaptureAttachments.filter((attachment) => attachment.id !== id);
	};

	const openQuickCamera = () => quickCameraInput?.click();
	const openQuickMediaPicker = () => quickMediaInput?.click();

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

			const url = await new Promise<string>((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(String(reader.result));
				reader.onerror = () => reject(reader.error);
				reader.readAsDataURL(file);
			});

			incoming.push({
				id: crypto.randomUUID(),
				kind: kindFromMimeType(file.type),
				title: file.name || vaultAttachmentKindLabel(kindFromMimeType(file.type)),
				url,
				mimeType: file.type || null,
				sizeBytes: file.size
			});
		}

		if (incoming.length) {
			append(incoming);
			setMessage(
				rejectedCount
					? `${incoming.length} media(s) ajoute(s), ${rejectedCount} refuse(s) pour taille trop grande.`
					: `${incoming.length} media(s) pret(s) a etre sauves avec ta note.`
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
				priority: quickPriority,
				lifeState: quickLifeState,
				plainTags: ['capture-rapide']
			})
		});

		lastQuickCaptureId = savedNote?.id ?? null;
		resetQuickCapture();
		setQuickCaptureMessage('Note ajoutee. Tu la retrouves juste en dessous.');
	};
</script>

<Card
	tone="active"
	class="overflow-hidden border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(51,153,255,0.16),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(255,79,216,0.1),transparent_38%),#0f1117]"
>
	<div class="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
		<div>
			<div class="flex items-center justify-between gap-3">
				<div>
					<p class="text-xs uppercase tracking-[0.22em] text-[#8fcaff]">Notes rapides</p>
					<h1 class="mt-3 text-3xl font-semibold text-white">Une idee, une photo, un commentaire</h1>
					<p class="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">
						Comme dans une app de notes moderne: prends une photo, ajoute un commentaire ou un contexte, puis retrouve-la avec le reste de ta journee.
					</p>
				</div>
				<a class="hidden rounded-2xl border border-white/10 px-4 py-3 text-sm text-white lg:inline-flex" href="/vault">
					Toutes les notes
				</a>
			</div>

			<textarea
				class="mt-4 min-h-[180px] w-full rounded-3xl border border-white/10 bg-black/20 px-4 py-4 text-sm leading-6 text-white outline-none transition focus:border-[#3399FF]/40"
				placeholder="Note rapide, commentaire de photo, idee ou chose a ne pas oublier..."
				bind:value={quickCaptureText}
			></textarea>

			<div class="mt-4 grid gap-3 md:grid-cols-2">
				<div>
					<p class="mb-2 text-xs uppercase tracking-[0.2em] text-zinc-500">Priorite</p>
					<div class="flex flex-wrap gap-2">
						{#each NOTE_PRIORITY_OPTIONS as option}
							<button
								class={`rounded-full border px-3 py-2 text-xs font-medium transition ${quickPriority === option.value ? 'text-white shadow-[0_0_18px_rgba(255,255,255,0.08)]' : 'border-white/10 text-zinc-400'}`}
								style={`border-color: ${quickPriority === option.value ? `${option.accent}66` : ''}; background: linear-gradient(135deg, ${option.accent}22, rgba(15,22,41,0.95));`}
								type="button"
								onclick={() => (quickPriority = option.value)}
							>
								{option.shortLabel}
							</button>
						{/each}
					</div>
				</div>

				<div>
					<p class="mb-2 text-xs uppercase tracking-[0.2em] text-zinc-500">Etat</p>
					<div class="flex flex-wrap gap-2">
						{#each NOTE_LIFE_STATE_OPTIONS as option}
							<button
								class={`rounded-full border px-3 py-2 text-xs font-medium transition ${quickLifeState === option.value ? 'border-white/30 bg-white/8 text-white' : 'border-white/10 text-zinc-400'}`}
								type="button"
								onclick={() => (quickLifeState = option.value)}
							>
								{option.icon} {option.label}
							</button>
						{/each}
					</div>
				</div>
			</div>

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

			{#if recentNotes.length}
				<div class="mt-5 rounded-3xl border border-white/8 bg-black/20 p-4">
					<div class="flex items-center justify-between gap-3">
						<div>
							<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Dernieres notes</p>
							<p class="mt-2 text-sm text-zinc-400">
								Les notes les plus recentes restent visibles ici, sans changer d'ecran.
							</p>
						</div>
						<p class="text-xs uppercase tracking-[0.16em] text-zinc-500">{recentNotes.length} visible(s)</p>
					</div>

					<div class="mt-4 space-y-3">
						{#each recentNotes as item}
							<a
								class={`block rounded-2xl border px-4 py-3 transition ${
									item.note.id === lastQuickCaptureId
										? 'border-[#3399FF]/40 bg-[#3399FF]/10 shadow-[0_0_20px_rgba(51,153,255,0.12)]'
										: item.colors.card
								}`}
								href="/vault"
								>
									<div class="flex items-start justify-between gap-3">
										<div class="min-w-0">
											<p class="truncate text-sm font-medium text-white">{item.note.title}</p>
										{#if item.document.plainText}
											<p class="mt-1 max-h-10 overflow-hidden text-sm leading-5 text-zinc-400">
												{item.document.plainText}
											</p>
										{:else if item.document.attachments.length}
											<p class="mt-1 text-sm text-zinc-400">{item.document.attachments.length} media(s) joint(s)</p>
										{/if}
									</div>
										<div class="shrink-0 text-right">
											<p
												class={`text-xs uppercase tracking-[0.16em] ${item.meta.priority === 'p0' ? 'animate-pulse' : ''}`}
												style={`color: ${getPriorityMeta(item.meta.priority).accent};`}
											>
												{getPriorityMeta(item.meta.priority).shortLabel}
											</p>
											<p class="mt-1 text-xs text-zinc-500">{getLifeStateMeta(item.meta.lifeState).icon}</p>
											<p class="mt-1 text-xs text-zinc-400">
												{new Date(item.note.updated_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
											</p>
										</div>
									</div>
							</a>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<div class="rounded-3xl border border-white/8 bg-black/20 p-4">
			<div class="flex items-center justify-between gap-3">
				<div>
					<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Photo et medias</p>
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
						Ajoute une photo puis ecris un commentaire, ou capture simplement un memo rapide.
					</p>
				</div>
			{/if}
		</div>
	</div>
</Card>
