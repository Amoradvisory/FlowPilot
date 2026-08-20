<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import { currentTask, flowpilot, focusRuntime, focusSessions, profile, todayFocusMinutes, visibleTasks } from '$lib/flowpilot';
	import { formatMinutes } from '$lib/utils';

	const summary = $derived(flowpilot.getFocusSummary());
	let selectedTaskId = $state('');
	let plannedMinutes = $state(25);

	const focusableTasks = $derived(
		$visibleTasks.filter((task) => task.status !== 'done' && task.status !== 'cancelled')
	);
	const taskMap = $derived(Object.fromEntries($visibleTasks.map((task) => [task.id, task.title])));
	const task = $derived(
		summary.task ?? focusableTasks.find((item) => item.id === selectedTaskId) ?? $currentTask ?? null
	);
	const dailyGoal = $derived($profile?.settings.daily_focus_goal_minutes ?? 240);

	$effect(() => {
		plannedMinutes = $profile?.settings.pomodoro_minutes ?? 25;
	});

	$effect(() => {
		if (summary.task?.id) {
			selectedTaskId = summary.task.id;
			return;
		}

		if ($currentTask?.id) {
			selectedTaskId = $currentTask.id;
			return;
		}

		if (!selectedTaskId && focusableTasks.length) {
			selectedTaskId = focusableTasks[0].id;
		}
	});

	const formatSeconds = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
	};
</script>

<div class="space-y-4">
	<Card tone="active" class="py-10 text-center">
		<p class="text-xs uppercase tracking-[0.2em] text-[#3399FF]">Focus</p>
		<h1 class="mt-4 text-6xl font-semibold tracking-tight text-white">{formatSeconds(summary.remainingSeconds)}</h1>
		<p class="mt-3 text-lg text-zinc-300">{task ? task.title : 'Choisis une tache pour demarrer'}</p>
		<p class="mt-2 text-sm text-zinc-500">Toujours lie a une tache. Le temps est enregistre automatiquement.</p>

		{#if $focusRuntime.mode === 'idle'}
			<div class="mx-auto mt-6 grid max-w-3xl gap-3 md:grid-cols-[1fr_auto]">
				<select class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" bind:value={selectedTaskId}>
					<option value="">Choisir une tache</option>
					{#each focusableTasks as item}
						<option value={item.id}>{item.title}</option>
					{/each}
				</select>
				<input class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" type="number" min="5" step="5" bind:value={plannedMinutes} />
			</div>

			<div class="mt-3 flex flex-wrap justify-center gap-2">
				{#each [15, 25, 50] as option}
					<button class={`rounded-2xl px-4 py-2 text-sm ${plannedMinutes === option ? 'bg-white/10 text-white' : 'border border-white/10 text-zinc-400'}`} type="button" onclick={() => (plannedMinutes = option)}>
						{option} min
					</button>
				{/each}
			</div>
		{/if}

		<div class="mt-8 flex flex-wrap justify-center gap-3">
			{#if $focusRuntime.mode === 'idle'}
				{#if task}
					<button class="rounded-2xl bg-[#3399FF] px-5 py-3 text-sm font-medium text-white" type="button" onclick={() => flowpilot.startFocus(task.id, plannedMinutes)}>
						Demarrer
					</button>
				{:else}
					<a class="rounded-2xl border border-white/10 px-5 py-3 text-sm text-white" href="/tasks">
						Creer une tache
					</a>
				{/if}
			{:else if $focusRuntime.mode === 'running'}
				<button class="rounded-2xl border border-white/10 px-5 py-3 text-sm text-white" type="button" onclick={() => flowpilot.pauseFocus()}>
					Pause
				</button>
				<button class="rounded-2xl border border-red-500/20 px-5 py-3 text-sm text-red-300" type="button" onclick={() => flowpilot.finishFocus(false)}>
					Stop
				</button>
			{:else if $focusRuntime.mode === 'paused'}
				<button class="rounded-2xl bg-[#3399FF] px-5 py-3 text-sm font-medium text-white" type="button" onclick={() => flowpilot.resumeFocus()}>
					Reprendre
				</button>
				<button class="rounded-2xl border border-red-500/20 px-5 py-3 text-sm text-red-300" type="button" onclick={() => flowpilot.finishFocus(false)}>
					Stop
				</button>
			{:else if $focusRuntime.mode === 'prompt'}
				<button class="rounded-2xl bg-green-500/15 px-5 py-3 text-sm font-medium text-green-300" type="button" onclick={() => flowpilot.finishFocus(true)}>
					Oui, terminee
				</button>
				<button class="rounded-2xl border border-white/10 px-5 py-3 text-sm text-white" type="button" onclick={() => flowpilot.finishFocus(false)}>
					Non, garder la tache
				</button>
			{/if}
		</div>
	</Card>

	<Card>
		<div class="flex items-center justify-between gap-4">
			<div>
				<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Objectif du jour</p>
				<h2 class="mt-2 text-xl font-semibold text-white">{formatMinutes($todayFocusMinutes)} / {formatMinutes(dailyGoal)}</h2>
			</div>
			<p class="text-sm text-zinc-400">{Math.min(100, Math.round(($todayFocusMinutes / dailyGoal) * 100) || 0)}%</p>
		</div>
		<div class="mt-4 h-2 rounded-full bg-white/6">
			<div class="h-2 rounded-full bg-[#3399FF]" style={`width:${Math.min(100, (($todayFocusMinutes / dailyGoal) * 100) || 0)}%`}></div>
		</div>
	</Card>

	<Card>
		<div class="mb-4 flex items-center justify-between">
			<div>
				<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Historique</p>
				<h2 class="mt-2 text-xl font-semibold text-white">Sessions recentes</h2>
			</div>
		</div>

		<div class="space-y-3">
			{#each $focusSessions.slice(0, 12) as session}
				<div class="flex items-center justify-between rounded-2xl border border-white/6 bg-black/20 px-4 py-3">
					<div>
						<p class="font-medium text-white">{session.started_at.slice(0, 16).replace('T', ' ')}</p>
						<p class="mt-1 text-sm text-zinc-400">{taskMap[session.task_id] ?? `Task ${session.task_id.slice(0, 8)}`} - {session.completed ? 'terminee' : 'enregistree'}</p>
					</div>
					<p class="text-sm text-zinc-300">{session.duration_minutes ?? 0} min</p>
				</div>
			{/each}
		</div>
	</Card>
</div>
