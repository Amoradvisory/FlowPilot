# TeacherFlow — adaptation éducative de FlowPilot

## Pourquoi adapter FlowPilot au lieu de reconstruire

FlowPilot possède déjà plusieurs briques pertinentes : PWA installable, fonctionnement local-first, notes, collections, clarification, analytics et interface structurée. L’objectif de TeacherFlow est de réutiliser cette base pour construire un **cockpit enseignant**, plutôt que d’ajouter un projet artificiel au portfolio.

## Problème métier ciblé

Le travail enseignant est fragmenté entre préparation, conduite de séance, observations, corrections, ressources, améliorations et tâches répétitives. Les outils généralistes de productivité ne reflètent pas ce cycle.

TeacherFlow cherche à organiser le travail autour d’une boucle pédagogique simple :

**PRÉPARER → ENSEIGNER → OBSERVER → CAPITALISER → AMÉLIORER**

## Prototype actuel

Une nouvelle route `/teacher` a été ajoutée sur la branche `teacherflow-demo`.

Elle présente :

- un cockpit de priorités pédagogiques ;
- les séances à piloter avec logique avant / pendant / après ;
- une capture de retour terrain ;
- une explicitation des compétences démontrées ;
- aucun usage de données réelles d’élèves.

Cette première version est volontairement simple et doit être testée avant fusion dans `main`.

## Évolutions prévues si le prototype est validé

1. Brancher la capture terrain sur le stockage local existant.
2. Ajouter des catégories pédagogiques : séquence, ressource, évaluation, observation, difficulté, idée d’amélioration.
3. Relier les éléments à une file « à améliorer ».
4. Ajouter une vue de préparation de séance.
5. Prévoir un export vers le Second cerveau enseignant, sans donnée personnelle d’élève.
6. Ajouter éventuellement une assistance IA contrôlée pour reformulation, différenciation ou analyse de consignes.

## Ce que TeacherFlow doit démontrer professionnellement

- capacité à partir d’un besoin enseignant réel ;
- réutilisation intelligente d’un système existant ;
- conception centrée métier ;
- articulation entre outil, données locales, IA et contrôle humain ;
- capacité à produire un prototype explicable et démontrable rapidement.

## Garde-fous

- aucune donnée réelle d’élève dans la démonstration publique ;
- aucune métrique d’impact inventée ;
- ne pas présenter le prototype comme un produit institutionnel ;
- toute intégration IA doit expliciter les données envoyées, la validation humaine et les limites.
