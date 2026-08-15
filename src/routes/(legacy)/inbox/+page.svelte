<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import { flowpilot, pendingInboxItems } from '$lib/flowpilot';

	const ageHours = (createdAt: string) => Math.floor((Date.now() - new Date(createdAt).getTime()) / 3600000);
	const backlogItems = $derived($pendingInboxItems.filter((item) => ageHours(item.created_at) >= 24));
</script>

<div class="space-y-4">
	<Card tone="active">
		<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
			<div>
				<p class="text-xs uppercase tracking-[0.2em] text-[#3399FF]">Inbox</p>
				<h1 class="mt-2 text-2xl font-semibold text-white">Capture brute</h1>
				<p class="mt-2 text-sm text-zinc-400">La capture se fait via le bouton + permanent.</p>
			</div>
			<a class="rounded-2xl border border-white/10 px-4 py-3 text-sm text-white" href="/clarify">Passer en clarification</a>
		</div>
	</Card>

	{#if $pendingInboxItems.length > 10 && backlogItems.length}
		<Card tone="warning">
			<p class="text-sm font-medium text-white">Backlog inbox</p>
			<p class="mt-2 text-sm text-zinc-300">
				{$pendingInboxItems.length} elements sont en attente et {backlogItems.length} ont plus de 24h.
			</p>
		</Card>
	{/if}

	<Card>
		<div class="space-y-3">
			{#if $pendingInboxItems.length}
				{#each $pendingInboxItems as item}
					<div
						class={`rounded-3xl border px-4 py-4 ${ageHours(item.created_at) >= 48 ? 'border-red-500/20 bg-[#1a1212]' : 'border-white/6 bg-black/20'}`}
					>
						<div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
							<div>
								<p class="font-medium text-white">{item.raw_text}</p>
								<p class="mt-2 text-sm text-zinc-400">
									age {ageHours(item.created_at)}h
									{#if item.parsed_date}
										- {item.parsed_date}
									{/if}
									{#if item.parsed_priority}
										- {item.parsed_priority}
									{/if}
									{#if item.parsed_tags.length}
										- #{item.parsed_tags.join(' #')}
									{/if}
								</p>
							</div>
							<div class="flex flex-wrap gap-2">
								<button class="rounded-2xl border border-white/10 px-3 py-2 text-sm text-white" type="button" onclick={() => flowpilot.snoozeInboxItem(item.id)}>
									Reporter
								</button>
								<button class="rounded-2xl border border-red-500/20 px-3 py-2 text-sm text-red-300" type="button" onclick={() => flowpilot.deleteInboxItem(item.id)}>
									Supprimer
								</button>
							</div>
						</div>
					</div>
				{/each}
			{:else}
				<p class="text-sm text-zinc-500">Inbox vide. Utilise le + pour capturer une idee.</p>
			{/if}
		</div>
	</Card>
</div>
