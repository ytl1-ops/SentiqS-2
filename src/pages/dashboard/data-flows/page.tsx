import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import OsinDashboard from './components/OsinDashboard';
import LogisticsMap from './components/LogisticsMap';
import GisLayerPanel from './components/GisLayerPanel';

type TabId = 'osint' | 'logistics' | 'gis';

export default function DataFlowsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>('osint');

  const tabs: Array<{ id: TabId; labelKey: string; icon: string }> = [
    { id: 'osint', labelKey: 'dataflows.tabOsin', icon: 'ri-radar-line' },
    { id: 'logistics', labelKey: 'dataflows.tabLogistics', icon: 'ri-ship-line' },
    { id: 'gis', labelKey: 'dataflows.tabGis', icon: 'ri-map-2-line' },
  ];

  return (
    <div className="space-y-5 anim-entry-down">
      {/* ===== HEADER ===== */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-sentiqs-navy">{t('dataflows.title')}</h1>
          <p className="text-xs text-sentiqs-gray-text mt-0.5">{t('dataflows.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-semibold text-sentiqs-gray-text tracking-[0.1em] uppercase">{t('dataflows.liveData')}</span>
        </div>
      </div>

      {/* ===== TABS ===== */}
      <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-full p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === tab.id
                ? 'bg-sentiqs-navy text-white shadow-sm'
                : 'text-sentiqs-gray-text hover:text-sentiqs-navy'
            }`}
          >
            <i className={`${tab.icon} text-base`} />
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* ===== TAB CONTENT ===== */}
      <div>
        {activeTab === 'osint' && <OsinDashboard />}
        {activeTab === 'logistics' && <LogisticsMap />}
        {activeTab === 'gis' && <GisLayerPanel />}
      </div>

      {/* ===== METHODOLOGY FOOTER ===== */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-sentiqs-navy/10 flex items-center justify-center flex-shrink-0">
          <i className="ri-information-line text-sentiqs-navy text-sm" />
        </div>
        <div>
          <p className="text-[11px] font-semibold text-sentiqs-navy mb-1">{t('dataflows.methodologyTitle')}</p>
          <p className="text-[10px] text-sentiqs-gray-text leading-relaxed">{t('dataflows.methodologyDesc')}</p>
        </div>
      </div>
    </div>
  );
}