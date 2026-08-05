import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Globe, Search, AlertTriangle, Shield, Radio, ChevronDown } from 'lucide-react';
import { ALL_AFRICA_COUNTRIES, REGION_ORDER, AFRICA_REGIONS, type AfricaCountry } from '@/data/africaRegions';
import { useVerifiedFeeds } from '@/hooks/useVerifiedFeeds';
import { useAgendaEvents } from '@/hooks/useAgendaEvents';
import { getFeedSeverity } from '@/hooks/useAlertLevels';
import { isVerifiedData } from '@/utils/dataIntegrity';
import CountrySelector from './components/CountrySelector';
import AlertTicker from './components/AlertTicker';
import FeedAggregator from './components/FeedAggregator';
import AgendaWidget from './components/AgendaWidget';
import DutyOfCare from './components/DutyOfCare';
import PdfExportPanel from './components/PdfExportPanel';
import ApiWebhooks from './components/ApiWebhooks';
import CountryDetail from './components/CountryDetail';

type OpsTab = 'flux' | 'agenda' | 'duty-of-care' | 'pdf-export' | 'api-webhooks' | 'country-detail';

export default function OpsRoom() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selectedCountry, setSelectedCountry] = useState<AfricaCountry | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<OpsTab>('flux');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showSosModal, setShowSosModal] = useState(false);
  const { feeds: supabaseFeeds } = useVerifiedFeeds({ includeUnverified: true, includeDeadSources: true });
  const { events: agendaEvents } = useAgendaEvents();

  const filteredCountries = useMemo(() => {
    if (selectedRegion === 'all') return ALL_AFRICA_COUNTRIES;
    return AFRICA_REGIONS[selectedRegion] || [];
  }, [selectedRegion]);

  const statsCards = useMemo(() => {
    const criticalFeeds = supabaseFeeds.filter((f) => getFeedSeverity(f) === 'critical');
    const verifiedCount = supabaseFeeds.filter((f) => isVerifiedData({ verification_status: f.verification_status })).length;
    return {
      totalFeeds: supabaseFeeds.length,
      criticalToday: criticalFeeds.length,
      verifiedCount,
      countriesCovered: new Set(supabaseFeeds.map((f) => f.country)).size,
      sourcesActive: new Set(supabaseFeeds.map((f) => f.source)).size,
    };
  }, [supabaseFeeds]);

  const filteredFeeds = useMemo(() => {
    let feeds = [...supabaseFeeds];
    if (selectedCountry) feeds = feeds.filter((f) => f.country === selectedCountry.name);
    if (categoryFilter !== 'all') feeds = feeds.filter((f) => f.category === categoryFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      feeds = feeds.filter(
        (f) =>
          f.title.toLowerCase().includes(q) ||
          (f.locality || '').toLowerCase().includes(q) ||
          f.country.toLowerCase().includes(q) ||
          f.source.toLowerCase().includes(q),
      );
    }
    feeds.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return feeds;
  }, [supabaseFeeds, selectedCountry, categoryFilter, searchQuery]);

  const tabs: { id: OpsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'flux', label: 'Flux & Veille', icon: <Radio className="w-3.5 h-3.5" /> },
    { id: 'agenda', label: 'Agenda', icon: <Globe className="w-3.5 h-3.5" /> },
    { id: 'duty-of-care', label: 'Duty of Care', icon: <Shield className="w-3.5 h-3.5" /> },
    { id: 'pdf-export', label: 'Export PDF', icon: <Search className="w-3.5 h-3.5" /> },
    { id: 'api-webhooks', label: 'API & Webhooks', icon: <Radio className="w-3.5 h-3.5" /> },
    { id: 'country-detail', label: 'Fiche Pays', icon: <Globe className="w-3.5 h-3.5" /> },
  ];

  const categoryOptions = ['all', ...new Set(supabaseFeeds.map((f) => f.category))];

  return (
    <div className="space-y-4">
      {/* ===== ALERT TICKER ===== */}
      <AlertTicker feeds={supabaseFeeds} />

      {/* ===== HEADER OPÉRATIONNEL ===== */}
      <div className="bg-[#0f1a2e] rounded-xl border border-[#1a2d4a] p-4 shadow-lg">
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
          {/* Country Selector */}
          <div className="flex-shrink-0 w-full lg:w-72">
            <CountrySelector
              selectedCountry={selectedCountry}
              selectedRegion={selectedRegion}
              onCountryChange={setSelectedCountry}
              onRegionChange={setSelectedRegion}
            />
          </div>

          {/* Search Bar */}
          <div className="flex-1 w-full">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par mot-clé, localité, source... (ex: Facobly, RN1, AIP, ACLED)"
                className="w-full bg-[#1a2232] border border-[#273449] rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
              />
            </div>
          </div>

          {/* SOS Button */}
          <button
            type="button"
            onClick={() => setShowSosModal(true)}
            className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 bg-red-700 hover:bg-red-600 text-white font-bold text-sm rounded-lg transition-colors cursor-pointer whitespace-nowrap shadow-lg shadow-red-900/30"
          >
            <AlertTriangle className="w-4 h-4" />
            CENTRE DE CRISE / SOS TERRAIN
          </button>
        </div>

        {/* Category quick filters */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {categoryOptions.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1 rounded-full text-[10px] font-semibold border transition-all whitespace-nowrap cursor-pointer ${
                categoryFilter === cat
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-[#1a2232] text-gray-400 border-[#273449] hover:border-gray-500 hover:text-gray-300'
              }`}
            >
              {cat === 'all' ? 'Tous' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* ===== STATS COUNTERS ===== */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-[#1a0a0a] rounded-lg border border-red-900/40 p-3">
          <div className="text-2xl font-black text-red-400 font-mono">{statsCards.criticalToday}</div>
          <div className="text-[10px] font-semibold text-red-500 uppercase tracking-wide mt-0.5">Alertes critiques / 24h</div>
        </div>
        <div className="bg-[#0a1a0a] rounded-lg border border-emerald-900/40 p-3">
          <div className="text-2xl font-black text-emerald-400 font-mono">{statsCards.totalFeeds}</div>
          <div className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wide mt-0.5">Flux actifs indexés</div>
        </div>
        <div className="bg-[#0a0a1a] rounded-lg border border-blue-900/40 p-3">
          <div className="text-2xl font-black text-blue-400 font-mono">{statsCards.countriesCovered}</div>
          <div className="text-[10px] font-semibold text-blue-500 uppercase tracking-wide mt-0.5">Pays couverts / 54</div>
        </div>
        <div className="bg-[#1a1a0a] rounded-lg border border-amber-900/40 p-3">
          <div className="text-2xl font-black text-amber-400 font-mono">{statsCards.sourcesActive}</div>
          <div className="text-[10px] font-semibold text-amber-500 uppercase tracking-wide mt-0.5">Sources actives</div>
        </div>
        <div className="bg-[#1a0a1a] rounded-lg border border-violet-900/40 p-3">
          <div className="text-2xl font-black text-violet-400 font-mono">{statsCards.verifiedCount}</div>
          <div className="text-[10px] font-semibold text-violet-500 uppercase tracking-wide mt-0.5">Flux vérifiés</div>
        </div>
      </div>

      {/* ===== TABS NAVIGATION ===== */}
      <div className="flex items-center gap-1 bg-[#0f1a2e] rounded-lg p-1 border border-[#1a2d4a] overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === tab.id
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a2232]'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== TAB CONTENT ===== */}
      <div className="min-h-[500px]">
        {activeTab === 'flux' && (
          <FeedAggregator supabaseFeeds={filteredFeeds} />
        )}
        {activeTab === 'agenda' && (
          <AgendaWidget agendaItems={agendaEvents} />
        )}
        {activeTab === 'duty-of-care' && (
          <DutyOfCare />
        )}
        {activeTab === 'pdf-export' && (
          <PdfExportPanel selectedCountry={selectedCountry} />
        )}
        {activeTab === 'api-webhooks' && (
          <ApiWebhooks />
        )}
        {activeTab === 'country-detail' && (
          <CountryDetail country={selectedCountry} feeds={filteredFeeds} />
        )}
      </div>

      {/* ===== SOS MODAL ===== */}
      {showSosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#0f1a2e] border border-red-800 rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-red-700 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Centre de Crise — SOS Terrain</h2>
                <p className="text-xs text-gray-400">Déclenchement d'alerte d'urgence</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">AGENT / ÉQUIPE CONCERNÉ(E)</label>
                <input
                  type="text"
                  placeholder="Nom de l'agent ou de l'équipe..."
                  className="w-full bg-[#1a2232] border border-[#273449] rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">NATURE DE L'URGENCE</label>
                <select className="w-full bg-[#1a2232] border border-[#273449] rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-red-500">
                  <option value="">Sélectionner...</option>
                  <option value="attack">Attaque / Incident armé</option>
                  <option value="kidnapping">Enlèvement / Disparition</option>
                  <option value="medical">Urgence médicale / Évacuation</option>
                  <option value="accident">Accident grave</option>
                  <option value="detention">Arrestation / Détention</option>
                  <option value="natural">Catastrophe naturelle</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">MESSAGE D'URGENCE</label>
                <textarea
                  rows={3}
                  placeholder="Décrivez la situation..."
                  className="w-full bg-[#1a2232] border border-[#273449] rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-red-500 resize-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 mt-5">
              <button
                type="button"
                onClick={() => setShowSosModal(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-[#273449] text-gray-400 hover:text-gray-200 hover:border-gray-500 text-sm font-semibold transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => setShowSosModal(false)}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-bold transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <AlertTriangle className="w-4 h-4" />
                DÉCLENCHER L'ALERTE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}