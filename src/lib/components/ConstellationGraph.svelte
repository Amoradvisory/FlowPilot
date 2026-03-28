<script lang="ts">
	import { onMount } from 'svelte';

	type TagNode = {
		id: string;
		label: string;
		count: number;
		color: string;
		x: number;
		y: number;
		vx: number;
		vy: number;
		r: number;
	};

	type NoteNode = {
		id: string;
		color: string;
		x: number;
		y: number;
		vx: number;
		vy: number;
	};

	type Link = {
		source: string; // noteId
		target: string; // tagId
		color: string;
	};

	type Props = {
		tags: Array<{ tag: string; count: number }>;
		noteLinks: Array<{ noteId: string; tags: string[]; color: string }>;
		width?: number;
		height?: number;
	};

	let { tags, noteLinks, width = 520, height = 320 }: Props = $props();

	const TAG_COLORS: Record<string, string> = {
		'#00D4FF': '#00D4FF',
		'#7B2FFF': '#7B2FFF',
		'#00FF9C': '#00FF9C',
		'#FFB800': '#FFB800',
		'#6E63FF': '#6E63FF',
		'#FF2D55': '#FF2D55',
		'#4A5580': '#4A5580'
	};
	const PALETTE = Object.values(TAG_COLORS);

	let tagNodes = $state<TagNode[]>([]);
	let noteNodes = $state<NoteNode[]>([]);
	let links = $state<Link[]>([]);
	let hoveredTag = $state<string | null>(null);
	let ready = $state(false);

	const cx = $derived(width / 2);
	const cy = $derived(height / 2);

	function buildGraph() {
		const validTags = tags.slice(0, 14);
		const newTagNodes: TagNode[] = validTags.map((t, i) => {
			const angle = (i / validTags.length) * 2 * Math.PI;
			const spread = Math.min(width, height) * 0.3;
			return {
				id: t.tag,
				label: t.tag,
				count: t.count,
				color: PALETTE[i % PALETTE.length],
				x: cx + spread * Math.cos(angle),
				y: cy + spread * Math.sin(angle),
				vx: 0,
				vy: 0,
				r: Math.max(10, Math.min(22, 9 + t.count * 3))
			};
		});

		const tagSet = new Set(validTags.map((t) => t.tag));
		const relevantNotes = noteLinks.filter((n) => n.tags.some((t) => tagSet.has(t))).slice(0, 40);

		const newNoteNodes: NoteNode[] = relevantNotes.map((n) => ({
			id: n.noteId,
			color: n.color,
			x: cx + (Math.random() - 0.5) * width * 0.6,
			y: cy + (Math.random() - 0.5) * height * 0.6,
			vx: 0,
			vy: 0
		}));

		const newLinks: Link[] = [];
		for (const n of relevantNotes) {
			for (const tag of n.tags) {
				if (tagSet.has(tag)) {
					const tagNode = newTagNodes.find((t) => t.id === tag);
					newLinks.push({ source: n.noteId, target: tag, color: tagNode?.color ?? '#ffffff' });
				}
			}
		}

		// Run force simulation to steady state
		const allNodes: Array<TagNode | (NoteNode & { r?: number })> = [
			...newTagNodes,
			...newNoteNodes
		];
		const nodeMap = new Map(allNodes.map((n) => [n.id, n]));

		const NOTE_R = 4;
		const ALPHA_DECAY = 0.015;
		let alpha = 1;

		for (let tick = 0; tick < 260 && alpha > 0.005; tick++) {
			alpha = Math.max(0, alpha - ALPHA_DECAY);
			const k = alpha;

			// Center gravity
			for (const node of allNodes) {
				node.vx += (cx - node.x) * 0.012 * k;
				node.vy += (cy - node.y) * 0.012 * k;
			}

			// Link spring (notes → tags)
			for (const link of newLinks) {
				const s = nodeMap.get(link.source);
				const t = nodeMap.get(link.target);
				if (!s || !t) continue;
				const dx = t.x - s.x;
				const dy = t.y - s.y;
				const dist = Math.sqrt(dx * dx + dy * dy) || 1;
				const targetDist = 55;
				const force = ((dist - targetDist) / dist) * 0.22 * k;
				const fx = dx * force;
				const fy = dy * force;
				s.vx += fx;
				s.vy += fy;
				t.vx -= fx * 0.35;
				t.vy -= fy * 0.35;
			}

			// Charge repulsion
			for (let i = 0; i < allNodes.length; i++) {
				for (let j = i + 1; j < allNodes.length; j++) {
					const a = allNodes[i];
					const b = allNodes[j];
					const dx = b.x - a.x;
					const dy = b.y - a.y;
					const dist2 = dx * dx + dy * dy || 1;
					const dist = Math.sqrt(dist2);
					const rSum = ((a as TagNode).r ?? NOTE_R) + ((b as TagNode).r ?? NOTE_R) + 8;
					if (dist < rSum * 2.2) {
						const force = (rSum * rSum * 1.8) / dist2;
						const fx = (dx / dist) * force * 0.5 * k;
						const fy = (dy / dist) * force * 0.5 * k;
						a.vx -= fx;
						a.vy -= fy;
						b.vx += fx;
						b.vy += fy;
					}
				}
			}

			// Integrate + dampen + clamp
			const margin = 18;
			for (const node of allNodes) {
				node.vx *= 0.72;
				node.vy *= 0.72;
				node.x = Math.max(margin, Math.min(width - margin, node.x + node.vx));
				node.y = Math.max(margin, Math.min(height - margin, node.y + node.vy));
			}
		}

		tagNodes = newTagNodes;
		noteNodes = newNoteNodes as NoteNode[];
		links = newLinks;
	}

	onMount(() => {
		buildGraph();
		ready = true;
	});

	$effect(() => {
		if (tags.length || noteLinks.length) buildGraph();
	});

	const hoveredNoteIds = $derived(
		hoveredTag
			? new Set(links.filter((l) => l.target === hoveredTag).map((l) => l.source))
			: new Set<string>()
	);

	function notePos(id: string) {
		return noteNodes.find((n) => n.id === id);
	}

	function tagPos(id: string) {
		return tagNodes.find((t) => t.id === id);
	}
