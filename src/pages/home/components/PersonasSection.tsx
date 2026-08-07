import { useTranslation } from 'react-i18next';

interface Persona {
  icon: string;
  title: string;
  desc: string;
}

export default function PersonasSection() {
  const { t } = useTranslation();

  const personas: Persona[] = [
    {
      icon: 'ri-shield-star-line',
      title: t('landing.personas.0.title'),
      desc: t('landing.personas.0.desc'),
    },
    {
      icon: 'ri-hand-heart-line',
      title: t('landing.personas.1.title'),
      desc: t('landing.personas.1.desc'),
    },
    {
      icon: 'ri-line-chart-line',
      title: t('landing.personas.2.title'),
      desc: t('landing.personas.2.desc'),
    },
    {
      icon: 'ri-compass-3-line',
      title: t('landing.personas.3.title'),
      desc: t('landing.personas.3.desc'),
    },
  ];

  return (
    <section className="w-full bg-white">
      <div className="w-full px-6 md:px-10 py-14 md:py-20">
        <div className="text-center mb-10 md:mb-14">
          <h2 className="text-2xl md:text-4xl font-bold text-sentiqs-navy">
            {t('landing.personas.title')}
          </h2>
          <p className="mt-3 text-sm md:text-base text-sentiqs-gray-text max-w-2xl mx-auto leading-relaxed">
            {t('landing.personas.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6 max-w-6xl mx-auto">
          {personas.map((p) => (
            <div
              key={p.title}
              className="bg-sentiqs-gray-bg rounded-xl border border-gray-100 p-6 md:p-7 flex flex-col"
            >
              <div className="w-11 h-11 flex items-center justify-center rounded-lg bg-sentiqs-blue/10 mb-4">
                <i className={`${p.icon} text-sentiqs-blue text-xl`} />
              </div>
              <h3 className="text-sm font-bold text-sentiqs-navy mb-2">{p.title}</h3>
              <p className="text-sm text-sentiqs-gray-text leading-relaxed flex-1">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
