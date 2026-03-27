<script lang="ts">
	import { goto } from '$app/navigation';
	import { tick } from 'svelte';
	import Card from '$lib/components/Card.svelte';
	import { notes } from '$lib/flowpilot';
	import { matchesNoteQuery, type NoteIndexItem } from '$lib/nexus-notes';
	import { getVaultMeta } from '$lib/note-vault';
	import { parseVaultContent, summarizeVaultContent } from '$lib/vault-document';
	import type { Note } from '$lib/types';

	let {
		open = false,
		onClose = () => {}
	}: {
		open?: boolean;
		onClose?: () => void;
	} = $props();

	type PaletteNote = NoteIndexItem & { note: Note };

	type PaletteAction = {
		id: string;
		label: string;
		description: string;
		href: string;
	};

	let query = $state('');
	let inputElement = $state<HTMLInputElement | null>(null);

	const noteItems = $derived(
		$notes
			.filter((note) => !note.deleted_at)
			.map((note): PaletteNote | null => {
				const meta = getVaultMeta(note);
				if (meta.kind !== 'note') return null;
				return {
					note,
					meta,
					document: parseVaultContent(note.content)
				};
			})
			.filter((item): item is PaletteNote => Boolean(item))
			.sort(
				(left, right) =>
					new Date(right.note.updated_at).getTime() - new Date(left.note.updated_at).getTime()
			)
	);

	const baseActions: PaletteAction[] = [
		{
			id: 'new-note',
			label: 'Nouvelle note',
			description: 'Ouvrir la bibliotheque et focus sur le titre.',
			href: '/vault?new=1&focus=title'
		},
		{
			id: 'meeting-template',
			label: 'Template reunion',
			description: 'Creer une note de reunion pre-remplie.',
			href: '/vault?template=meeting&focus=title'
		},
		{
			id: 'idea-template',
			label: 'Template idee produit',
			description: 'Creer une note idee produit.',
			href: '/vault?template=product-idea&focus=content'
		},
		{
			id: 'daily-review',
			label: 'Template daily review',
			description: 'Preparer la revue du jour.',
			href: '/vault?template=daily-review&focus=content'
		},
		{
			id: 'weekly-review',
			label: 'Template bilan semaine',
			description: 'Preparer la revue de la semaine.',
			href: '/vault?template=weekly-review&focus=content'
		},
		{
			id: 'media',
			label: 'Galerie media',
			description: 'Aller directement aux notes avec medias.',
			href: '/media'
		},
		{
			id: 'constellation',
			label: 'Constellation',
			description: 'Explorer les smart collections et le decay.',
			href: '/collections'
		}
	];

	const filteredActions = $derived(
		baseActions.filter((action) => {
			if (!query.trim()) return true;
			const haystack = `${action.label} ${action.description}`.toLowerCase();
			return haystack.includes(query.trim().toLowerCase());
		})
	);

	const matchingNotes = $derived(
		noteItems.filter((item: PaletteNote) => matchesNoteQuery(item, query)).slice(0, 6)
	);

	const openHref = async (href: string) => {
		onClose();
		await goto(href);
	};

	const onInputKeydown = async (event: KeyboardEvent) => {
		if (event.key === 'Escape') {
			event.preventDefault();
			onClose();
			return;
		}

		if (event.key === 'Enter') {
			event.preventDefault();
			if (matchingNotes[0]) {
				await openHref(`/vault?edit=${matchingNotes[0].note.id}`);
				return;
			}
			if (filteredActions[0]) {
				await openHref(filteredActions[0].href);
			}
		}
	};

	$effect(() => {
		if (open) {
			void tick().then(() => inputElement?.focus());
			return;
		}
		query = '';
	});
</script>

{#if open}
	<div
		class="fixed inset-0 z-[60] flex items-start justify-center bg-black/70 p-4 pt-20 backdrop-blur-sm"
	>
		<button class="absolute inset-0" type="button" aria-label="Fermer" onclick={onClose}></button>

		<Card class="relative z-10 w-full max-w-3xl border-white/10 bg-[#0F1629]/96" tone="active">
			<div class="flex items-center justify-between gap-4">
				<div>
					<p class="text-xs tracking-[0.2em] text-[#8fcaff] uppercase">Command palette</p>
					<h2 class="mt-2 text-2xl font-semibold text-white">Naviguer, chercher, capturer</h2>
				</div>
				<button
					class="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300"
					type="button"
					onclick={onClose}
				>
					Echap
				</button>
			</div>

			<input
				class="mt-4 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white transition outline-none focus:border-[#00D4FF]/40"
				placeholder="Chercher une note, un tag, ou lancer une action..."
				bind:this={inputElement}
				bind:value={query}
				onkeydown={onInputKeydown}
			/>

			<div class="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
				<div>
					<p class="text-xs tracking-[0.16em] text-zinc-500 uppercase">Actions</p>
					<div class="mt-3 space-y-2">
						{#each filteredActions.slice(0, 6) as action}
							<button
								class="w-full rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-left transition hover:border-white/14"
								type="button"
								onclick={() => openHref(action.href)}
							>
								<p class="text-sm font-medium text-white">{action.label}</p>
								<p class="mt-1 text-sm text-zinc-400">{action.description}</p>
							</button>
						{/each}
					</div>
				</div>

				<div>
					<p class="text-xs tracking-[0.16em] text-zinc-500 uppercase">Notes</p>
					<div class="mt-3 space-y-2">
						{#if matchingNotes.length}
							{#each matchingNotes as item}
								<button
									class="w-full rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-left transition hover:border-white/14"
									type="button"
									onclick={() => openHref(`/vault?edit=${item.note.id}`)}
								>
									<div class="flex items-center justify-between gap-3">
										<p class="truncate text-sm font-medium text-white">{item.note.title}</p>
										<p class="text-xs text-zinc-500">
											{new Date(item.note.updated_at).toLocaleDateString('fr-FR')}
										</p>
									</div>
									<p class="mt-1 text-sm text-zinc-400">
										{summarizeVaultContent(item.note.content, 96)}
									</p>
									{#if item.meta.plainTags.length}
										<div class="mt-2 flex flex-wrap gap-2">
											{#each item.meta.plainTags.slice(0, 3) as tag}
												<span
													class="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-zinc-400"
													>#{tag}</span
												>
											{/each}
										</div>
									{/if}
								</button>
							{/each}
						{:else}
							<p
								class="rounded-2xl border border-white/8 bg-black/20 px-4 py-6 text-sm text-zinc-500"
							>
								Aucune note ne correspond. Essaie un tag, `priority:p1`, `state:seed` ou un mot-cle.
							</p>
						{/if}
					</div>
				</div>
			</div>

			<div class="mt-5 flex flex-wrap gap-2 text-xs text-zinc-500">
				<span class="rounded-full border border-white/10 px-3 py-1">Ctrl+K palette</span>
				<span class="rounded-full border border-white/10 px-3 py-1">Ctrl+Shift+N nouvelle note</span
				>
				<span class="rounded-full border border-white/10 px-3 py-1">Ctrl+D densite</span>
			</div>
		</Card>
	</div>
{/if}
