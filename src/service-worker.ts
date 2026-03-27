/// <reference types="@sveltejs/kit" />

import { build, files, version } from '$service-worker';

const CACHE = `flowpilot-${version}`;
const ASSETS = [...build, ...files, '/', '/manifest.json'];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE).then((cache) => {
			return cache.addAll(ASSETS);
		})
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
			await self.clients.claim();
		})()
	);
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);

			if (event.request.mode === 'navigate') {
				try {
					const response = await fetch(event.request);
					cache.put('/', response.clone());
					return response;
				} catch {
					return (await cache.match('/')) ?? Response.error();
				}
			}

			const cached = await cache.match(event.request);
			if (cached) return cached;

			try {
				const response = await fetch(event.request);
				if (response.ok && new URL(event.request.url).origin === self.location.origin) {
					cache.put(event.request, response.clone());
				}
				return response;
			} catch {
				return cached ?? Response.error();
			}
		})()
	);
});
