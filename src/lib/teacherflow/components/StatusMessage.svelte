<script lang="ts">
	let { kind, message }: { kind: 'success' | 'error' | 'info'; message: string | undefined } =
		$props();
</script>

{#if message}
	<p class="status-message status-message--{kind}" role={kind === 'error' ? 'alert' : 'status'}>
		{message}
	</p>
{/if}
