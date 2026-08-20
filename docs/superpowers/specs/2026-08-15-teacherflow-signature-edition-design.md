# TeacherFlow Signature Edition — design validé

Date : 15 août 2026  
Statut : validé par la Master Spec, la décision PWA/offline et le mandat d’autonomie d’exécution  
Branche cible : `codex/teacherflow-signature-edition`

## 1. Finalité et critère de succès

TeacherFlow devient une application-démonstrateur professionnelle, local-first et réellement utilisable hors ligne après une première visite réussie. Elle transforme une observation pédagogique post-cours en décision explicite, puis replace cette décision dans la préparation d’une séance future.

Le produit sert trois lectures simultanées :

- un enseignant comprend pourquoi il pourrait le rouvrir demain ;
- un technopédagogue comprend la qualité du cadrage, des garde-fous et des arbitrages ;
- un développeur constate une architecture sobre, typée, testée et maintenable.

TeacherFlow reste un démonstrateur professionnel. Il ne revendique ni adoption, ni impact mesuré, ni validation institutionnelle, ni conformité juridique.

## 2. Décisions de produit

### 2.1 Boucle métier

La boucle narrative reste :

`PRÉPARER → ENSEIGNER → OBSERVER → CAPITALISER → AMÉLIORER`

L’interface ne transforme pas artificiellement ces cinq verbes en cinq écrans. `ENSEIGNER` se déroule dans le monde réel. L’application matérialise la boucle utile suivante :

1. ouvrir une séance ou un cours ;
2. capturer une observation non nominative ;
3. confirmer ou reformuler la décision qui en découle ;
4. affecter la décision à une séance future ou à une file « à planifier » ;
5. retrouver cette décision au moment de préparer ;
6. la marquer comme appliquée ;
7. conserver l’ensemble dans la mémoire du cours.

Une observation ne génère pas une décision prétendument intelligente. Des amorces textuelles transparentes peuvent réduire la friction, mais l’enseignant garde la formulation et la validation finales.

### 2.2 Architecture d’information

Trois destinations principales :

- **Aujourd’hui** — prochaine séance, décisions à préparer, raccourci de capture et reprise du travail ;
- **Observer** — capture post-cours courte, contexte explicite, décision éditable et cible future ;
- **Mémoire** — chronologie filtrable des séances, observations et décisions.

Une destination secondaire **Données** regroupe export, import, état du stockage local, reset et limites. Une page secondaire **Démarche** conserve la preuve de conception sans encombrer le travail quotidien.

Routes publiques :

- `/teacher/`
- `/teacher/observe/`
- `/teacher/memory/`
- `/teacher/data/`
- `/teacher/about/`

Toutes sont pré-rendues, compatibles avec le base path GitHub Pages et utilisables hors ligne après la première visite.

### 2.3 Test des 30 secondes

La première vue contient :

- « TeacherFlow transforme ce que vous remarquez après un cours en décision utile pour la prochaine séance. » ;
- un badge explicite `Données de démonstration` ou `Espace personnel` ;
- la prochaine séance et sa décision prioritaire ;
- un CTA principal `Vivre la boucle en 90 secondes` ;
- un accès direct `Ajouter une observation`.

Les métriques fictives, le long argumentaire et les cartes décoratives disparaissent du parcours principal.

### 2.4 Test des 90 secondes

Le scénario guidé ouvre une séance fictive cohérente, préremplit uniquement son contexte, puis demande au visiteur de :

1. choisir `À conserver`, `À ajuster` ou `À vérifier` ;
2. saisir ou adapter une observation ;
3. confirmer une décision ;
4. choisir la prochaine séance ;
5. enregistrer ;
6. constater immédiatement la décision dans `Aujourd’hui`.

La sortie personnalisée est visible sans défilement supplémentaire sur mobile. Le focus est déplacé vers un résumé annoncé par lecteur d’écran.

### 2.5 Démonstration et espace personnel

Le premier lancement affiche directement un jeu de démonstration réaliste, clairement fictif. Il n’utilise aucun nom d’élève, aucune école réelle et aucune métrique d’impact.

Les données de démonstration et personnelles partagent le même schéma mais sont séparées par un espace de travail fixé au niveau du repository. Les appels UI ne peuvent pas choisir arbitrairement un autre espace. L’export ne contient jamais la démonstration.

- `Explorer la démonstration` : données fictives modifiables et reset déterministe ;
- `Commencer à vide` : espace personnel vide avec onboarding court ;
- changement d’espace explicite ;
- aucune fusion automatique entre les deux.

