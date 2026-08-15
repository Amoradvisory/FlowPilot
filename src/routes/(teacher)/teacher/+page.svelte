<script lang="ts">
	import { base } from '$app/paths';
	import CourseForm from '$lib/teacherflow/components/CourseForm.svelte';
	import DecisionCard from '$lib/teacherflow/components/DecisionCard.svelte';
	import SessionCard from '$lib/teacherflow/components/SessionCard.svelte';
	import SessionForm from '$lib/teacherflow/components/SessionForm.svelte';
	import StatusMessage from '$lib/teacherflow/components/StatusMessage.svelte';
	import { PERSONAL_WORKSPACE_ID } from '$lib/teacherflow/demo/seed';
	import { getTeacherFlowState } from '$lib/teacherflow/state/context';

	const teacherFlow = getTeacherFlowState();
	const observePath = `${base}/teacher/observe/`;
	const activeCourses = $derived(
		teacherFlow.snapshot.courses.filter((course) => !course.archivedAt)
	);
	const activeCourse = $derived(activeCourses[0]);
	const courseSessions = $derived(
		activeCourse
			? teacherFlow.snapshot.sessions.filter((session) => session.courseId === activeCourse.id)
			: []
	);
	const firstSession = $derived(courseSessions[0]);
	const allSessions = $derived(
		teacherFlow.snapshot.sessions.filter(
			(session) =>
				!teacherFlow.snapshot.courses.find((course) => course.id === session.courseId)?.archivedAt
		)
	);
	const courseById = $derived(
		new Map(teacherFlow.snapshot.courses.map((course) => [course.id, course]))
	);
	const sessionById = $derived(
		new Map(teacherFlow.snapshot.sessions.map((session) => [session.id, session]))
	);
	const nextSessionCourse = $derived(
		teacherFlow.today.nextSession
			? courseById.get(teacherFlow.today.nextSession.courseId)
			: undefined
	);
</script>

<svelte:head>
	<title>Aujourd’hui · TeacherFlow</title>
	<meta
		name="description"
		content="Retrouvez la prochaine séance et les décisions pédagogiques que vous avez choisi de préparer."
	/>
</svelte:head>

<div class="page-shell today-page">
	{#if teacherFlow.phase === 'loading'}
		<section class="loading-state" aria-live="polite">
			<p>Préparation de votre espace local…</p>
		</section>
	{:else if teacherFlow.phase === 'error' && teacherFlow.snapshot.courses.length === 0}
		<section class="empty-state">
			<h1>Le stockage local n’a pas pu être ouvert.</h1>
			<StatusMessage kind="error" message={teacherFlow.status?.message} />
		</section>
	{:else if teacherFlow.workspaceId === PERSONAL_WORKSPACE_ID && activeCourses.length === 0}
		<section class="onboarding-hero">
			<p class="eyebrow">Espace personnel · vide</p>
			<h1>Commencez par le contexte, pas par un formulaire kilométrique.</h1>
			<p>Un cours puis une première séance suffisent pour rendre la boucle utile.</p>
		</section>
		<CourseForm />
		{#if teacherFlow.snapshot.courses.some((course) => course.archivedAt)}
			<p class="quiet-note">Le dernier cours est archivé. Vous pouvez en créer un nouveau.</p>
		{/if}
	{:else}
		<section class="today-hero">
			<div class="today-hero__copy">
				<p class="eyebrow">Aujourd’hui</p>
				<h1>Une observation. Une décision. Le bon prochain moment.</h1>
				<p class="value-proposition">
					TeacherFlow transforme ce que vous remarquez après un cours en décision utile pour la
					prochaine séance.
				</p>
				<div class="hero-actions">
					<a
						class="button button--primary"
						data-testid="primary-value-loop-cta"
						href={`${observePath}?guided=1`}>Vivre la boucle en 90 secondes</a
					>
					<a class="button button--secondary" href={observePath}>Ajouter une observation</a>
				</div>
			</div>

			{#if teacherFlow.today.nextSession}
				<SessionCard
					session={teacherFlow.today.nextSession}
					course={nextSessionCourse}
					testid="today-next-session"
				/>
			{:else}
				<section class="session-card" data-testid="today-next-session">
					<p class="card-kicker">Prochaine séance</p>
					<h2>Aucune séance datée à venir</h2>
					<p>Vous pouvez continuer à observer ; la décision restera dans « À planifier ».</p>
				</section>
			{/if}
		</section>

		<section class="decision-section" aria-labelledby="prepare-title">
			<div class="section-heading">
				<div>
					<p class="eyebrow">Préparer</p>
					<h2 id="prepare-title">Décisions pour la prochaine séance</h2>
				</div>
				<span class="true-count">{teacherFlow.today.sessionDecisions.length}</span>
			</div>
			{#if teacherFlow.today.sessionDecisions.length}
				<div class="card-list">
					{#each teacherFlow.today.sessionDecisions as decision}
						<DecisionCard {decision} target={sessionById.get(decision.targetSessionId ?? '')} />
					{/each}
				</div>
			{:else}
				<p class="quiet-note">Aucune décision n’est liée à cette séance pour le moment.</p>
			{/if}
		</section>

		<section class="decision-section" aria-labelledby="unplanned-title">
			<div class="section-heading">
				<div>
					<p class="eyebrow">À planifier</p>
					<h2 id="unplanned-title">Décisions sans séance cible</h2>
				</div>
				<span class="true-count">{teacherFlow.today.unscheduledDecisions.length}</span>
			</div>
			{#if teacherFlow.today.unscheduledDecisions.length}
				<div class="card-list">
					{#each teacherFlow.today.unscheduledDecisions as decision}
						<DecisionCard {decision} />
					{/each}
				</div>
			{:else}
				<p class="quiet-note">Aucune décision en attente de planification.</p>
			{/if}
		</section>

		{#if teacherFlow.workspaceId === PERSONAL_WORKSPACE_ID && activeCourse}
			<section class="management-section" aria-labelledby="manage-title">
				<div class="section-heading">
					<div>
						<p class="eyebrow">Contexte personnel</p>
						<h2 id="manage-title">Cours et première séance</h2>
					</div>
				</div>
				<div class="management-grid">
					{#key activeCourse.id}<CourseForm current={activeCourse} />{/key}
					{#key firstSession?.id ?? 'new-session'}
						<SessionForm courses={activeCourses} current={firstSession} />
					{/key}
				</div>
			</section>
		{/if}

		{#if teacherFlow.workspaceId === PERSONAL_WORKSPACE_ID}
			<section
				class="management-section"
				aria-labelledby="all-context-title"
				data-testid="all-personal-context"
			>
				<h2 id="all-context-title">Tous les cours et séances</h2>
				<p>
					Chaque contexte reste modifiable séparément ; aucun cours n’est relégué derrière le
					premier de la file.
				</p>
				<CourseForm />
				{#each activeCourses as course (course.id)}
					<section class="management-section" aria-label={`Cours ${course.name}`}>
						<CourseForm current={course} />
						{#each allSessions.filter((session) => session.courseId === course.id) as session (session.id)}
							<SessionForm courses={activeCourses} current={session} />
						{/each}
						<SessionForm courses={[course]} />
					</section>
				{/each}
			</section>
		{/if}
	{/if}
</div>
