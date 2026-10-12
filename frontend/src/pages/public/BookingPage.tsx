import {useQuery, useQueryClient} from '@tanstack/react-query';
import {AnimatePresence, motion} from 'framer-motion';
import {useEffect, useMemo, useRef, useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {ApiError, publicApi} from '../../api/client';
import type {BookingConfirmation, PublicBarber, PublicService, SiteResponse} from '../../api/types';
import {BarberPole, Button, ButtonLink, Card, Monogram, Ornament, Spinner} from '../../components/ui';
import {cn} from '../../lib/cn';
import {Confetti} from '../../components/fx/effects';
import {useLang} from '../../i18n';
import {useSite} from '../../hooks/useSite';
import {addDays, formatDate, parts, todayIso} from '../../lib/dates';
import {formatLocalPhone, isValidLocalPhone} from '../../lib/phone';

type Step = 0 | 1 | 2 | 3;
const ANY = 0; // "Istalgan usta"

export default function BookingPage() {
  const {data, isLoading} = useSite();
  if (isLoading || !data)
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  return <Wizard site={data} />;
}

function Wizard({site}: {site: SiteResponse}) {
  const {t, lang} = useLang();
  const [params] = useSearchParams();
  const qc = useQueryClient();

  const presetService = Number(params.get('service')) || null;
  const presetBarber = Number(params.get('barber')) || null;

  const [serviceId, setServiceId] = useState<number | null>(
    site.services.some((s) => s.id === presetService) ? presetService : null,
  );
  const [barberId, setBarberId] = useState<number | null>(
    site.barbers.some((b) => b.id === presetBarber) ? presetBarber : null,
  );
  const [step, setStep] = useState<Step>(serviceId ? (barberId ? 2 : 1) : 0);
  const [date, setDate] = useState(todayIso());
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<BookingConfirmation | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const service = site.services.find((s) => s.id === serviceId) ?? null;
  const barber = site.barbers.find((b) => b.id === barberId) ?? null;

  // Usta oldindan tanlangan, lekin u bu xizmatni bajarmasa — ustani bekor qilamiz
  useEffect(() => {
    if (service && barberId && barberId !== ANY && !service.barberIds.includes(barberId)) setBarberId(null);
  }, [service, barberId]);

  useEffect(() => {
    topRef.current?.scrollIntoView({behavior: 'smooth', block: 'start'});
  }, [step, done]);

  const go = (s: Step) => {
    setError(null);
    setStep(s);
  };

  async function submit() {
    if (!service || !time) return;
    if (name.trim().length < 2) return setError(t('booking.errors.name_invalid'));
    if (!isValidLocalPhone(phone)) return setError(t('booking.errors.phone_invalid'));
    setSending(true);
    setError(null);
    try {
      const res = await publicApi.book({
        serviceId: service.id,
        barberId: barberId && barberId !== ANY ? barberId : null,
        date,
        time,
        clientName: name.trim(),
        clientPhone: `+998${phone.replace(/\D/g, '')}`,
        comment: comment.trim() || undefined,
        language: lang,
      });
      setDone(res);
      qc.invalidateQueries({queryKey: ['slots']});
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 429) setError(t('booking.errors.tooMany'));
      else if (err.code === 'slot_unavailable' || err.code === 'slot_taken') {
        setError(t(`booking.errors.${err.code}`));
        setTime(null);
        qc.invalidateQueries({queryKey: ['slots']});
        setStep(2);
      } else setError(err.code ? t(`booking.errors.${err.code}`, {defaultValue: t('booking.errors.generic')}) : t('booking.errors.generic'));
    } finally {
      setSending(false);
    }
  }

  const reset = () => {
    setDone(null);
    setTime(null);
    setComment('');
    go(0);
  };

  return (
    <div ref={topRef} className="mx-auto max-w-3xl scroll-mt-24 px-4 py-10">
      <div className="text-center">
        <Ornament className="text-navy">New York Barbershop</Ornament>
        <h1 className="mt-3 font-deco text-5xl text-cherry md:text-6xl">{t('booking.title')}</h1>
      </div>

      {done ? (
        <Success booking={done} site={site} onAgain={reset} />
      ) : (
        <>
          <Stepper step={step} onJump={(s) => s < step && go(s)} />
          {error ? (
            <div role="alert" className="mb-5 rounded-2xl border-2 border-cherry bg-cherry/10 px-4 py-3 text-sm font-semibold text-cherry-dark">
              {error}
            </div>
          ) : null}

          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{opacity: 0, x: 30}} animate={{opacity: 1, x: 0}} exit={{opacity: 0, x: -30}} transition={{duration: 0.25}}>
              {step === 0 && (
                <ServiceStep
                  services={site.services}
                  selected={serviceId}
                  onPick={(id) => {
                    setServiceId(id);
                    setTime(null);
                    go(1);
                  }}
                />
              )}
              {step === 1 && service && (
                <BarberStep
                  barbers={site.barbers.filter((b) => service.barberIds.includes(b.id))}
                  selected={barberId}
                  onPick={(id) => {
                    setBarberId(id);
                    setTime(null);
                    go(2);
                  }}
                />
              )}
              {step === 2 && service && (
                <TimeStep
                  service={service}
                  barberId={barberId && barberId !== ANY ? barberId : null}
                  daysOff={offDays(site, service, barberId)}
                  horizon={site.settings.bookingHorizonDays}
                  date={date}
                  time={time}
                  onDate={(d) => {
                    setDate(d);
                    setTime(null);
                  }}
                  onTime={(tm) => {
                    setTime(tm);
                    go(3);
                  }}
                />
              )}
              {step === 3 && service && time && (
                <DetailsStep
                  service={service}
                  barber={barber}
                  date={date}
                  time={time}
                  name={name}
                  phone={phone}
                  comment={comment}
                  sending={sending}
                  onName={setName}
                  onPhone={(v) => setPhone(formatLocalPhone(v))}
                  onComment={setComment}
                  onSubmit={submit}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {step > 0 ? (
            <div className="mt-6">
              <Button variant="ghost" onClick={() => go((step - 1) as Step)}>
                ← {t('booking.back')}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

/**
 * Hech kim ishlamaydigan hafta kunlari: aniq usta tanlangan bo'lsa — uning dam olish kunlari,
 * "istalgan usta" bo'lsa — xizmatni bajaradigan barcha ustalar dam oladigan kunlar.
 */
function offDays(site: SiteResponse, service: PublicService, barberId: number | null): number[] {
  const barbers = site.barbers.filter((b) => service.barberIds.includes(b.id) && (!barberId || barberId === ANY || b.id === barberId));
  if (!barbers.length) return [];
  return [0, 1, 2, 3, 4, 5, 6].filter((d) => barbers.every((b) => b.daysOff.includes(d)));
}

function Stepper({step, onJump}: {step: Step; onJump: (s: Step) => void}) {
  const {t} = useLang();
  const labels = t('booking.steps', {returnObjects: true}) as string[];
  return (
    <div className="my-8">
      <p className="mb-3 text-center text-xs font-bold tracking-[0.3em] uppercase text-cherry">{t('booking.step', {n: step + 1})}</p>
      <ol className="grid grid-cols-4 gap-2">
        {labels.map((l, i) => (
          <li key={l}>
            <button
              type="button"
              onClick={() => onJump(i as Step)}
              disabled={i >= step}
              className={cn(
                'w-full truncate rounded-full border-2 px-1 py-2 text-[10px] font-bold tracking-wide uppercase transition sm:text-xs sm:tracking-widest',
                i < step && 'border-navy bg-navy text-cream hover:bg-navy-dark',
                i === step && 'border-cherry bg-cherry text-white',
                i > step && 'border-navy/30 text-navy/40',
              )}
            >
              {i < step ? '✓ ' : ''}
              {l}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function StepHeading({children}: {children: string}) {
  return <h2 className="mb-5 font-deco text-4xl text-navy">{children}</h2>;
}

function ServiceStep({services, selected, onPick}: {services: PublicService[]; selected: number | null; onPick: (id: number) => void}) {
  const {t, pick, money} = useLang();
  return (
    <div>
      <StepHeading>{t('booking.chooseService')}</StepHeading>
      <div className="grid gap-3">
        {services.map((s) => (
          <button key={s.id} type="button" onClick={() => onPick(s.id)} className="text-left">
            <Card active={selected === s.id} className="flex items-center gap-4 p-4 hover:border-cherry">
              <span aria-hidden className="text-2xl">✂</span>
              <div className="flex-1">
                <p className="font-bold">{pick(s.name)}</p>
                <p className="text-xs opacity-70">{t('common.minutes', {count: s.durationMinutes})}</p>
              </div>
              <span className="font-bold text-cherry">{money(s.price)}</span>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}

function BarberStep({barbers, selected, onPick}: {barbers: PublicBarber[]; selected: number | null; onPick: (id: number) => void}) {
  const {t, pick} = useLang();
  return (
    <div>
      <StepHeading>{t('booking.chooseBarber')}</StepHeading>
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => onPick(ANY)} className="text-left sm:col-span-2">
          <Card active={selected === ANY} className="flex items-center gap-4 p-4 hover:border-cherry">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-navy text-2xl">★</div>
            <div>
              <p className="font-bold">{t('booking.anyBarber')}</p>
              <p className="text-xs opacity-70">{t('booking.anyBarberDesc')}</p>
            </div>
          </Card>
        </button>
        {barbers.map((b) => (
          <button key={b.id} type="button" onClick={() => onPick(b.id)} className="text-left">
            <Card active={selected === b.id} className="flex items-center gap-4 p-4 hover:border-cherry">
              {b.photoUrl ? (
                <img src={b.photoUrl} alt="" className="h-16 w-16 rounded-full border-2 border-cherry object-cover" />
              ) : (
                <Monogram name={b.name} className="h-16 w-16 text-3xl" />
              )}
              <div>
                <p className="font-deco text-2xl">{b.name}</p>
                <p className="text-xs font-bold tracking-widest uppercase text-cherry">{pick(b.title)}</p>
              </div>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}

function TimeStep(props: {
  service: PublicService;
  barberId: number | null;
  daysOff: number[];
  horizon: number;
  date: string;
  time: string | null;
  onDate: (d: string) => void;
  onTime: (t: string) => void;
}) {
  const {t} = useLang();
  const {service, barberId, daysOff, horizon, date, time, onDate, onTime} = props;
  const today = todayIso();
  const days = useMemo(() => Array.from({length: horizon + 1}, (_, i) => addDays(today, i)), [today, horizon]);
  const shortDays = t('daysShort', {returnObjects: true}) as string[];
  const isOff = (d: string) => daysOff.includes(parts(d).weekday);

  // Tanlangan kun dam olish kuni bo'lsa — birinchi ish kuniga o'tamiz
  useEffect(() => {
    if (isOff(date) || date < today) {
      const first = days.find((d) => !isOff(d));
      if (first && first !== date) onDate(first);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daysOff.join(','), date, today]);

  const slots = useQuery({
    queryKey: ['slots', service.id, barberId, date],
    queryFn: () => publicApi.slots(service.id, date, barberId),
    staleTime: 15_000,
  });

  const groups = useMemo(() => {
    const all = slots.data?.slots ?? [];
    const g = {morning: [] as string[], day: [] as string[], evening: [] as string[]};
    for (const s of all) {
      const h = Number(s.time.slice(0, 2));
      (h < 12 ? g.morning : h < 17 ? g.day : g.evening).push(s.time);
    }
    return g;
  }, [slots.data]);

  return (
    <div>
      <StepHeading>{t('booking.chooseTime')}</StepHeading>
      <div className="-mx-4 mb-6 flex snap-x gap-2 overflow-x-auto px-4 pb-2">
        {days.map((d, i) => {
          const p = parts(d);
          const label = i === 0 ? t('booking.today') : i === 1 ? t('booking.tomorrow') : shortDays[p.weekday];
          const off = isOff(d);
          return (
            <button
              key={d}
              type="button"
              disabled={off}
              onClick={() => onDate(d)}
              title={off ? t('common.dayOff') : undefined}
              className={cn(
                'min-w-[4.5rem] snap-start rounded-2xl border-2 px-2 py-2 text-center transition',
                off && 'border-dashed border-navy/30 text-navy/35 line-through',
                !off && (d === date ? 'border-navy bg-navy text-cream' : 'border-navy hover:bg-cream-dark'),
              )}
            >
              <span className="block text-[11px] font-semibold uppercase tracking-wider">{label}</span>
              <span className="block text-2xl font-bold">{p.day}</span>
            </button>
          );
        })}
      </div>

      {slots.isLoading ? (
        <p className="flex items-center gap-3 py-8 opacity-70">
          <Spinner /> {t('booking.loadingSlots')}
        </p>
      ) : !slots.data?.slots.length ? (
        <Card className="p-6 text-center">{t('booking.noSlots')}</Card>
      ) : (
        <div className="space-y-5">
          {(['morning', 'day', 'evening'] as const).map((k) =>
            groups[k].length ? (
              <div key={k}>
                <p className="mb-2 text-xs font-bold tracking-[0.3em] uppercase opacity-60">
                  {k === 'morning' ? '☀' : k === 'day' ? '◐' : '☾'}
                </p>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {groups[k].map((tm) => (
                    <button
                      key={tm}
                      type="button"
                      onClick={() => onTime(tm)}
                      className={cn(
                        'rounded-xl border-2 py-2.5 text-sm font-bold transition',
                        tm === time ? 'border-cherry bg-cherry text-white' : 'border-navy hover:border-cherry hover:text-cherry',
                      )}
                    >
                      {tm}
                    </button>
                  ))}
                </div>
              </div>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}

function DetailsStep(props: {
  service: PublicService;
  barber: PublicBarber | null;
  date: string;
  time: string;
  name: string;
  phone: string;
  comment: string;
  sending: boolean;
  onName: (v: string) => void;
  onPhone: (v: string) => void;
  onComment: (v: string) => void;
  onSubmit: () => void;
}) {
  const {t, pick, money} = useLang();
  const months = t('months', {returnObjects: true}) as string[];
  const days = t('days', {returnObjects: true}) as string[];
  const {service, barber, date, time} = props;
  const input =
    'w-full rounded-xl border-2 border-navy bg-white px-4 py-3 text-base outline-none transition focus:border-cherry focus:ring-4 focus:ring-cherry/15';

  return (
    <form
      className="grid gap-6 md:grid-cols-[1fr_0.9fr]"
      onSubmit={(e) => {
        e.preventDefault();
        props.onSubmit();
      }}
    >
      <div className="space-y-4">
        <StepHeading>{t('booking.yourDetails')}</StepHeading>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">{t('booking.name')}</span>
          <input className={input} value={props.name} onChange={(e) => props.onName(e.target.value)} placeholder={t('booking.namePlaceholder')} autoComplete="name" maxLength={100} required />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">{t('booking.phone')}</span>
          <div className="flex items-stretch">
            <span className="flex items-center rounded-l-xl border-2 border-r-0 border-navy bg-cream-dark px-3 font-bold">+998</span>
            <input
              className={cn(input, 'rounded-l-none')}
              value={props.phone}
              onChange={(e) => props.onPhone(e.target.value)}
              placeholder="90 123 45 67"
              inputMode="tel"
              autoComplete="tel-national"
              required
            />
          </div>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">{t('booking.comment')}</span>
          <textarea className={cn(input, 'min-h-24')} value={props.comment} onChange={(e) => props.onComment(e.target.value)} placeholder={t('booking.commentPlaceholder')} maxLength={500} />
        </label>
      </div>

      <Card className="h-fit overflow-hidden">
        <BarberPole className="!h-2.5" />
        <div className="p-5">
          <p className="mb-3 font-deco text-3xl text-cherry">{t('booking.summary')}</p>
          <dl className="space-y-2 text-sm">
            <Row k={t('booking.service')} v={pick(service.name)} />
            <Row k={t('booking.barber')} v={barber?.name ?? t('booking.anyBarber')} />
            <Row k={t('booking.date')} v={formatDate(date, months, days)} />
            <Row k={t('booking.time')} v={time} />
            <div className="my-2 border-t-2 border-dashed border-navy/30" />
            <Row k={t('booking.price')} v={money(service.price)} strong />
          </dl>
          <Button type="submit" className="mt-5 w-full" disabled={props.sending}>
            {props.sending ? (
              <>
                <Spinner /> {t('booking.sending')}
              </>
            ) : (
              <>{t('booking.confirm')} ★</>
            )}
          </Button>
        </div>
      </Card>
    </form>
  );
}

function Row({k, v, strong}: {k: string; v: string; strong?: boolean}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="opacity-70">{k}</dt>
      <dd className={cn('text-right font-semibold', strong && 'text-lg text-cherry')}>{v}</dd>
    </div>
  );
}

function Success({booking, site, onAgain}: {booking: BookingConfirmation; site: SiteResponse; onAgain: () => void}) {
  const {t, pick, money} = useLang();
  const months = t('months', {returnObjects: true}) as string[];
  const days = t('days', {returnObjects: true}) as string[];
  const service = site.services.find((s) => s.id === booking.serviceId);
  return (
    <motion.div initial={{opacity: 0, scale: 0.95}} animate={{opacity: 1, scale: 1}} className="mt-10">
      <Card className="relative overflow-hidden text-center">
        <Confetti />
        <BarberPole />
        <div className="px-6 py-10">
          <motion.div
            initial={{scale: 0, rotate: -90}}
            animate={{scale: 1, rotate: 0}}
            transition={{type: 'spring', stiffness: 200, damping: 12, delay: 0.1}}
            className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-cherry text-5xl text-white"
          >
            ✓
          </motion.div>
          <h2 className="mt-6 font-deco text-5xl text-navy">{t('booking.successTitle')}</h2>
          <p className="mx-auto mt-2 max-w-sm opacity-80">{t('booking.successText')}</p>
          <dl className="mx-auto mt-8 max-w-sm space-y-2 text-left text-sm">
            <Row k={t('booking.bookingNumber')} v={`#${booking.id}`} />
            <Row k={t('booking.service')} v={service ? pick(service.name) : ''} />
            <Row k={t('booking.barber')} v={booking.barberName} />
            <Row k={t('booking.date')} v={formatDate(booking.date, months, days)} />
            <Row k={t('booking.time')} v={`${booking.time}–${booking.endTime}`} />
            <Row k={t('booking.price')} v={money(booking.price)} strong />
          </dl>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button variant="outline" onClick={onAgain}>
              {t('booking.newBooking')}
            </Button>
            <ButtonLink to="/">{t('booking.toHome')}</ButtonLink>
          </div>
        </div>
        <BarberPole />
      </Card>
    </motion.div>
  );
}
