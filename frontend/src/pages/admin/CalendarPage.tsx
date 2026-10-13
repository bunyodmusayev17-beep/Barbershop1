import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';
import {adminApi, STATUSES, timeOffApi, type Appointment, type AppointmentStatus} from '../../api/admin';
import {useAuth} from '../../auth/AuthContext';
import {Btn, errorText, Input, Modal, PageHeader, STATUS_LABEL, StatusBadge, money, useToast} from '../../components/admin/kit';
import {Spinner} from '../../components/ui';
import {Pager, usePaged} from '../../components/Pager';
import {useSite} from '../../hooks/useSite';
import {cn} from '../../lib/cn';
import {addDays, parts, todayIso} from '../../lib/dates';
import {NewAppointmentModal} from './AppointmentsView';

const START_HOUR = 9;
const END_HOUR = 24;
const HOUR_PX = 84;
/** Bundan past bloklarda matn bitta qatorda ko'rsatiladi (aks holda kesilib qoladi) */
const COMPACT_PX = 57; // 3 qator × 15px (text-xs, leading-tight) + py-1.5
const DAY_NAMES = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];

const BLOCK_STYLE: Record<AppointmentStatus, string> = {
  Pending: 'bg-amber-100 border-amber-400 text-amber-900',
  Confirmed: 'bg-sky-100 border-sky-500 text-sky-900',
  Completed: 'bg-emerald-100 border-emerald-500 text-emerald-900',
  Cancelled: 'bg-zinc-100 border-zinc-300 text-zinc-500 line-through opacity-60',
  NoShow: 'bg-rose-100 border-rose-400 text-rose-900',
};

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const pad = (n: number) => String(n).padStart(2, '0');

