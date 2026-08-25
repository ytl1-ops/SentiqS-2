# SENTIQS-OSINT CORE — prototype & synthèse (session Cowork)

Ce dossier documente le travail produit dans une session Claude Cowork : un prototype fonctionnel autonome et une synthèse de veille, distincts de l'application React/Supabase de ce dépôt. Rien ici n'est branché sur le code applicatif — ce sont des livrables de conception et de contenu, à titre de référence.

## Liens en ligne

- **Prototype fonctionnel (Artifact)** : https://claude.ai/code/artifact/4c87495c-14bd-4b99-958f-d1d7122ab465
- **Canvas de conception (Artifact, maquettes éditables clair/sombre)** : https://claude.ai/code/artifact/c63ae820-25b0-4b48-a727-b8a78095fd57

## Contenu

- `sentiqs-app.html` — prototype HTML/JS autonome (SPA à page unique, aucune dépendance), navigation réelle par routes (`#dashboard`, `#fiches`, `#fiche/<id>`, `#actualites`, `#modules`, `#pays`, `#parametres`), thème clair/sombre persistant, 9 fiches et 9 articles réels intégrés en données JavaScript.
- `design/dark/` et `design/light/` — sources des 5 écrans de maquette (`Main`, `Dashboard`, `FicheDetail`, `Actualites`, `Modules`) au format Design Components (`.dc.html`), un jeu par thème.
- `design/canvas.json` — disposition du canvas de conception (positions, pages, annotations).
- `synthese-cote-divoire-2026-08-24.md` — synthèse de veille : 9 fiches de synthèse sourcées (presse, ONG, officiel), format normalisé Pays / Date / Niveau / Lieu / Fait / Source / Impact / À surveiller.

## Sources couvertes dans la synthèse

KOACI, AllAfrica, Africtelegraph, Jeune Afrique, France 24, Amnesty International, Afrik Soir, gouv.ci, page Facebook de la Présidence de Côte d'Ivoire.

## État des connecteurs (dans le prototype)

Réseaux sociaux (Telegram), ACLED et GDELT ne sont pas encore connectés dans ce prototype — affichés honnêtement comme inactifs (0 donnée), sans données inventées.
