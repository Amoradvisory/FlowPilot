<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import { currentTask, dashboardPrompts, flowpilot, habitProgress, notes, pendingInboxItems, profile, projectProgress, todayFocusMinutes, todayTasks, overdueTasks, visibleTasks } from '$lib/flowpilot';
	import type { Note } from '$lib/types';
	import { formatMinutes } from '$lib/utils';
	import { getVaultMeta, type VaultMeta } from '$lib/note-vault';

	type DashboardVaultItem = {
		note: Note;
		meta: VaultMeta;
	};

	const today = new Date().toISOString().slice(0, 10);
	const plannedTodayTotal = $derived($visibleTasks.filter((task) => task.scheduled_date === today).length);
	const plannedTodayDone = $derived(
		$visibleTasks.filter((task) => task.scheduled_date === today && task.status === 'done').length
	);
	const inboxBacklog = $derived(
		$pendingInboxItems.filter((item) => Date.now() - new Date(item.created_at).getTime() > 24 * 60 * 60 * 1000)
	);
	const vaultItems = $derived(
		$notes
			.filter((note) => !note.deleted_at)
			.map((note): DashboardVaultItem => ({ note, meta: getVaultMeta(note) }))
			.sort((left, right) => {
				if (left.meta.pinned !== right.meta.pinned) return Number(right.meta.pinned) - Number(left.meta.pinned);
				return new Date(right.note.updated_at).getTime() - new Date(left.note.updated_at).getTime();
			})
	);
	const pinnedVault = $derived(vaultItems.filter((item: DashboardVaultItem) => item.meta.pinned));
	const promptVault = $derived(
		vaultItems.filter((item: DashboardVaultItem) => item.meta.kind === 'prompt')
	);
</script>

