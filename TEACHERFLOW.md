# TeacherFlow — étude de cas

> Transformer un retour de cours de trente secondes en prochaine amélioration explicite, sans collecter de données élèves et sans confier le jugement pédagogique à une machine.

- **Démonstration :** [amoradvisory.github.io/FlowPilot/teacher](https://amoradvisory.github.io/FlowPilot/teacher)
- **Implémentation :** branche `teacherflow-demo`, [pull request #1](https://github.com/Amoradvisory/FlowPilot/pull/1)
- **Statut :** prototype public fonctionnel — pas un déploiement institutionnel

## 1. Quel problème est traité ?

L’enseignant prépare, conduit une séance, observe des réactions, ajuste une consigne et découvre parfois une formulation décisive. Ces signaux sont courts, contextuels et précieux. Ils finissent pourtant souvent dans une note isolée — ou disparaissent avant la prochaine préparation.

TeacherFlow donne une continuité à ce travail :

**PRÉPARER → ENSEIGNER → OBSERVER → CAPITALISER → AMÉLIORER**

Le problème ciblé n’est donc pas un manque d’outils. C’est la rupture entre l’expérience vécue et la prochaine décision pédagogique.

## 2. Pour qui ?

- enseignants et formateurs qui améliorent leurs séquences par itérations ;
- coordinateurs pédagogiques qui veulent rendre les ajustements partageables et discutables ;
- responsables de formation qui évaluent un dispositif technopédagogique ;
- équipes qui envisagent l’IA sans vouloir court-circuiter le jugement humain.

## 3. Quelles contraintes ont guidé le prototype ?

1. Une capture post-cours doit rester possible en moins de trente secondes.
2. La preuve publique ne doit contenir aucune donnée personnelle ou scolaire réelle.
3. Le visiteur doit comprendre le cas d’usage sans connaître FlowPilot.
4. Aucune métrique de gain de temps ou d’impact ne peut être avancée sans mesure terrain.
5. L’IA ne doit pas être ajoutée comme décoration de sapin algorithmique : son rôle doit être nécessaire, explicable et validé par l’enseignant.

## 4. Pourquoi réemployer FlowPilot ?

FlowPilot possède déjà une architecture SvelteKit local-first, un stockage navigateur, une logique de capture et une interface modulaire. Repartir de zéro aurait surtout prouvé une capacité à dupliquer du code.

La décision de conception a donc été double :

- **conserver** les fondations techniques utiles ;
- **retirer** de la preuve publique l’authentification, la navigation « Nexus Notes », la synchronisation et le bouton de création générique.

La route `/teacher` utilise une coque autonome. Le visiteur voit TeacherFlow, tandis que le reste de FlowPilot demeure intact.

## 5. Quel parcours est réellement fonctionnel ?

Le visiteur peut :

1. choisir un signal — **A fonctionné**, **A bloqué** ou **À tester** ;
2. saisir une observation fictive ;
3. obtenir une prochaine action dérivée du signal ;
4. voir cette action rejoindre la file « à améliorer » ;
5. retrouver ses captures après rechargement dans le même navigateur ;
6. réinitialiser entièrement la démonstration.

La logique métier est isolée dans un module TypeScript pur et couverte par des tests comportementaux : validation des entrées, normalisation, dérivation des actions, historique borné et restauration défensive d’un stockage malformé.

## 6. Quelles données circulent ?

| Élément                                      | Nature                               | Destination                  |
| -------------------------------------------- | ------------------------------------ | ---------------------------- |
| séances, groupes, priorités                  | données fictives intégrées à la démo | navigateur                   |
| observation saisie par le visiteur           | texte de démonstration               | `localStorage` du navigateur |
| action dérivée                               | calcul local déterministe            | interface et `localStorage`  |
| donnée élève, compte ou identifiant scolaire | non collecté                         | nulle part                   |

Aucune API distante n’est appelée par le parcours de capture. Le stockage peut être effacé depuis le bouton **Réinitialiser** ou les outils du navigateur.

## 7. Où l’IA pourrait-elle intervenir ?

Une évolution pourrait proposer :

- une reformulation de consigne ;
- des variantes de différenciation ;
- la détection de motifs dans plusieurs observations ;
- une préparation d’export vers une mémoire pédagogique structurée.

Cette assistance n’est volontairement pas branchée dans la preuve actuelle. Avant toute intégration, il faut définir les données envoyées, leur minimisation, le fournisseur, la durée de conservation, la traçabilité et le geste de validation humaine. TeacherFlow ne doit jamais transformer une suggestion statistique en décision pédagogique silencieuse.

## 8. Qu’est-ce qui est simulé ?

- les deux séances du cockpit ;
- les noms de groupes ;
- les horaires et contenus ;
- les compteurs initiaux ;
- les trois actions d’amélioration de départ.

Ces exemples servent à rendre le parcours immédiatement compréhensible. Ils ne décrivent aucun élève, aucune classe réelle et aucun usage à grande échelle.

## 9. Quelles sont les limites actuelles ?

- pas de compte ni de synchronisation entre appareils ;
- pas d’export vers un Second cerveau enseignant ;
- pas de catégorisation par séquence, référentiel ou compétence ;
- pas de test utilisateur formalisé ;
- pas de métrique de temps gagné, d’adoption ou d’effet sur l’apprentissage ;
- pas d’assistance IA active.

Ces limites sont visibles par conception. Une preuve honnête vaut davantage qu’un faux produit complet dont les boutons pratiquent la méditation transcendantale.

## 10. Quelle est la prochaine expérience à plus fort levier ?

Faire tester la capture par trois enseignants ou formateurs immédiatement après une séance fictive ou réelle, sans donnée personnelle. Mesurer :

1. le temps de capture ;
2. la clarté des trois catégories ;
3. la qualité de la prochaine action générée ;
4. la capacité à retrouver et réutiliser l’observation une semaine plus tard.

Le résultat décidera s’il faut d’abord améliorer la taxonomie, l’export vers une mémoire pédagogique ou l’assistance à la reformulation. L’IA n’entre dans le produit qu’après cette décision, pas avant.

## Ce que ce démonstrateur cherche à prouver

- partir d’une friction réelle du métier ;
- réemployer une architecture existante avec discernement ;
- concevoir une interaction très courte mais porteuse de continuité ;
- distinguer clairement données fictives, fonctions réelles et pistes futures ;
- articuler outil, IA potentielle et contrôle humain dans un langage compréhensible par un décideur.
