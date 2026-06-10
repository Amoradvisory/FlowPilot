# FlowPilot

![Licence](https://img.shields.io/github/license/Amoradvisory/FlowPilot)
![Dernier commit](https://img.shields.io/github/last-commit/Amoradvisory/FlowPilot)

## Description

FlowPilot est une application web de productivité personnelle **local-first** (PWA installable), construite avec SvelteKit. Les données restent sur l'appareil ; l'application fonctionne hors-ligne grâce à un service worker.

## Fonctionnalités (modules présents dans le code)

- **Agenda** — organisation des journées
- **Focus** — sessions de concentration
- **Habitudes** — suivi d'habitudes
- **Collections** — listes et regroupements personnels
- **Analytics** — statistiques d'usage personnelles
- **Clarify** — clarification des tâches entrantes

## Stack technique

- [SvelteKit 2](https://kit.svelte.dev/) + Svelte 5 (adapter-static)
- [Tailwind CSS 4](https://tailwindcss.com/)
- TypeScript · Vite · PWA (service worker)

## Installation et lancement

```bash
git clone https://github.com/Amoradvisory/FlowPilot.git
cd FlowPilot
npm ci
npm run dev      # développement
npm run build    # build de production
```

## Statut du projet

Prototype personnel actif — développé comme cockpit de productivité individuel.

## Licence

Projet sous licence MIT — voir [LICENSE](LICENSE).
