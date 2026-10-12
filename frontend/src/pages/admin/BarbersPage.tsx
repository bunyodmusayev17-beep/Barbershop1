import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {useRef, useState} from 'react';
import {adminApi, type BarberAdmin, type BarberInput, type Hours} from '../../api/admin';
import {Btn, Empty, errorText, Field, Input, LangFields, Modal, PageHeader, Toggle, useToast} from '../../components/admin/kit';
import {Monogram, Spinner} from '../../components/ui';
import {cn} from '../../lib/cn';

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_NAMES = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];

const defaultHours = (): Hours[] => DAY_ORDER.map((day) => ({day, start: '11:00', end: '23:00', isDayOff: false}));

const EMPTY: BarberInput = {
  name: '',
  title: {uz: 'Barber', ru: 'Барбер', en: 'Barber'},
  bio: {uz: '', ru: '', en: ''},
  sortOrder: 0,
  isActive: true,
  serviceIds: [],
  hours: defaultHours(),
};

export default function BarbersPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const barbers = useQuery({queryKey: ['admin-barbers'], queryFn: adminApi.barbers});
  const services = useQuery({queryKey: ['admin-services'], queryFn: adminApi.services});
  const [editing, setEditing] = useState<{id: number | null; data: BarberInput} | null>(null);

  const refresh = () => {
    qc.invalidateQueries({queryKey: ['admin-barbers']});
    qc.invalidateQueries({queryKey: ['admin-services']});
    qc.invalidateQueries({queryKey: ['site']});
  };

  const save = useMutation({
    mutationFn: (e: {id: number | null; data: BarberInput}) => (e.id ? adminApi.updateBarber(e.id, e.data) : adminApi.createBarber(e.data)),
    onSuccess: (b) => {
      toast('Saqlandi');
      // Yangi usta yaratilgach — rasm va ta'til qo'shish uchun tahrirlash rejimida qoladi
      setEditing((cur) => (cur?.id ? null : {id: b.id, data: toInput(b)}));
      refresh();
    },
    onError: (e) => toast(errorText(e), 'error'),
  });

  const remove = useMutation({
    mutationFn: (id: number) => adminApi.deleteBarber(id),
    onSuccess: () => {
      toast("O'chirildi (zapislari bo'lsa — nofaol qilindi)");
      setEditing(null);
      refresh();
    },
    onError: (e) => toast(errorText(e), 'error'),
  });

  const current = editing?.id ? barbers.data?.find((b) => b.id === editing.id) : undefined;
  const setData = (p: Partial<BarberInput>) => editing && setEditing({...editing, data: {...editing.data, ...p}});

  return (
    <>
      <PageHeader title="Ustalar" sub="Profil, xizmatlar, ish jadvali va dam olish kunlari" actions={<Btn onClick={() => setEditing({id: null, data: {...EMPTY, hours: defaultHours(), sortOrder: (barbers.data?.length ?? 0) + 1}})}>+ Usta qo'shish</Btn>} />
      {barbers.isLoading ? (
        <Spinner className="h-8 w-8" />
      ) : !barbers.data?.length ? (
        <Empty>Hali usta yo'q</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {barbers.data.map((b) => (
            <button key={b.id} type="button" onClick={() => setEditing({id: b.id, data: toInput(b)})} className={cn('rounded-2xl border-2 bg-white p-5 text-left transition hover:border-cherry', b.isActive ? 'border-navy/15' : 'border-dashed border-zinc-300 opacity-60')}>
              <div className="flex items-center gap-4">
                {b.photoUrl ? <img src={b.photoUrl} alt="" className="h-16 w-16 rounded-full border-2 border-cherry object-cover" /> : <Monogram name={b.name || '?'} className="h-16 w-16 text-3xl" />}
                <div>
                  <p className="font-deco text-3xl text-navy">{b.name}</p>
                  <p className="text-xs font-bold tracking-widest uppercase text-cherry">{b.title.uz}</p>
                </div>
              </div>
              <p className="mt-3 text-xs opacity-70">
                Dam olish: {b.hours.filter((h) => h.isDayOff).map((h) => DAY_NAMES[h.day]).join(', ') || "yo'q"}
              </p>
              <p className="mt-1 text-xs opacity-70">Xizmatlar: {b.serviceIds.length} ta</p>
              {b.timeOffs.length ? <p className="mt-1 text-xs font-semibold text-cherry">Ta'til/kasallik: {b.timeOffs.length} ta</p> : null}
              {!b.isActive ? <p className="mt-1 text-xs font-bold">Nofaol</p> : null}
            </button>
          ))}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? `${editing.data.name || 'Usta'}` : 'Yangi usta'} wide>
        {editing ? (
          <form
            className="grid gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(editing);
            }}
          >
            {current ? <PhotoEditor barber={current} onChanged={refresh} /> : <p className="rounded-xl bg-cream-dark p-3 text-sm">Rasm va ta'til kunlarini usta saqlangandan keyin qo'shishingiz mumkin.</p>}

            <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
              <Field label="Ism">
                <Input value={editing.data.name} onChange={(e) => setData({name: e.target.value})} maxLength={100} required />
              </Field>
              <Field label="Tartib">
                <Input type="number" value={editing.data.sortOrder} onChange={(e) => setData({sortOrder: Number(e.target.value)})} />
              </Field>
            </div>
            <LangFields label="Lavozim" value={editing.data.title} onChange={(title) => setData({title})} />
            <LangFields label="Bio" multiline value={editing.data.bio} onChange={(bio) => setData({bio})} />

            <div>
              <p className="mb-2 text-xs font-bold tracking-wider uppercase text-navy/70">Bajaradigan xizmatlari</p>
              <div className="flex flex-wrap gap-2">
                {services.data?.map((s) => {
                  const on = editing.data.serviceIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setData({serviceIds: on ? editing.data.serviceIds.filter((x) => x !== s.id) : [...editing.data.serviceIds, s.id]})}
                      className={cn('rounded-full border-2 px-3 py-1.5 text-sm font-semibold', on ? 'border-navy bg-navy text-cream' : 'border-navy/20')}
                    >
                      {on ? '✓ ' : ''}
                      {s.name.uz}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold tracking-wider uppercase text-navy/70">Haftalik ish jadvali</p>
              <div className="divide-y divide-navy/10 rounded-2xl border-2 border-navy/10 bg-white">
                {DAY_ORDER.map((day) => {
                  const h = editing.data.hours.find((x) => x.day === day) ?? {day, start: '11:00', end: '23:00', isDayOff: true};
                  const update = (p: Partial<Hours>) => setData({hours: [...editing.data.hours.filter((x) => x.day !== day), {...h, ...p}]});
                  return (
                    <div key={day} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                      <span className="w-28 text-sm font-semibold">{DAY_NAMES[day]}</span>
                      <Toggle checked={!h.isDayOff} onChange={(v) => update({isDayOff: !v})} label={h.isDayOff ? 'Dam olish' : 'Ishlaydi'} />
                      {!h.isDayOff ? (
                        <div className="ml-auto flex items-center gap-2">
                          <Input type="time" value={h.start} onChange={(e) => update({start: e.target.value})} className="!w-28" />
                          <span>—</span>
                          <Input type="time" value={h.end} onChange={(e) => update({end: e.target.value})} className="!w-28" />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            {current ? <TimeOffEditor barber={current} onChanged={refresh} /> : null}

            <Toggle checked={editing.data.isActive} onChange={(isActive) => setData({isActive})} label="Faol (saytda ko'rinadi va zapis qabul qiladi)" />

            <div className="flex flex-wrap justify-between gap-2 pt-2">
              {editing.id ? (
                <Btn type="button" variant="danger" onClick={() => confirm("Ustani o'chirasizmi?") && remove.mutate(editing.id!)}>
                  O'chirish
                </Btn>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Btn type="button" variant="ghost" onClick={() => setEditing(null)}>
                  Yopish
                </Btn>
                <Btn type="submit" disabled={save.isPending}>
                  {save.isPending ? <Spinner /> : 'Saqlash'}
                </Btn>
              </div>
            </div>
          </form>
        ) : null}
      </Modal>
    </>
  );
}

function toInput(b: BarberAdmin): BarberInput {
  return {name: b.name, title: b.title, bio: b.bio, sortOrder: b.sortOrder, isActive: b.isActive, serviceIds: b.serviceIds, hours: b.hours.length ? b.hours : defaultHours()};
}

function PhotoEditor({barber, onChanged}: {barber: BarberAdmin; onChanged: () => void}) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: (f: File) => adminApi.uploadBarberPhoto(barber.id, f),
    onSuccess: () => {
      toast('Rasm yuklandi');
      onChanged();
    },
    onError: (e) => toast(errorText(e), 'error'),
  });
  const del = useMutation({
    mutationFn: () => adminApi.deleteBarberPhoto(barber.id),
    onSuccess: () => {
      toast("Rasm o'chirildi");
      onChanged();
    },
  });
  return (
    <div className="flex items-center gap-4">
      {barber.photoUrl ? <img src={barber.photoUrl} alt="" className="h-24 w-24 rounded-full border-4 border-cherry object-cover" /> : <Monogram name={barber.name || '?'} className="h-24 w-24 text-5xl" />}
      <div className="flex flex-wrap gap-2">
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />
        <Btn type="button" variant="outline" onClick={() => input.current?.click()} disabled={upload.isPending}>
          {upload.isPending ? <Spinner /> : barber.photoUrl ? 'Rasmni almashtirish' : 'Rasm yuklash'}
        </Btn>
        {barber.photoUrl ? (
          <Btn type="button" variant="danger" onClick={() => del.mutate()}>
            O'chirish
          </Btn>
        ) : null}
        <p className="w-full text-xs opacity-60">JPG, PNG yoki WEBP, 5 MB gacha</p>
      </div>
    </div>
  );
}

function TimeOffEditor({barber, onChanged}: {barber: BarberAdmin; onChanged: () => void}) {
  const toast = useToast();
  const [form, setForm] = useState({from: '', to: '', reason: ''});
  const add = useMutation({
    mutationFn: () => adminApi.addTimeOff(barber.id, {from: form.from, to: form.to, reason: form.reason || undefined}),
    onSuccess: () => {
      toast("Qo'shildi");
      setForm({from: '', to: '', reason: ''});
      onChanged();
    },
    onError: (e) => toast(errorText(e), 'error'),
  });
  const del = useMutation({mutationFn: (id: number) => adminApi.deleteTimeOff(barber.id, id), onSuccess: onChanged});

  return (
    <div>
      <p className="mb-2 text-xs font-bold tracking-wider uppercase text-navy/70">Ta'til, kasallik, band vaqtlar</p>
      {barber.timeOffs.length ? (
        <ul className="mb-3 divide-y divide-navy/10 rounded-2xl border-2 border-navy/10 bg-white">
          {barber.timeOffs.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
              <span>
                {t.from.replace('T', ' ')} → {t.to.replace('T', ' ')}
                {t.reason ? <span className="opacity-60"> · {t.reason}</span> : null}
              </span>
              <button type="button" onClick={() => del.mutate(t.id)} className="text-xs font-bold text-rose-700 hover:underline">
                O'chirish
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <Input type="datetime-local" value={form.from} onChange={(e) => setForm({...form, from: e.target.value})} aria-label="Boshlanishi" />
        <Input type="datetime-local" value={form.to} onChange={(e) => setForm({...form, to: e.target.value})} aria-label="Tugashi" />
        <Input value={form.reason} onChange={(e) => setForm({...form, reason: e.target.value})} placeholder="Sabab (ixtiyoriy)" maxLength={200} />
        <Btn type="button" variant="outline" disabled={!form.from || !form.to || add.isPending} onClick={() => add.mutate()}>
          + Qo'shish
        </Btn>
      </div>
    </div>
  );
}
