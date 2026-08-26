# SENTIQS-OSINT CORE — prototype & synthèse (session Cowork)

Ce dossier documente le travail produit dans une session Claude Cowork : un prototype fonctionnel autonome et une synthèse de veille couvrant les 16 pays d'Afrique de l'Ouest, distincts de l'application React/Supabase de ce dépôt. Rien ici n'est branché sur le code applicatif — ce sont des livrables de conception et de contenu, à titre de référence.

## Liens en ligne

- **Prototype fonctionnel (Artifact)** : https://claude.ai/code/artifact/4c87495c-14bd-4b99-958f-d1d7122ab465 — conforme WCAG 2.1 AA (audit et corrections du 25/08/2026).
- **Canvas de conception (Artifact, maquettes éditables clair/sombre)** : https://claude.ai/code/artifact/08757c0f-2900-4a4b-bf8e-814db8f889a8 — *nouvelle adresse au 25/08/2026*. L'ancien lien (`bb0c3cfc-fd0b-48bc-a732-549f9d08ab64`) reste figé sur la version à 3 pays ; une restriction réseau de l'environnement de session a empêché la mise à jour de cet artefact existant (auto-publication), d'où la republication sous une nouvelle adresse.

## Contenu

- `sentiqs-app.html` — prototype HTML/JS autonome (SPA à page unique, aucune dépendance), navigation réelle par routes (`#dashboard`, `#fiches`, `#fiche/<id>`, `#actualites`, `#modules`, `#pays`, `#pays/<code>`, `#parametres`), thème clair/sombre persistant. 66 fiches de synthèse recoupées, réparties sur les 16 pays du périmètre Afrique de l'Ouest.
- `design/dark/` et `design/light/` — sources des 5 écrans de maquette (`Main`, `Dashboard`, `FicheDetail`, `Actualites`, `Modules`) au format Design Components (`.dc.html`), un jeu par thème. Le tableau de bord (`Dashboard`) reflète les 16 pays suivis.
- `design/canvas.json` — disposition du canvas de conception (positions, pages, annotations).
- `synthese-cote-divoire-2026-08-24.md` — synthèse de veille Côte d'Ivoire : 10 fiches de synthèse sourcées (presse, ONG, officiel).
- `synthese-mali-2026-08-25.md`, `synthese-burkina-faso-2026-08-25.md` et les 13 fichiers `synthese-<pays>-2026-08-25.md` restants — synthèses des 15 autres pays du périmètre (Bénin, Cap-Vert, Gambie, Ghana, Guinée, Guinée-Bissau, Liberia, Mauritanie, Niger, Nigeria, Sénégal, Sierra Leone, Togo), toutes au format normalisé Pays / Date / Niveau / Lieu / Fait / Source / Impact / À surveiller.

**Total : 66 fiches actives sur 16 pays, dont 4 notées Critique.**

## Périmètre géographique

16 pays de la région « Afrique de l'Ouest » au sens de la classification ONU (M49), à l'exclusion de Sainte-Hélène (territoire non souverain) — un périmètre plus large que la CEDEAO actuelle puisqu'il inclut le Mali, le Burkina Faso et le Niger (sortis de la CEDEAO en janvier 2025) ainsi que la Mauritanie (sortie en 2000), choix délibéré pour ne pas exclure des pays dont la situation sécuritaire est directement pertinente pour la veille régionale.

## Sources couvertes dans la synthèse

KOACI, AllAfrica, Africtelegraph, Jeune Afrique, France 24, Amnesty International, Afrik Soir, FratMat, Abidjan.net, L'Intelligent d'Abidjan, linfodrome.com, afrique-sur7.fr, AIP (Agence Ivoirienne de Presse), Présidence de la Côte d'Ivoire (site officiel), Africa Radio, Connectionivoirienne, Xinhua, Africa Check, gouv.ci, page Facebook de la Présidence de Côte d'Ivoire, ainsi que des médias et sources officielles propres à chacun des 15 autres pays (voir chaque fiche de synthèse pour le détail du sourcing).

## État des connecteurs (dans le prototype)

Réseaux sociaux (Telegram), ACLED et GDELT ne sont pas encore connectés dans ce prototype — affichés honnêtement comme inactifs (0 donnée), sans données inventées.

## Audit d'accessibilité du 25/08/2026 (WCAG 2.1 AA)

Un audit du prototype fonctionnel a mis au jour 8 constats (1 critique, 4 majeurs, 3 mineurs) : grille du tableau de bord ne se réorganisant pas sur petit écran (débordement horizontal à 320px), contrastes de texte secondaire et de badges de niveau insuffisants sur les deux thèmes, absence de gestion du focus clavier et de titre de page lors des changements d'écran, icônes décoratives non masquées aux lecteurs d'écran, absence de repères sémantiques (`<main>`, `<header>`, `aria-label`). Toutes les corrections ont été appliquées et vérifiées (zéro erreur JS, zéro débordement à 320px sur 9 écrans testés, ratios de contraste recalculés ≥ 4.5:1 sur les deux thèmes) avant republication de l'artefact.

## Recoupement du 25/08/2026 — fiches 4, 5 et 6 (Côte d'Ivoire)

