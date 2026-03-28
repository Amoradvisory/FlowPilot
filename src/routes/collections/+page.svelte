<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import ConstellationGraph from '$lib/components/ConstellationGraph.svelte';
	import { notes } from '$lib/flowpilot';
	import { buildSmartCollections, type NoteIndexItem } from '$lib/nexus-notes';
	import {
		NOTE_COLOR_OPTIONS,
		getDecayMeta,
		getPriorityMeta,
		getVaultMeta,
		noteColorClasses,
		type VaultMeta
	} from '$lib/note-vault';
	import {
		parseVaultContent,
		summarizeVaultContent,
		type VaultDocument
	} from '$lib/vault-document';
	import type { Note } from '$lib/types';

	const COLOR_ACCENT: Record<string, string> = {
		blue: '#00D4FF',
		pink: '#7B2FFF',
		green: '#00FF9C',
		amber: '#FFB800',
		violet: '#6E63FF',
		rose: '#FF2D55',
		slate: '#4A5580'
	};

	type CollectionNoteItem = NoteIndexItem & {
		note: Note;
		meta: VaultMeta;
		document: VaultDocument;
		colors: ReturnType<typeof noteColorClasses>;
	};

	type TagSummary = {
		tag: string;
		count: number;
	};

	const noteItems = $derived(
		$notes
			.filter((note) => !note.deleted_at)
			.map((note): CollectionNoteItem | null => {
				const meta = getVaultMeta(note);
				if (meta.kind !== 'note') return null;
				return {
					note,
					meta,
					document: parseVaultContent(note.content),
					colors: noteColorClasses(meta.color)
				};
			})
			.filter((item): item is CollectionNoteItem => Boolean(item))
			.sort(
				(left, right) =>
					new Date(right.note.updated_at).getTime() - new Date(left.note.updated_at).getTime()
			)
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
			.slice(0, 12);
	});

	const smartCollections = $derived(buildSmartCollections(noteItems));

	const constellationNoteLinks = $derived(
		noteItems.map((item) => ({
			noteId: item.note.id,
			tags: item.meta.plainTags,
			color: COLOR_ACCENT[item.meta.color] ?? '#00D4FF'
		}))
	);

	const groupedByColor = $derived(
		NOTE_COLOR_OPTIONS.map((option) => ({
			...option,
			items: noteItems.filter((item: CollectionNoteItem) => item.meta.color === option.value)
		})).filter((group) => group.items.length > 0)
	);

	const groupedByDecay = $derived([
		{
			key: 'fresh',
			label: 'Fraiches',
			description: 'Notes travaillees recemment, encore dans le haut du flux.',
			items: noteItems.filter(
				(item: CollectionNoteItem) => getDecayMeta(item.note, item.meta).band === 'fresh'
			)
		},
		{
			key: 'warm',
			label: 'Tiedes',
			description: 'Encore utiles, mais moins presentes dans la memoire immediate.',
			items: noteItems.filter(
				(item: CollectionNoteItem) => getDecayMeta(item.note, item.meta).band === 'warm'
			)
		},
		{
			key: 'dormant',
			label: 'Dormantes',
			description: 'A revisiter bientot pour ne pas les perdre.',
			items: noteItems.filter(
				(item: CollectionNoteItem) => getDecayMeta(item.note, item.meta).band === 'dormant'
			)
		},
		{
			key: 'ghost',
			label: 'Fantomes',
			description: 'Presque sorties du radar, filtrees par defaut dans le temps.',
			items: noteItems.filter(
				(item: CollectionNoteItem) => getDecayMeta(item.note, item.meta).band === 'ghost'
			)
		}
	]);
</script>

