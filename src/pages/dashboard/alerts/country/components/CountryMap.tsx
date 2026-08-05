import { useTranslation } from 'react-i18next';

interface Props {
  countryName: string;
  lat: number;
  lng: number;
}

export default function CountryMap({ countryName, lat, lng }: Props) {
  const { t } = useTranslation();
  const zoom = 5;
  const embedUrl = `https://maps.google.com/maps?q=${lat},${lng}&z=${zoom}&t=m&output=embed`;

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
      <div className="px-4 py-2.5 border-b border-gray-200 bg-white flex items-center gap-2">
        <i className="ri-map-pin-line text-sentiqs-navy text-sm" />
        <span className="text-xs font-bold text-sentiqs-navy">Carte de situation — {countryName}</span>
      </div>
      <div className="relative w-full" style={{ height: '360px' }}>
        <iframe
          title={`Carte de ${countryName}`}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          src={embedUrl}
        />
        <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />
      </div>
      <div className="px-4 py-2 bg-white border-t border-gray-100 text-[10px] text-gray-400 flex items-center gap-1.5">
        <i className="ri-information-line" />
        {t('dashboard.map.coordinates', { lat: lat.toFixed(4), lng: lng.toFixed(4) })}
      </div>
    </div>
  );
}