<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import TaskCard from '$lib/components/TaskCard.svelte';
	import { activeProjects, flowpilot, subtasks, tasks, todayTasks, visibleTasks, weekTasks } from '$lib/flowpilot';
	import type { Energy, Priority, Task } from '$lib/types';

	let filter = $state<'today' | 'week' | 'all' | 'project'>('today');
	let selectedTaskId = $state<string | null>(null);
	let newTaskTitle = $state('');
	let newSubtaskTitle = $state('');
	let projectFilter = $state('');
	let contextFilter = $state('');
	let energyFilter = $state<'' | Energy>('');

	const projectMap = $derived(Object.fromEntries($activeProjects.map((project) => [project.id, project.title])));
	const contexts = $derived(
		Array.from(new Set($visibleTasks.map((task) => task.context).filter(Boolean) as string[])).sort()
	);

	const filteredTasks = $derived.by(() => {
		let list =
			filter === 'today'
				? $todayTasks
				: filter === 'week'
					? $weekTasks
					: $visibleTasks.filter((task) => task.status !== 'done');

		if (filter === 'project' && projectFilter) {
			list = list.filter((task) => task.project_id === projectFilter);
		}

		if (projectFilter && filter !== 'project') {
			list = list.filter((task) => task.project_id === projectFilter);
		}

		if (contextFilter) {
			list = list.filter((task) => task.context === contextFilter);
		}

		if (energyFilter) {
			list = list.filter((task) => task.energy === energyFilter);
		}

		return list;
	});

	const selectedTask = $derived($tasks.find((task) => task.id === selectedTaskId) ?? filteredTasks.at(0) ?? null);

	let editTitle = $state('');
	let editDescription = $state('');
	let editPriority = $state<Priority>('normal');
	let editDuration = $state(25);
	let editEnergy = $state<Energy | ''>('');
	let editContext = $state('');
	let editProjectId = $state('');
	let editDate = $state('');
	let editStartTime = $state('');
	let editStatus = $state<Task['status']>('todo');

	$effect(() => {
		if (!selectedTask) return;
		selectedTaskId = selectedTask.id;
		editTitle = selectedTask.title;
		editDescription = selectedTask.description ?? '';
		editPriority = selectedTask.priority;
		editDuration = selectedTask.estimated_duration ?? 25;
		editEnergy = selectedTask.energy ?? '';
		editContext = selectedTask.context ?? '';
		editProjectId = selectedTask.project_id ?? '';
		editDate = selectedTask.scheduled_date ?? '';
		editStartTime = selectedTask.scheduled_time_start ?? '';
		editStatus = selectedTask.status;
	});

	const saveSelected = async () => {
		if (!selectedTask) return;
		await flowpilot.updateTask(selectedTask.id, {
			title: editTitle,
			description: editDescription || null,
			priority: editPriority,
			estimated_duration: editDuration,
			energy: editEnergy || null,
			context: editContext || null,
			project_id: editProjectId || null,
			scheduled_date: editDate || null,
			scheduled_time_start: editStartTime || null,
			status: editStatus
		});
	};
</script>

