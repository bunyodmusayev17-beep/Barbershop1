import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {useMemo, useState} from 'react';
import {adminApi, STATUSES, type Appointment, type AppointmentStatus} from '../../api/admin';
import {publicApi} from '../../api/client';
import {useAuth} from '../../auth/AuthContext';
import {Btn, Empty, errorText, Field, Input, Modal, PageHeader, Panel, Select, STATUS_LABEL, StatusBadge, Textarea, money, useToast} from '../../components/admin/kit';
import {Spinner} from '../../components/ui';
import {useSite} from '../../hooks/useSite';
import {cn} from '../../lib/cn';
import {addDays, todayIso} from '../../lib/dates';
import {formatLocalPhone, isValidLocalPhone} from '../../lib/phone';

const RANGES = [
  {key: 'today', label: 'Bugun'},
  {key: 'tomorrow', label: 'Ertaga'},
  {key: 'week', label: '7 kun'},
  {key: 'month', label: '30 kun'},
  {key: 'past', label: "O'tgan 30 kun"},
] as const;
type RangeKey = (typeof RANGES)[number]['key'];

function rangeDates(key: RangeKey) {
  const t = todayIso();
  switch (key) {
    case 'today':
      return {from: t, to: t};
    case 'tomorrow':
      return {from: addDays(t, 1), to: addDays(t, 1)};
    case 'week':
      return {from: t, to: addDays(t, 6)};
    case 'month':
      return {from: t, to: addDays(t, 29)};
    case 'past':
      return {from: addDays(t, -30), to: addDays(t, -1)};
  }
}

/** Keyingi mantiqiy holatlar — tezkor tugmalar uchun */
const QUICK: Partial<Record<AppointmentStatus, AppointmentStatus[]>> = {
  Pending: ['Confirmed', 'Cancelled'],
  Confirmed: ['Completed', 'NoShow', 'Cancelled'],
};

