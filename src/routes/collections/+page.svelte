<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import { NOTE_COLOR_OPTIONS, getVaultMeta, noteColorClasses, type VaultMeta } from '$lib/note-vault';
	import { notes, projects } from '$lib/flowpilot';
	import { parseVaultContent, summarizeVaultContent, type VaultDocument } from '$lib/vault-document';
	import type { Note, Project } from '$lib/types';

	type CollectionNoteItem = {
		note: Note;
		meta: VaultMeta;
		project: Project | null;
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
					project: $projects.find((project) => project.id === note.project_id) ?? null,
					document: parseVaultContent(note.content),
					colors: noteColorClasses(meta.color)
				};
			})
			.filter((item): item is CollectionNoteItem => Boolean(item))
			.sort((left, right) => new Date(right.note.updated_at).getTime() - new Date(left.note.updated_at).getTime())
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

	const groupedByColor = $derived(
		NOTE_COLOR_OPTIONS.map((option) => ({
			...option,
			items: noteItems.filter((item: CollectionNoteItem) => item.meta.color === option.value)
		})).filter((group) => group.items.length > 0)
	);
</script>

<div class="space-y-4">
	<Card tone="active" class="overflow-hidden border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,79,216,0.16),transparent_36%),#101114]">
		<p class="text-xs uppercase tracking-[0.22em] text-[#8fcaff]">Classement</p>
		<h1 class="mt-3 text-3xl font-semibold text-white">Couleurs, tags et regroupements</h1>
		<p class="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">
			Une vue simple pour retrouver les notes par couleur, par tags et par regroupement logique.
		</p>
	</Card>

	<div class="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
		<Card>
			<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Tags</p>
			<h2 class="mt-2 text-xl font-semibold text-white">Les plus utilises</h2>

			<div class="mt-4 flex flex-wrap gap-2">
				{#if topTags.length}
					{#each topTags as item}
						<div class="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-300">
							#{item.tag} · {item.count}
						</div>
					{/each}
				{:else}
					<p class="text-sm text-zinc-500">Ajoute des tags libres dans les notes pour commencer a classer.</p>
				{/if}
			</div>
		</Card>

		<Card>
			<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Par couleur</p>
			<h2 class="mt-2 text-xl font-semibold text-white">Collections visuelles</h2>

			<div class="mt-4 space-y-4">
				{#if groupedByColor.length}
					{#each groupedByColor as group}
						<div>
							<div class="flex items-center justify-between gap-3">
								<div class="flex items-center gap-2">
									<span class="h-2.5 w-2.5 rounded-full" style={`background-color: ${group.accent}`}></span>
									<p class="text-sm font-medium text-white">{group.label}</p>
								</div>
								<p class="text-xs text-zinc-500">{group.items.length} note(s)</p>
							</div>

							<div class="mt-3 grid gap-3 md:grid-cols-2">
								{#each group.items.slice(0, 4) as item}
									<a class={`block rounded-2xl border px-4 py-3 ${item.colors.card}`} href="/vault">
										<p class="font-medium text-white">{item.note.title}</p>
										<p class="mt-1 text-sm text-zinc-400">{summarizeVaultContent(item.note.content, 90)}</p>
										{#if item.project}
											<p class="mt-2 text-xs text-zinc-500">Projet: {item.project.title}</p>
										{/if}
									</a>
								{/each}
							</div>
						</div>
					{/each}
				{:else}
					<p class="text-sm text-zinc-500">Aucune couleur active pour l’instant.</p>
				{/if}
			</div>
		</Card>
	</div>
</div>
