# SENTIQS-OSINT CORE — prototype & synthèse (session Cowork)

Ce dossier documente le travail produit dans une session Claude Cowork : un prototype fonctionnel autonome et une synthèse de veille, distincts de l'application React/Supabase de ce dépôt. Rien ici n'est branché sur le code applicatif — ce sont des livrables de conception et de contenu, à titre de référence.

## Liens en ligne

- **Prototype fonctionnel (Artifact)** : https://claude.ai/code/artifact/4c87495c-14bd-4b99-958f-d1d7122ab465
- **Canvas de conception (Artifact, maquettes éditables clair/sombre)** : https://claude.ai/code/artifact/bb0c3cfc-fd0b-48bc-a732-549f9d08ab64

## Contenu

- `sentiqs-app.html` — prototype HTML/JS autonome (SPA à page unique, aucune dépendance), navigation réelle par routes (`#dashboard`, `#fiches`, `#fiche/<id>`, `#actualites`, `#modules`, `#pays`, `#parametres`), thème clair/sombre persistant, 9 fiches et 9 articles réels intégrés en données JavaScript.
- `design/dark/` et `design/light/` — sources des 5 écrans de maquette (`Main`, `Dashboard`, `FicheDetail`, `Actualites`, `Modules`) au format Design Components (`.dc.html`), un jeu par thème.
- `design/canvas.json` — disposition du canvas de conception (positions, pages, annotations).
- `synthese-cote-divoire-2026-08-24.md` — synthèse de veille : 9 fiches de synthèse sourcées (presse, ONG, officiel), format normalisé Pays / Date / Niveau / Lieu / Fait / Source / Impact / À surveiller.

## Sources couvertes dans la synthèse

KOACI, AllAfrica, Africtelegraph, Jeune Afrique, France 24, Amnesty International, Afrik Soir, FratMat, Abidjan.net, L'Intelligent d'Abidjan, linfodrome.com, afrique-sur7.fr, gouv.ci, page Facebook de la Présidence de Côte d'Ivoire.

## État des connecteurs (dans le prototype)

Réseaux sociaux (Telegram), ACLED et GDELT ne sont pas encore connectés dans ce prototype — affichés honnêtement comme inactifs (0 donnée), sans données inventées.

## Recoupement du 25/08/2026 — Fiche 4 corrigée

La fiche 4 (initialement sourcée sur le seul média secondaire Africtelegraph) affirmait à tort qu'une déclaration présidentielle du 6 août 2026 portait sur la menace jihadiste dans le nord frontalier. Le recoupement avec le texte intégral du discours et 4 médias ivoiriens indépendants a montré qu'il s'agissait en réalité d'un enjeu de gouvernance urbaine (déguerpissements et risque d'inondation à Abidjan, quartier de Koumassi), sans rapport avec le nord du pays. La fiche a été réécrite, reclassée, et son niveau abaissé d'Élevé à Modéré. Détail complet dans `synthese-cote-divoire-2026-08-24.md`.
