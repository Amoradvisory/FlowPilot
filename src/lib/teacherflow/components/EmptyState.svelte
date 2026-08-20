<script lang="ts">
	let { title, message }: { title: string; message: string } = $props();
</script>

<section class="empty-state">
	<h2>{title}</h2>
	<p>{message}</p>
</section>
