import { computeHallucinationScore, getQualityTier } from '@/utils/dataIntegrity';
import type { HallucinationInput } from '@/utils/dataIntegrity';
import { useTranslation } from 'react-i18next';

interface VerificationBadgeProps {
  /** Statut de vérification */
  verificationStatus?: string | null;
  /** Statut de la source */
  sourceStatus?: string | null;
  /** Score d'hallucination (0-1). Si fourni, affiche une barre de fiabilité. */
  hallucinationScore?: number | null;
  /** Données brutes pour calculer le score si non fourni */
  feedData?: HallucinationInput | null;
  /** Taille du badge */
  size?: 'sm' | 'md';
  /** Afficher la barre de fiabilité */
  showReliabilityBar?: boolean;
}

/**
 * Badge de vérification — version sobre et professionnelle.
 *
 * Priorité aux données vérifiées. Le contenu non confirmé reste
 * visible mais discret, sans alarmisme ni vocabulaire anxiogène.
 *
 * - "Confirmé" / "Vérifié" (vert discret) : priorité d'affichage
 * - "En attente" (gris neutre) : information non encore vérifiée
 * - "Non confirmé" (gris discret) : non corroboré, à considérer avec prudence
 * - "Source injoignable" (gris) : lien mort, donnée à prendre avec réserve
 */
export default function VerificationBadge({
  verificationStatus,
  sourceStatus,
  hallucinationScore,
  feedData,
  size = 'sm',
  showReliabilityBar = false,
}: VerificationBadgeProps) {
  const { t } = useTranslation();

  const computedScore =
    hallucinationScore ??
    (feedData ? computeHallucinationScore(feedData) : null);

  const sizeClasses = size === 'sm'
    ? 'text-[10px] px-1.5 py-0.5'
    : 'text-[11px] px-2 py-1';

  // Source morte → badge discret, pas alarmant
  if (sourceStatus === 'dead') {
    return (
      <span className={`inline-flex items-center gap-1 ${sizeClasses} rounded font-medium border bg-gray-50 text-gray-400 border-gray-200`}>
        <i className="ri-link-unlink text-[9px]" />
        {t('common.sourceDeadBadge', 'Source injoignable')}
      </span>
    );
  }

  // Source non vérifiée → badge sobre
  if (sourceStatus === 'unchecked') {
    return (
      <span className={`inline-flex items-center gap-1 ${sizeClasses} rounded font-medium border bg-gray-50 text-gray-400 border-gray-200`}>
        <i className="ri-time-line text-[9px]" />
        {t('common.sourceUncheckedBadge', 'À contrôler')}
      </span>
    );
  }

  // Non confirmé (ex-"Rumeur") → vocabulaire neutre, style discret
  if (verificationStatus === 'rumor') {
    return (
      <span className={`inline-flex items-center gap-1 ${sizeClasses} rounded font-medium border bg-gray-50 text-gray-400 border-gray-200`}>
        <i className="ri-information-line text-[9px]" />
        {t('common.rumorBadge', 'Non confirmé')}
        {showReliabilityBar && computedScore !== null && (
          <ReliabilityBar score={computedScore} />
        )}
      </span>
    );
  }

  // En attente (ex-"Non vérifié") → vocabulaire neutre
  if (verificationStatus === 'unverified') {
    return (
      <span className={`inline-flex items-center gap-1 ${sizeClasses} rounded font-medium border bg-gray-50 text-gray-400 border-gray-200`}>
        <i className="ri-time-line text-[9px]" />
        {t('common.unverifiedBadge', 'En attente')}
        {showReliabilityBar && computedScore !== null && (
          <ReliabilityBar score={computedScore} />
        )}
      </span>
    );
  }

  // Vérifié ou confirmé → badge positif sobre
  if (verificationStatus === 'verified' || verificationStatus === 'confirmed') {
    return (
      <span className={`inline-flex items-center gap-1 ${sizeClasses} rounded font-medium border bg-emerald-50/70 text-emerald-700 border-emerald-200/60`}>
        <i className="ri-check-line text-[9px]" />
        {verificationStatus === 'confirmed' ? t('common.confirmedBadge', 'Confirmé') : t('common.verifiedBadge', 'Vérifié')}
        {showReliabilityBar && computedScore !== null && (
          <ReliabilityBar score={computedScore} />
        )}
      </span>
    );
  }

  return null;
}

/** Micro barre de fiabilité — sobre et discrète */
function ReliabilityBar({ score }: { score: number }) {
  const percentage = Math.round((1 - score) * 100);

  let barColor = 'bg-emerald-400';
  if (score > 0.5) barColor = 'bg-gray-300';
  else if (score > 0.3) barColor = 'bg-amber-300';

  return (
    <span className="inline-flex items-center gap-1 ml-1">
      <span className="w-10 h-1 bg-gray-100 rounded-full overflow-hidden">
        <span
          className={`block h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.max(5, percentage)}%` }}
        />
      </span>
      <span className="text-[8px] text-gray-400">{percentage}%</span>
    </span>
  );
}