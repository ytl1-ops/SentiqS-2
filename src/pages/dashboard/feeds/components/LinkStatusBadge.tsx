import { useTranslation } from 'react-i18next';
import { type VerifiedFeed } from '@/hooks/useVerifiedFeeds';
import VerificationBadge from '@/components/base/VerificationBadge';

interface LinkStatusBadgeProps {
  feed: VerifiedFeed;
  /** Afficher aussi le badge de vérification (non vérifié / rumeur) */
  showVerification?: boolean;
  /** Afficher la barre de fiabilité */
  showReliability?: boolean;
}

export function LinkStatusBadge({ feed, showVerification = false, showReliability = false }: LinkStatusBadgeProps) {
  const { t } = useTranslation();
  const status = feed.source_status || 'unchecked';

  const verificationBadge = showVerification ? (
    <VerificationBadge
      verificationStatus={feed.verification_status}
      sourceStatus={feed.source_status}
      hallucinationScore={feed.hallucination_score}
      showReliabilityBar={showReliability}
    />
  ) : null;

  switch (status) {
    case 'active':
      return (
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
            <i className="ri-checkbox-circle-line text-[9px]" />
            {t('feeds.linkStatus.activeBadge')}
          </span>
          {verificationBadge}
        </span>
      );
    case 'warning':
      return (
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border bg-amber-50 text-amber-700 border-amber-200">
            <i className="ri-alert-line text-[9px]" />
            {t('feeds.linkStatus.warningBadge')}
          </span>
          {verificationBadge}
        </span>
      );
    case 'dead':
      return (
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border bg-red-50 text-red-700 border-red-200">
            <i className="ri-close-circle-line text-[9px]" />
            {t('feeds.linkStatus.deadBadge')}
          </span>
          {verificationBadge}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border bg-gray-50 text-gray-500 border-gray-200">
            <i className="ri-question-line text-[9px]" />
            {t('feeds.linkStatus.uncheckedBadge')}
          </span>
          {verificationBadge}
        </span>
      );
  }
}