<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>{page.status} — Page indisponible</title>
</svelte:head>

<main class="teacherflow-error">
	<p class="teacherflow-error__status">{page.status}</p>
	<h1>Cette page n’est pas disponible.</h1>
	<a href={`${base}/teacher/`}>Revenir à TeacherFlow</a>
</main>
