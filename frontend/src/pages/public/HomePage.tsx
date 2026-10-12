import {motion} from 'framer-motion';
import type {ReactNode} from 'react';
import type {PublicSettings, SiteResponse} from '../../api/types';
import {BarberPole, ButtonLink, Card, Monogram, Ornament, SectionTitle, Spinner, Stars} from '../../components/ui';
import {HeroPole} from '../../components/fx/HeroPole';
import {CombIcon, FloatingDecor, Marquee, RazorIcon, ScissorsIcon, SplitLetters, TiltCard} from '../../components/fx/effects';
import {useLang} from '../../i18n';
import {useSite} from '../../hooks/useSite';

function Reveal({children, delay = 0, className}: {children: ReactNode; delay?: number; className?: string}) {
  return (
    <motion.div
      className={className}
      initial={{opacity: 0, y: 24}}
      whileInView={{opacity: 1, y: 0}}
      viewport={{once: true, margin: '-60px'}}
      transition={{duration: 0.5, delay}}
    >
      {children}
    </motion.div>
  );
}

/** Umumiy ish vaqti: hamma kun bir xil bo'lsa "Har kuni 11:00–23:00" */
function hoursLabel(s: PublicSettings, everyDay: string) {
  const open = s.hours.filter((h) => h.open);
  if (open.length === 7 && open.every((h) => h.open === open[0].open && h.close === open[0].close))
    return `${everyDay} ${open[0].open}–${open[0].close}`;
  return open.length ? `${open[0].open}–${open[0].close}` : '';
}

export default function HomePage() {
  const {data, isLoading, isError} = useSite();
  if (isLoading)
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-navy">
        <Spinner className="h-8 w-8" />
      </div>
    );
  if (isError || !data) return <p className="py-20 text-center">⚠</p>;

  return (
    <>
      <Hero data={data} />
      <ServicesMarquee data={data} />
      <Services data={data} />
      <Barbers data={data} />
      <Reviews data={data} />
      <Gallery data={data} />
      <Location data={data} />
      <CtaBand />
    </>
  );
}

function Hero({data}: {data: SiteResponse}) {
  const {t} = useLang();
  const s = data.settings;
  return (
    <section className="relative overflow-hidden">
      <FloatingDecor className="top-10 left-[4%] text-navy/10" speed={60} rotate={30}>
        <ScissorsIcon className="h-20 w-20 md:h-28 md:w-28" />
      </FloatingDecor>
      <FloatingDecor className="right-[40%] bottom-16 hidden text-cherry/10 md:block" speed={90} rotate={-20}>
        <CombIcon className="h-24 w-24" />
      </FloatingDecor>
      <div className="mx-auto grid max-w-6xl items-center gap-6 px-4 py-10 md:grid-cols-[1.4fr_1fr] md:gap-10 md:py-20">
        <motion.div initial={{opacity: 0, y: 20}} animate={{opacity: 1, y: 0}} transition={{duration: 0.6}} className="relative z-10 text-center md:text-left">
          <Ornament className="md:justify-start text-navy">{t('hero.est')}</Ornament>
          <h1 className="mt-5 font-deco text-cherry text-7xl leading-[0.9] sm:text-8xl md:text-9xl">
            <SplitLetters text="New York" delay={0.15} />
          </h1>
          <p className="mt-3 font-deco text-navy text-2xl tracking-[0.55em] sm:text-3xl">BARBERSHOP</p>
          <div className="mx-auto my-6 h-0.5 w-40 bg-navy md:mx-0" />
          <p className="text-lg">{t('hero.tagline')}</p>
          <p className="mt-1 text-sm opacity-80">{hoursLabel(s, t('hero.everyDay'))}</p>
          <div className="mt-5 flex items-center justify-center gap-2 md:justify-start">
            <Stars value={s.rating} className="text-xl" />
            <span className="font-bold">{s.rating.toFixed(1)}</span>
            <span className="text-sm opacity-70">· {t('hero.ratingCount', {count: s.ratingCount})}</span>
          </div>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row md:justify-start">
            <ButtonLink to="/book">{t('hero.cta')} ★</ButtonLink>
            <ButtonLink to="/#services" variant="outline">
              {t('hero.ctaSecondary')}
            </ButtonLink>
          </div>
        </motion.div>

        <motion.div
          initial={{opacity: 0, scale: 0.9}}
          animate={{opacity: 1, scale: 1}}
          transition={{duration: 0.7, delay: 0.15}}
          className="order-first md:order-none"
        >
          <HeroPole className="mx-auto h-64 w-full max-w-[260px] md:h-[460px] md:max-w-[360px]" />
        </motion.div>
      </div>
      <BarberPole />
    </section>
  );
}

