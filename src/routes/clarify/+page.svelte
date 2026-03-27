<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import { activeProjects, flowpilot, pendingInboxItems } from '$lib/flowpilot';
	import type { Energy, Priority } from '$lib/types';

	let priority = $state<Priority>('normal');
	let duration = $state(25);
	let energy = $state<Energy | null>(null);
	let context = $state('');
	let projectId = $state('');
	let deadline = $state('');

	const currentItem = $derived($pendingInboxItems.at(0) ?? null);

	$effect(() => {
		if (!currentItem) return;
		priority = currentItem.parsed_priority ?? 'normal';
		duration = 25;
		energy = null;
		context = '';
		projectId = currentItem.project_id ?? '';
		deadline = currentItem.parsed_date ? currentItem.parsed_date.slice(0, 10) : '';
	});
</script>

<div class="space-y-4">
	<Card tone="active">
		<div class="flex items-center justify-between gap-4">
			<div>
				<p class="text-xs uppercase tracking-[0.2em] text-[#3399FF]">Clarification</p>
				<h1 class="mt-2 text-2xl font-semibold text-white">{Math.max(0, $pendingInboxItems.length - 1)} restant(s)</h1>
			</div>
			<a class="rounded-2xl border border-white/10 px-4 py-3 text-sm text-white" href="/inbox">Voir la liste</a>
		</div>
	</Card>

	{#if currentItem}
		<Card class="space-y-6">
			<div>
				<p class="text-sm text-zinc-400">Element en cours</p>
				<h2 class="mt-2 text-2xl font-semibold text-white">{currentItem.raw_text}</h2>
				<p class="mt-2 text-sm text-zinc-500">Choisis sa destination puis passe au suivant.</p>
			</div>

			<div class="grid gap-3 md:grid-cols-4">
				<button class={`rounded-2xl px-4 py-3 text-sm ${priority === 'critical' ? 'bg-red-500/15 text-red-200' : 'border border-white/10 text-white'}`} type="button" onclick={() => (priority = 'critical')}>Critique</button>
				<button class={`rounded-2xl px-4 py-3 text-sm ${priority === 'important' ? 'bg-amber-400/15 text-amber-200' : 'border border-white/10 text-white'}`} type="button" onclick={() => (priority = 'important')}>Important</button>
				<button class={`rounded-2xl px-4 py-3 text-sm ${priority === 'normal' ? 'bg-[#3399FF]/15 text-white' : 'border border-white/10 text-white'}`} type="button" onclick={() => (priority = 'normal')}>Normal</button>
				<button class={`rounded-2xl px-4 py-3 text-sm ${priority === 'low' ? 'bg-white/10 text-white' : 'border border-white/10 text-white'}`} type="button" onclick={() => (priority = 'low')}>Low</button>
			</div>

			<div class="grid gap-3 md:grid-cols-5">
				{#each [5, 15, 30, 60, 120] as option}
					<button class={`rounded-2xl px-4 py-3 text-sm ${duration === option ? 'bg-[#3399FF]/15 text-white' : 'border border-white/10 text-white'}`} type="button" onclick={() => (duration = option)}>
						{option} min
					</button>
				{/each}
			</div>

			<div class="grid gap-3 md:grid-cols-3">
				<button class={`rounded-2xl px-4 py-3 text-sm ${energy === 'high' ? 'bg-[#3399FF]/15 text-white' : 'border border-white/10 text-white'}`} type="button" onclick={() => (energy = 'high')}>Energie H</button>
				<button class={`rounded-2xl px-4 py-3 text-sm ${energy === 'medium' ? 'bg-[#3399FF]/15 text-white' : 'border border-white/10 text-white'}`} type="button" onclick={() => (energy = 'medium')}>Energie M</button>
				<button class={`rounded-2xl px-4 py-3 text-sm ${energy === 'low' ? 'bg-[#3399FF]/15 text-white' : 'border border-white/10 text-white'}`} type="button" onclick={() => (energy = 'low')}>Energie L</button>
			</div>

			<div class="grid gap-3 md:grid-cols-3">
				<input class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" placeholder="Contexte" bind:value={context} />
				<select class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" bind:value={projectId}>
					<option value="">Sans projet</option>
					{#each $activeProjects as project}
						<option value={project.id}>{project.title}</option>
					{/each}
				</select>
				<input class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" type="date" bind:value={deadline} />
			</div>

			<div class="grid gap-3 md:grid-cols-5">
				<button class="rounded-2xl bg-[#3399FF] px-4 py-3 text-sm font-medium text-white" type="button" onclick={() => flowpilot.clarifyInboxToTask(currentItem.id, { title: currentItem.raw_text, priority, estimated_duration: duration, energy, context, project_id: projectId || null, deadline: deadline ? `${deadline}T09:00:00.000Z` : null })}>
					-> Tache
				</button>
				<button class="rounded-2xl border border-white/10 px-4 py-3 text-sm text-white" type="button" onclick={() => flowpilot.clarifyInboxToNote(currentItem.id)}>
					-> Note
				</button>
				<button class="rounded-2xl border border-white/10 px-4 py-3 text-sm text-white" type="button" onclick={() => flowpilot.clarifyInboxToProject(currentItem.id)}>
					-> Projet
				</button>
				<button class="rounded-2xl border border-white/10 px-4 py-3 text-sm text-white" type="button" onclick={() => flowpilot.snoozeInboxItem(currentItem.id)}>
					Reporter
				</button>
				<button class="rounded-2xl border border-red-500/20 px-4 py-3 text-sm text-red-300" type="button" onclick={() => flowpilot.deleteInboxItem(currentItem.id)}>
					Supprimer
				</button>
			</div>
		</Card>
	{:else}
		<Card>
			<p class="text-sm text-zinc-400">Inbox vide. Tout a ete clarifie.</p>
		</Card>
	{/if}
</div>
