<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		children,
		class: className = '',
		padding = 'p-5',
		tone = 'default'
	}: {
		children?: Snippet;
		class?: string;
		padding?: string;
		tone?: 'default' | 'active' | 'warning';
	} = $props();

	const toneClasses = {
		default: 'border-white/6 bg-[#111] shadow-[0_0_0_1px_rgba(255,255,255,0.03)]',
		active: 'border-[#3399FF]/35 bg-[#101826] shadow-[0_0_18px_rgba(51,153,255,0.12)]',
		warning: 'border-red-500/25 bg-[#161212] shadow-[0_0_0_1px_rgba(239,68,68,0.08)]'
	};
</script>

<section class={`rounded-3xl border ${toneClasses[tone]} ${padding} ${className}`}>
	{@render children?.()}
</section>