</script>

<div
	class="constellation-wrap"
	role="img"
	aria-label="Graphe constellation des tags"
	style={`width: 100%; max-width: ${width}px; height: ${height}px;`}
>
	{#if ready && tagNodes.length}
		<svg
			viewBox={`0 0 ${width} ${height}`}
			style="width: 100%; height: 100%;"
			class="constellation-svg"
		>
			<defs>
				{#each tagNodes as tag}
					<radialGradient id={`glow-${tag.id}`} cx="50%" cy="50%" r="50%">
						<stop offset="0%" stop-color={tag.color} stop-opacity="0.32" />
						<stop offset="100%" stop-color={tag.color} stop-opacity="0" />
					</radialGradient>
				{/each}
			</defs>

			<!-- Links -->
			{#each links as link}
				{@const s = notePos(link.source)}
				{@const t = tagPos(link.target)}
				{#if s && t}
					<line
						x1={s.x}
						y1={s.y}
						x2={t.x}
						y2={t.y}
						stroke={link.color}
						stroke-width={hoveredTag === link.target ? 1.2 : 0.5}
						stroke-opacity={hoveredTag
							? hoveredTag === link.target
								? 0.55
								: 0.08
							: 0.2}
						class="constellation-link"
					/>
				{/if}
			{/each}

			<!-- Note nodes -->
			{#each noteNodes as note}
				<circle
					cx={note.x}
					cy={note.y}
					r={hoveredNoteIds.has(note.id) ? 5.5 : 3.5}
					fill={note.color}
					fill-opacity={hoveredTag ? (hoveredNoteIds.has(note.id) ? 0.9 : 0.18) : 0.55}
					class="constellation-note"
				/>
			{/each}

			<!-- Tag glow halos -->
			{#each tagNodes as tag}
				<circle
					cx={tag.x}
					cy={tag.y}
					r={tag.r * 2.8}
					fill={`url(#glow-${tag.id})`}
					class="constellation-halo"
					style={hoveredTag === tag.id ? 'opacity: 1' : 'opacity: 0.55'}
				/>
			{/each}

			<!-- Tag nodes -->
			{#each tagNodes as tag}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<g
					class="constellation-tag"
					style="cursor: pointer"
					onmouseenter={() => (hoveredTag = tag.id)}
					onmouseleave={() => (hoveredTag = null)}
				>
					<circle
						cx={tag.x}
						cy={tag.y}
						r={tag.r}
						fill={tag.color}
						fill-opacity={hoveredTag === tag.id ? 0.28 : 0.14}
						stroke={tag.color}
						stroke-width={hoveredTag === tag.id ? 1.5 : 0.8}
						stroke-opacity={hoveredTag === tag.id ? 0.9 : 0.5}
					/>
					<text
						x={tag.x}
						y={tag.y - tag.r - 5}
						text-anchor="middle"
						font-size="10"
						fill={tag.color}
						fill-opacity={hoveredTag === tag.id ? 1 : 0.7}
						font-family="ui-monospace, monospace"
						font-weight={hoveredTag === tag.id ? '600' : '400'}
					>
						#{tag.label}
					</text>
					{#if hoveredTag === tag.id}
						<text
							x={tag.x}
							y={tag.y + 4}
							text-anchor="middle"
							font-size="9"
							fill={tag.color}
							fill-opacity="0.8"
							font-family="ui-monospace, monospace"
						>
							{tag.count}
						</text>
					{/if}
				</g>
			{/each}
		</svg>
	{:else if ready}
		<div class="constellation-empty">
			<p>Ajoute des tags inline comme <code>#projet-x</code> pour faire naitre la constellation.</p>
		</div>
	{/if}
</div>

<style>
	.constellation-wrap {
		position: relative;
		background: radial-gradient(ellipse at center, rgba(123, 47, 255, 0.06), transparent 68%),
			radial-gradient(ellipse at 30% 60%, rgba(0, 212, 255, 0.05), transparent 55%),
			rgba(0, 0, 0, 0.2);
		border-radius: 1.5rem;
		border: 1px solid rgba(255, 255, 255, 0.06);
		overflow: hidden;
	}

	.constellation-svg {
		display: block;
	}

	.constellation-link {
		transition: stroke-opacity 0.18s, stroke-width 0.18s;
	}

	.constellation-note {
		transition: r 0.18s, fill-opacity 0.18s;
	}

	.constellation-halo {
		transition: opacity 0.2s;
	}

	.constellation-tag circle,
	.constellation-tag text {
		transition: fill-opacity 0.18s, stroke-opacity 0.18s, font-weight 0.1s;
	}

	.constellation-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		padding: 2rem;
		text-align: center;
		color: rgb(113 113 122);
		font-size: 0.875rem;
	}

	.constellation-empty code {
		background: rgba(255, 255, 255, 0.06);
		border-radius: 0.25rem;
		padding: 0.1em 0.35em;
		font-family: ui-monospace, monospace;
		color: #00d4ff;
	}
</style>
