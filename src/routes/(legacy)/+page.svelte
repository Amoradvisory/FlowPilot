<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import QuickNotesPanel from '$lib/components/QuickNotesPanel.svelte';
	import { flowpilot, notes } from '$lib/flowpilot';
	import {
		buildSmartCollections,
		computeNoteVelocity,
		findRelatedNotes,
		type NoteIndexItem
	} from '$lib/nexus-notes';
	import {
		buildVaultTags,
		getDecayMeta,
		getLifeStateMeta,
		getPriorityMeta,
		getVaultMeta,
		noteColorClasses,
		type NoteLifeState,
		type NotePriorityLevel,
		type VaultColor,
		type VaultMeta
	} from '$lib/note-vault';
	import {
		isAudioAttachment,
		isImageAttachment,
		isVideoAttachment,
		parseVaultContent,
		summarizeVaultContent
	} from '$lib/vault-document';
	import type { Note } from '$lib/types';

	type NoteDashboardItem = NoteIndexItem & {
		note: Note;
		meta: VaultMeta;
		colors: ReturnType<typeof noteColorClasses>;
	};

	type TagSummary = {
		tag: string;
		count: number;
	};

	const noteItems = $derived(
		$notes
			.filter((note) => !note.deleted_at)
			.map((note): NoteDashboardItem | null => {
				const meta = getVaultMeta(note);
				if (meta.kind !== 'note') return null;
				return {
					note,
					meta,
					document: parseVaultContent(note.content),
					colors: noteColorClasses(meta.color)
				};
			})
			.filter((item): item is NoteDashboardItem => Boolean(item))
			.sort(
				(left, right) =>
					new Date(right.note.updated_at).getTime() - new Date(left.note.updated_at).getTime()
			)
	);

	const quickCaptureNotes = $derived(
		noteItems.filter((item: NoteDashboardItem) => item.meta.plainTags.includes('capture-rapide'))
	);
	const mediaNotes = $derived(
		noteItems.filter((item: NoteDashboardItem) => item.document.attachments.length > 0)
	);
	const pinnedNotes = $derived(noteItems.filter((item: NoteDashboardItem) => item.meta.pinned));
	const ghostNotes = $derived(
		noteItems.filter(
			(item: NoteDashboardItem) => getDecayMeta(item.note, item.meta).band === 'ghost'
		)
	);
	const recentNotes = $derived(noteItems.slice(0, 6));
	const reviewQueue = $derived(ghostNotes.slice(0, 5));
	const smartCollections = $derived(buildSmartCollections(noteItems).slice(0, 4));
	const velocity = $derived(computeNoteVelocity(noteItems));
	const relatedNoteMap = $derived.by(
		() => new Map(noteItems.map((item) => [item.note.id, findRelatedNotes(item, noteItems, 3)]))
	);
	const topTags = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const item of noteItems) {
			for (const tag of item.meta.plainTags) {
				counts.set(tag, (counts.get(tag) ?? 0) + 1);
			}
		}
		return [...counts.entries()]
			.map(([tag, count]): TagSummary => ({ tag, count }))
			.sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag))
			.slice(0, 10);
	});

	const applyMetaPatch = async (
		item: NoteDashboardItem,
		overrides: Partial<{
			color: VaultColor;
			pinned: boolean;
			priority: NotePriorityLevel;
			lifeState: NoteLifeState;
		}>
	) => {
		await flowpilot.updateNote(item.note.id, {
			tags: buildVaultTags({
				kind: 'note',
				color: overrides.color ?? item.meta.color,
				pinned: overrides.pinned ?? item.meta.pinned,
				priority: overrides.priority ?? item.meta.priority,
				lifeState: overrides.lifeState ?? item.meta.lifeState,
				plainTags: item.meta.plainTags
			})
		});
	};
</script>

