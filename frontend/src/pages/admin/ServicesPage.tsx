import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';
import {adminApi, type ServiceAdmin, type ServiceInput} from '../../api/admin';
import {Btn, Empty, errorText, Field, Input, LangFields, Modal, PageHeader, Toggle, money, useToast} from '../../components/admin/kit';
import {Spinner} from '../../components/ui';
import {cn} from '../../lib/cn';

const EMPTY: ServiceInput = {
  name: {uz: '', ru: '', en: ''},
  description: {uz: '', ru: '', en: ''},
  price: 50000,
  durationMinutes: 30,
  sortOrder: 0,
  isActive: true,
  barberIds: [],
};

export default function ServicesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const services = useQuery({queryKey: ['admin-services'], queryFn: adminApi.services});
  const barbers = useQuery({queryKey: ['admin-barbers'], queryFn: adminApi.barbers});
  const [editing, setEditing] = useState<{id: number | null; data: ServiceInput} | null>(null);

  const refresh = () => {
    qc.invalidateQueries({queryKey: ['admin-services']});
    qc.invalidateQueries({queryKey: ['admin-barbers']});
    qc.invalidateQueries({queryKey: ['site']});
  };

  const save = useMutation({
    mutationFn: (e: {id: number | null; data: ServiceInput}) => (e.id ? adminApi.updateService(e.id, e.data) : adminApi.createService(e.data)),
    onSuccess: () => {
      toast('Saqlandi');
      setEditing(null);
      refresh();
    },
    onError: (e) => toast(errorText(e), 'error'),
  });

  const remove = useMutation({
    mutationFn: (id: number) => adminApi.deleteService(id),
    onSuccess: () => {
      toast("O'chirildi (zapislari bo'lsa — nofaol qilindi)");
      setEditing(null);
      refresh();
    },
    onError: (e) => toast(errorText(e), 'error'),
  });

  const open = (s?: ServiceAdmin) =>
    setEditing(
      s
        ? {id: s.id, data: {name: s.name, description: s.description, price: s.price, durationMinutes: s.durationMinutes, sortOrder: s.sortOrder, isActive: s.isActive, barberIds: s.barberIds}}
        : {id: null, data: {...EMPTY, sortOrder: (services.data?.length ?? 0) + 1, barberIds: barbers.data?.map((b) => b.id) ?? []}},
    );

  const barberName = (id: number) => barbers.data?.find((b) => b.id === id)?.name ?? `#${id}`;

  return (
    <>
      <PageHeader title="Xizmatlar" sub="Narxlar va davomiylik saytda darhol yangilanadi" actions={<Btn onClick={() => open()}>+ Xizmat qo'shish</Btn>} />
      {services.isLoading ? (
        <Spinner className="h-8 w-8" />
      ) : !services.data?.length ? (
        <Empty>Hali xizmat yo'q</Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {services.data.map((s) => (
            <button key={s.id} type="button" onClick={() => open(s)} className={cn('rounded-2xl border-2 bg-white p-5 text-left transition hover:border-cherry', s.isActive ? 'border-navy/15' : 'border-dashed border-zinc-300 opacity-60')}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-bold">{s.name.uz}</p>
                  <p className="text-xs opacity-60">
                    {s.name.ru || '—'} · {s.name.en || '—'}
                  </p>
                </div>
                <p className="whitespace-nowrap text-lg font-bold text-cherry">{money(s.price)}</p>
              </div>
              <p className="mt-2 text-sm opacity-70">{s.description.uz}</p>
              <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                <span className="rounded-full bg-cream-dark px-2 py-0.5 font-semibold">⏱ {s.durationMinutes} daq</span>
                {!s.isActive ? <span className="rounded-full bg-zinc-200 px-2 py-0.5 font-semibold">Nofaol</span> : null}
                {s.barberIds.map((id) => (
                  <span key={id} className="rounded-full border border-navy/20 px-2 py-0.5">
                    {barberName(id)}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Xizmatni tahrirlash' : 'Yangi xizmat'} wide>
        {editing ? (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(editing);
            }}
          >
            <LangFields label="Nomi" required value={editing.data.name} onChange={(name) => setEditing({...editing, data: {...editing.data, name}})} />
            <LangFields label="Tavsif" multiline value={editing.data.description} onChange={(description) => setEditing({...editing, data: {...editing.data, description}})} />
            <div className="grid grid-cols-3 gap-3">
              <Field label="Narx, so'm">
                <Input type="number" min={0} step={1000} value={editing.data.price} onChange={(e) => setEditing({...editing, data: {...editing.data, price: Number(e.target.value)}})} required />
              </Field>
              <Field label="Davomiylik, daq">
                <Input type="number" min={5} max={600} step={5} value={editing.data.durationMinutes} onChange={(e) => setEditing({...editing, data: {...editing.data, durationMinutes: Number(e.target.value)}})} required />
              </Field>
              <Field label="Tartib">
                <Input type="number" value={editing.data.sortOrder} onChange={(e) => setEditing({...editing, data: {...editing.data, sortOrder: Number(e.target.value)}})} />
              </Field>
            </div>
            <div>
              <p className="mb-2 text-xs font-bold tracking-wider uppercase text-navy/70">Kim bajaradi</p>
              <div className="flex flex-wrap gap-2">
                {barbers.data?.map((b) => {
                  const on = editing.data.barberIds.includes(b.id);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() =>
                        setEditing({...editing, data: {...editing.data, barberIds: on ? editing.data.barberIds.filter((x) => x !== b.id) : [...editing.data.barberIds, b.id]}})
                      }
                      className={cn('rounded-full border-2 px-3 py-1.5 text-sm font-semibold', on ? 'border-navy bg-navy text-cream' : 'border-navy/20')}
                    >
                      {on ? '✓ ' : ''}
                      {b.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <Toggle checked={editing.data.isActive} onChange={(isActive) => setEditing({...editing, data: {...editing.data, isActive}})} label="Saytda ko'rinadi (faol)" />
            <div className="flex flex-wrap justify-between gap-2 pt-2">
              {editing.id ? (
                <Btn type="button" variant="danger" onClick={() => confirm("Xizmatni o'chirasizmi?") && remove.mutate(editing.id!)}>
                  O'chirish
                </Btn>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Btn type="button" variant="ghost" onClick={() => setEditing(null)}>
                  Bekor
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
