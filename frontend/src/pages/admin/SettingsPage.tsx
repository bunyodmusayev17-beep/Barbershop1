import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';
import {adminApi, type Settings} from '../../api/admin';
import {Btn, errorText, Field, Input, LangFields, PageHeader, Panel, useToast} from '../../components/admin/kit';
import {Spinner} from '../../components/ui';

export default function SettingsPage() {
  const settings = useQuery({queryKey: ['admin-settings'], queryFn: adminApi.settings});
  if (settings.isLoading || !settings.data) return <Spinner className="h-8 w-8" />;
  return <SettingsForm initial={settings.data} />;
}

function SettingsForm({initial}: {initial: Settings}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [s, setS] = useState(initial);
  const set = (p: Partial<Settings>) => setS((x) => ({...x, ...p}));

  const save = useMutation({
    mutationFn: () => adminApi.updateSettings(s),
    onSuccess: () => {
      toast('Sozlamalar saqlandi');
      qc.invalidateQueries({queryKey: ['admin-settings']});
      qc.invalidateQueries({queryKey: ['site']});
    },
    onError: (e) => toast(errorText(e), 'error'),
  });

  const num = (v: string) => (v === '' ? 0 : Number(v));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <PageHeader
        title="Sozlamalar"
        sub="Sayt ma'lumotlari va onlayn zapis qoidalari"
        actions={
          <Btn type="submit" disabled={save.isPending}>
            {save.isPending ? <Spinner /> : 'Saqlash'}
          </Btn>
        }
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Barbershop">
          <div className="grid gap-4">
            <Field label="Nomi">
              <Input value={s.businessName} onChange={(e) => set({businessName: e.target.value})} required maxLength={100} />
            </Field>
            <LangFields label="Manzil" required value={s.address} onChange={(address) => set({address})} />
            <Field label="Telefon">
              <Input value={s.phone} onChange={(e) => set({phone: e.target.value})} required maxLength={32} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Telegram" hint="username yoki havola">
                <Input value={s.telegram ?? ''} onChange={(e) => set({telegram: e.target.value || null})} />
              </Field>
              <Field label="Instagram" hint="username yoki havola">
                <Input value={s.instagram ?? ''} onChange={(e) => set({instagram: e.target.value || null})} />
              </Field>
            </div>
          </div>
        </Panel>

        <Panel title="Xarita va reyting">
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Kenglik (latitude)">
                <Input type="number" step="0.000001" value={s.latitude} onChange={(e) => set({latitude: num(e.target.value)})} />
              </Field>
              <Field label="Uzunlik (longitude)">
                <Input type="number" step="0.000001" value={s.longitude} onChange={(e) => set({longitude: num(e.target.value)})} />
              </Field>
            </div>
            <p className="-mt-2 text-xs opacity-60">Yandex Xaritada joyni o'ng tugma bilan bosing — koordinatalar chiqadi.</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Reyting (0–5)">
                <Input type="number" min={0} max={5} step={0.1} value={s.rating} onChange={(e) => set({rating: num(e.target.value)})} />
              </Field>
              <Field label="Baholar soni">
                <Input type="number" min={0} value={s.ratingCount} onChange={(e) => set({ratingCount: num(e.target.value)})} />
              </Field>
            </div>
          </div>
        </Panel>

        <Panel title="Onlayn zapis qoidalari" className="xl:col-span-2">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Vaqt qadami, daqiqa" hint="Bo'sh vaqtlar orasidagi qadam (masalan, 15)">
              <Input type="number" min={5} max={120} step={5} value={s.slotStepMinutes} onChange={(e) => set({slotStepMinutes: num(e.target.value)})} />
            </Field>
            <Field label="Kamida qancha oldin, daqiqa" hint="Hozirdan necha daqiqa keyingi vaqtga yozilish mumkin">
              <Input type="number" min={0} max={1440} step={5} value={s.minLeadMinutes} onChange={(e) => set({minLeadMinutes: num(e.target.value)})} />
            </Field>
            <Field label="Necha kun oldinga" hint="Mijoz qancha kun oldinga yozila oladi">
              <Input type="number" min={1} max={90} value={s.bookingHorizonDays} onChange={(e) => set({bookingHorizonDays: num(e.target.value)})} />
            </Field>
          </div>
        </Panel>
      </div>
    </form>
  );
}
