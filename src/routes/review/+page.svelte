<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import { focusSessions, flowpilot, habitProgress, pendingInboxItems, projectProgress, reviews, visibleTasks } from '$lib/flowpilot';
	import { formatMinutes, startOfWeekDate } from '$lib/utils';

	let reviewNotes = $state('');
	let priorities = $state('');

	const weekStart = $derived(startOfWeekDate().toISOString().slice(0, 10));
	const doneThisWeek = $derived(
		$visibleTasks.filter((task) => task.status === 'done' && task.updated_at.slice(0, 10) >= weekStart)
	);
	const focusThisWeek = $derived(
		$focusSessions
			.filter((session) => session.started_at.slice(0, 10) >= weekStart)
			.reduce((sum, session) => sum + (session.duration_minutes ?? 0), 0)
	);
	const overdueCount = $derived(
		$visibleTasks.filter(
			(task) =>
				task.status !== 'done' &&
				((task.deadline && new Date(task.deadline).getTime() < Date.now()) ||
					(task.scheduled_date && new Date(`${task.scheduled_date}T23:59:59`).getTime() < Date.now()))
		).length
	);
	const stagnantProjects = $derived($projectProgress.filter((item) => item.isStagnant));
	const habitsAverage = $derived(
		$habitProgress.length
			? Math.round(
					$habitProgress.reduce((sum, item) => sum + item.completionRate, 0) / $habitProgress.length
				)
			: 0
	);
	const plannedThisWeek = $derived(
		$visibleTasks.filter((task) => task.scheduled_date && task.scheduled_date >= weekStart)
	);
	const planningAccuracy = $derived(
		plannedThisWeek.length
			? Math.round(
					(plannedThisWeek.filter((task) => task.status === 'done').length / plannedThisWeek.length) * 100
				)
			: 0
	);
	const autoSummary = $derived(
		`${doneThisWeek.length} taches terminees, ${formatMinutes(focusThisWeek)} de focus, ${habitsAverage}% d habitudes et ${planningAccuracy}% de fiabilite planning.`
	);
</script>

<div class="space-y-4">
	<Card tone="active">
		<p class="text-xs uppercase tracking-[0.2em] text-[#3399FF]">Revue hebdo</p>
		<h1 class="mt-2 text-2xl font-semibold text-white">Guide en 5 etapes</h1>
		<p class="mt-2 text-sm text-zinc-400">Vider inbox -> retards -> projets stagnants -> bilan auto -> 3 priorites.</p>
	</Card>

	<div class="grid gap-4 lg:grid-cols-2">
		<Card>
			<div class="space-y-4">
				<div>
					<p class="text-sm font-medium text-white">1. Vider l inbox</p>
					<p class="mt-2 text-sm text-zinc-400">{$pendingInboxItems.length} element(s) encore a clarifier.</p>
				</div>
				<div>
					<p class="text-sm font-medium text-white">2. Retards</p>
					<p class="mt-2 text-sm text-zinc-400">{overdueCount} element(s) demandent un arbitrage.</p>
				</div>
				<div>
					<p class="text-sm font-medium text-white">3. Projets stagnants</p>
					<p class="mt-2 text-sm text-zinc-400">{stagnantProjects.length} projet(s) sans mouvement recent.</p>
				</div>
				<div>
					<p class="text-sm font-medium text-white">4. Bilan auto</p>
					<p class="mt-2 text-sm text-zinc-400">{autoSummary}</p>
				</div>
				<div>
					<p class="text-sm font-medium text-white">5. Les 3 priorites de la semaine prochaine</p>
					<p class="mt-2 text-sm text-zinc-400">Saisis-les ci-dessous et enregistre la revue.</p>
				</div>
			</div>
		</Card>

		<Card>
			<form class="space-y-4" onsubmit={(event) => { event.preventDefault(); void flowpilot.createWeeklyReview(reviewNotes, priorities.split('\n').map((item) => item.trim()).filter(Boolean).slice(0,3)); priorities=''; reviewNotes=''; }}>
				<div class="grid gap-3 sm:grid-cols-2">
					<div class="rounded-2xl border border-white/6 bg-black/20 px-4 py-3">
						<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Taches</p>
						<p class="mt-2 text-xl font-semibold text-white">{doneThisWeek.length}</p>
					</div>
					<div class="rounded-2xl border border-white/6 bg-black/20 px-4 py-3">
						<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Focus</p>
						<p class="mt-2 text-xl font-semibold text-white">{formatMinutes(focusThisWeek)}</p>
					</div>
					<div class="rounded-2xl border border-white/6 bg-black/20 px-4 py-3">
						<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Habitudes</p>
						<p class="mt-2 text-xl font-semibold text-white">{habitsAverage}%</p>
					</div>
					<div class="rounded-2xl border border-white/6 bg-black/20 px-4 py-3">
						<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Fiabilite</p>
						<p class="mt-2 text-xl font-semibold text-white">{planningAccuracy}%</p>
					</div>
				</div>
				<textarea class="min-h-40 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" placeholder={`Bilan auto: ${autoSummary}`} bind:value={reviewNotes}></textarea>
				<textarea class="min-h-32 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" placeholder="Une priorite par ligne" bind:value={priorities}></textarea>
				<button class="rounded-2xl bg-[#3399FF] px-4 py-3 text-sm font-medium text-white" type="submit">Enregistrer la revue</button>
			</form>
		</Card>
	</div>

	<Card>
		<p class="text-sm font-medium text-white">Historique</p>
		<div class="mt-4 space-y-3">
			{#each $reviews as review}
				<div class="rounded-2xl border border-white/6 bg-black/20 px-4 py-3">
					<p class="font-medium text-white">Semaine du {review.week_start}</p>
					<p class="mt-1 text-sm text-zinc-400">
						{review.tasks_completed} taches - {review.total_focus_minutes} min focus - precision {Math.round(review.planning_accuracy * 100)}% - habitudes {Math.round(review.habits_completion_rate * 100)}%
					</p>
					{#if review.priorities_next_week.length}
						<div class="mt-3 flex flex-wrap gap-2">
							{#each review.priorities_next_week as priority}
								<span class="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300">{priority}</span>
							{/each}
						</div>
					{/if}
					{#if review.notes}
						<p class="mt-3 text-sm text-zinc-300">{review.notes}</p>
					{/if}
				</div>
			{/each}
		</div>
	</Card>
</div>
