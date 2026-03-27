<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import QuickNotesPanel from '$lib/components/QuickNotesPanel.svelte';
	import { notes } from '$lib/flowpilot';
	import { NOTE_COLOR_OPTIONS, getVaultMeta, noteColorClasses, type VaultMeta } from '$lib/note-vault';
	import {
		isAudioAttachment,
		isImageAttachment,
		isVideoAttachment,
		parseVaultContent,
		summarizeVaultContent
	} from '$lib/vault-document';
	import type { Note } from '$lib/types';

	type NoteDashboardItem = {
		note: Note;
		meta: VaultMeta;
		document: ReturnType<typeof parseVaultContent>;
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
			.sort((left, right) => new Date(right.note.updated_at).getTime() - new Date(left.note.updated_at).getTime())
	);

	const pinnedNotes = $derived(noteItems.filter((item: NoteDashboardItem) => item.meta.pinned));
	const mediaNotes = $derived(noteItems.filter((item: NoteDashboardItem) => item.document.attachments.length > 0));
	const quickCaptureNotes = $derived(
		noteItems.filter((item: NoteDashboardItem) => item.meta.plainTags.includes('capture-rapide'))
	);
	const recentNotes = $derived(noteItems.slice(0, 6));
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
			.slice(0, 8);
	});
	const colorSummary = $derived(
		NOTE_COLOR_OPTIONS.map((option) => ({
			...option,
			count: noteItems.filter((item: NoteDashboardItem) => item.meta.color === option.value).length
		})).filter((item) => item.count > 0)
	);
</script>