## 3. Modèle de données

### 3.1 Entités

`Course`

- `id`
- `workspaceId`
- `name`
- `subject` facultatif
- `colorToken`
- `archivedAt` facultatif
- `createdAt`
- `updatedAt`

`Session`

- `id`
- `workspaceId`
- `courseId`
- `title`
- `scheduledFor` facultatif
- `status`: `planned | taught | completed`
- `createdAt`
- `updatedAt`

`Observation`

- `id`
- `workspaceId`
- `sessionId`
- `signal`: `keep | adjust | verify`
- `note`
- `createdAt`
- `updatedAt`

`Decision`

- `id`
- `workspaceId`
- `observationId`
- `targetSessionId` facultatif
- `text`
- `status`: `to_prepare | ready | applied`
- `appliedAt` facultatif
- `createdAt`
- `updatedAt`

`AppMeta`

- version du schéma ;
- migrations appliquées ;
- espace actif ;
- état d’onboarding ;
- date du dernier export ;
- marqueur de nettoyage de l’ancien stockage.

`RecoveryBackup`

- identifiant ;
- source et version ;
- date ;
- contenu brut borné ;
- raison de création.

### 3.2 Invariants

- toutes les chaînes sont normalisées, bornées et rendues comme texte ;
- toutes les dates sont ISO UTC valides ;
- les relations référencent des objets du même espace de travail ;
- une décision sans séance cible reste visible dans `À planifier` ;
- supprimer une observation supprime sa décision dans la même transaction ;
- supprimer un cours avec ses séances exige une confirmation détaillée ;
- aucune donnée invalide n’entre dans le repository.

## 4. Architecture logicielle

### 4.1 Isolation des routes

Le dépôt reste unique, mais les arbres de layout sont séparés :

- `src/routes/(teacher)/teacher/**` — TeacherFlow ;
- `src/routes/(legacy)/**` — routes historiques FlowPilot ;
- `src/routes/+layout.svelte` — racine minimale, sans import statique du shell FlowPilot ;
- `src/routes/(teacher)/+layout.svelte` — shell, contexte et cycle PWA TeacherFlow ;
- `src/routes/(legacy)/+layout.svelte` — ancien shell et ses dépendances.

Les groupes de routes ne changent pas les URL. TeacherFlow ne charge ni auth, ni navigation, ni contrôleur, ni styles de marque Nexus. Le legacy garde son comportement client actuel et ses URL.

Les options de rendu sont elles aussi séparées : TeacherFlow active SSR et prerender ; le legacy conserve son mode client lorsque nécessaire. `trailingSlash: 'always'` produit des répertoires statiques compatibles avec GitHub Pages.

### 4.2 Modules TeacherFlow

`src/lib/teacherflow/domain/`

- types, invariants, commandes, sélecteurs et règles pures ;
- aucune dépendance Svelte, IndexedDB ou navigateur.

`src/lib/teacherflow/data/`

- interface `TeacherFlowRepository` ;
- adaptateur Dexie/IndexedDB ;
- migrations ;
- validation import/export ;
- sauvegardes de récupération.

`src/lib/teacherflow/state/`

- contrôleur réactif unique créé par le layout TeacherFlow ;
- orchestre chargement, commandes, états asynchrones et messages ;
- expose des vues dérivées, sans dupliquer le domaine.

`src/lib/teacherflow/components/`

- shell et navigation ;
- cartes séance/décision ;
- formulaire d’observation ;
- listes et filtres mémoire ;
- dialogues de confirmation ;
- retours d’état et erreurs.

Les routes assemblent ces unités. Elles ne contiennent ni accès direct au stockage, ni logique de migration, ni règles métier complexes.

### 4.3 État et flux

1. le layout crée un repository fixé sur l’espace actif ;
2. le repository ouvre et migre la base ;
3. le contrôleur charge un snapshot cohérent ;
4. une commande valide l’intention dans le domaine ;
5. le repository exécute une transaction ;
6. le contrôleur rafraîchit l’état dérivé ;
7. l’interface annonce le résultat ;
8. une erreur conserve l’état précédent et propose une action compréhensible.

L’optimisme UI n’est utilisé que lorsque l’échec peut être annulé sans ambiguïté. Une écriture n’est jamais annoncée « enregistrée localement » avant confirmation du repository.

## 5. Persistance, migrations et portabilité

### 5.1 Choix de stockage

IndexedDB via Dexie est retenu. Dexie existe déjà dans le dépôt et apporte transactions, versions et erreurs structurées sans backend. `localStorage` reste réservé à aucun contenu métier nouveau.