<div class="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
	<div class="space-y-4">
		<Card tone="active">
			<div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
				<div>
					<p class="text-xs uppercase tracking-[0.2em] text-[#3399FF]">Taches</p>
					<h1 class="mt-2 text-2xl font-semibold text-white">Planifier et executer</h1>
				</div>
				<form class="flex w-full gap-2 md:max-w-md" onsubmit={(event) => { event.preventDefault(); if (newTaskTitle.trim()) { void flowpilot.createTask({ title: newTaskTitle, scheduled_date: filter === 'today' ? new Date().toISOString().slice(0,10) : null, project_id: projectFilter || null, context: contextFilter || null, energy: energyFilter || null }); newTaskTitle = ''; } }}>
					<input class="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" placeholder="Nouvelle tache" bind:value={newTaskTitle} />
					<button class="rounded-2xl bg-[#3399FF] px-4 py-3 text-sm font-medium text-white" type="submit">Ajouter</button>
				</form>
			</div>

			<div class="mt-4 flex flex-wrap gap-2">
				{#each ['today', 'week', 'all', 'project'] as option}
					<button class={`rounded-2xl px-4 py-2 text-sm ${filter === option ? 'bg-white/10 text-white' : 'border border-white/10 text-zinc-400'}`} type="button" onclick={() => (filter = option as typeof filter)}>
						{option}
					</button>
				{/each}
			</div>

			<div class="mt-4 grid gap-3 md:grid-cols-3">
				<select class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" bind:value={projectFilter}>
					<option value="">Tous les projets</option>
					{#each $activeProjects as project}
						<option value={project.id}>{project.title}</option>
					{/each}
				</select>
				<select class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" bind:value={contextFilter}>
					<option value="">Tous les contextes</option>
					{#each contexts as context}
						<option value={context}>{context}</option>
					{/each}
				</select>
				<select class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" bind:value={energyFilter}>
					<option value="">Toute energie</option>
					<option value="high">high</option>
					<option value="medium">medium</option>
					<option value="low">low</option>
				</select>
			</div>
		</Card>

		<div class="space-y-3">
			{#if filteredTasks.length}
				{#each filteredTasks as task}
					<TaskCard
						task={task}
						projectTitle={task.project_id ? projectMap[task.project_id] : null}
						selected={task.id === selectedTask?.id}
						onSelect={() => (selectedTaskId = task.id)}
						onDone={() => flowpilot.completeTask(task.id)}
						onPostpone={() => flowpilot.postponeTask(task.id)}
					/>
				{/each}
			{:else}
				<Card>
					<p class="text-sm text-zinc-500">Aucune tache dans ce filtre.</p>
				</Card>
			{/if}
		</div>
	</div>

	<Card>
		{#if selectedTask}
			<div class="space-y-4">
				<div class="flex items-start justify-between gap-3">
					<div>
						<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Detail</p>
						<h2 class="mt-2 text-2xl font-semibold text-white">Editer la tache</h2>
					</div>
					<div class="flex gap-2">
						<button class="rounded-2xl border border-white/10 px-3 py-2 text-sm text-white" type="button" onclick={() => flowpilot.startFocus(selectedTask.id)}>
							Focus
						</button>
						<button class="rounded-2xl bg-green-500/15 px-3 py-2 text-sm text-green-300" type="button" onclick={() => flowpilot.completeTask(selectedTask.id)}>
							Done
						</button>
					</div>
				</div>

				<div class="grid gap-3 md:grid-cols-2">
					<input class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" bind:value={editTitle} />
					<select class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" bind:value={editStatus}>
						<option value="todo">todo</option>
						<option value="in_progress">in_progress</option>
						<option value="done">done</option>
						<option value="cancelled">cancelled</option>
					</select>
					<textarea class="min-h-28 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none md:col-span-2" placeholder="Description" bind:value={editDescription}></textarea>
					<select class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" bind:value={editPriority}>
						<option value="critical">critical</option>
						<option value="important">important</option>
						<option value="normal">normal</option>
						<option value="low">low</option>
					</select>
					<input class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" type="number" min="5" step="5" bind:value={editDuration} />
					<select class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" bind:value={editEnergy}>
						<option value="">energie</option>
						<option value="high">high</option>
						<option value="medium">medium</option>
						<option value="low">low</option>
					</select>
					<input class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" placeholder="Contexte" bind:value={editContext} />
					<select class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" bind:value={editProjectId}>
						<option value="">Sans projet</option>
						{#each $activeProjects as project}
							<option value={project.id}>{project.title}</option>
						{/each}
					</select>
					<input class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" type="date" bind:value={editDate} />
					<input class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" type="time" bind:value={editStartTime} />
				</div>

				<button class="rounded-2xl bg-[#3399FF] px-4 py-3 text-sm font-medium text-white" type="button" onclick={saveSelected}>
					Enregistrer
				</button>

				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<h3 class="text-lg font-semibold text-white">Sous-taches</h3>
						<form class="flex gap-2" onsubmit={(event) => { event.preventDefault(); if (newSubtaskTitle.trim()) { void flowpilot.createSubtask(selectedTask.id, newSubtaskTitle); newSubtaskTitle = ''; } }}>
							<input class="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none" placeholder="Ajouter" bind:value={newSubtaskTitle} />
							<button class="rounded-2xl border border-white/10 px-3 py-2 text-sm text-white" type="submit">+</button>
						</form>
					</div>

					<div class="space-y-2">
						{#each $subtasks.filter((item) => item.task_id === selectedTask.id) as item}
							<div class="flex items-center justify-between rounded-2xl border border-white/6 bg-black/20 px-4 py-3">
								<label class="flex items-center gap-3 text-sm text-zinc-300">
									<input type="checkbox" checked={item.is_done} onchange={() => flowpilot.toggleSubtask(item.id)} />
									<span>{item.title}</span>
								</label>
								<button class="rounded-full border border-red-500/20 px-2 py-1 text-xs text-red-300" type="button" onclick={() => flowpilot.deleteSubtask(item.id)}>
									x
								</button>
							</div>
						{/each}
					</div>
				</div>
			</div>
		{:else}
			<p class="text-sm text-zinc-500">Selectionne une tache pour l editer.</p>
		{/if}
	</Card>
</div>
