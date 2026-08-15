<script lang="ts">
	let {
		id,
		open = false,
		title,
		description,
		confirmLabel = 'Confirmer',
		danger = false,
		busy = false,
		typedPhrase,
		returnFocus,
		onconfirm,
		oncancel
	}: {
		id: string;
		open?: boolean;
		title: string;
		description: string;
		confirmLabel?: string;
		danger?: boolean;
		busy?: boolean;
		typedPhrase?: string;
		returnFocus?: HTMLElement;
		onconfirm: () => void;
		oncancel: () => void;
	} = $props();
	let dialog = $state<HTMLDialogElement>();
	let confirmation = $state('');

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});

	function cancel() {
		oncancel();
	}
	function close() {
		returnFocus?.focus();
	}
</script>

<dialog
	bind:this={dialog}
	aria-labelledby={`${id}-title`}
	aria-describedby={`${id}-description`}
	oncancel={cancel}
	onclose={close}
>
	<form method="dialog" class="confirm-dialog" onsubmit={(event) => event.preventDefault()}>
		<h2 id={`${id}-title`}>{title}</h2>
		<p id={`${id}-description`}>{description}</p>
		{#if typedPhrase}<label
				>Écrivez <strong>{typedPhrase}</strong> pour confirmer
				<input bind:value={confirmation} autocomplete="off" /></label
			>{/if}
		<div class="form-actions">
			<button class="button button--quiet" type="button" disabled={busy} onclick={cancel}
				>Annuler</button
			>
			<button
				class:button--danger={danger}
				class="button button--primary"
				type="button"
				disabled={busy || (typedPhrase !== undefined && confirmation !== typedPhrase)}
				onclick={onconfirm}>{confirmLabel}</button
			>
		</div>
	</form>
</dialog>
