import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';
import {adminApi, timeOffApi, type Appointment, type StaffTimeOff} from '../../api/admin';
import {useAuth} from '../../auth/AuthContext';
import {Btn, Empty, errorText, Field, Input, Modal, PageHeader, Panel, Select, StatusBadge, useToast} from '../../components/admin/kit';
import {Spinner} from '../../components/ui';
import {useSite} from '../../hooks/useSite';
import {cn} from '../../lib/cn';
import {addDays, parts, todayIso} from '../../lib/dates';

const REASONS = ['Kasal', 'Shaxsiy ish', "Ta'til", 'Boshqa'];
const DAY_NAMES = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];

/** "2026-10-13T00:00" → "13-oktabr (Seshanba) 00:00" ko'rinishiga yaqin qisqa format */
function fmt(dt: string) {
  const [d, t] = dt.split('T');
  const p = parts(d);
  return `${d} (${DAY_NAMES[p.weekday]}) ${t}`;
}

/** Butun kunlik oraliqmi: 00:00 dan 00:00 gacha */
const isWholeDays = (t: StaffTimeOff) => t.from.endsWith('T00:00') && t.to.endsWith('T00:00');

function describe(t: StaffTimeOff) {
  if (isWholeDays(t)) {
    const fromDay = t.from.slice(0, 10);
    const lastDay = addDays(t.to.slice(0, 10), -1);
    return fromDay === lastDay ? `${fmt(t.from).slice(0, -6)} — butun kun` : `${fromDay} → ${lastDay} — butun kunlar`;
  }
  return `${fmt(t.from)} → ${t.to.slice(11)}${t.to.slice(0, 10) !== t.from.slice(0, 10) ? ` (${t.to.slice(0, 10)})` : ''}`;
}

