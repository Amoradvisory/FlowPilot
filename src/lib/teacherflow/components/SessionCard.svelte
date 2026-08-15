<script lang="ts">
	import type { Course, Session } from '$lib/teacherflow/domain/types';

	let { session, course, testid }: { session: Session; course?: Course; testid?: string } =
		$props();
	const dateLabel = $derived(
		session.scheduledFor
			? new Intl.DateTimeFormat('fr-FR', {
					weekday: 'short',
					day: 'numeric',
					month: 'short',
					hour: '2-digit',
					minute: '2-digit'
				}).format(new Date(session.scheduledFor))
			: 'À planifier'
	);
</script>

<article class="session-card" data-testid={testid}>
	<p class="card-kicker">Prochaine séance</p>
	<h2>{session.title}</h2>
	<p>{course?.name ?? 'Cours'} · <time datetime={session.scheduledFor}>{dateLabel}</time></p>
</article>