export default function CalendarPage() {
  const {user} = useAuth();
  const isAdmin = user?.role === 'Admin';
  const site = useSite();
  const qc = useQueryClient();
  const toast = useToast();
  const [date, setDate] = useState(todayIso());
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [newAt, setNewAt] = useState<{time: string; barberId: number} | null>(null);

  const appointments = useQuery({
    queryKey: ['appointments', date, date, null, '', ''],
    queryFn: () => adminApi.appointments({from: date, to: date}),
    refetchInterval: 60_000,
  });

  const timeOffs = useQuery({
    queryKey: ['timeoffs', 'day', date],
    queryFn: () => timeOffApi.list({from: date, to: date}),
  });

  /** Ishlamaydigan vaqtning shu kunga to'g'ri keladigan qismi, kalendar daqiqalarida */
  const offRanges = (barberId: number) =>
    (timeOffs.data ?? [])
      .filter((t) => t.barberId === barberId)
      .map((t) => {
        const dayStart = START_HOUR * 60;
        const dayEnd = END_HOUR * 60;
        const from = t.from.slice(0, 10) < date ? 0 : toMin(t.from.slice(11));
        const to = t.to.slice(0, 10) > date ? 24 * 60 : toMin(t.to.slice(11));
        return {id: t.id, reason: t.reason, from: Math.max(from, dayStart), to: Math.min(to, dayEnd)};
      })
      .filter((r) => r.to > r.from);

  const setStatus = useMutation({
    mutationFn: ({id, s}: {id: number; s: AppointmentStatus}) => adminApi.setStatus(id, s),
    onSuccess: (a) => {
      toast(`#${a.id}: ${STATUS_LABEL[a.status]}`);
      setSelected(a);
      qc.invalidateQueries({queryKey: ['appointments']});
      qc.invalidateQueries({queryKey: ['stats']});
    },
    onError: (e) => toast(errorText(e), 'error'),
  });

  const weekday = parts(date).weekday;
  // Ustalar ko'p bo'lsa — 6 tadan ustun, sahifalar bilan (aks holda kalendar juda keng bo'lib ketadi)
  const paged = usePaged((site.data?.barbers ?? []).filter((b) => isAdmin || b.id === user?.barberId), 6);
  const columns = paged.items;
  const hours = Array.from({length: END_HOUR - START_HOUR}, (_, i) => START_HOUR + i);

  // Hozirgi vaqt chizig'i (faqat bugun uchun)
  const nowMin = (() => {
    const s = new Intl.DateTimeFormat('en-GB', {timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit', hour12: false}).format(new Date());
    return toMin(s);
  })();

  return (
    <>
      <PageHeader
        title="Kalendar"
        sub={`${DAY_NAMES[weekday]}, ${date}`}
        actions={
          <>
            <Btn variant="outline" onClick={() => setDate(addDays(date, -1))} aria-label="Oldingi kun">
              ←
            </Btn>
            <Btn variant="outline" onClick={() => setDate(todayIso())}>
              Bugun
            </Btn>
            <Btn variant="outline" onClick={() => setDate(addDays(date, 1))} aria-label="Keyingi kun">
              →
            </Btn>
            <Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="!w-auto" />
          </>
        }
      />

      <Pager page={paged.page} pages={paged.pages} onChange={paged.setPage} className="mb-4" />

      {appointments.isLoading || site.isLoading ? (
        <Spinner className="h-8 w-8" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border-2 border-navy/15 bg-white">
          <div className="grid" style={{gridTemplateColumns: `56px repeat(${columns.length}, minmax(160px, 1fr))`, minWidth: 56 + columns.length * 160}}>
            <div className="sticky top-0 z-10 border-b-2 border-navy/10 bg-white" />
            {columns.map((b) => {
              const off = b.daysOff.includes(weekday);
              const sick = offRanges(b.id).some((r) => r.from <= START_HOUR * 60 && r.to >= END_HOUR * 60);
              const count = (appointments.data ?? []).filter((a) => a.barberId === b.id && a.status !== 'Cancelled').length;
              return (
                <div key={b.id} className="sticky top-0 z-10 border-b-2 border-l border-navy/10 bg-white px-3 py-3 text-center">
                  <p className="font-deco text-2xl text-navy">{b.name}</p>
                  <p className={cn('text-xs', off || sick ? 'font-bold text-cherry' : 'opacity-60')}>
                    {off ? 'Dam olish kuni' : sick ? 'Ishlamaydi' : `${count} ta zapis`}
                  </p>
                </div>
              );
            })}

            <div className="relative" style={{height: hours.length * HOUR_PX}}>
              {hours.map((h, i) => (
                <span key={h} className="absolute right-2 -translate-y-1/2 text-[11px] opacity-50" style={{top: i * HOUR_PX}}>
                  {i === 0 ? '' : `${pad(h)}:00`}
                </span>
              ))}
            </div>

            {columns.map((b) => {
              const off = b.daysOff.includes(weekday);
              const items = (appointments.data ?? []).filter((a) => a.barberId === b.id);
              return (
                <div key={b.id} className={cn('relative border-l border-navy/10', off && 'bg-[repeating-linear-gradient(45deg,#f4f0e6_0_8px,#fff_8px_16px)]')} style={{height: hours.length * HOUR_PX}}>
                  {hours.map((h, i) => (
                    <button
                      key={h}
                      type="button"
                      aria-label={`${b.name}, ${pad(h)}:00 — yangi zapis`}
                      onClick={() => setNewAt({time: `${pad(h)}:00`, barberId: b.id})}
                      className="absolute inset-x-0 border-t border-navy/5 hover:bg-cherry/5"
                      style={{top: i * HOUR_PX, height: HOUR_PX}}
                    />
                  ))}
                  {date === todayIso() && nowMin >= START_HOUR * 60 ? (
                    <div className="pointer-events-none absolute inset-x-0 z-[5] h-0.5 bg-cherry" style={{top: ((nowMin - START_HOUR * 60) / 60) * HOUR_PX}} />
                  ) : null}
                  {offRanges(b.id).map((r) => (
                    <div
                      key={`off-${r.id}`}
                      className="pointer-events-none absolute inset-x-0 z-[4] flex items-start justify-center overflow-hidden border-y-2 border-cherry/40 bg-[repeating-linear-gradient(45deg,rgba(214,46,46,0.08)_0_8px,rgba(255,255,255,0.6)_8px_16px)] pt-2"
                      style={{top: ((r.from - START_HOUR * 60) / 60) * HOUR_PX, height: ((r.to - r.from) / 60) * HOUR_PX}}
                    >
                      <span className="rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold text-cherry-dark shadow-sm">Ishlamaydi · {r.reason ?? '—'}</span>
                    </div>
                  ))}
                  {items.map((a) => {
                    const top = ((toMin(a.time) - START_HOUR * 60) / 60) * HOUR_PX;
                    const height = Math.max(30, ((toMin(a.endTime) - toMin(a.time)) / 60) * HOUR_PX - 3);
                    const compact = height < COMPACT_PX;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setSelected(a)}
                        title={`${a.time}–${a.endTime} · ${a.clientName} · ${a.serviceName.uz}`}
                        className={cn(
                          'absolute inset-x-1 z-[6] overflow-hidden rounded-lg border-l-4 px-2 text-left text-xs leading-tight shadow-sm transition hover:shadow-md',
                          compact ? 'flex items-center gap-1.5 py-0.5' : 'py-1.5',
                          BLOCK_STYLE[a.status],
                        )}
                        style={{top, height}}
                      >
                        {compact ? (
                          <>
                            <span className="shrink-0 font-bold">{a.time}</span>
                            <span className="truncate font-semibold">{a.clientName}</span>
                            <span className="hidden truncate opacity-70 sm:inline">· {a.serviceName.uz}</span>
                          </>
                        ) : (
                          <>
                            <p className="font-bold">
                              {a.time}–{a.endTime}
                            </p>
                            <p className="truncate font-semibold">{a.clientName}</p>
                            <p className="truncate opacity-70">{a.serviceName.uz}</p>
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `Zapis #${selected.id}` : ''}>
        {selected ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold">
                {selected.time}–{selected.endTime}
              </p>
              <StatusBadge status={selected.status} />
            </div>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="opacity-60">Mijoz</dt>
                <dd className="font-semibold">{selected.clientName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="opacity-60">Telefon</dt>
                <dd>
                  <a href={`tel:${selected.clientPhone}`} className="font-semibold text-cherry">
                    {selected.clientPhone}
                  </a>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="opacity-60">Xizmat</dt>
                <dd className="font-semibold">{selected.serviceName.uz}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="opacity-60">Usta</dt>
                <dd className="font-semibold">{selected.barberName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="opacity-60">Narx</dt>
                <dd className="font-semibold">{money(selected.price)}</dd>
              </div>
              {selected.comment ? <p className="rounded-xl bg-cream-dark p-3 italic">“{selected.comment}”</p> : null}
            </dl>
            <div>
              <p className="mb-2 text-xs font-bold tracking-wider uppercase opacity-60">Holatni o'zgartirish</p>
              <div className="flex flex-wrap gap-2">
                {STATUSES.filter((s) => s !== selected.status).map((s) => (
                  <Btn key={s} variant={s === 'Cancelled' || s === 'NoShow' ? 'danger' : 'outline'} disabled={setStatus.isPending} onClick={() => setStatus.mutate({id: selected.id, s})}>
                    {STATUS_LABEL[s]}
                  </Btn>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      {newAt ? (
        <NewAppointmentModal
          key={`${date}-${newAt.time}-${newAt.barberId}`}
          open
          onClose={() => setNewAt(null)}
          fixedBarberId={isAdmin ? null : (user?.barberId ?? null)}
          initial={{date, time: newAt.time, barberId: newAt.barberId}}
        />
      ) : null}
    </>
  );
}