**Fiche 4 — corrigée.** La fiche (initialement sourcée sur le seul média secondaire Africtelegraph) affirmait à tort qu'une déclaration présidentielle du 6 août 2026 portait sur la menace jihadiste dans le nord frontalier. Le recoupement avec le texte intégral du discours et 4 médias ivoiriens indépendants a montré qu'il s'agissait en réalité d'un enjeu de gouvernance urbaine (déguerpissements et risque d'inondation à Abidjan, quartier de Koumassi), sans rapport avec le nord du pays. La fiche a été réécrite, reclassée, et son niveau abaissé d'Élevé à Modéré.

**Fiche 5 — sourcing renforcé, aucune erreur factuelle.** Contrairement à la fiche 4, le recoupement de la fiche 5 (115 000+ demandeurs d'asile originaires du Mali, Burkina Faso, Ghana et Guinée ; renforcement du dispositif à la frontière nord) n'a révélé aucune erreur : les faits sont confirmés par le communiqué officiel du Conseil National de Sécurité et par au moins six médias ivoiriens indépendants, dont l'agence de presse publique (AIP). Seule la citation de source a été réécrite pour refléter la chaîne réelle de sourcing (communiqué CNS → FratMat → AllAfrica, recoupé indépendamment par l'AIP et 5 autres médias), ce qui relève le niveau de fiabilité affiché de « correct » à « élevé ».

**Fiche 6 — corrigée ; fiche 10 ajoutée.** La fiche affirmait à tort que la réélection présidentielle s'était déroulée « sans large contestation violente rapportée ». Le recoupement a mis au jour un bilan officiel du Conseil National de Sécurité (communiqué du 13/11/2025, opération « Espérance ») : 11 morts, 71 blessés et 1 658 interpellations liés au scrutin, corroboré indépendamment par Africa Check (au moins 8 décès identifiés individuellement). Conformément au principe « un événement = une fiche », cet épisode a été isolé dans une nouvelle fiche 10 (Élevé) plutôt que mélangé à la fiche 6, qui a par ailleurs été enrichie du taux de participation (50,1 %) et de l'exclusion judiciaire des deux principaux candidats d'opposition. La catégorie « Stabilité politique » passe de Modéré à Élevé dans le dispositif.

## Recoupement du 25/08/2026 — fiches 7, 8 et 9 (Côte d'Ivoire)

**Fiche 7 — complétée.** Seconde vague de condamnations (32 supplémentaires, jugement du 21/10/2025) découverte en recoupement, portant à au moins 58 le total des condamnations liées à la marche interdite du 11 octobre 2025. Écart non résolu entre sources sur le nombre total d'interpellations signalé plutôt que tranché.

**Fiche 8 — corrigée (attribution retirée).** L'attribution de l'attaque du village de Difita à des VDP burkinabés reposait sur une simple hypothèse d'un média, non confirmée officiellement et contredite par une dépêche AFP citant une source gouvernementale. Présentée désormais comme non confirmée et disputée.

**Fiche 9 — complétée.** Les six personnes enlevées à Kalan 2 identifiées comme agents de la DAARA en mission de recensement des demandeurs d'asile, recoupant directement le dispositif décrit en fiche 5. Le sort des agents après transfert repose sur une seule source et reste non confirmé.

## Recoupement du 25/08/2026 — fiche 10, second passage (Côte d'Ivoire)

La mention de Yopougon comme localité touchée reposait sur une allégation démontrée fausse par Africa Check (images sans rapport, Cameroun/Afrique du Sud) — retirée. La fiche a été enrichie de huit décès individuellement documentés par Africa Check et du bilan officiel du procureur d'Issia sur Nahio (3 morts, 19 blessés), circonstances disputées entre sources.

Détail complet des recoupements Côte d'Ivoire dans `synthese-cote-divoire-2026-08-24.md`.

## Instrumentation du 25/08/2026 — Mali et Burkina Faso

Mali (4 fiches, dont 1 Critique — offensive coordonnée FLA-JNIM d'avril 2026) et Burkina Faso (3 fiches, toutes Élevé — dont le siège de Djibo par le JNIM) instrumentés selon le protocole standard, avec la même rigueur de recoupement que la Côte d'Ivoire.

## Instrumentation du 25/08/2026 — les 13 pays restants

Achèvement de la couverture régionale : Bénin, Cap-Vert, Gambie, Ghana, Guinée, Guinée-Bissau, Liberia, Mauritanie, Niger, Nigeria, Sénégal, Sierra Leone et Togo instrumentés le même jour, portant le dispositif à 66 fiches sur 16 pays. Trois nouvelles fiches Critique identifiées : frappe de drone militaire nigérien sur un marché civil à Kokoloko (Niger — source unique HRW, non confirmée indépendamment), double enlèvement de masse d'élèves au Nigeria, qualification par la Cour de justice de la CEDEAO de la réforme constitutionnelle togolaise de « changement inconstitutionnel de gouvernement ».

Points de vigilance méthodologique signalés plutôt que tranchés : bilans disputés (Tillabéri/Niger : 16 vs 47 morts ; manifestations M66/Togo : 5 vs 7 décès ; massacre de Binper-Mangu/Nigeria : 20+ vs 26) ; sources uniques non recoupées (drone de Kokoloko, cause du décès d'un militant en Guinée-Bissau) ; absence honnête de données (Cap-Vert : 2 fiches seulement, faute d'événement identifié — aucune fiche inventée pour combler ce vide).
