<script lang="ts">
	import { page } from '$app/state';
	import { base } from '$app/paths';

	const links = [
		{ label: 'Aujourd’hui', suffix: '' },
		{ label: 'Observer', suffix: 'observe/' },
		{ label: 'Mémoire', suffix: 'memory/' }
	] as const;
	const teacherPath = (suffix: string) => `${base}/teacher/${suffix}`;
	const isActive = (suffix: string) => page.url.pathname === teacherPath(suffix);
</script>

<nav class="primary-nav" aria-label="Navigation principale">
	{#each links as link}
		<a href={teacherPath(link.suffix)} aria-current={isActive(link.suffix) ? 'page' : undefined}>
			{link.label}
		</a>
	{/each}
</nav>
