# FlowPilot

![Licence](https://img.shields.io/github/license/Amoradvisory/FlowPilot)
![Dernier commit](https://img.shields.io/github/last-commit/Amoradvisory/FlowPilot)

## TeacherFlow — démonstrateur public

**[Tester TeacherFlow](https://amoradvisory.github.io/FlowPilot/teacher/)** · [Lire l’étude de cas](TEACHERFLOW.md) · [Examiner la pull request](https://github.com/Amoradvisory/FlowPilot/pull/1)

TeacherFlow adapte la base local-first de FlowPilot à une boucle de travail pédagogique :

**PRÉPARER → ENSEIGNER → OBSERVER → CAPITALISER → AMÉLIORER**

La démonstration permet de saisir un retour post-cours fictif, de le conserver uniquement dans le navigateur et de le transformer en prochaine action. Elle ne contient aucune donnée réelle d’élève, ne mobilise aucun service d’IA externe et n’est pas présentée comme un produit institutionnel.

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

FlowPilot reste un prototype personnel actif. TeacherFlow est une branche de démonstration publique destinée à éprouver la transférabilité de son architecture dans un contexte pédagogique.

## Licence

Projet sous licence MIT — voir [LICENSE](LICENSE).