La base `teacherflow` possède un schéma explicite et des versions monotones. Chaque migration :

- lit sans détruire ;
- valide ;
- crée une sauvegarde de récupération ;
- transforme dans une transaction ;
- marque son succès ;
- laisse la source récupérable en cas d’échec.

### 5.2 Migration de l’ancien prototype

La clé `teacherflow-observations-v1` est détectée une seule fois :

1. lecture protégée contre `SecurityError` ;
2. copie brute bornée dans `RecoveryBackup` ;
3. validation des observations acceptables ;
4. création d’un cours `Observations importées` et de séances génériques, sans inventer de contexte ;
5. migration vers l’espace personnel ;
6. rapport indiquant les éléments récupérés ou ignorés ;
7. conservation de la copie tant que l’utilisateur ne réinitialise pas ses données.

Une date invalide, un JSON corrompu ou un quota dépassé ne provoque ni écran blanc ni effacement silencieux.

### 5.3 Export et import

Export JSON :

- identifiant `teacherflow-backup` ;
- `formatVersion` ;
- version d’application ;
- date d’export ;
- entités personnelles seulement ;
- aucune télémétrie ni donnée de démonstration.

Import :

- taille maximale explicite ;
- JSON et schéma strictement validés ;
- résumé avant action ;
- mode unique `Remplacer mon espace` pour éviter une fusion ambiguë ;
- sauvegarde automatique pré-import ;
- transaction atomique ;
- état antérieur intact si l’import échoue.

Le reset personnel exige une confirmation forte et décrit exactement ce qui sera supprimé. Le reset de démonstration régénère uniquement le seed fictif.

## 6. PWA et fonctionnement hors ligne

### 6.1 Manifeste et scope

- manifeste dédié sous `static/teacher/manifest.webmanifest` ;
- `start_url` et `scope` relatifs (`./`) pour rester compatibles avec le base path ;
- nom, description, couleurs et icônes exclusivement TeacherFlow ;
- icônes 192, 512 et maskable ;
- enregistrement automatique SvelteKit désactivé ;
- enregistrement manuel de `${base}/service-worker.js` avec scope `${base}/teacher/` depuis le layout TeacherFlow.

Le worker ne contrôle aucune route FlowPilot hors `/teacher/`.

### 6.2 Responsabilités

Cache Storage conserve seulement le code et les ressources nécessaires au fonctionnement de l’application. IndexedDB conserve les données utilisateur. Aucun contenu saisi n’est copié dans le cache.

Stratégies :

- assets immuables hachés : cache-first ;
- pages TeacherFlow : network-first, fallback vers la version mise en cache ;
- manifeste et icônes : stale-while-revalidate ;
- requêtes cross-origin : jamais essentielles, network-only ;
- requêtes non GET : non interceptées.

Le build SvelteKit fournit la liste versionnée des assets. Le précache porte sur le build compilé et les seuls fichiers statiques TeacherFlow. La taille totale est mesurée ; une barrière de 2 Mio compressés déclenche une revue avant release. Le compromis accepté est qu’un petit nombre de chunks legacy partagés puisse être présent dans le cache, mais le scope ne leur donne aucun contrôle sur les routes legacy.

### 6.3 Première visite et état réseau

La promesse offline n’apparaît qu’après activation du worker et vérification des ressources essentielles. Le message est discret : `TeacherFlow est prêt hors connexion.`

En cas de coupure : `Hors connexion — votre travail reste enregistré sur cet appareil.` Le retour réseau n’entraîne aucune synchronisation et affiche au plus un retour bref.

### 6.4 Mise à jour

- vérification au chargement, au retour de visibilité et après navigation, avec temporisation ;
- nouvelle version téléchargée sans remplacer la page active ;
- worker en attente signalé par `Une nouvelle version est disponible. Actualiser` ;
- activation seulement après action utilisateur ou lorsque plus aucun client actif ne travaille ;
- coordination multi-onglets par `BroadcastChannel` avec repli sur événements de stockage ;
- message `SKIP_WAITING`, puis rechargement unique sur `controllerchange` ;
- nettoyage uniquement des anciens caches préfixés `teacherflow-` et de l’ancien cache obsolète identifié ;
- aucune suppression IndexedDB lors d’une activation de worker.

Les migrations de données s’exécutent à l’ouverture de la nouvelle application, avec sauvegarde et reprise décrites plus haut.

## 7. Gestion des erreurs et résilience

Les erreurs sont traduites en messages orientés action :

