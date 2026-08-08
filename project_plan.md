# SentiqS — Plateforme de Veille Sûreté Afrique

## 1. Description du Projet
SentiqS est une plateforme d'aide à la décision pour responsables sûreté, couvrant 54 pays d'Afrique. Elle agrège des alertes, flux d'actualités, corrélations, rapports et événements d'agenda en temps réel.

## 2. Structure des Pages
- `/` — Page d'accueil / login
- `/dashboard` — Tableau de bord (vue d'ensemble)
- `/dashboard/alerts` — Alertes
- `/dashboard/feeds` — Flux d'actualités
- `/dashboard/correlations` — Corrélations
- `/dashboard/countries` — Pays
- `/dashboard/reports` — Rapports & planifications
- `/dashboard/agenda` — Agenda
- `/dashboard/settings` — Paramètres admin (NOUVEAU)

## 3. Fonctionnalités
- [x] Page d'accueil + login
- [x] Dashboard overview (stats, timeline, activité)
- [x] Alertes avec filtres et partage
- [x] Flux d'actualités
- [x] Corrélations (graphe + liste)
- [x] Pays avec niveaux de risque
- [x] Rapports + Planifications (ScheduledReports)
- [x] Agenda des événements
- [x] Base de données Supabase connectée
- [ ] Paramètres admin — Alertes SMS/WhatsApp
- [ ] Paramètres admin — Gestion abonnements
- [ ] Paramètres admin — Suivi trafic
- [ ] Paramètres admin — Gestion paiements

## 4. Modèle de Données

### Table: subscribers
| Champ | Type | Description |
|-------|------|-------------|
| id | bigint | PK |
| name | text | Nom de l'abonné |
| email | text | Email |
| phone | text | Téléphone (SMS/WhatsApp) |
| country | text | Pays |
| subscription_tier | text | Niveau d'abonnement |
| status | text | actif/inactif/suspendu |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### Table: user_subscriptions
| Champ | Type | Description |
|-------|------|-------------|
| id | bigint | PK |
| subscriber_id | bigint | FK → subscribers |
| plan_id | bigint | FK → subscription_plans |
| status | text | actif/expiré/annulé |
| start_date | date | |
| end_date | date | |
| auto_renew | boolean | |
| created_at | timestamptz | |

### Table: subscription_plans
| Champ | Type | Description |
|-------|------|-------------|
| id | bigint | PK |
| name | text | Nom du plan |
| price | numeric | Prix |
| currency | text | Devise |
| billing_cycle | text | mensuel/annuel |
| features | jsonb | Fonctionnalités incluses |
| download_limit | integer | Limite téléchargements/mois |
| max_alerts_per_day | integer | Max alertes/jour |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### Table: alert_channels
| Champ | Type | Description |
|-------|------|-------------|
| id | bigint | PK |
| name | text | Nom du canal |
| channel_type | text | sms/whatsapp/email |
| phone | text | Numéro |
| email | text | Email |
| is_active | boolean | Actif |
| alert_severities | jsonb | Sévérités concernées |
| created_at | timestamptz | |

### Table: traffic_logs
| Champ | Type | Description |
|-------|------|-------------|
| id | bigint | PK |
| page_path | text | Page visitée |
| country | text | Pays visiteur |
| region | text | Région |
| ip_hash | text | IP hashée |
| user_agent | text | Navigateur |
| referrer | text | Référent |
| duration_seconds | integer | Durée visite |
| timestamp | timestamptz | |

### Table: payment_configs
| Champ | Type | Description |
|-------|------|-------------|
| id | bigint | PK |
| provider | text | stripe/paypal/virement |
| display_name | text | Nom affiché |
| is_active | boolean | Actif |
| config | jsonb | Configuration |
| supported_currencies | jsonb | Devises |
| created_at | timestamptz | |
| updated_at | timestamptz | |

## 5. Backend / Intégrations
- **Supabase** : Connecté — stockage données, edge functions
- **Resend** : En attente de configuration clé API

## 6. Plan de Développement

### Phase 1 : Plateforme Admin — Paramètres (en cours)
- Page Settings avec navigation par onglets
- Gestion des canaux d'alerte (SMS, WhatsApp, Email)
- Gestion des abonnés
- Seed des tables avec données démo
- Routage et navigation

### Phase 2 : Gestion des abonnements
- CRUD plans d'abonnement
- Suivi des abonnements utilisateurs
- Paramétrage des téléchargements par type d'abonnement
- Dashboard abonnements

### Phase 3 : Trafic & Pays
- Dashboard trafic avec graphiques
- Suivi pays consultés
- Intégration traffic_logs

### Phase 4 : Paiements
- Gestion des modes de paiement
- Configuration Stripe/PayPal/Virement
- Activation/désactivation par région