export default function AppointmentsView() {
  const {user} = useAuth();
  const isAdmin = user?.role === 'Admin';
  const site = useSite();
  const qc = useQueryClient();
  const toast = useToast();

  const [range, setRange] = useState<RangeKey>('week');
  const [barberId, setBarberId] = useState<number | null>(null);
  const [status, setStatus] = useState<AppointmentStatus | ''>('');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  const {from, to} = rangeDates(range);
  const query = useQuery({
    queryKey: ['appointments', from, to, barberId, status, search],
    queryFn: () => adminApi.appointments({from, to, barberId, status, search: search.trim()}),
  });

  const mutate = useMutation({
    mutationFn: ({id, s}: {id: number; s: AppointmentStatus}) => adminApi.setStatus(id, s),
    onSuccess: (a) => {
      toast(`#${a.id}: ${STATUS_LABEL[a.status]}`);
      qc.invalidateQueries({queryKey: ['appointments']});
      qc.invalidateQueries({queryKey: ['stats']});
    },
    onError: (e) => toast(errorText(e), 'error'),
  });

  const grouped = useMemo(() => {
    const m = new Map<string, Appointment[]>();
    for (const a of query.data ?? []) m.set(a.date, [...(m.get(a.date) ?? []), a]);
    return [...m.entries()];
  }, [query.data]);

  const total = (query.data ?? []).filter((a) => a.status !== 'Cancelled' && a.status !== 'NoShow').reduce((s, a) => s + a.price, 0);

  return (
    <>
      <PageHeader
        title={isAdmin ? 'Zapislar' : 'Mening zapislarim'}
        sub={query.data ? `${query.data.length} ta zapis · ${money(total)}` : undefined}
        actions={<Btn onClick={() => setCreating(true)}>+ Yangi zapis</Btn>}
      />

      <Panel className="mb-5">
        <div className="flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              className={cn('rounded-full border-2 px-3 py-1.5 text-xs font-bold tracking-wider uppercase', range === r.key ? 'border-navy bg-navy text-cream' : 'border-navy/20 hover:border-navy')}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {isAdmin ? (
            <Select value={barberId ?? ''} onChange={(e) => setBarberId(e.target.value ? Number(e.target.value) : null)} aria-label="Usta">
              <option value="">Barcha ustalar</option>
              {site.data?.barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          ) : null}
          <Select value={status} onChange={(e) => setStatus(e.target.value as AppointmentStatus | '')} aria-label="Holat">
            <option value="">Barcha holatlar</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ism yoki telefon bo'yicha qidirish" />
        </div>
      </Panel>

      {query.isLoading ? (
        <Spinner className="h-8 w-8" />
      ) : grouped.length === 0 ? (
        <Empty>Bu davrda zapis topilmadi</Empty>
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, items]) => (
            <div key={date}>
              <h3 className="mb-2 text-sm font-bold tracking-[0.2em] uppercase text-navy/70">
                {date === todayIso() ? 'Bugun · ' : ''}
                {date}
              </h3>
              <div className="grid gap-2">
                {items.map((a) => (
                  <div key={a.id} className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border-2 bg-white p-4', a.status === 'Cancelled' ? 'border-zinc-200 opacity-60' : 'border-navy/15')}>
                    <div className="w-24">
                      <p className="text-lg font-bold">{a.time}</p>
                      <p className="text-xs opacity-60">{a.endTime} gacha</p>
                    </div>
                    <div className="min-w-40 flex-1">
                      <p className="font-bold">{a.clientName}</p>
                      <a href={`tel:${a.clientPhone}`} className="text-sm text-cherry hover:underline">
                        {a.clientPhone}
                      </a>
                      {a.comment ? <p className="mt-1 text-xs italic opacity-70">“{a.comment}”</p> : null}
                    </div>
                    <div className="min-w-36">
                      <p className="text-sm font-semibold">{a.serviceName.uz}</p>
                      <p className="text-xs opacity-60">
                        {isAdmin ? `${a.barberName} · ` : ''}
                        {money(a.price)}
                      </p>
                    </div>
                    <StatusBadge status={a.status} />
                    <div className="flex flex-wrap gap-1.5">
                      {(QUICK[a.status] ?? []).map((s) => (
                        <Btn key={s} variant={s === 'Cancelled' || s === 'NoShow' ? 'danger' : 'outline'} className="!px-3 !py-1.5 !text-[10px]" disabled={mutate.isPending} onClick={() => mutate.mutate({id: a.id, s})}>
                          {STATUS_LABEL[s]}
                        </Btn>
                      ))}
                      <Select
                        aria-label="Holatni o'zgartirish"
                        className="!w-auto !py-1 !text-xs"
                        value=""
                        onChange={(e) => e.target.value && mutate.mutate({id: a.id, s: e.target.value as AppointmentStatus})}
                      >
                        <option value="">…</option>
                        {STATUSES.filter((s) => s !== a.status).map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <NewAppointmentModal open={creating} onClose={() => setCreating(false)} fixedBarberId={isAdmin ? null : (user?.barberId ?? null)} />
    </>
  );
}

export function NewAppointmentModal({open, onClose, fixedBarberId, initial}: {open: boolean; onClose: () => void; fixedBarberId: number | null; initial?: {date?: string; time?: string; barberId?: number}}) {
  const site = useSite();
  const qc = useQueryClient();
  const toast = useToast();
  const services = site.data?.services ?? [];
  const barbers = site.data?.barbers ?? [];

  const [form, setForm] = useState({
    serviceId: services[0]?.id ?? 0,
    barberId: fixedBarberId ?? initial?.barberId ?? barbers[0]?.id ?? 0,
    date: initial?.date ?? todayIso(),
    time: initial?.time ?? '',
    name: '',
    phone: '',
    comment: '',
  });
  const set = (p: Partial<typeof form>) => setForm((f) => ({...f, ...p}));
  const serviceId = form.serviceId || services[0]?.id || 0;
  const barberId = form.barberId || barbers[0]?.id || 0;

  const slots = useQuery({
    queryKey: ['slots', serviceId, barberId, form.date],
    queryFn: () => publicApi.slots(serviceId, form.date, barberId),
    enabled: open && !!serviceId && !!barberId,
  });

  const create = useMutation({
    mutationFn: () =>
      adminApi.createAppointment({
        serviceId,
        barberId,
        date: form.date,
        time: form.time,
        clientName: form.name.trim(),
        clientPhone: `+998${form.phone.replace(/\D/g, '')}`,
        comment: form.comment.trim() || undefined,
      }),
    onSuccess: (a) => {
      toast(`Zapis #${a.id} qo'shildi`);
      qc.invalidateQueries({queryKey: ['appointments']});
      qc.invalidateQueries({queryKey: ['stats']});
      qc.invalidateQueries({queryKey: ['slots']});
      set({name: '', phone: '', comment: '', time: ''});
      onClose();
    },
    onError: (e) => toast(errorText(e), 'error'),
  });

  const valid = form.name.trim().length >= 2 && isValidLocalPhone(form.phone) && /^\d{2}:\d{2}$/.test(form.time);
  const service = services.find((s) => s.id === serviceId);

  return (
    <Modal open={open} onClose={onClose} title="Yangi zapis">
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) create.mutate();
        }}
      >
        <Field label="Xizmat">
          <Select value={serviceId} onChange={(e) => set({serviceId: Number(e.target.value), time: ''})}>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name.uz} — {money(s.price)} · {s.durationMinutes} daq
              </option>
            ))}
          </Select>
        </Field>
        {fixedBarberId ? null : (
          <Field label="Usta">
            <Select value={barberId} onChange={(e) => set({barberId: Number(e.target.value), time: ''})}>
              {barbers
                .filter((b) => !service || service.barberIds.includes(b.id))
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
            </Select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sana">
            <Input type="date" value={form.date} onChange={(e) => set({date: e.target.value, time: ''})} required />
          </Field>
          <Field label="Vaqt" hint="Bo'sh vaqtni tanlang yoki o'zingiz yozing">
            <Input type="time" value={form.time} onChange={(e) => set({time: e.target.value})} step={300} required />
          </Field>
        </div>
        <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
          {slots.isLoading ? <Spinner /> : null}
          {slots.data?.slots.map((s) => (
            <button
              key={s.time}
              type="button"
              onClick={() => set({time: s.time})}
              className={cn('rounded-lg border-2 px-2 py-1 text-xs font-bold', form.time === s.time ? 'border-cherry bg-cherry text-white' : 'border-navy/20 hover:border-navy')}
            >
              {s.time}
            </button>
          ))}
          {slots.data && !slots.data.slots.length ? <p className="text-xs opacity-60">Bu kunda onlayn bo'sh vaqt yo'q — vaqtni qo'lda kiriting</p> : null}
        </div>
        <Field label="Mijoz ismi">
          <Input value={form.name} onChange={(e) => set({name: e.target.value})} maxLength={100} required />
        </Field>
        <Field label="Telefon">
          <div className="flex">
            <span className="flex items-center rounded-l-xl border-2 border-r-0 border-navy/25 bg-cream-dark px-3 text-sm font-bold">+998</span>
            <Input className="rounded-l-none" value={form.phone} onChange={(e) => set({phone: formatLocalPhone(e.target.value)})} placeholder="90 123 45 67" inputMode="tel" required />
          </div>
        </Field>
        <Field label="Izoh">
          <Textarea value={form.comment} onChange={(e) => set({comment: e.target.value})} maxLength={500} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Btn type="button" variant="ghost" onClick={onClose}>
            Bekor
          </Btn>
          <Btn type="submit" disabled={!valid || create.isPending}>
            {create.isPending ? <Spinner /> : 'Saqlash'}
          </Btn>
        </div>
      </form>
    </Modal>
  );
}
