	<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import { flowpilot, focusSessions, visibleTasks } from '$lib/flowpilot';
	import { formatMinutes } from '$lib/utils';

	let view = $state<'day' | 'week'>('day');
	let selectedDate = $state(new Date().toISOString().slice(0, 10));
	let draggedTaskId = $state<string | null>(null);

	const dayList = $derived.by(() => {
		if (view === 'day') return [selectedDate];
		return Array.from({ length: 7 }, (_, index) => {
			const date = new Date(`${selectedDate}T00:00:00`);
			date.setDate(date.getDate() + index);
			return date.toISOString().slice(0, 10);
		});
	});

	const hours = Array.from({ length: 12 }, (_, index) => `${String(index + 8).padStart(2, '0')}:00`);
	const scheduledCount = $derived($visibleTasks.filter((task) => task.scheduled_date === selectedDate).length);
	const focusCount = $derived($focusSessions.filter((session) => session.started_at.slice(0, 10) === selectedDate).length);
	const focusMinutes = $derived(
		$focusSessions
			.filter((session) => session.started_at.slice(0, 10) === selectedDate)
			.reduce((sum, session) => sum + (session.duration_minutes ?? 0), 0)
	);

	const dropTask = async (date: string, hour: string) => {
		if (!draggedTaskId) return;
		const task = $visibleTasks.find((item) => item.id === draggedTaskId);
		if (!task) return;
		await flowpilot.scheduleTask(draggedTaskId, date, hour, task.estimated_duration ?? 30);
		draggedTaskId = null;
	};
</script>

<div class="space-y-4">
	<Card tone="active">
		<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
			<div>
				<p class="text-xs uppercase tracking-[0.2em] text-[#3399FF]">Agenda</p>
				<h1 class="mt-2 text-2xl font-semibold text-white">Time blocking</h1>
			</div>
			<div class="flex flex-wrap gap-2">
				<button class={`rounded-2xl px-4 py-2 text-sm ${view === 'day' ? 'bg-white/10 text-white' : 'border border-white/10 text-zinc-400'}`} type="button" onclick={() => (view = 'day')}>Jour</button>
				<button class={`rounded-2xl px-4 py-2 text-sm ${view === 'week' ? 'bg-white/10 text-white' : 'border border-white/10 text-zinc-400'}`} type="button" onclick={() => (view = 'week')}>Semaine</button>
				<input class="rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-white outline-none" type="date" bind:value={selectedDate} />
			</div>
		</div>
	</Card>

	<div class="grid gap-4 md:grid-cols-3">
		<Card>
			<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Taches planifiees</p>
			<p class="mt-2 text-2xl font-semibold text-white">{scheduledCount}</p>
		</Card>
		<Card>
			<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Sessions focus</p>
			<p class="mt-2 text-2xl font-semibold text-white">{focusCount}</p>
		</Card>
		<Card>
			<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Focus du jour</p>
			<p class="mt-2 text-2xl font-semibold text-white">{formatMinutes(focusMinutes)}</p>
		</Card>
	</div>

	<Card>
		<p class="mb-3 text-sm text-zinc-400">Glisse une tache non planifiee vers un creneau.</p>
		<div class="flex flex-wrap gap-2">
			{#each $visibleTasks.filter((task) => task.status !== 'done' && !task.scheduled_date).slice(0, 12) as task}
				<div
					role="button"
					tabindex="0"
					class="cursor-grab rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white"
					draggable="true"
					ondragstart={() => (draggedTaskId = task.id)}
				>
					{task.title}
				</div>
			{/each}
		</div>
	</Card>

	<div class={`grid gap-4 ${view === 'week' ? 'xl:grid-cols-7' : ''}`}>
		{#each dayList as date}
			<Card>
				<p class="mb-4 text-sm font-medium text-white">{date}</p>
				<div class="space-y-3">
					{#each hours as hour}
						<div
							role="button"
							tabindex="0"
							class="rounded-2xl border border-white/6 bg-black/20 p-3"
							ondragover={(event) => event.preventDefault()}
							ondrop={() => dropTask(date, hour)}
						>
							<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">{hour}</p>
							<div class="mt-2 space-y-2">
								{#each $visibleTasks.filter((task) => task.scheduled_date === date && task.scheduled_time_start === hour) as task}
									<div class="rounded-2xl bg-[#3399FF]/10 px-3 py-2 text-sm text-white">
										<div class="flex items-start justify-between gap-3">
											<div>
												<p>{task.title}</p>
												<p class="mt-1 text-xs text-zinc-300">{task.scheduled_time_start} - {task.scheduled_time_end ?? '--:--'}</p>
											</div>
											<button class="rounded-full border border-white/10 px-2 py-1 text-[10px] text-zinc-200" type="button" onclick={() => flowpilot.unscheduleTask(task.id)}>
												clear
											</button>
										</div>
									</div>
								{/each}

								{#each $focusSessions.filter((session) => session.started_at.slice(0, 10) === date && new Date(session.started_at).toTimeString().slice(0, 2) === hour.slice(0, 2)) as session}
									<div class="rounded-2xl border border-green-500/20 bg-green-500/10 px-3 py-2 text-sm text-green-200">
										Focus {session.duration_minutes ?? 0} min
									</div>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			</Card>
		{/each}
	</div>
</div>