/** Hero ostidagi cheksiz lenta: xizmat nomlari */
function ServicesMarquee({data}: {data: SiteResponse}) {
  const {pick} = useLang();
  const items = ['New York Barbershop', ...data.services.map((s) => pick(s.name))];
  return <Marquee items={items} className="border-b-2 border-navy bg-navy py-3 font-deco text-2xl text-cream md:text-3xl" />;
}

function Services({data}: {data: SiteResponse}) {
  const {t, pick, money} = useLang();
  return (
    <section className="mx-auto max-w-6xl px-4 pt-20">
      <SectionTitle id="services" title={t('sections.services')} sub={t('sections.servicesSub')} />
      <div className="grid gap-4 md:grid-cols-2">
        {data.services.map((s, i) => (
          <Reveal key={s.id} delay={i * 0.05}>
            <TiltCard max={5}>
            <Card className="flex h-full flex-col gap-3 p-5 sm:flex-row sm:items-center">
              <div className="flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-xl font-bold">{pick(s.name)}</h3>
                  <span className="whitespace-nowrap text-lg font-bold text-cherry">{money(s.price)}</span>
                </div>
                <p className="mt-1 text-sm opacity-80">{pick(s.description)}</p>
                <p className="mt-2 text-xs font-semibold tracking-widest uppercase opacity-60">⏱ {t('common.minutes', {count: s.durationMinutes})}</p>
              </div>
              <ButtonLink to={`/book?service=${s.id}`} variant="outline" className="!px-4 !py-2 self-start sm:self-center">
                {t('common.bookThis')}
              </ButtonLink>
            </Card>
            </TiltCard>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Barbers({data}: {data: SiteResponse}) {
  const {t, pick} = useLang();
  const days = t('daysShort', {returnObjects: true}) as string[];
  return (
    <section className="mx-auto max-w-6xl px-4 pt-24">
      <SectionTitle id="barbers" title={t('sections.barbers')} sub={t('sections.barbersSub')} />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {data.barbers.map((b, i) => (
          <Reveal key={b.id} delay={i * 0.08}>
            <TiltCard>
            <Card className="h-full overflow-hidden text-center">
              <div className="relative bg-cream-dark px-6 pt-8 pb-6">
                {b.photoUrl ? (
                  <img src={b.photoUrl} alt={b.name} className="mx-auto h-36 w-36 rounded-full border-4 border-cherry object-cover" />
                ) : (
                  <Monogram name={b.name} className="mx-auto h-36 w-36 text-7xl" />
                )}
              </div>
              <div className="p-5">
                <h3 className="font-deco text-4xl text-navy">{b.name}</h3>
                <p className="mt-1 text-xs font-bold tracking-[0.3em] uppercase text-cherry">{pick(b.title)}</p>
                <p className="mt-3 text-sm opacity-80">{pick(b.bio)}</p>
                {b.daysOff.length ? (
                  <p className="mt-3 text-xs opacity-60">
                    {t('common.dayOff')}: {b.daysOff.map((d) => days[d]).join(', ')}
                  </p>
                ) : null}
                <ButtonLink to={`/book?barber=${b.id}`} variant="outline" className="mt-5 !px-4 !py-2">
                  {t('common.bookThis')}
                </ButtonLink>
              </div>
            </Card>
            </TiltCard>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Reviews({data}: {data: SiteResponse}) {
  const {t} = useLang();
  if (!data.reviews.length) return null;
  const s = data.settings;
  return (
    <section className="mx-auto max-w-6xl px-4 pt-24">
      <SectionTitle id="reviews" title={t('sections.reviews')} sub={t('sections.reviewsSub')} />
      <div className="mb-8 flex items-center justify-center gap-3">
        <span className="font-deco text-6xl text-navy">{s.rating.toFixed(1)}</span>
        <div className="text-left">
          <Stars value={s.rating} className="text-2xl" />
          <p className="text-sm opacity-70">{t('hero.ratingCount', {count: s.ratingCount})}</p>
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {data.reviews.map((r, i) => (
          <Reveal key={r.id} delay={i * 0.06}>
            <Card className="relative h-full p-6">
              <span aria-hidden className="absolute -top-5 left-5 font-deco text-7xl leading-none text-cherry">“</span>
              <Stars value={r.rating} />
              <p className="mt-3">{r.text}</p>
              <p className="mt-4 text-sm font-bold">— {r.authorName}</p>
            </Card>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Gallery({data}: {data: SiteResponse}) {
  const {t, pick} = useLang();
  if (!data.gallery.length) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 pt-24">
      <SectionTitle id="gallery" title={t('sections.gallery')} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {data.gallery.map((g, i) => (
          <Reveal key={g.id} delay={(i % 4) * 0.05}>
            <figure className="overflow-hidden rounded-2xl border-2 border-navy">
              <img src={g.url} alt={pick(g.caption)} loading="lazy" className="aspect-square w-full object-cover transition duration-500 hover:scale-105" />
            </figure>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Location({data}: {data: SiteResponse}) {
  const {t, pick} = useLang();
  const s = data.settings;
  const days = t('days', {returnObjects: true}) as string[];
  const mapSrc = `https://yandex.uz/map-widget/v1/?ll=${s.longitude}%2C${s.latitude}&z=16&pt=${s.longitude}%2C${s.latitude}%2Cpm2rdm`;
  const route = `https://yandex.uz/maps/?rtext=~${s.latitude}%2C${s.longitude}&rtt=auto`;
  return (
    <section className="mx-auto max-w-6xl px-4 pt-24">
      <SectionTitle id="contacts" title={t('sections.location')} sub={t('sections.locationSub')} />
      <div className="grid gap-6 md:grid-cols-[1.5fr_1fr]">
        <Card className="overflow-hidden">
          <iframe title="Map" src={mapSrc} className="h-80 w-full md:h-full md:min-h-96" loading="lazy" />
        </Card>
        <Card className="flex flex-col gap-4 p-6">
          <p className="text-lg font-bold">{pick(s.address)}</p>
          <a href={`tel:${s.phone.replace(/\s/g, '')}`} className="text-2xl font-bold text-cherry hover:underline">
            {s.phone}
          </a>
          <ul className="space-y-1 text-sm">
            {s.hours
              .slice()
              .sort((a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7))
              .map((h) => (
                <li key={h.day} className="flex justify-between border-b border-dashed border-navy/30 py-1">
                  <span>{days[h.day]}</span>
                  <span className="font-semibold">{h.open ? `${h.open}–${h.close}` : t('common.closed')}</span>
                </li>
              ))}
          </ul>
          <div className="mt-auto flex flex-wrap gap-3 pt-2">
            <a href={route} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-full border-2 border-navy px-4 py-2 text-xs font-bold tracking-widest uppercase hover:bg-navy hover:text-cream transition">
              {t('common.route')} ↗
            </a>
            {s.telegram ? (
              <a href={`https://t.me/${s.telegram}`} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-full border-2 border-navy px-4 py-2 text-xs font-bold tracking-widest uppercase hover:bg-navy hover:text-cream transition">
                Telegram ↗
              </a>
            ) : null}
          </div>
        </Card>
      </div>
    </section>
  );
}

function CtaBand() {
  const {t} = useLang();
  return (
    <section className="relative mx-auto max-w-6xl px-4 pt-24">
      <FloatingDecor className="-top-2 right-6 text-navy/15" speed={50} rotate={40}>
        <RazorIcon className="h-16 w-16 md:h-20 md:w-20" />
      </FloatingDecor>
      <div className="overflow-hidden rounded-3xl border-2 border-navy bg-navy text-center text-cream">
        <BarberPole />
        <div className="px-6 py-12">
          <p className="font-deco text-5xl md:text-6xl">{t('hero.cta')}</p>
          <p className="mx-auto mt-3 max-w-md opacity-80">{t('hero.tagline')}</p>
          <ButtonLink to="/book" className="mt-8 !shadow-[0_4px_0_0_var(--color-cream)]">
            {t('nav.book')} ★
          </ButtonLink>
        </div>
        <BarberPole />
      </div>
    </section>
  );
}
