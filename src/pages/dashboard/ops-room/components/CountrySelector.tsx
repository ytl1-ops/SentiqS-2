import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, MapPin } from 'lucide-react';
import { ALL_AFRICA_COUNTRIES, REGION_ORDER, AFRICA_REGIONS, type AfricaCountry } from '@/data/africaRegions';

interface CountrySelectorProps {
  selectedCountry: AfricaCountry | null;
  selectedRegion: string;
  onCountryChange: (country: AfricaCountry | null) => void;
  onRegionChange: (region: string) => void;
}

export default function CountrySelector({ selectedCountry, selectedRegion, onCountryChange, onRegionChange }: CountrySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchCountry, setSearchCountry] = useState('');
  const [activeRegion, setActiveRegion] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRegionClick = (region: string) => {
    setActiveRegion(activeRegion === region ? null : region);
    onRegionChange(region === selectedRegion ? 'all' : region);
  };

  const filteredCountries = searchCountry
    ? ALL_AFRICA_COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(searchCountry.toLowerCase()) ||
          c.code.toLowerCase().includes(searchCountry.toLowerCase()) ||
          c.capital.toLowerCase().includes(searchCountry.toLowerCase()),
      )
    : [];

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 bg-[#1a2232] border border-[#273449] rounded-lg px-3 py-2.5 text-sm text-gray-200 hover:border-gray-500 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="truncate text-left">
            {selectedCountry ? (
              <span>
                <span className="font-semibold text-emerald-400">{selectedCountry.code}</span>
                <span className="text-gray-400 ml-1">{selectedCountry.name}</span>
              </span>
            ) : (
              <span className="text-gray-500">54 Pays d'Afrique — Tous</span>
            )}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-[340px] max-h-[500px] overflow-y-auto bg-[#111827] border border-[#273449] rounded-xl shadow-2xl z-50">
          {/* Quick search */}
          <div className="sticky top-0 bg-[#111827] p-3 border-b border-[#1e293b]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                type="text"
                value={searchCountry}
                onChange={(e) => setSearchCountry(e.target.value)}
                placeholder="Rechercher un pays..."
                className="w-full bg-[#1a2232] border border-[#273449] rounded-lg pl-9 pr-3 py-2 text-xs text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>

          {searchCountry ? (
            <div className="p-2">
              {filteredCountries.length === 0 ? (
                <div className="text-xs text-gray-500 text-center py-4">Aucun pays trouvé</div>
              ) : (
                filteredCountries.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => {
                      onCountryChange(c);
                      setSearchCountry('');
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer text-left ${
                      selectedCountry?.code === c.code
                        ? 'bg-emerald-600/20 text-emerald-400'
                        : 'text-gray-300 hover:bg-[#1a2232]'
                    }`}
                  >
                    <span className="w-6 h-6 rounded bg-[#1a2232] flex items-center justify-center text-[10px] font-bold text-gray-400 flex-shrink-0">
                      {c.code}
                    </span>
                    <div>
                      <div className="font-semibold">{c.name}</div>
                      <div className="text-[10px] text-gray-500">{c.capital}</div>
                    </div>
                    <span className="ml-auto text-[10px] text-gray-600">{c.region}</span>
                  </button>
                ))
              )}
            </div>
          ) : (
            <div className="p-2">
              {/* Reset all */}
              <button
                type="button"
                onClick={() => {
                  onCountryChange(null);
                  onRegionChange('all');
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  !selectedCountry && selectedRegion === 'all'
                    ? 'bg-emerald-600/20 text-emerald-400'
                    : 'text-gray-300 hover:bg-[#1a2232]'
                }`}
              >
                <GlobeIcon className="w-4 h-4" />
                Tous les 54 pays d'Afrique
              </button>

              {/* Regions */}
              <div className="mt-2 space-y-0.5">
                {REGION_ORDER.map((region) => {
                  const countries = AFRICA_REGIONS[region] || [];
                  const isActive = activeRegion === region;
                  return (
                    <div key={region}>
                      <button
                        type="button"
                        onClick={() => handleRegionClick(region)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          selectedRegion === region
                            ? 'bg-emerald-600/10 text-emerald-400 border border-emerald-800/30'
                            : 'text-gray-300 hover:bg-[#1a2232]'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {region}
                        </span>
                        <span className="text-[10px] text-gray-500">{countries.length}</span>
                      </button>
                      {isActive && (
                        <div className="ml-4 mt-1 space-y-0.5">
                          {countries.map((c) => (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => {
                                onCountryChange(c);
                                onRegionChange(region);
                                setIsOpen(false);
                              }}
                              className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left ${
                                selectedCountry?.code === c.code
                                  ? 'bg-emerald-600/20 text-emerald-400'
                                  : 'text-gray-300 hover:bg-[#1a2232]'
                              }`}
                            >
                              <span className="w-5 h-5 rounded bg-[#1a2232] flex items-center justify-center text-[9px] font-bold text-gray-400 flex-shrink-0">
                                {c.code}
                              </span>
                              <span>{c.name}</span>
                              {c.independenceDay && (
                                <span className="ml-auto text-[9px] text-gray-600">{c.independenceDay}</span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}