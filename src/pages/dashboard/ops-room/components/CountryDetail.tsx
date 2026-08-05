import { useState, useMemo } from 'react';
import { MapPin, Shield, Globe, Building, Calendar, ExternalLink, Search } from 'lucide-react';
import { ALL_AFRICA_COUNTRIES, type AfricaCountry } from '@/data/africaRegions';
import type { VerifiedFeed } from '@/hooks/useVerifiedFeeds';
import { getFeedSeverity } from '@/hooks/useAlertLevels';
import { isVerifiedData } from '@/utils/dataIntegrity';

interface CountryDetailProps {
  country: AfricaCountry | null;
  feeds: VerifiedFeed[];
}

export default function CountryDetail({ country, feeds }: CountryDetailProps) {
  const [subRegionFilter, setSubRegionFilter] = useState<string>('all');
  const [searchLocality, setSearchLocality] = useState('');

  const countryFeeds = useMemo(() => {
    if (!country) return [];
    let filtered = feeds.filter((f) => f.country === country.name);
    if (subRegionFilter !== 'all') {
      filtered = filtered.filter((f) => f.locality === subRegionFilter);
    }
    if (searchLocality.trim()) {
      const q = searchLocality.toLowerCase();
      filtered = filtered.filter((f) => (f.locality || '').toLowerCase().includes(q) || f.title.toLowerCase().includes(q));
    }
    return filtered;
  }, [country, feeds, subRegionFilter, searchLocality]);

  const stats = useMemo(() => {
    const total = countryFeeds.length;
    const critical = countryFeeds.filter((f) => getFeedSeverity(f) === 'critical').length;
    const high = countryFeeds.filter((f) => getFeedSeverity(f) === 'high').length;
    const verified = countryFeeds.filter((f) => isVerifiedData({ verification_status: f.verification_status })).length;
    const localities = new Set(countryFeeds.map((f) => f.locality).filter(Boolean));
    const sources = new Set(countryFeeds.map((f) => f.source));
    return { total, critical, high, verified, localities: localities.size, sources: sources.size };
  }, [countryFeeds]);

  if (!country) {
    return (
      <div className="bg-[#0f1a2e] rounded-xl border border-[#1a2d4a] p-12 text-center">
        <Globe className="w-16 h-16 text-gray-700 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-gray-300 mb-2">Fiche Pays</h3>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          Sélectionnez un pays africain dans le sélecteur en haut de page pour afficher sa fiche détaillée : incidents, sources, sous-régions et recommandations.
        </p>
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-2 max-w-lg mx-auto">
          {ALL_AFRICA_COUNTRIES.slice(0, 8).map((c) => (
            <div key={c.code} className="bg-[#1a2232] rounded-lg px-3 py-2 text-center border border-[#273449]">
              <div className="text-[10px] font-bold text-gray-400">{c.code}</div>
              <div className="text-[9px] text-gray-600">{c.name}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Country header */}
      <div className="bg-[#0f1a2e] rounded-xl border border-[#1a2d4a] p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-emerald-900/20 border border-emerald-800/30 flex items-center justify-center">
              <span className="text-xl font-black text-emerald-400">{country.code}</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-100">{country.name}</h2>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Building className="w-3 h-3" />
                  Capitale : {country.capital}
                </span>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  Région : {country.region}
                </span>
                {country.independenceDay && (
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Fête nationale : {country.independenceDay}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center px-3 py-2 bg-[#1a2232] rounded-lg border border-[#273449]">
              <div className="text-lg font-black text-emerald-400 font-mono">{stats.total}</div>
              <div className="text-[8px] text-gray-500 uppercase">Incidents</div>
            </div>
            <div className="text-center px-3 py-2 bg-[#1a2232] rounded-lg border border-[#273449]">
              <div className="text-lg font-black text-red-400 font-mono">{stats.critical}</div>
              <div className="text-[8px] text-gray-500 uppercase">Critiques</div>
            </div>
            <div className="text-center px-3 py-2 bg-[#1a2232] rounded-lg border border-[#273449]">
              <div className="text-lg font-black text-amber-400 font-mono">{stats.high}</div>
              <div className="text-[8px] text-gray-500 uppercase">Élevés</div>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-region filters + search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-emerald-400" />
          <span className="text-xs text-gray-400 font-semibold">Sous-régions / Villes :</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setSubRegionFilter('all')}
            className={`px-3 py-1 rounded-full text-[10px] font-semibold border transition-all cursor-pointer whitespace-nowrap ${
              subRegionFilter === 'all'
                ? 'bg-emerald-600 text-white border-emerald-500'
                : 'bg-[#1a2232] text-gray-400 border-[#273449] hover:border-gray-500'
            }`}
          >
            Tout ({country.subRegions.length})
          </button>
          {country.subRegions.map((sub) => (
            <button
              key={sub}
              type="button"
              onClick={() => setSubRegionFilter(sub)}
              className={`px-3 py-1 rounded-full text-[10px] font-semibold border transition-all cursor-pointer whitespace-nowrap ${
                subRegionFilter === sub
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-[#1a2232] text-gray-400 border-[#273449] hover:border-gray-500'
              }`}
            >
              {sub}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
          <input
            type="text"
            value={searchLocality}
            onChange={(e) => setSearchLocality(e.target.value)}
            placeholder="Filtrer par localité..."
            className="w-full bg-[#1a2232] border border-[#273449] rounded-lg pl-9 pr-3 py-2 text-xs text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>
      </div>

      {/* Feeds for this country */}
      {countryFeeds.length === 0 ? (
        <div className="bg-[#0f1a2e] rounded-xl border border-[#1a2d4a] p-8 text-center">
          <Shield className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-gray-300 mb-1">
            {subRegionFilter !== 'all'
              ? `Aucun incident signalé à ${subRegionFilter}`
              : `Aucun incident signalé pour ${country.name}`}
          </h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            La veille est active sur cette zone. Les incidents seront affichés ici dès qu'ils seront détectés et vérifiés par nos sources.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {countryFeeds.map((feed) => {
            const alertLevel = getFeedSeverity(feed);
            const verified = isVerifiedData({ verification_status: feed.verification_status });
            return (
              <div
                key={feed.id}
                className={`bg-[#0f1a2e] rounded-lg border p-4 ${
                  alertLevel === 'critical' ? 'border-red-900/40' :
                  alertLevel === 'high' ? 'border-orange-900/20' : 'border-[#1a2d4a]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                    alertLevel === 'critical' ? 'bg-red-500' :
                    alertLevel === 'high' ? 'bg-orange-500' :
                    alertLevel === 'medium' ? 'bg-yellow-500' : 'bg-emerald-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        alertLevel === 'critical' ? 'bg-red-900/30 text-red-400' :
                        alertLevel === 'high' ? 'bg-orange-900/30 text-orange-400' : 'bg-gray-800 text-gray-400'
                      }`}>
                        {feed.category}
                      </span>
                      {verified && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-900/20 text-emerald-400 border border-emerald-800/30">
                          <Shield className="w-2 h-2" />
                          Vérifié
                        </span>
                      )}
                      <span className="text-[9px] text-gray-600 font-mono">
                        {new Date(feed.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <a
                      href={feed.source_url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="text-sm font-semibold text-gray-100 hover:text-emerald-400 transition-colors cursor-pointer leading-snug"
                    >
                      {feed.title}
                      <ExternalLink className="w-3 h-3 inline ml-1 text-gray-600" />
                    </a>

                    {feed.summary && (
                      <p className="text-xs text-gray-400 mt-1.5 leading-relaxed line-clamp-2">{feed.summary}</p>
                    )}

                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {feed.locality && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-900/20 px-2 py-0.5 rounded">
                          <MapPin className="w-3 h-3" />
                          {feed.locality}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded text-[9px] font-semibold border bg-gray-800 text-gray-400 border-gray-700">
                        Source: {feed.source}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Source coverage summary */}
      <div className="bg-[#0f1a2e] rounded-xl border border-[#1a2d4a] p-4">
        <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">Sources actives sur {country.name}</h4>
        <div className="flex items-center gap-1.5 flex-wrap">
          {[...new Set(countryFeeds.map((f) => f.source))].map((source) => (
            <span
              key={source}
              className="px-2.5 py-1 rounded-full text-[9px] font-semibold border bg-gray-800 text-gray-400 border-gray-700"
            >
              {source}
            </span>
          ))}
          {countryFeeds.length === 0 && (
            <span className="text-[10px] text-gray-600">Aucune source active — veille en cours</span>
          )}
        </div>
      </div>
    </div>
  );
}
