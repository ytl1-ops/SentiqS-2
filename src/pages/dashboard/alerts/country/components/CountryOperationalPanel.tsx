import { useTranslation } from 'react-i18next';

interface CountryOperationalPanelProps {
  countryName: string;
  countryCode: string;
  level: string;
}

/**
 * Ce panneau contenait auparavant des numéros d'urgence, hôpitaux et zones
 * à risque fabriqués (non connectés à une source officielle vérifiée) —
 * risque réel pour un utilisateur en situation de crise composant un faux
 * numéro. Retiré tant qu'aucune table Supabase alimentée par des sources
 * officielles vérifiées n'existe pour ces données. Ne jamais réintroduire
 * de contacts/coordonnées codés en dur ici.
 */
export default function CountryOperationalPanel({ countryName, level }: CountryOperationalPanelProps) {
  const { t, i18n } = useTranslation();
  const isFr = i18n.language.startsWith('fr');
  const isHighRisk = level === 'rouge' || level === 'orange';

  return (
    <div className="bg-white dark:bg-[#111827] rounded-lg border border-gray-100 dark:border-[#1e293b]">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-[#1e293b] flex items-center gap-2">
        <i className="ri-shield-check-line text-emerald-600 text-base" />
        <h2 className="text-sm font-bold text-sentiqs-navy dark:text-white">
          {isFr ? `Fiche opérationnelle — ${countryName}` : `Operational Sheet — ${countryName}`}
        </h2>
        {isHighRisk && (
          <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[9px] font-bold">
            {isFr ? 'HAUTE PRIORITÉ' : 'HIGH PRIORITY'}
          </span>
        )}
      </div>

      <div className="p-6 text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mb-3">
          <i className="ri-error-warning-line text-amber-600 dark:text-amber-400 text-xl" />
        </div>
        <h3 className="text-xs font-bold text-sentiqs-navy dark:text-white mb-1">
          {isFr ? 'Fiche opérationnelle non disponible' : 'Operational sheet unavailable'}
        </h3>
        <p className="text-[10px] text-sentiqs-gray-text dark:text-gray-400 max-w-sm mx-auto">
          {isFr
            ? 'Les contacts d\'urgence, hôpitaux et zones à risque ne sont pas encore connectés à une source officielle vérifiée. Aucune coordonnée n\'est affichée pour éviter de présenter une information non fiable en situation de crise. Consultez directement les sites officiels de votre ambassade et des autorités locales.'
            : 'Emergency contacts, hospitals and risk zones are not yet connected to a verified official source. No contact details are shown here to avoid presenting unreliable information during a crisis. Consult your embassy\'s official website and local authorities directly.'}
        </p>
      </div>
    </div>
  );
}