export default function TimeOffPage() {
  const {user} = useAuth();
  const isAdmin = user?.role === 'Admin';
  const site = useSite();
  const qc = useQueryClient();
  const toast = useToast();
  const today = todayIso();

  const [barberId, setBarberId] = useState<number | null>(null);
  const [mode, setMode] = useState<'days' | 'hours'>('days');
  const [form, setForm] = useState({fromDate: today, toDate: today, date: today, fromTime: '11:00', toTime: '15:00'});
  const [reason, setReason] = useState('Kasal');
  const [otherReason, setOtherReason] = useState('');
  const [conflicts, setConflicts] = useState<Appointment[] | null>(null);

  const effectiveBarber = isAdmin ? (barberId ?? site.data?.barbers[0]?.id ?? null) : (user?.barberId ?? null);

  const list = useQuery({
    queryKey: ['timeoffs', isAdmin ? effectiveBarber : 'own'],
    queryFn: () => timeOffApi.list({from: today, barberId: isAdmin ? effectiveBarber : null}),
    enabled: !isAdmin || !!effectiveBarber,
  });

  const refresh = () => {
    qc.invalidateQueries({queryKey: ['timeoffs']});
    qc.invalidateQueries({queryKey: ['slots']});
    qc.invalidateQueries({queryKey: ['admin-barbers']});
  };

  const create = useMutation({
    mutationFn: (t: {from: string; to: string}) =>
      timeOffApi.create({barberId: isAdmin ? effectiveBarber : null, ...t, reason: reason === 'Boshqa' ? otherReason.trim() || 'Boshqa' : reason}),
    onSuccess: (r) => {
      toast('Belgilandi — bu vaqtga onlayn zapis yopildi');
      refresh();
      if (r.conflicts.length) setConflicts(r.conflicts);
    },
    onError: (e) => toast(errorText(e), 'error'),
  });

  const remove = useMutation({
    mutationFn: (id: number) => timeOffApi.remove(id),
    onSuccess: () => {
      toast("O'chirildi — bu vaqtga yana zapis qabul qilinadi");
      refresh();
    },
    onError: (e) => toast(errorText(e), 'error'),
  });

  const wholeDays = (from: string, to: string) => create.mutate({from: `${from}T00:00`, to: `${addDays(to, 1)}T00:00`});

  const submit = () => {
    if (mode === 'days') {
      if (form.toDate < form.fromDate) return toast("Tugash sanasi boshlanishdan oldin bo'lmasin", 'error');
      wholeDays(form.fromDate, form.toDate);
    } else {
      if (form.toTime <= form.fromTime) return toast("Tugash vaqti boshlanishdan keyin bo'lsin", 'error');
      create.mutate({from: `${form.date}T${form.fromTime}`, to: `${form.date}T${form.toTime}`});
    }
  };

  return (
    <>
      <PageHeader title="Ishlamayman" sub="Kasal bo'lsangiz yoki ishlay olmasangiz — vaqtni yoping. Onlayn zapis shu zahoti to'xtaydi." />

      {isAdmin ? (
        <Panel className="mb-5">
          <Field label="Usta">
            <Select value={effectiveBarber ?? ''} onChange={(e) => setBarberId(Number(e.target.value))}>
              {site.data?.barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
        </Panel>
      ) : null}

      <Panel title="Sabab" className="mb-5">
        <div className="flex flex-wrap gap-2">
          {REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={cn('rounded-full border-2 px-4 py-2 text-sm font-semibold', reason === r ? 'border-navy bg-navy text-cream' : 'border-navy/20 hover:border-navy')}
            >
              {r}
            </button>
          ))}
        </div>
        {reason === 'Boshqa' ? <Input className="mt-3" value={otherReason} onChange={(e) => setOtherReason(e.target.value)} placeholder="Sababini yozing" maxLength={200} /> : null}
      </Panel>

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        {[
          {day: today, word: 'Bugun'},
          {day: addDays(today, 1), word: 'Ertaga'},
        ].map(({day, word}) => (
          <DayToggle
            key={day}
            day={day}
            word={word}
            timeOffs={list.data ?? []}
            busy={create.isPending || remove.isPending || list.isFetching}
            onClose={() => wholeDays(day, day)}
            onOpen={(t) => remove.mutate(t.id)}
          />
        ))}
      </div>

      <Panel title="Boshqa vaqt" className="mb-6">
        <div className="mb-4 inline-flex rounded-full border-2 border-navy p-0.5 text-xs font-bold">
          {(['days', 'hours'] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={cn('rounded-full px-4 py-1.5 uppercase tracking-wider', mode === m ? 'bg-navy text-cream' : 'text-navy')}>
              {m === 'days' ? 'Bir necha kun' : 'Soatlar'}
            </button>
          ))}
        </div>
        {mode === 'days' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Qaysi kundan">
              <Input type="date" min={today} value={form.fromDate} onChange={(e) => setForm({...form, fromDate: e.target.value, toDate: e.target.value > form.toDate ? e.target.value : form.toDate})} />
            </Field>
            <Field label="Qaysi kungacha (shu kun ham)">
              <Input type="date" min={form.fromDate} value={form.toDate} onChange={(e) => setForm({...form, toDate: e.target.value})} />
            </Field>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Sana">
              <Input type="date" min={today} value={form.date} onChange={(e) => setForm({...form, date: e.target.value})} />
            </Field>
            <Field label="Soat nechadan">
              <Input type="time" step={900} value={form.fromTime} onChange={(e) => setForm({...form, fromTime: e.target.value})} />
            </Field>
            <Field label="Soat nechagacha">
              <Input type="time" step={900} value={form.toTime} onChange={(e) => setForm({...form, toTime: e.target.value})} />
            </Field>
          </div>
        )}
        <Btn className="mt-4" onClick={submit} disabled={create.isPending}>
          {create.isPending ? <Spinner /> : 'Vaqtni yopish'}
        </Btn>
      </Panel>

      <Panel title="Belgilangan vaqtlar">
        {list.isLoading ? (
          <Spinner />
        ) : !list.data?.length ? (
          <Empty>Hozircha belgilangan dam olish yoki kasallik yo'q</Empty>
        ) : (
          <ul className="divide-y divide-navy/10">
            {list.data.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold">{describe(t)}</p>
                  <p className="text-xs opacity-60">
                    {isAdmin ? `${t.barberName} · ` : ''}
                    {t.reason ?? '—'}
                  </p>
                </div>
                <Btn variant="outline" className="!px-3 !py-1.5" disabled={remove.isPending} onClick={() => confirm('Bu vaqtni qayta ochasizmi?') && remove.mutate(t.id)}>
                  Qayta ochish
                </Btn>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <ConflictsModal items={conflicts} onClose={() => setConflicts(null)} />
    </>
  );
}

/**
 * Kun almashtirgichi: kun ochiq bo'lsa — qizil "ishlamayman" (bosilsa yopiladi),
 * yopiq bo'lsa — yashil "ishlayman" (bosilsa qayta ochiladi, onlayn zapis yana ishlaydi).
 */
function DayToggle({day, word, timeOffs, busy, onClose, onOpen}: {
  day: string;
  word: string;
  timeOffs: StaffTimeOff[];
  busy: boolean;
  onClose: () => void;
  onOpen: (t: StaffTimeOff) => void;
}) {
  const dayStart = `${day}T00:00`;
  const dayEnd = `${addDays(day, 1)}T00:00`;
  // ISO mahalliy vaqt satrlari leksikografik tartibda solishtiriladi
  const covering = timeOffs.find((t) => t.from <= dayStart && t.to >= dayEnd);
  const partial = !covering ? timeOffs.filter((t) => t.from < dayEnd && t.to > dayStart) : [];
  const closed = !!covering;
  const multiDay = covering && (covering.from < dayStart || covering.to > dayEnd);

  const click = () => {
    if (!closed) return onClose();
    if (multiDay && !confirm(`Bu kun ko'p kunlik oraliq ichida (${describe(covering!)}). Butun oraliqni bekor qilib, ishga qaytasizmi?`)) return;
    onOpen(covering!);
  };

  return (
    <button
      type="button"
      disabled={busy}
      onClick={click}
      aria-pressed={closed}
      className={cn(
        'relative overflow-hidden rounded-2xl border-2 p-5 text-left text-white shadow-sm transition-colors duration-300 disabled:opacity-60',
        closed ? 'border-emerald-600 bg-emerald-600 hover:bg-emerald-700' : 'border-cherry bg-cherry hover:bg-cherry-dark',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-2xl font-bold">{closed ? `${word} ishlayman` : `${word} ishlamayman`}</p>
          <p className="mt-1 text-sm opacity-90">
            {closed
              ? `${day} — yopiq${covering?.reason ? ` (${covering.reason})` : ''}. Bosing — kun qayta ochiladi`
              : partial.length
                ? `${day} — qisman yopiq (${partial.map((p) => `${p.from.slice(11)}–${p.to.slice(11)}`).join(', ')}). Bosing — butun kun yopiladi`
                : `${day} — bosing, butun kun yopiladi`}
          </p>
        </div>
        <span
          aria-hidden
          className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-xl transition-transform duration-300', closed && 'rotate-[360deg]')}
        >
          {busy ? <Spinner className="h-5 w-5" /> : closed ? '✓' : '✕'}
        </span>
      </div>
    </button>
  );
}

/** Yopilgan vaqtga to'g'ri kelib qolgan zapislar: qo'ng'iroq qilish yoki bekor qilish */
function ConflictsModal({items, onClose}: {items: Appointment[] | null; onClose: () => void}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [cancelled, setCancelled] = useState<number[]>([]);
  const cancel = useMutation({
    mutationFn: async (ids: number[]) => {
      for (const id of ids) await adminApi.setStatus(id, 'Cancelled');
      return ids;
    },
    onSuccess: (ids) => {
      setCancelled((c) => [...c, ...ids]);
      toast(`${ids.length} ta zapis bekor qilindi`);
      qc.invalidateQueries({queryKey: ['appointments']});
      qc.invalidateQueries({queryKey: ['stats']});
    },
    onError: (e) => toast(errorText(e), 'error'),
  });

  const open = items ?? [];
  const remaining = open.filter((a) => !cancelled.includes(a.id));
  return (
    <Modal open={!!items} onClose={onClose} title="Diqqat: zapislar bor">
      <p className="mb-4 text-sm">
        Yopilgan vaqtda <b>{open.length} ta</b> zapis bor. Mijozlarga qo'ng'iroq qilib, boshqa vaqtga ko'chiring yoki bekor qiling.
      </p>
      <ul className="mb-4 divide-y divide-navy/10 rounded-2xl border-2 border-navy/10 bg-white">
        {open.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <p className="font-bold">
                {a.date} {a.time} · {a.clientName}
              </p>
              <a href={`tel:${a.clientPhone}`} className="text-sm font-semibold text-cherry">
                📞 {a.clientPhone}
              </a>
            </div>
            {cancelled.includes(a.id) ? (
              <StatusBadge status="Cancelled" />
            ) : (
              <Btn variant="danger" className="!px-3 !py-1.5" disabled={cancel.isPending} onClick={() => cancel.mutate([a.id])}>
                Bekor qilish
              </Btn>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap justify-between gap-2">
        {remaining.length > 1 ? (
          <Btn variant="danger" disabled={cancel.isPending} onClick={() => confirm(`${remaining.length} ta zapisni bekor qilasizmi?`) && cancel.mutate(remaining.map((a) => a.id))}>
            Hammasini bekor qilish
          </Btn>
        ) : (
          <span />
        )}
        <Btn onClick={onClose}>Tushunarli</Btn>
      </div>
    </Modal>
  );
}