<div class="space-y-4">
	<Card
		tone="active"
		class="overflow-hidden border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(123,47,255,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(0,212,255,0.16),transparent_32%),#101114]"
	>
		<p class="text-xs tracking-[0.22em] text-[#8fcaff] uppercase">Constellation</p>
		<h1 class="mt-3 text-3xl font-semibold text-white">Tags, regroupements et decay</h1>
		<p class="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">
			Ici, les notes ne vivent pas dans des dossiers. Elles flottent dans plusieurs contextes a la
			fois.
		</p>
	</Card>

	<div class="grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
		<Card>
			<p class="text-xs tracking-[0.2em] text-zinc-500 uppercase">Tag graph</p>
			<h2 class="mt-2 text-xl font-semibold text-white">Constellation de tags</h2>
			<p class="mt-2 text-sm text-zinc-400">
				Hover sur un tag pour illuminer ses notes. Taille = frequence.
			</p>

			<div class="mt-5">
				<ConstellationGraph
					tags={topTags}
					noteLinks={constellationNoteLinks}
					width={480}
					height={300}
				/>
			</div>
		</Card>

		<Card>
			<p class="text-xs tracking-[0.2em] text-zinc-500 uppercase">Smart collections</p>
			<h2 class="mt-2 text-xl font-semibold text-white">Regroupements automatiques</h2>

			<div class="mt-4 grid gap-3 md:grid-cols-2">
				{#if smartCollections.length}
					{#each smartCollections as group}
						<div
							class="rounded-2xl border border-white/8 bg-black/20 px-4 py-4"
							style={`box-shadow: inset 0 0 0 1px ${group.accent}22;`}
						>
							<p class="text-xs tracking-[0.16em] uppercase" style={`color: ${group.accent};`}>
								{group.label}
							</p>
							<p class="mt-2 text-sm text-zinc-400">{group.description}</p>
							<p class="mt-3 text-2xl font-semibold text-white">{group.items.length}</p>

							<div class="mt-4 space-y-2">
								{#each group.items.slice(0, 2) as item}
									<a class={`block rounded-2xl border px-3 py-3 ${item.colors.card}`} href="/vault">
										<p class="truncate text-sm font-medium text-white">{item.note.title}</p>
										<p class="mt-1 text-sm text-zinc-400">
											{summarizeVaultContent(item.note.content, 70)}
										</p>
									</a>
								{/each}
							</div>
						</div>
					{/each}
				{:else}
					<p class="text-sm text-zinc-500">
						Les collections apparaissent automatiquement a partir de tes habitudes de notes.
					</p>
				{/if}
			</div>
		</Card>
	</div>

	<Card>
		<p class="text-xs tracking-[0.2em] text-zinc-500 uppercase">Par couleur</p>
		<h2 class="mt-2 text-xl font-semibold text-white">Collections visuelles</h2>

		<div class="mt-4 space-y-4">
			{#if groupedByColor.length}
				{#each groupedByColor as group}
					<div>
						<div class="flex items-center justify-between gap-3">
							<div class="flex items-center gap-2">
								<span class="h-2.5 w-2.5 rounded-full" style={`background-color: ${group.accent}`}
								></span>
								<p class="text-sm font-medium text-white">{group.label}</p>
							</div>
							<p class="text-xs text-zinc-500">{group.items.length} note(s)</p>
						</div>

						<div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
							{#each group.items.slice(0, 4) as item}
								<a class={`block rounded-2xl border px-4 py-3 ${item.colors.card}`} href="/vault">
									<p class="font-medium text-white">{item.note.title}</p>
									<p class="mt-1 text-sm text-zinc-400">
										{summarizeVaultContent(item.note.content, 90)}
									</p>
								</a>
							{/each}
						</div>
					</div>
				{/each}
			{:else}
				<p class="text-sm text-zinc-500">Aucune couleur active pour l instant.</p>
			{/if}
		</div>
	</Card>

	<Card>
		<p class="text-xs tracking-[0.2em] text-zinc-500 uppercase">Decay system</p>
		<h2 class="mt-2 text-xl font-semibold text-white">Vie des notes</h2>

		<div class="mt-4 grid gap-4 xl:grid-cols-2">
			{#each groupedByDecay as group}
				<div class="rounded-3xl border border-white/8 bg-black/20 p-4">
					<div class="flex items-center justify-between gap-3">
						<div>
							<p class="text-sm font-medium text-white">{group.label}</p>
							<p class="mt-1 text-sm text-zinc-400">{group.description}</p>
						</div>
						<p class="text-xs text-zinc-500">{group.items.length} note(s)</p>
					</div>

					<div class="mt-4 space-y-3">
						{#if group.items.length}
							{#each group.items.slice(0, 3) as item}
								<a class={`block rounded-2xl border px-4 py-3 ${item.colors.card}`} href="/vault">
									<div class="flex items-start justify-between gap-3">
										<div class="min-w-0">
											<p class="font-medium text-white">{item.note.title}</p>
											<p class="mt-1 text-sm text-zinc-400">
												{summarizeVaultContent(item.note.content, 90)}
											</p>
										</div>
										<div class="shrink-0 text-right">
											<p
												class="text-xs tracking-[0.16em] uppercase"
												style={`color: ${getPriorityMeta(item.meta.priority).accent};`}
											>
												{getPriorityMeta(item.meta.priority).shortLabel}
											</p>
											<p class="mt-1 text-xs text-zinc-500">
												{getDecayMeta(item.note, item.meta).label}
											</p>
										</div>
									</div>
								</a>
							{/each}
						{:else}
							<p class="text-sm text-zinc-500">Aucune note dans ce groupe pour l instant.</p>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</Card>
</div>
