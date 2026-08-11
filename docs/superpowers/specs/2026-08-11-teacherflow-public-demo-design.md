# TeacherFlow — démonstrateur public orienté décideur

- **Date :** 11 août 2026
- **Branche :** `teacherflow-demo`
- **Statut :** conception approuvée par la mission Notion « Passer des preuves aux actifs publics »

## Intention

Transformer la route `/teacher` en une preuve professionnelle autonome : en moins de deux minutes, un responsable pédagogique doit comprendre le problème métier, voir la boucle de travail, manipuler une capture post-cours fictive et juger la transférabilité du dispositif.

Le démonstrateur ne doit pas ressembler à une page ajoutée à FlowPilot. Il doit se présenter comme **TeacherFlow**, tout en assumant honnêtement qu’il réemploie l’architecture local-first de FlowPilot.

## Public prioritaire

- directions et coordinations pédagogiques ;
- responsables de formation et chefs de projet formation ;
- organismes d’accompagnement ou de transformation numérique ;
- recruteurs évaluant la capacité à concevoir un dispositif technopédagogique.

## Proposition de valeur

Le travail pédagogique produit des observations utiles, mais celles-ci se dispersent entre préparation, classe, notes et mémoire. TeacherFlow rend visible une boucle courte :

**PRÉPARER → ENSEIGNER → OBSERVER → CAPITALISER → AMÉLIORER**

La promesse n’est pas « davantage d’IA ». C’est une continuité de travail qui transforme un retour terrain de trente secondes en prochaine amélioration explicite, avec validation humaine.

## Parcours de démonstration

1. Le visiteur lit la promesse et les garde-fous : prototype public, données entièrement fictives, aucun déploiement institutionnel revendiqué.
2. Il visualise la boucle pédagogique et atteint le cockpit « Aujourd’hui ».
3. Il choisit un signal post-cours — **A fonctionné**, **A bloqué** ou **À tester** — puis saisit une observation fictive.
4. La capture validée apparaît dans le journal local et alimente la file « À améliorer » quand le signal l’exige.
5. Il peut réinitialiser la démonstration, lire l’étude de cas et comprendre ce qui est réel, simulé ou prévu.

## Architecture UX

### Coque publique dédiée

La route `/teacher` contourne l’initialisation, l’authentification, la navigation et le bouton flottant de FlowPilot. Elle possède son propre en-tête minimal, ses ancres et ses métadonnées. Les autres routes restent inchangées.

### Sections

1. **Hero** — problème, promesse, statut honnête, appel à l’action.
2. **Boucle métier** — cinq étapes lisibles sur mobile et desktop.
3. **Aujourd’hui** — priorités et deux séances fictives.
4. **Capture express** — interaction réellement fonctionnelle, enregistrée uniquement dans le navigateur.
5. **File d’amélioration** — conséquence visible de l’observation.
6. **Étude de cas** — problème, décision de conception, réemploi, limites, suite.
7. **Preuves et garde-fous** — compétences démontrées, rôle éventuel de l’IA, aucune donnée élève.

## Modèle de données de démonstration

Un module TypeScript pur définit :

- les trois types de signaux ;
- la validation et la normalisation d’une observation ;
- la dérivation d’une action d’amélioration ;
- la sérialisation et la restauration défensive du petit journal de démonstration.

Le composant Svelte garde l’état dans `localStorage` sous une clé dédiée. Aucune API, aucun compte, aucun identifiant élève et aucune synchronisation distante ne sont utilisés.

## Direction visuelle

- identité sobre et chaleureuse : ivoire, encre, bleu pédagogique, accent corail ;
- typographie éditoriale, grands espaces et cartes à forte hiérarchie ;
- données fictives identifiables sans transformer chaque écran en formulaire de consentement des Nations unies ;
- priorité à la compréhension en 375 px, puis enrichissement desktop ;
- animations discrètes et respect de `prefers-reduced-motion`.

## Publication publique

L’aperçu Vercel actuel est protégé par une connexion. Une publication GitHub Pages sera ajoutée à la branche afin d’obtenir une URL réellement accessible sans compte. Le build utilisera un chemin de base configurable et produira un fallback `404.html` compatible avec le routage client.

## Critères d’acceptation

- `/teacher` ne montre aucun élément de navigation ou d’authentification FlowPilot ;
- les cinq étapes de la boucle sont immédiatement visibles et correctement ordonnées ;
- une capture vide est refusée ; une capture valide est normalisée, enregistrée localement et reflétée dans l’interface ;
- le bouton de réinitialisation restaure l’état initial ;
- aucune donnée réelle d’élève, aucun secret et aucune métrique d’impact inventée ;
- le cas d’usage, la décision de réemploi, les limites et la suite sont lisibles par un décideur non technique ;
- `svelte-check`, les tests comportementaux, le build de production et la vérification visuelle mobile/desktop passent ;
- l’URL publique ne demande ni compte ni authentification.

## Hors périmètre

- connexion à une IA générative ou à un système scolaire ;
- comptes utilisateurs, synchronisation distante ou données réelles ;
- fusion dans `main` avant revue du démonstrateur ;
- promesse de gains de temps ou d’impact non mesurés.
