# FlowPilot

![Licence](https://img.shields.io/github/license/Amoradvisory/FlowPilot)
![Dernier commit](https://img.shields.io/github/last-commit/Amoradvisory/FlowPilot)

## TeacherFlow — démonstrateur public fonctionnel

**[Tester TeacherFlow](https://amoradvisory.github.io/FlowPilot/teacher/)** · [Lire l’étude de cas](TEACHERFLOW.md)

TeacherFlow transforme une observation post-cours en décision pédagogique explicite :

**PRÉPARER → ENSEIGNER → OBSERVER → CAPITALISER → AMÉLIORER**

Le visiteur peut explorer un scénario fictif ou commencer dans un espace personnel local, créer ses cours et séances, enregistrer une observation avec sa décision, retrouver cette mémoire, puis exporter ou restaurer ses données. Le parcours n’utilise aucune donnée réelle d’élève, aucun compte et aucun service d’IA externe.

Le code de la version publique est identifiable dans [`src/routes/(teacher)/teacher`](<src/routes/(teacher)/teacher>) et [`src/lib/teacherflow`](src/lib/teacherflow).

### Statut honnête

TeacherFlow est un **démonstrateur public fonctionnel**. Ce n’est ni un produit institutionnel, ni un pilote terrain, ni un déploiement multi-utilisateur. Aucune capacité PWA ou hors ligne n’est revendiquée pour TeacherFlow.

## FlowPilot — base historique

FlowPilot est le prototype personnel local-first dont certaines fondations ont été réemployées pour TeacherFlow. Ses modules historiques de productivité restent dans le dépôt, isolés de la route publique TeacherFlow.

La base historique comprend un manifest et un service worker. Cette propriété ne constitue pas une promesse PWA ou hors ligne pour TeacherFlow.

## Stack technique

- [SvelteKit 2](https://kit.svelte.dev/) + Svelte 5 (adapter-static)
- TypeScript · Vite · IndexedDB via Dexie
- Vitest · Playwright

## Installation et vérification

```bash
git clone https://github.com/Amoradvisory/FlowPilot.git
cd FlowPilot
npm ci
npm run test:unit
npm run test:integration
npm run check
npm run lint:teacherflow
npm run build:pages
npm run test:e2e -- --project=chromium --project=webkit
```

Le workflow GitHub Actions applique ces contrôles sur les pull requests. Après fusion dans `main`, le même pipeline construit puis déploie l’artefact vérifié sur GitHub Pages.

## Licence

Projet sous licence MIT — voir [LICENSE](LICENSE).