<div class="space-y-4">
	<QuickNotesPanel />

	<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
		<Card class="bg-[linear-gradient(135deg,rgba(0,212,255,0.1),transparent_70%),#111]">
			<p class="text-xs tracking-[0.2em] text-zinc-500 uppercase">Notes vivantes</p>
			<p class="mt-2 text-3xl font-semibold text-white">{noteItems.length}</p>
			<p class="mt-2 text-sm text-zinc-400">
				Texte, photo, audio, video et liens dans un seul flux.
			</p>
		</Card>
		<Card class="bg-[linear-gradient(135deg,rgba(123,47,255,0.12),transparent_70%),#111]">
			<p class="text-xs tracking-[0.2em] text-zinc-500 uppercase">Captures rapides</p>
			<p class="mt-2 text-3xl font-semibold text-white">{quickCaptureNotes.length}</p>
			<p class="mt-2 text-sm text-zinc-400">
				Ce qui a ete attrape a la volee reste visible et classable.
			</p>
		</Card>
		<Card class="bg-[linear-gradient(135deg,rgba(255,45,85,0.1),transparent_70%),#111]">
			<p class="text-xs tracking-[0.2em] text-zinc-500 uppercase">Decay queue</p>
			<p class="mt-2 text-3xl font-semibold text-white">{ghostNotes.length}</p>
			<p class="mt-2 text-sm text-zinc-400">
				Les fantomes du systeme de decay a revisiter ou archiver.
			</p>
		</Card>
		<Card class="bg-[linear-gradient(135deg,rgba(0,255,156,0.1),transparent_70%),#111]">
			<p class="text-xs tracking-[0.2em] text-zinc-500 uppercase">Streak</p>
			<p class="mt-2 text-3xl font-semibold text-white">{velocity.streakDays}</p>
			<p class="mt-2 text-sm text-zinc-400">
				Jour(s) consecutif(s) avec au moins une note capturee.
			</p>
		</Card>
	</div>

	<div class="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
		<Card>
			<div class="flex items-center justify-between gap-4">
				<div>
					<p class="text-xs tracking-[0.2em] text-zinc-500 uppercase">Flux recent</p>
					<h2 class="mt-2 text-xl font-semibold text-white">Les dernieres notes prises</h2>
					<p class="mt-2 text-sm text-zinc-400">
						Le flux principal de Nexus Notes, avec liens implicites et priorite chromee.
					</p>
				</div>
				<a class="rounded-2xl border border-white/10 px-3 py-2 text-sm text-white" href="/vault">
					Ouvrir la bibliotheque
				</a>
			</div>

			<div class="mt-4 space-y-3">
				{#if recentNotes.length}
					{#each recentNotes as item}
						<a
							class={`block rounded-2xl border px-4 py-3 transition hover:border-white/14 ${item.colors.card}`}
							href="/vault"
						>
							<div class="flex items-start justify-between gap-3">
								<div class="min-w-0">
									<div class="flex flex-wrap items-center gap-2">
										<p class="truncate font-medium text-white">{item.note.title}</p>
										<span
											class="rounded-full border px-2 py-0.5 text-[11px] tracking-[0.16em] uppercase"
											style={`border-color: ${getPriorityMeta(item.meta.priority).accent}44; background: ${getPriorityMeta(item.meta.priority).accent}18; color: ${getPriorityMeta(item.meta.priority).accent};`}
										>
											{getPriorityMeta(item.meta.priority).shortLabel}
										</span>
										<span
											class="rounded-full border border-white/10 px-2 py-0.5 text-[11px] tracking-[0.16em] text-zinc-300 uppercase"
										>
											{getLifeStateMeta(item.meta.lifeState).icon}
											{getLifeStateMeta(item.meta.lifeState).label}
										</span>
									</div>
									<p class="mt-2 text-sm text-zinc-400">
										{summarizeVaultContent(item.note.content, 150)}
									</p>
									<div class="mt-3 flex flex-wrap gap-2">
										{#each item.meta.plainTags.slice(0, 4) as tag}
											<span
												class="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-zinc-400"
												>#{tag}</span
											>
										{/each}
										{#if (relatedNoteMap.get(item.note.id)?.length ?? 0) > 0}
											<span
												class="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-zinc-400"
											>
												{relatedNoteMap.get(item.note.id)?.length} lien(s) implicite(s)
											</span>
										{/if}
									</div>
								</div>
								<div class="shrink-0 text-right">
									<p class="text-xs text-zinc-500">{getDecayMeta(item.note, item.meta).label}</p>
									<p class="mt-1 text-xs text-zinc-500">
										{new Date(item.note.updated_at).toLocaleString('fr-FR', {
											day: '2-digit',
											month: '2-digit',
											hour: '2-digit',
											minute: '2-digit'
										})}
									</p>
								</div>
							</div>
						</a>
					{/each}
				{:else}
					<p class="text-sm text-zinc-500">Commence par une note rapide ou une photo commentee.</p>
				{/if}
			</div>
		</Card>

		<Card
			class="bg-[radial-gradient(circle_at_top_right,rgba(0,212,255,0.08),transparent_36%),rgba(17,17,17,0.98)]"
		>
			<p class="text-xs tracking-[0.2em] text-zinc-500 uppercase">Note velocity</p>
			<h2 class="mt-2 text-xl font-semibold text-white">Ton rythme de capture</h2>
			<p class="mt-2 text-sm text-zinc-400">
				Des signaux bruts pour comprendre quand tu captures le mieux et ce qui remonte.
			</p>

			<div class="mt-4 grid gap-3 sm:grid-cols-2">
				<div class="rounded-2xl border border-white/8 bg-black/20 p-4">
					<p class="text-xs tracking-[0.16em] text-zinc-500 uppercase">Aujourd hui</p>
					<p class="mt-2 text-2xl font-semibold text-white">{velocity.createdToday}</p>
				</div>
				<div class="rounded-2xl border border-white/8 bg-black/20 p-4">
					<p class="text-xs tracking-[0.16em] text-zinc-500 uppercase">Cette semaine</p>
					<p class="mt-2 text-2xl font-semibold text-white">{velocity.createdThisWeek}</p>
				</div>
				<div class="rounded-2xl border border-white/8 bg-black/20 p-4">
					<p class="text-xs tracking-[0.16em] text-zinc-500 uppercase">Ce mois</p>
					<p class="mt-2 text-2xl font-semibold text-white">{velocity.createdThisMonth}</p>
				</div>
				<div class="rounded-2xl border border-white/8 bg-black/20 p-4">
					<p class="text-xs tracking-[0.16em] text-zinc-500 uppercase">Pic cognitif</p>
					<p class="mt-2 text-2xl font-semibold text-white">{velocity.peakHourLabel}</p>
				</div>
			</div>

			<div class="mt-4 space-y-3 rounded-2xl border border-white/8 bg-black/20 p-4">
				<div class="flex items-center justify-between gap-3">
					<p class="text-sm text-zinc-300">Sujet chaud de la semaine</p>
					<p class="text-sm font-medium text-white">
						{velocity.hotTag ? `#${velocity.hotTag}` : 'Aucun tag fort'}
					</p>
				</div>
				<div class="flex items-center justify-between gap-3">
					<p class="text-sm text-zinc-300">Ratio graines -> solides</p>
					<p class="text-sm font-medium text-white">{velocity.seedToSolidLabel}</p>
				</div>
				<div class="flex items-center justify-between gap-3">
					<p class="text-sm text-zinc-300">Notes avec media</p>
					<p class="text-sm font-medium text-white">{mediaNotes.length}</p>
				</div>
			</div>
		</Card>
	</div>

	<div class="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
		<Card
			class={reviewQueue.length
				? ''
				: 'bg-[linear-gradient(135deg,rgba(74,85,128,0.08),transparent_70%),#111]'}
		>
			<div class="flex items-center justify-between gap-4">
				<div>
					<p class="text-xs tracking-[0.2em] text-zinc-500 uppercase">Review queue</p>
					<h2 class="mt-2 text-xl font-semibold text-white">Notes fantomes a traiter</h2>
				</div>
				<a
					class="rounded-2xl border border-white/10 px-3 py-2 text-sm text-white"
					href="/collections"
				>
					Constellation
				</a>
			</div>

			<div class="mt-4 space-y-3">
				{#if reviewQueue.length}
					{#each reviewQueue as item}
						<div class={`rounded-2xl border px-4 py-4 ${item.colors.card}`}>
							<div class="flex items-start justify-between gap-3">
								<div>
									<p class="font-medium text-white">{item.note.title}</p>
									<p class="mt-1 text-sm text-zinc-400">
										{summarizeVaultContent(item.note.content, 120)}
									</p>
									<p class="mt-2 text-xs text-zinc-500">
										{getDecayMeta(item.note, item.meta).label} - {getDecayMeta(item.note, item.meta)
											.daysOld} jour(s)
									</p>
								</div>
								<span
									class="rounded-full border px-2 py-1 text-[11px] tracking-[0.16em] uppercase"
									style={`border-color: ${getPriorityMeta(item.meta.priority).accent}44; background: ${getPriorityMeta(item.meta.priority).accent}18; color: ${getPriorityMeta(item.meta.priority).accent};`}
								>
									{getPriorityMeta(item.meta.priority).shortLabel}
								</span>
							</div>

							<div class="mt-4 flex flex-wrap gap-2">
								<button
									class="rounded-2xl bg-[#00D4FF] px-3 py-2 text-xs font-medium text-[#0A0E1A]"
									type="button"
									onclick={() => applyMetaPatch(item, { lifeState: 'solid', color: 'green' })}
								>
									Rendre solide
								</button>
								<button
									class="rounded-2xl border border-white/10 px-3 py-2 text-xs text-zinc-300"
									type="button"
									onclick={() => applyMetaPatch(item, { pinned: true, lifeState: 'active' })}
								>
									Epingler
								</button>
								<button
									class="rounded-2xl border border-white/10 px-3 py-2 text-xs text-zinc-300"
									type="button"
									onclick={() => applyMetaPatch(item, { priority: 'p4', lifeState: 'obsolete' })}
								>
									Archiver
								</button>
								<button
									class="rounded-2xl border border-red-500/20 px-3 py-2 text-xs text-red-300"
									type="button"
									onclick={() => flowpilot.deleteNote(item.note.id)}
								>
									Supprimer
								</button>
							</div>
						</div>
					{/each}
				{:else}
					<p class="text-sm text-zinc-500">
						Aucune note fantome pour l instant. Le decay system est sous controle.
					</p>
				{/if}
			</div>
		</Card>

		<Card>
			<div class="flex items-center justify-between gap-4">
				<div>
					<p class="text-xs tracking-[0.2em] text-zinc-500 uppercase">Smart collections</p>
					<h2 class="mt-2 text-xl font-semibold text-white">Regroupements automatiques</h2>
				</div>
				<a
					class="rounded-2xl border border-white/10 px-3 py-2 text-sm text-white"
					href="/collections"
				>
					Voir tout
				</a>
			</div>

			<div class="mt-4 grid gap-3 md:grid-cols-2">
				{#if smartCollections.length}
					{#each smartCollections as collection}
						<a
							class="rounded-2xl border border-white/8 bg-black/20 px-4 py-4 transition hover:border-white/14"
							href="/collections"
							style={`box-shadow: inset 0 0 0 1px ${collection.accent}22;`}
						>
							<p class="text-xs tracking-[0.16em] uppercase" style={`color: ${collection.accent};`}>
								{collection.label}
							</p>
							<p class="mt-2 text-sm text-zinc-300">{collection.description}</p>
							<p class="mt-3 text-2xl font-semibold text-white">{collection.items.length}</p>
						</a>
					{/each}
				{:else}
					<p class="text-sm text-zinc-500">
						Les regroupements apparaissent automatiquement des que tu captures quelques notes.
					</p>
				{/if}
			</div>

			<div class="mt-4 rounded-2xl border border-white/8 bg-black/20 p-4">
				<p class="text-xs tracking-[0.16em] text-zinc-500 uppercase">Tags dominants</p>
				<div class="mt-3 flex flex-wrap gap-2">
					{#if topTags.length}
						{#each topTags as item}
							<span
								class="rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-300"
								style={`transform: scale(${Math.min(1.18, 1 + item.count * 0.03)});`}
							>
								#{item.tag} - {item.count}
							</span>
						{/each}
					{:else}
						<p class="text-sm text-zinc-500">
							Ajoute des tags inline pour faire emerger la constellation.
						</p>
					{/if}
				</div>
			</div>
		</Card>
	</div>

	<div class="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
		<Card>
			<div class="flex items-center justify-between gap-4">
				<div>
					<p class="text-xs tracking-[0.2em] text-zinc-500 uppercase">Epingles</p>
					<h2 class="mt-2 text-xl font-semibold text-white">Notes a garder dans le viseur</h2>
				</div>
				<a class="rounded-2xl border border-white/10 px-3 py-2 text-sm text-white" href="/vault">
					Notes
				</a>
			</div>

			<div class="mt-4 space-y-3">
				{#if pinnedNotes.length}
					{#each pinnedNotes.slice(0, 4) as item}
						<a
							class={`block rounded-2xl border px-4 py-3 transition hover:border-white/14 ${item.colors.card}`}
							href="/vault"
						>
							<p class="font-medium text-white">{item.note.title}</p>
							<p class="mt-1 text-sm text-zinc-400">
								{summarizeVaultContent(item.note.content, 120)}
							</p>
							<p class="mt-2 text-xs text-zinc-500">
								{getPriorityMeta(item.meta.priority).shortLabel} - {getDecayMeta(
									item.note,
									item.meta
								).label}
							</p>
						</a>
					{/each}
				{:else}
					<p class="text-sm text-zinc-500">
						Epingler une note la garde ici comme pensee immortelle.
					</p>
				{/if}
			</div>
		</Card>

		<Card>
			<div class="flex items-center justify-between gap-4">
				<div>
					<p class="text-xs tracking-[0.2em] text-zinc-500 uppercase">Memoire visuelle</p>
					<h2 class="mt-2 text-xl font-semibold text-white">Les medias les plus recents</h2>
				</div>
				<a class="rounded-2xl border border-white/10 px-3 py-2 text-sm text-white" href="/media">
					Galerie media
				</a>
			</div>

			<div class="mt-4 grid gap-3 md:grid-cols-2">
				{#if mediaNotes.length}
					{#each mediaNotes.slice(0, 4) as item}
						<a
							class="overflow-hidden rounded-2xl border border-white/8 bg-black/20 transition hover:border-white/14"
							href="/media"
						>
							{#if isImageAttachment(item.document.attachments[0])}
								<img
									class="h-36 w-full object-cover"
									src={item.document.attachments[0].url}
									alt={item.note.title}
								/>
							{:else}
								<div
									class="flex h-36 items-center justify-center bg-white/[0.03] text-sm text-zinc-300"
								>
									{#if isVideoAttachment(item.document.attachments[0])}
										Video
									{:else if isAudioAttachment(item.document.attachments[0])}
										Audio
									{:else}
										Lien
									{/if}
								</div>
							{/if}
							<div class="px-4 py-3">
								<p class="font-medium text-white">{item.note.title}</p>
								<p class="mt-1 text-sm text-zinc-400">
									{summarizeVaultContent(item.note.content, 80)}
								</p>
							</div>
						</a>
					{/each}
				{:else}
					<p class="text-sm text-zinc-500">
						Ajoute une image, un audio ou une video pour peupler la galerie.
					</p>
				{/if}
			</div>
		</Card>
	</div>
</div>
