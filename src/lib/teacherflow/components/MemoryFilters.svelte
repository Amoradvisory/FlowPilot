<script lang="ts">
	import type { Course, MemoryFilters as Filters } from '$lib/teacherflow/domain/types';

	let {
		courses,
		value,
		onchange
	}: { courses: readonly Course[]; value: Filters; onchange: (value: Filters) => void } = $props();

	function update(key: keyof Filters, next: string) {
		onchange({ ...value, [key]: next || undefined });
	}
</script>

<fieldset class="memory-filters">
	<legend>Filtrer la chronologie</legend>
	<label
		>Cours
		<select
			value={value.courseId ?? ''}
			onchange={(event) => update('courseId', event.currentTarget.value)}
		>
			<option value="">Tous les cours</option>
			{#each courses as course}<option value={course.id}>{course.name}</option>{/each}
		</select>
	</label>
	<label
		>Signal
		<select
			value={value.signal ?? ''}
			onchange={(event) => update('signal', event.currentTarget.value)}
		>
			<option value="">Tous les signaux</option><option value="keep">À conserver</option><option
				value="adjust">À ajuster</option
			><option value="verify">À vérifier</option>
		</select>
	</label>
	<label
		>État
		<select
			value={value.decisionStatus ?? ''}
			onchange={(event) => update('decisionStatus', event.currentTarget.value)}
		>
			<option value="">Tous les états</option><option value="to_prepare">À préparer</option><option
				value="ready">Prête</option
			><option value="applied">Appliquée</option>
		</select>
	</label>
</fieldset>