<div class="space-y-4">
	<Card tone="active" class="sticky top-20 z-10">
		<p class="text-xs uppercase tracking-[0.2em] text-[#3399FF]">Maintenant</p>
		{#if $currentTask}
			<div class="mt-3 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<div>
					<h2 class="text-2xl font-semibold text-white">{$currentTask.title}</h2>
					<p class="mt-2 text-sm text-zinc-400">
						{$currentTask.priority} - {$currentTask.estimated_duration ?? 25} min - {$currentTask.context ?? 'sans contexte'}
					</p>
				</div>

				<div class="flex flex-wrap gap-3">
					<a class="rounded-2xl border border-white/10 px-4 py-3 text-sm text-white" href="/tasks">
						Details
					</a>
					<button class="rounded-2xl bg-[#3399FF] px-4 py-3 text-sm font-medium text-white" type="button" onclick={() => flowpilot.startFocus($currentTask.id)}>
						Focus
					</button>
				</div>
			</div>
		{:else}
			<div class="mt-3 flex items-center justify-between gap-4">
				<div>
					<h2 class="text-2xl font-semibold text-white">Planifie ta journee</h2>
					<p class="mt-2 text-sm text-zinc-400">Aucune tache prioritaire claire pour le moment.</p>
				</div>
				<a class="rounded-2xl bg-[#3399FF] px-4 py-3 text-sm font-medium text-white" href="/tasks">Planifier</a>
			</div>
		{/if}
	</Card>

	{#if $dashboardPrompts.length}
		<div class="grid gap-3 md:grid-cols-2">
			{#each $dashboardPrompts as prompt}
				<Card tone={prompt.tone === 'warning' ? 'warning' : 'default'} class="space-y-3">
					<div>
						<p class="text-sm font-medium text-white">{prompt.title}</p>
						<p class="mt-2 text-sm text-zinc-400">{prompt.body}</p>
					</div>
					<a class="inline-flex rounded-2xl border border-white/10 px-4 py-2 text-sm text-white" href={prompt.actionHref}>
						{prompt.actionLabel}
					</a>
				</Card>
			{/each}
		</div>
	{/if}

	<div class="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
		<div class="space-y-4">
			<Card>
				<div class="mb-4 flex items-center justify-between">
					<div>
						<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Aujourd hui</p>
						<h2 class="mt-2 text-xl font-semibold text-white">{$todayTasks.length} tache(s) planifiee(s)</h2>
						<p class="mt-2 text-sm text-zinc-400">
							Progression {plannedTodayDone}/{plannedTodayTotal || 0}
						</p>
					</div>
					<a class="rounded-2xl border border-white/10 px-3 py-2 text-sm text-white" href="/tasks">Voir tout</a>
				</div>

				<div class="mb-4 h-2 rounded-full bg-white/6">
					<div
						class="h-2 rounded-full bg-green-500"
						style={`width: ${plannedTodayTotal ? (plannedTodayDone / plannedTodayTotal) * 100 : 0}%`}
					></div>
				</div>

				<div class="space-y-3">
					{#if $todayTasks.length}
						{#each $todayTasks as task}
							<div class="rounded-2xl border border-white/6 bg-black/20 px-4 py-3">
								<div class="flex items-start justify-between gap-4">
									<div>
										<p class="font-medium text-white">{task.title}</p>
										<p class="mt-1 text-sm text-zinc-400">
											{task.priority} - {task.estimated_duration ?? 25} min - {task.scheduled_time_start ?? 'a planifier'}
										</p>
									</div>
									<button class="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300" type="button" onclick={() => flowpilot.completeTask(task.id)}>
										Terminer
									</button>
								</div>
							</div>
						{/each}
					{:else}
						<p class="text-sm text-zinc-500">Aucune tache du jour pour le moment.</p>
					{/if}
				</div>
			</Card>

			<Card>
				<div class="mb-4 flex items-center justify-between">
					<div>
						<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Habitudes</p>
						<h2 class="mt-2 text-xl font-semibold text-white">Check rapide</h2>
					</div>
					<a class="rounded-2xl border border-white/10 px-3 py-2 text-sm text-white" href="/habits">Gerer</a>
				</div>

				<div class="space-y-3">
					{#if $habitProgress.length}
						{#each $habitProgress as item}
							<div class="flex items-center justify-between rounded-2xl border border-white/6 bg-black/20 px-4 py-3">
								<div>
									<p class="font-medium text-white">{item.habit.title}</p>
									<p class="mt-1 text-sm text-zinc-400">streak {item.currentStreak} - meilleur {item.bestStreak}</p>
								</div>
								<button
									class={`rounded-2xl px-4 py-2 text-sm font-medium ${item.todayDone ? 'bg-green-500/15 text-green-300' : 'border border-white/10 text-white'}`}
									type="button"
									onclick={() => flowpilot.toggleHabitCompletion(item.habit.id)}
								>
									{item.todayDone ? 'Fait' : 'Valider'}
								</button>
							</div>
						{/each}
					{:else}
						<p class="text-sm text-zinc-500">Ajoute une habitude pour le suivi quotidien.</p>
					{/if}
				</div>
			</Card>
		</div>

		<div class="space-y-4">
			<Card>
				<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Focus</p>
				<h2 class="mt-2 text-xl font-semibold text-white">{formatMinutes($todayFocusMinutes)}</h2>
				<p class="mt-2 text-sm text-zinc-400">
					Objectif {formatMinutes($profile?.settings.daily_focus_goal_minutes ?? 240)}
				</p>
				<div class="mt-4 h-2 rounded-full bg-white/6">
					<div
						class="h-2 rounded-full bg-[#3399FF]"
						style={`width: ${Math.min(100, (($todayFocusMinutes / ($profile?.settings.daily_focus_goal_minutes ?? 240)) * 100) || 0)}%`}
					></div>
				</div>
			</Card>

			<Card>
				<div class="flex items-center justify-between">
					<div>
						<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Inbox</p>
						<h2 class="mt-2 text-xl font-semibold text-white">{$pendingInboxItems.length} pending</h2>
						{#if $pendingInboxItems.length > 10 && inboxBacklog.length}
							<p class="mt-2 text-sm text-red-300">
								Backlog actif: {inboxBacklog.length} element(s) ont plus de 24h.
							</p>
						{/if}
					</div>
					<a class="rounded-2xl border border-white/10 px-3 py-2 text-sm text-white" href="/clarify">Clarifier</a>
				</div>

				<div class="mt-4 space-y-2">
					{#each $pendingInboxItems.slice(0, 4) as item}
						<div class={`rounded-2xl border px-4 py-3 text-sm ${Date.now() - new Date(item.created_at).getTime() > 48 * 60 * 60 * 1000 ? 'border-red-500/20 bg-[#1a1212] text-red-100' : 'border-white/6 bg-black/20 text-zinc-300'}`}>
							{item.raw_text}
						</div>
					{/each}
				</div>
			</Card>

			<Card class="bg-[radial-gradient(circle_at_top_right,rgba(255,79,216,0.12),transparent_36%),radial-gradient(circle_at_top_left,rgba(51,153,255,0.12),transparent_34%),#111]">
				<div class="flex items-center justify-between gap-4">
					<div>
						<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Vault</p>
						<h2 class="mt-2 text-xl font-semibold text-white">{pinnedVault.length} epingle(s)</h2>
						<p class="mt-2 text-sm text-zinc-400">{promptVault.length} prompt(s) et {vaultItems.length} note(s) utiles a reutiliser.</p>
					</div>
					<a class="rounded-2xl border border-white/10 px-3 py-2 text-sm text-white" href="/vault">Ouvrir</a>
				</div>

				<div class="mt-4 space-y-2">
					{#if pinnedVault.length}
						{#each pinnedVault.slice(0, 3) as item}
							<div class="rounded-2xl border border-white/6 bg-black/20 px-4 py-3">
								<p class="font-medium text-white">{item.note.title}</p>
								<p class="mt-1 text-sm text-zinc-400">{item.meta.kind}</p>
							</div>
						{/each}
					{:else}
						<p class="text-sm text-zinc-500">Ajoute une note importante ou un prompt pour les retrouver ici.</p>
					{/if}
				</div>
			</Card>

			{#if $overdueTasks.length || $projectProgress.some((item) => item.isStagnant)}
				<Card tone="warning">
					<p class="text-xs uppercase tracking-[0.2em] text-red-300">En retard</p>
					<div class="mt-4 space-y-3">
						{#each $overdueTasks.slice(0, 4) as task}
							<div class="rounded-2xl border border-red-500/10 bg-black/20 px-4 py-3">
								<p class="font-medium text-white">{task.title}</p>
								<p class="mt-1 text-sm text-zinc-400">{task.deadline ?? task.scheduled_date}</p>
							</div>
						{/each}

						{#each $projectProgress.filter((item) => item.isStagnant).slice(0, 3) as item}
							<div class="rounded-2xl border border-white/6 bg-black/20 px-4 py-3">
								<p class="font-medium text-white">{item.project.title}</p>
								<p class="mt-1 text-sm text-zinc-400">Projet stagnant depuis plus de 7 jours</p>
							</div>
						{/each}
					</div>
				</Card>
			{/if}
		</div>
	</div>
</div>
