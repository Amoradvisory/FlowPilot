<script lang="ts">
	type ChecklistItem = {
		checked: boolean;
		text: string;
	};

	type Block =
		| { type: 'heading'; level: number; text: string }
		| { type: 'paragraph'; text: string }
		| { type: 'checklist'; items: ChecklistItem[] }
		| { type: 'quote'; lines: string[] }
		| { type: 'code'; language: string; code: string }
		| { type: 'formula'; expression: string; result: string | null }
		| { type: 'table'; rows: string[][] };

	let { text = '', compact = false }: { text?: string; compact?: boolean } = $props();

	type InlineSegment = {
		type: 'text' | 'link';
		value: string;
	};

	const isBlockBoundary = (line: string) =>
		!line.trim() ||
		/^#{1,3}\s/.test(line.trim()) ||
		/^>\s?/.test(line.trim()) ||
		/^[-*]?\s*\[( |x|X)\]\s+/.test(line.trim()) ||
		line.trim().startsWith('```') ||
		(/^=\s*[0-9()+\-*/%.,\s]+$/.test(line.trim()) && line.trim().length > 1) ||
		(line.includes('|') && line.split('|').filter(Boolean).length >= 2);

	const linkify = (value: string): InlineSegment[] => {
		const parts: InlineSegment[] = [];
		const regex = /(https?:\/\/[^\s]+)/g;
		let lastIndex = 0;
		for (const match of value.matchAll(regex)) {
			const index = match.index ?? 0;
			if (index > lastIndex) {
				parts.push({ type: 'text', value: value.slice(lastIndex, index) });
			}
			parts.push({ type: 'link', value: match[0] });
			lastIndex = index + match[0].length;
		}
		if (lastIndex < value.length) {
			parts.push({ type: 'text', value: value.slice(lastIndex) });
		}
		return parts.length ? parts : [{ type: 'text', value }];
	};

	const safeFormulaResult = (expression: string) => {
		const normalized = expression.replace(',', '.').trim();
		if (!/^[0-9()+\-*/%.\s]+$/.test(normalized)) return null;
		try {
			const result = Function(`"use strict"; return (${normalized});`)();
			return Number.isFinite(result) ? String(result) : null;
		} catch {
			return null;
		}
	};

	const parseBlocks = (value: string): Block[] => {
		const lines = value.replace(/\r\n/g, '\n').split('\n');
		const blocks: Block[] = [];

		for (let index = 0; index < lines.length; ) {
			const raw = lines[index];
			const trimmed = raw.trim();

			if (!trimmed) {
				index += 1;
				continue;
			}

			if (trimmed.startsWith('```')) {
				const language = trimmed.slice(3).trim();
				const codeLines: string[] = [];
				index += 1;
				while (index < lines.length && !lines[index].trim().startsWith('```')) {
					codeLines.push(lines[index]);
					index += 1;
				}
				if (index < lines.length) index += 1;
				blocks.push({ type: 'code', language, code: codeLines.join('\n') });
				continue;
			}

			if (/^#{1,3}\s/.test(trimmed)) {
				const hashes = trimmed.match(/^#+/)?.[0].length ?? 1;
				blocks.push({
					type: 'heading',
					level: Math.min(3, hashes),
					text: trimmed.replace(/^#{1,3}\s+/, '')
				});
				index += 1;
				continue;
			}

			if (/^>\s?/.test(trimmed)) {
				const quoteLines: string[] = [];
				while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
					quoteLines.push(lines[index].trim().replace(/^>\s?/, ''));
					index += 1;
				}
				blocks.push({ type: 'quote', lines: quoteLines });
				continue;
			}

			if (/^[-*]?\s*\[( |x|X)\]\s+/.test(trimmed)) {
				const items: ChecklistItem[] = [];
				while (index < lines.length && /^[-*]?\s*\[( |x|X)\]\s+/.test(lines[index].trim())) {
					const line = lines[index].trim();
					items.push({
						checked: /\[(x|X)\]/.test(line),
						text: line.replace(/^[-*]?\s*\[( |x|X)\]\s+/, '')
					});
					index += 1;
				}
				blocks.push({ type: 'checklist', items });
				continue;
			}

			if (/^=\s*[0-9()+\-*/%.,\s]+$/.test(trimmed) && trimmed.length > 1) {
				const expression = trimmed.slice(1).trim();
				blocks.push({ type: 'formula', expression, result: safeFormulaResult(expression) });
				index += 1;
				continue;
			}

			if (trimmed.includes('|') && trimmed.split('|').filter(Boolean).length >= 2) {
				const rows: string[][] = [];
				while (
					index < lines.length &&
					lines[index].trim() &&
					lines[index].includes('|') &&
					lines[index].split('|').filter(Boolean).length >= 2
				) {
					rows.push(
						lines[index]
							.split('|')
							.map((cell) => cell.trim())
							.filter(Boolean)
					);
					index += 1;
				}
				blocks.push({ type: 'table', rows });
				continue;
			}

			const paragraphLines: string[] = [];
			while (index < lines.length && !isBlockBoundary(lines[index])) {
				paragraphLines.push(lines[index].trim());
				index += 1;
			}
			blocks.push({ type: 'paragraph', text: paragraphLines.join(' ') });
		}

		return blocks;
	};

	const blocks = $derived(parseBlocks(text));
</script>

{#if blocks.length}
	<div class={`space-y-3 ${compact ? 'text-[13px]' : 'text-sm'}`}>
		{#each blocks as block}
			{#if block.type === 'heading'}
				{@const headingClass =
					block.level === 1 ? 'text-xl' : block.level === 2 ? 'text-lg' : 'text-base'}
				<h3 class={`font-semibold text-white ${headingClass}`}>{block.text}</h3>
			{:else if block.type === 'paragraph'}
				<p class="leading-6 text-zinc-200">
					{#each linkify(block.text) as segment}
						{#if segment.type === 'link'}
							<a
								class="text-[#8feeff] underline decoration-white/20 underline-offset-4"
								href={segment.value}
								target="_blank"
								rel="noreferrer"
							>
								{segment.value}
							</a>
						{:else}
							{segment.value}
						{/if}
					{/each}
				</p>
			{:else if block.type === 'checklist'}
				<div class="space-y-2 rounded-2xl border border-white/8 bg-black/20 p-3">
					{#each block.items as item}
						<div class="flex items-start gap-3">
							<span
								class={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border text-[11px] ${item.checked ? 'border-[#00FF9C]/40 bg-[#00FF9C]/12 text-[#00FF9C]' : 'border-white/12 text-zinc-400'}`}
							>
								{item.checked ? 'x' : ''}
							</span>
							<p class={`${item.checked ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>
								{item.text}
							</p>
						</div>
					{/each}
				</div>
			{:else if block.type === 'quote'}
				<div class="rounded-2xl border border-[#7B2FFF]/25 bg-[#7B2FFF]/8 px-4 py-3 text-zinc-200">
					{#each block.lines as line}
						<p class="leading-6">{line}</p>
					{/each}
				</div>
			{:else if block.type === 'code'}
				<div class="overflow-hidden rounded-2xl border border-white/8 bg-[#0b1020]">
					<div
						class="flex items-center justify-between border-b border-white/6 px-4 py-2 text-xs text-zinc-500"
					>
						<span>{block.language || 'code'}</span>
						<span>Bloc intelligent</span>
					</div>
					<pre
						class="overflow-auto px-4 py-4 text-[13px] leading-6 text-[#d8f6ff]">{block.code}</pre>
				</div>
			{:else if block.type === 'formula'}
				<div class="rounded-2xl border border-[#FFB800]/20 bg-[#FFB800]/10 px-4 py-3">
					<p class="text-xs tracking-[0.16em] text-[#FFB800] uppercase">Formule</p>
					<p class="mt-2 text-sm text-zinc-200">= {block.expression}</p>
					<p class="mt-2 text-lg font-semibold text-white">
						{block.result ? block.result : 'Expression invalide'}
					</p>
				</div>
			{:else if block.type === 'table'}
				<div class="overflow-auto rounded-2xl border border-white/8 bg-black/20">
					<table class="min-w-full text-left text-sm text-zinc-200">
						<tbody>
							{#each block.rows as row, rowIndex}
								<tr class={rowIndex === 0 ? 'bg-white/[0.03]' : ''}>
									{#each row as cell}
										<td class="border-b border-white/6 px-4 py-2 align-top">{cell}</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		{/each}
	</div>
{:else}
	<p class="text-sm text-zinc-500">Apercu vide.</p>
{/if}
