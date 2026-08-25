# SENTIQS-OSINT CORE — prototype & synthèse (session Cowork)

Ce dossier documente le travail produit dans une session Claude Cowork : un prototype fonctionnel autonome et une synthèse de veille, distincts de l'application React/Supabase de ce dépôt. Rien ici n'est branché sur le code applicatif — ce sont des livrables de conception et de contenu, à titre de référence.

## Liens en ligne

- **Prototype fonctionnel (Artifact)** : https://claude.ai/code/artifact/4c87495c-14bd-4b99-958f-d1d7122ab465
- **Canvas de conception (Artifact, maquettes éditables clair/sombre)** : https://claude.ai/code/artifact/bb0c3cfc-fd0b-48bc-a732-549f9d08ab64

## Contenu

- `sentiqs-app.html` — prototype HTML/JS autonome (SPA à page unique, aucune dépendance), navigation réelle par routes (`#dashboard`, `#fiches`, `#fiche/<id>`, `#actualites`, `#modules`, `#pays`, `#parametres`), thème clair/sombre persistant, 10 fiches et 10 articles réels intégrés en données JavaScript.
- `design/dark/` et `design/light/` — sources des 5 écrans de maquette (`Main`, `Dashboard`, `FicheDetail`, `Actualites`, `Modules`) au format Design Components (`.dc.html`), un jeu par thème.
- `design/canvas.json` — disposition du canvas de conception (positions, pages, annotations).
- `synthese-cote-divoire-2026-08-24.md` — synthèse de veille : 10 fiches de synthèse sourcées (presse, ONG, officiel), format normalisé Pays / Date / Niveau / Lieu / Fait / Source / Impact / À surveiller.

## Sources couvertes dans la synthèse

KOACI, AllAfrica, Africtelegraph, Jeune Afrique, France 24, Amnesty International, Afrik Soir, FratMat, Abidjan.net, L'Intelligent d'Abidjan, linfodrome.com, afrique-sur7.fr, AIP (Agence Ivoirienne de Presse), Présidence de la Côte d'Ivoire (site officiel), Africa Radio, Connectionivoirienne, Xinhua, Africa Check, gouv.ci, page Facebook de la Présidence de Côte d'Ivoire.

## État des connecteurs (dans le prototype)

Réseaux sociaux (Telegram), ACLED et GDELT ne sont pas encore connectés dans ce prototype — affichés honnêtement comme inactifs (0 donnée), sans données inventées.

## Recoupement du 25/08/2026 — fiches 4, 5 et 6