- stockage indisponible : expliquer que les changements ne peuvent pas être conservés et proposer export/réessai ;
- quota : proposer export puis nettoyage ;
- migration échouée : conserver la sauvegarde, ouvrir en lecture lorsque possible et proposer téléchargement ;
- import invalide : indiquer la raison et laisser les données intactes ;
- route inconnue : page TeacherFlow sobre avec retour vers Aujourd’hui, sans coque Nexus ;
- erreur inattendue : frontière d’erreur, récupération et identifiant local non traçant.

Les actions destructives utilisent un dialogue natif accessible ou un composant dialog correctement focalisé. Aucune suppression importante ne repose sur un simple toast fugitif.

## 8. Confidentialité et sécurité

- aucune donnée élève n’est nécessaire ;
- rappel adjacent aux champs : `Ne saisissez ni nom d’élève ni information personnelle ou sensible.` ;
- avertissement clair pour appareil partagé ;
- aucune télémétrie, API, clé, compte ou synchronisation ;
- contenu utilisateur rendu comme texte, jamais via HTML injecté ;
- imports bornés et validés avant toute transaction ;
- téléchargements créés localement et URL Blob révoquée ;
- service worker limité à l’origine, au scope et aux méthodes attendus ;
- dépendances auditées sans correctif majeur aveugle.

La documentation dit `données conservées dans ce navigateur`, jamais `conforme RGPD`.

## 9. Décision IA

**Pas d’IA dans la Signature Edition.**

La friction essentielle est résolue par contexte, mémoire, liaison vers une séance future et réduction de saisie. Une génération IA ajouterait transmission de données, configuration, variabilité, risque de surpromesse et perte de contrôle sans gain indispensable.

Les amorces de décision sont des règles visibles et éditables. Cette absence d’IA est documentée comme une décision de conception raisonnée, non comme une incapacité.

## 10. Design d’interface

### 10.1 Direction visuelle

- fond ivoire chaud, encre profonde, vert sourd et terre cuite accessible ;
- aucune esthétique néon, fintech, chatbot ou cerveau lumineux ;
- typographie système rapide, sans dépendance réseau ;
- grille, espaces, rayons, ombres, états et couleurs définis par tokens CSS TeacherFlow ;
- aucune métrique fictive ;
- illustration uniquement si elle améliore la compréhension.

### 10.2 Responsive

- trois destinations principales tiennent dans une navigation tactile cohérente ;
- largeur de lecture bornée sur desktop ;
- mise en page deux colonnes uniquement lorsqu’elle réduit réellement les allers-retours ;
- formulaire Observer en colonne unique sur mobile ;
- résultat immédiatement sous l’action principale ;
- aucun élément sticky ne masque le clavier ou le contenu ;
- cibles tactiles d’au moins 44 × 44 px ;
- tests à 360, 390, 412, 768 et 1440 px, portrait et paysage critique.

### 10.3 Accessibilité

- landmarks, titres et listes sémantiques ;
- lien d’évitement ;
- labels persistants, aides reliées par `aria-describedby` ;
- erreurs associées au champ et résumé focalisé ;
- focus visible ;
- dialogues avec retour de focus ;
- `aria-live` réservé aux résultats utiles ;
- contraste texte normal ≥ 4,5:1 et grands textes ≥ 3:1 ;
- reduced motion respecté ;
- parcours complet réalisable au clavier.

## 11. Métadonnées et preuve publique

TeacherFlow produit du HTML pré-rendu contenant :

- langue française ;
- title et description ;
- canonical unique avec slash final ;
- OpenGraph et Twitter Card ;
- image sociale 1200 × 630 ;
- favicon et icônes TeacherFlow ;
- manifeste relatif correct.

La page `Démarche` explique : problème, hypothèse, décisions, limites, rôle d’Amor et développement assisté par IA sous cadrage produit et pédagogique.

## 12. Stratégie de tests

### 12.1 Unitaires

- invariants et normalisation ;
- commandes métier ;
- sélecteurs Aujourd’hui/Mémoire ;
- validation import/export ;
- migrations et cas corrompus ;
- règles de suppression et cascades.

### 12.2 Intégration

- repository IndexedDB avec `fake-indexeddb` ;
- transactions, quota/indisponibilité simulés ;
- séparation démonstration/personnel ;
- migration `localStorage` ;
- import atomique et sauvegarde pré-import ;
- contrôleur et messages d’état.

### 12.3 E2E

Playwright exécute le build de production sous `BASE_PATH=/FlowPilot` :

