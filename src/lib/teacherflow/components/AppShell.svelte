<script lang="ts">
	import type { Snippet } from 'svelte';
	import { base } from '$app/paths';
	import PrimaryNav from './PrimaryNav.svelte';
	import WorkspaceBadge from './WorkspaceBadge.svelte';

	let { children }: { children: Snippet } = $props();
	const teacherPath = (suffix: string) => `${base}/teacher/${suffix}`;
</script>

<div class="teacherflow-app">
	<a class="skip-link" href="#teacherflow-main">Aller au contenu principal</a>
	<header class="app-header">
		<div class="app-header__top">
			<a class="brand" href={teacherPath('')} aria-label="TeacherFlow — Aujourd’hui">
				<span class="brand__mark" aria-hidden="true">TF</span>
				<span><strong>TeacherFlow</strong><small>mémoire pédagogique locale</small></span>
			</a>
			<WorkspaceBadge />
		</div>
		<div class="app-header__navs">
			<PrimaryNav />
			<nav class="secondary-nav" aria-label="Navigation secondaire">
				<a href={teacherPath('data/')}>Données</a>
				<a href={teacherPath('about/')}>Démarche</a>
			</nav>
		</div>
	</header>

	<main id="teacherflow-main" tabindex="-1">
		{@render children()}
	</main>
	<footer class="app-footer">
		<p>Données conservées dans ce navigateur · aucun compte ni synchronisation.</p>
	</footer>
</div>
