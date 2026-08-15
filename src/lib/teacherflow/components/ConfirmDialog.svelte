<script lang="ts">
	let {
		open = false,
		title,
		description,
		confirmLabel = 'Confirmer',
		danger = false,
		onconfirm,
		oncancel
	}: {
		open?: boolean;
		title: string;
		description: string;
		confirmLabel?: string;
		danger?: boolean;
		onconfirm: () => void;
		oncancel: () => void;
	} = $props();
	let dialog = $state<HTMLDialogElement>();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});

	function cancel() {
		oncancel();
	}
</script>

<dialog bind:this={dialog} aria-labelledby="confirm-dialog-title" oncancel={cancel}>
	<form method="dialog" class="confirm-dialog" onsubmit={(event) => event.preventDefault()}>
		<h2 id="confirm-dialog-title">{title}</h2>
		<p>{description}</p>
		<div class="form-actions">
			<button class="button button--quiet" type="button" onclick={cancel}>Annuler</button>
			<button
				class:button--danger={danger}
				class="button button--primary"
				type="button"
				onclick={onconfirm}>{confirmLabel}</button
			>
		</div>
	</form>
</dialog>