<div class="space-y-4">
	<QuickNotesPanel />

	<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
		<Card class="bg-[linear-gradient(135deg,rgba(51,153,255,0.08),transparent_65%),#111]">
			<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Notes</p>
			<p class="mt-2 text-3xl font-semibold text-white">{noteItems.length}</p>
			<p class="mt-2 text-sm text-zinc-400">Toutes tes notes texte, photo et media reunies.</p>
		</Card>
		<Card class="bg-[linear-gradient(135deg,rgba(255,79,216,0.08),transparent_65%),#111]">
			<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Captures rapides</p>
			<p class="mt-2 text-3xl font-semibold text-white">{quickCaptureNotes.length}</p>
			<p class="mt-2 text-sm text-zinc-400">Les notes prises a la volee restent faciles a retrouver.</p>
		</Card>
		<Card class="bg-[linear-gradient(135deg,rgba(34,197,94,0.08),transparent_65%),#111]">
			<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Notes avec media</p>
			<p class="mt-2 text-3xl font-semibold text-white">{mediaNotes.length}</p>
			<p class="mt-2 text-sm text-zinc-400">Images, videos, audio et liens gardes dans les notes.</p>
		</Card>
		<Card class="bg-[linear-gradient(135deg,rgba(245,158,11,0.08),transparent_65%),#111]">
			<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Epinglees</p>
			<p class="mt-2 text-3xl font-semibold text-white">{pinnedNotes.length}</p>
			<p class="mt-2 text-sm text-zinc-400">Tes notes prioritaires restent au premier plan.</p>
		</Card>
	</div>

	<div class="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
		<Card>
			<div class="flex items-center justify-between gap-4">
				<div>
					<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Recentes</p>
					<h2 class="mt-2 text-xl font-semibold text-white">Les dernieres notes</h2>
					<p class="mt-2 text-sm text-zinc-400">Le flux le plus recent, sans quitter l’accueil.</p>
				</div>
				<a class="rounded-2xl border border-white/10 px-3 py-2 text-sm text-white" href="/vault">Bibliotheque complete</a>
			</div>

			<div class="mt-4 space-y-3">
				{#if recentNotes.length}
					{#each recentNotes as item}
						<a class={`block rounded-2xl border px-4 py-3 transition hover:border-white/14 ${item.colors.card}`} href="/vault">
							<div class="flex items-start justify-between gap-3">
								<div class="min-w-0">
									<p class="truncate font-medium text-white">{item.note.title}</p>
									<p class="mt-1 text-sm text-zinc-400">{summarizeVaultContent(item.note.content, 120)}</p>
								</div>
								<div class="shrink-0 text-right">
									{#if item.document.attachments.length}
										<p class="text-xs uppercase tracking-[0.16em] text-zinc-500">{item.document.attachments.length} media(s)</p>
									{/if}
									<p class="mt-1 text-xs text-zinc-500">
										{new Date(item.note.updated_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
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

		<Card class="bg-[radial-gradient(circle_at_top_right,rgba(255,79,216,0.08),transparent_38%),#111]">
			<div class="flex items-center justify-between gap-4">
				<div>
					<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Classement</p>
					<h2 class="mt-2 text-xl font-semibold text-white">Couleurs et tags</h2>
				</div>
				<a class="rounded-2xl border border-white/10 px-3 py-2 text-sm text-white" href="/collections">Explorer</a>
			</div>

			<div class="mt-4 space-y-4">
				<div>
					<p class="text-xs uppercase tracking-[0.16em] text-zinc-500">Couleurs actives</p>
					<div class="mt-3 flex flex-wrap gap-2">
						{#if colorSummary.length}
							{#each colorSummary as option}
								<div class="rounded-full border px-3 py-2 text-xs text-white" style={`background: linear-gradient(135deg, ${option.accent}22, rgba(17,17,17,0.95)); border-color: ${option.accent}44;`}>
									{option.label} · {option.count}
								</div>
							{/each}
						{:else}
							<p class="text-sm text-zinc-500">Aucune couleur utilisee pour le moment.</p>
						{/if}
					</div>
				</div>

				<div>
					<p class="text-xs uppercase tracking-[0.16em] text-zinc-500">Tags utiles</p>
					<div class="mt-3 flex flex-wrap gap-2">
						{#if topTags.length}
							{#each topTags as item}
								<div class="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-300">
									#{item.tag} · {item.count}
								</div>
							{/each}
						{:else}
							<p class="text-sm text-zinc-500">Ajoute quelques tags pour commencer ton classement.</p>
						{/if}
					</div>
				</div>
			</div>
		</Card>
	</div>

	<div class="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
		<Card>
			<div class="flex items-center justify-between gap-4">
				<div>
					<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Epinglees</p>
					<h2 class="mt-2 text-xl font-semibold text-white">Notes a garder en tete</h2>
				</div>
				<a class="rounded-2xl border border-white/10 px-3 py-2 text-sm text-white" href="/vault">Voir les notes</a>
			</div>

			<div class="mt-4 space-y-3">
				{#if pinnedNotes.length}
					{#each pinnedNotes.slice(0, 4) as item}
						<a class={`block rounded-2xl border px-4 py-3 transition hover:border-white/14 ${item.colors.card}`} href="/vault">
							<p class="font-medium text-white">{item.note.title}</p>
							<p class="mt-1 text-sm text-zinc-400">{summarizeVaultContent(item.note.content, 110)}</p>
						</a>
					{/each}
				{:else}
					<p class="text-sm text-zinc-500">Epingle une note importante pour la garder ici.</p>
				{/if}
			</div>
		</Card>

		<Card>
			<div class="flex items-center justify-between gap-4">
				<div>
					<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Medias recents</p>
					<h2 class="mt-2 text-xl font-semibold text-white">Images, audio et videos</h2>
				</div>
				<a class="rounded-2xl border border-white/10 px-3 py-2 text-sm text-white" href="/media">Galerie media</a>
			</div>

			<div class="mt-4 grid gap-3 md:grid-cols-2">
				{#if mediaNotes.length}
					{#each mediaNotes.slice(0, 4) as item}
						<a class="overflow-hidden rounded-2xl border border-white/8 bg-black/20 transition hover:border-white/14" href="/media">
							{#if isImageAttachment(item.document.attachments[0])}
								<img class="h-36 w-full object-cover" src={item.document.attachments[0].url} alt={item.note.title} />
							{:else}
								<div class="flex h-36 items-center justify-center bg-white/[0.03] text-sm text-zinc-300">
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
								<p class="mt-1 text-sm text-zinc-400">{summarizeVaultContent(item.note.content, 80)}</p>
							</div>
						</a>
					{/each}
				{:else}
					<p class="text-sm text-zinc-500">Ajoute une image, un audio ou une video pour remplir la galerie.</p>
				{/if}
			</div>
		</Card>
	</div>
</div>