**Fiche 4 — corrigée.** La fiche (initialement sourcée sur le seul média secondaire Africtelegraph) affirmait à tort qu'une déclaration présidentielle du 6 août 2026 portait sur la menace jihadiste dans le nord frontalier. Le recoupement avec le texte intégral du discours et 4 médias ivoiriens indépendants a montré qu'il s'agissait en réalité d'un enjeu de gouvernance urbaine (déguerpissements et risque d'inondation à Abidjan, quartier de Koumassi), sans rapport avec le nord du pays. La fiche a été réécrite, reclassée, et son niveau abaissé d'Élevé à Modéré.

**Fiche 5 — sourcing renforcé, aucune erreur factuelle.** Contrairement à la fiche 4, le recoupement de la fiche 5 (115 000+ demandeurs d'asile originaires du Mali, Burkina Faso, Ghana et Guinée ; renforcement du dispositif à la frontière nord) n'a révélé aucune erreur : les faits sont confirmés par le communiqué officiel du Conseil National de Sécurité et par au moins six médias ivoiriens indépendants, dont l'agence de presse publique (AIP). Seule la citation de source a été réécrite pour refléter la chaîne réelle de sourcing (communiqué CNS → FratMat → AllAfrica, recoupé indépendamment par l'AIP et 5 autres médias), ce qui relève le niveau de fiabilité affiché de « correct » à « élevé ».

**Fiche 6 — corrigée ; fiche 10 ajoutée.** La fiche affirmait à tort que la réélection présidentielle s'était déroulée « sans large contestation violente rapportée ». Le recoupement a mis au jour un bilan officiel du Conseil National de Sécurité (communiqué du 13/11/2025, opération « Espérance ») : 11 morts, 71 blessés et 1 658 interpellations liés au scrutin, corroboré indépendamment par Africa Check (au moins 8 décès identifiés individuellement). Conformément au principe « un événement = une fiche », cet épisode a été isolé dans une nouvelle fiche 10 (Élevé) plutôt que mélangé à la fiche 6, qui a par ailleurs été enrichie du taux de participation (50,1 %) et de l'exclusion judiciaire des deux principaux candidats d'opposition. La catégorie « Stabilité politique » passe de Modéré à Élevé dans le dispositif.

Détail complet des trois recoupements dans `synthese-cote-divoire-2026-08-24.md`.

## Recoupement du 25/08/2026 — fiches 7, 8 et 9

**Fiche 7 — complétée (aucune erreur, mais incomplète).** La fiche ne rapportait que la première vague de condamnations (26 manifestants, jugement du 16/10/2025) après la marche interdite du 11 octobre 2025. Le recoupement a révélé une seconde vague plus large jugée le 21/10/2025 (32 condamnations supplémentaires, avec privation de droits civiques et interdiction de séjour) — soit au moins 58 condamnations à trois ans ferme pour ce seul épisode, à quatre jours du scrutin. Un écart non résolu entre deux sources sur le nombre total d'interpellations (~700 selon le parquet vs. 237 selon une autre source) est signalé plutôt que tranché arbitrairement.

**Fiche 8 — corrigée (attribution retirée).** La fiche attribuait l'attaque du village de Difita à des VDP (supplétifs burkinabés), même avec la nuance « présumés ». Le recoupement a montré que cette attribution provient d'une simple hypothèse d'un média (AllAfrica), qu'elle n'est confirmée par aucun communiqué officiel, et qu'elle est même contredite par une dépêche AFP/L'Orient-Le Jour citant une source gouvernementale évoquant la thèse inverse (VDP visés, pas auteurs — règlement de compte). La fiche présente désormais l'attribution comme non confirmée et disputée entre plusieurs hypothèses.

**Fiche 9 — complétée.** La fiche initiale, exacte mais peu détaillée, a été enrichie par le recoupement de 7 médias indépendants, dont l'agence de presse publique AIP : les six personnes enlevées à Kalan 2 sont des agents de la DAARA (Direction d'aide et d'assistance aux réfugiés et apatrides) en mission de recensement des demandeurs d'asile — un détail qui recoupe directement le dispositif décrit en fiche 5. Le sort des agents après remise à l'armée burkinabè régulière (transfert par hélicoptère) repose sur une seule source et reste signalé comme non confirmé.

Détail complet des trois recoupements dans `synthese-cote-divoire-2026-08-24.md`.

## Recoupement du 25/08/2026 — fiche 10 (second passage)

**Fiche 10 — corrigée une seconde fois.** Ajoutée lors du recoupement de la fiche 6, la fiche 10 a été recoupée à son tour. La mention de Yopougon comme localité touchée reposait sur une allégation de bureaux de vote incendiés le 24/10/2025, depuis démontrée fausse par Africa Check (images sans rapport, originaires du Cameroun et d'Afrique du Sud) — retirée. En contrepartie, la fiche a été enrichie de huit décès individuellement documentés par Africa Check (Agboville, Daloa, Bonoua, Adzopé, Yamoussoukro, Nahio) et du bilan officiel du procureur de la République d'Issia sur Nahio (3 morts, 19 blessés, enquête ouverte) — dont les circonstances exactes restent disputées entre sources. Aucune source ne confirme de suites judiciaires concrètes pour ces 11 décès au-delà d'une instruction présidentielle générale.

Détail complet dans `synthese-cote-divoire-2026-08-24.md`.
