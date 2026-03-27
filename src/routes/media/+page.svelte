<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import { notes } from '$lib/flowpilot';
	import {
		getDecayMeta,
		getPriorityMeta,
		getVaultMeta,
		noteColorClasses,
		type VaultMeta
	} from '$lib/note-vault';
	import {
		isAudioAttachment,
		isImageAttachment,
		isVideoAttachment,
		parseVaultContent,
		type VaultDocument
	} from '$lib/vault-document';
	import type { Note } from '$lib/types';

	type MediaNoteItem = {
		note: Note;
		meta: VaultMeta;
		document: VaultDocument;
		colors: ReturnType<typeof noteColorClasses>;
	};

	const mediaNotes = $derived(
		$notes
			.filter((note) => !note.deleted_at)
			.map((note): MediaNoteItem | null => {
				const meta = getVaultMeta(note);
				if (meta.kind !== 'note') return null;
				const document = parseVaultContent(note.content);
				if (!document.attachments.length) return null;
				return {
					note,
					meta,
					document,
					colors: noteColorClasses(meta.color)
				};
			})
			.filter((item): item is MediaNoteItem => Boolean(item))
			.sort(
				(left, right) =>
					new Date(right.note.updated_at).getTime() - new Date(left.note.updated_at).getTime()
			)
	);
</script>

<div class="space-y-4">
	<Card
		tone="active"
		class="overflow-hidden border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(0,212,255,0.18),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(123,47,255,0.12),transparent_38%),#101114]"
	>
		<p class="text-xs tracking-[0.22em] text-[#8feeff] uppercase">Medias</p>
		<h1 class="mt-3 text-3xl font-semibold text-white">Galerie des notes enrichies</h1>
		<p class="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">
			Toutes les notes qui transportent une preuve visuelle, un audio, une video ou un lien utile.
		</p>
	</Card>

	<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
		{#if mediaNotes.length}
			{#each mediaNotes as item}
				<Card class={`overflow-hidden ${item.colors.card}`}>
					{#if isImageAttachment(item.document.attachments[0])}
						<img
							class="h-48 w-full rounded-2xl object-cover"
							src={item.document.attachments[0].url}
							alt={item.note.title}
						/>
					{:else if isVideoAttachment(item.document.attachments[0])}
						<!-- svelte-ignore a11y_media_has_caption -->
						<video
							class="h-48 w-full rounded-2xl bg-black object-cover"
							src={item.document.attachments[0].url}
							controls
							preload="metadata"
						></video>
					{:else if isAudioAttachment(item.document.attachments[0])}
						<div class="rounded-2xl border border-white/8 bg-black/25 px-4 py-6">
							<audio
								class="w-full"
								src={item.document.attachments[0].url}
								controls
								preload="metadata"
							></audio>
						</div>
					{:else}
						<div
							class="flex h-48 items-center justify-center rounded-2xl border border-white/8 bg-black/25 px-4 text-center text-sm text-zinc-300"
						>
							Lien ou ressource externe
						</div>
					{/if}

					<div class="mt-4">
						<div class="flex items-start justify-between gap-3">
							<div>
								<p class="font-medium text-white">{item.note.title}</p>
								<p class="mt-1 text-sm text-zinc-400">
									{item.document.plainText || 'Note media sans commentaire supplementaire.'}
								</p>
							</div>
							<p
								class="text-xs tracking-[0.16em] uppercase"
								style={`color: ${getPriorityMeta(item.meta.priority).accent};`}
							>
								{getPriorityMeta(item.meta.priority).shortLabel}
							</p>
						</div>
						<p class="mt-3 text-xs text-zinc-500">
							{item.document.attachments.length} media(s) - {getDecayMeta(item.note, item.meta)
								.label} - mis a jour le {new Date(item.note.updated_at).toLocaleString('fr-FR')}
						</p>
						<a
							class="mt-4 inline-flex rounded-2xl border border-white/10 px-3 py-2 text-sm text-white"
							href="/vault"
						>
							Ouvrir la note
						</a>
					</div>
				</Card>
			{/each}
		{:else}
			<Card class="md:col-span-2 xl:col-span-3">
				<p class="text-lg font-medium text-white">Aucune note media pour l instant</p>
				<p class="mt-2 text-sm text-zinc-400">
					Ajoute une photo ou un autre media depuis l accueil ou depuis les notes pour remplir cette
					galerie.
				</p>
			</Card>
		{/if}
	</div>
</div>