- ouverture et test 30 secondes ;
- boucle 90 secondes ;
- création, édition, suppression ;
- persistance après reload et réouverture ;
- démo/reset et espace vide ;
- import/export ;
- deep links, retour arrière et 404 ;
- aucune trace Nexus ;
- clavier et axe automatisé sur parcours critiques ;
- Chromium, Firefox et WebKit ;
- profils mobiles 360/390/412.

### 12.4 PWA

- manifeste validé ;
- scope et enregistrement ;
- shell et routes hors ligne ;
- lecture/création/édition/suppression offline ;
- fermeture/réouverture ;
- retour online sans perte ;
- cache N → N+1 dans un serveur de test versionné ;
- conservation IndexedDB après update ;
- vérification manuelle en production.

## 13. Quality gates et release

Scripts canoniques :

- `test:unit`
- `test:integration`
- `test:e2e`
- `check`
- `lint:teacherflow`
- `build:pages`
- `verify:production`

Le lint de la Signature Edition est borné aux fichiers touchés et au périmètre TeacherFlow ; les 54 fichiers legacy déjà mal formatés sont documentés sans être maquillés en régression. `svelte-check` doit néanmoins couvrir le projet complet et terminer localement comme en CI.

La CI d’une pull request exécute unitaires, intégration, check, lint ciblé, build Pages et E2E critique. Le déploiement ne dépend plus de la branche historique `teacherflow-demo` : il suit `main` après merge vert, avec concurrence annulant les releases obsolètes.

La release comprend :

1. revue du diff complet ;
2. build frais ;
3. CI verte ;
4. déploiement GitHub Pages ;
5. smoke test de l’URL publique ;
6. scénario online/offline ;
7. seconde version contrôlée pour tester N → N+1 ;
8. revalidation données, console, assets, metadata et deep links ;
9. gel d’un tag/version stable.

## 14. Documentation livrée

- `README.md` et `TEACHERFLOW.md` à jour ;
- `docs/teacherflow-decisions.md` sous forme problème/options/choix/compromis/conséquences ;
- `docs/teacherflow-explain.md` pour la présentation orale d’Amor ;
- matrice capacité professionnelle → preuve TeacherFlow ;
- package de preuve : URL, commit, captures, démo 90 secondes, décisions, limites et rôle réel ;
- journal Notion mis à jour après vérification de production.

## 15. Performance

- aucune font distante ;
- aucune image lourde dans le cœur applicatif ;
- séparation effective du bundle legacy ;
- mesure avant/après des bundles et du chargement ;
- budget précache compressé de 2 Mio ;
- aucune optimisation exotique sans preuve ;
- objectif ressenti : interaction immédiate après chargement et transitions sans jank significatif.

## 16. Hors périmètre

- backend, compte, cloud et synchronisation ;
- collaboration ou multi-appareil ;
- données élèves ;
- analytics ;
- IA générative ;
- notifications push ou background sync ;
- LMS, paiement, API publique ou application native ;
- rebranding complet du legacy FlowPilot ;
- modification automatique du dépôt portfolio.

## 17. Definition of Done synthétique

La Signature Edition est terminée seulement lorsque :

- la boucle observation → décision → séance future → mémoire fonctionne entièrement ;
- les espaces démo/personnel sont séparés ;
- toutes les créations, éditions, suppressions, reprises et erreurs visibles fonctionnent ;
- persistance, migrations, export/import et récupération sont testés ;
- TeacherFlow ne charge ni ne montre Nexus ;
- routes et metadata sont correctes sous `/FlowPilot` ;
- PWA/offline est constatée sur la production réelle ;
- update N → N+1 conserve les données ;
- check, tests, build, E2E et CI sont verts ;
- mobile, clavier, accessibilité et console ont été vérifiés ;
- documentation et package de preuve sont complets ;
- aucun P0 ni P1 majeur ne subsiste dans le périmètre public.

## 18. Sources de cadrage

- Master Spec TeacherFlow Signature Edition, fournie le 15 août 2026 ;
- Décision produit PWA/offline, fournie le 15 août 2026 ;
- Mandat d’autonomie d’exécution, fourni le 15 août 2026 ;
- [SvelteKit — service workers](https://svelte.dev/docs/kit/service-workers) ;
- [SvelteKit — adapter-static et GitHub Pages](https://svelte.dev/docs/kit/adapter-static#GitHub-Pages) ;
- Notion : `00B — CODEX — START HERE` ;
- Notion : `INTEL — GitHub, portfolio & démonstrateurs` ;
- Notion : `13 — Portfolio public & démonstrateurs` ;
- Notion : `OBJECTIF ULTIME — North Star`.
