import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';
import {adminApi, type UserAdmin} from '../../api/admin';
import {useAuth} from '../../auth/AuthContext';
import {Btn, errorText, Field, Input, Modal, PageHeader, Panel, Select, Toggle, useToast} from '../../components/admin/kit';
import {Spinner} from '../../components/ui';
import {cn} from '../../lib/cn';

type Form = {id: number | null; login: string; email: string; role: 'Admin' | 'Barber'; barberId: number | null; isActive: boolean; password: string; telegram: string; telegramLinked: boolean};

export default function UsersPage() {
  const {user: me} = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const users = useQuery({queryKey: ['admin-users'], queryFn: adminApi.users});
  const barbers = useQuery({queryKey: ['admin-barbers'], queryFn: adminApi.barbers});
  const [form, setForm] = useState<Form | null>(null);

  const save = useMutation({
    mutationFn: (f: Form) =>
      f.id
        ? adminApi.updateUser(f.id, {email: f.email || null, role: f.role, barberId: f.role === 'Barber' ? f.barberId : null, isActive: f.isActive, newPassword: f.password || undefined, telegram: f.telegram.trim() || null})
        : adminApi.createUser({login: f.login, email: f.email || undefined, password: f.password, role: f.role, barberId: f.role === 'Barber' ? f.barberId : null, telegram: f.telegram.trim() || null}),
    onSuccess: () => {
      toast('Saqlandi');
      setForm(null);
      qc.invalidateQueries({queryKey: ['admin-users']});
    },
    onError: (e) => toast(errorText(e), 'error'),
  });
  const remove = useMutation({
    mutationFn: (id: number) => adminApi.deleteUser(id),
    onSuccess: () => {
      toast("O'chirildi");
      setForm(null);
      qc.invalidateQueries({queryKey: ['admin-users']});
    },
    onError: (e) => toast(errorText(e), 'error'),
  });

  const open = (u?: UserAdmin) =>
    setForm(
      u
        ? {id: u.id, login: u.login, email: u.email ?? '', role: u.role, barberId: u.barberId, isActive: u.isActive, password: '', telegram: u.telegram ?? '', telegramLinked: u.telegramLinked}
        : {id: null, login: '', email: '', role: 'Barber', barberId: barbers.data?.[0]?.id ?? null, isActive: true, password: '', telegram: '', telegramLinked: false},
    );

  const isSelf = form?.id === me?.id;
  const passwordOk = form ? (form.id ? !form.password || form.password.length >= 8 : form.password.length >= 8) : false;

  return (
    <>
      <PageHeader title="Foydalanuvchilar" sub="Admin va usta akkauntlari" actions={<Btn onClick={() => open()}>+ Akkaunt qo'shish</Btn>} />
      <Panel>
        {users.isLoading ? (
          <Spinner className="h-8 w-8" />
        ) : (
          <ul className="divide-y divide-navy/10">
            {users.data?.map((u) => (
              <li key={u.id}>
                <button type="button" onClick={() => open(u)} className={cn('flex w-full flex-wrap items-center justify-between gap-3 py-3 text-left hover:bg-cream-dark/50', !u.isActive && 'opacity-50')}>
                  <div>
                    <p className="font-bold">
                      {u.login}
                      {u.id === me?.id ? <span className="ml-2 text-xs font-normal opacity-60">(siz)</span> : null}
                    </p>
                    <p className="text-xs opacity-60">{u.email ?? '—'}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {u.barberName ? <span className="rounded-full border border-navy/20 px-2 py-0.5">{u.barberName}</span> : null}
                    <span className={cn('rounded-full px-2.5 py-0.5 font-bold', u.role === 'Admin' ? 'bg-cherry text-white' : 'bg-navy text-cream')}>{u.role === 'Admin' ? 'Admin' : 'Usta'}</span>
                    {u.telegram ? (
                      <span className={cn('rounded-full border px-2 py-0.5', u.telegramLinked ? 'border-emerald-600/40 text-emerald-700' : 'border-navy/20 opacity-70')} title={u.telegramLinked ? 'Telegram ulangan' : 'Botga /start yozishi kutilmoqda'}>
                        {u.telegramLinked ? '✓ ' : '… '}
                        {u.telegram}
                      </span>
                    ) : null}
                    {!u.isActive ? <span className="rounded-full bg-zinc-200 px-2 py-0.5">Bloklangan</span> : null}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? `Akkaunt: ${form.login}` : 'Yangi akkaunt'}>
        {form ? (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (passwordOk) save.mutate(form);
            }}
          >
            <Field label="Login" hint={form.id ? undefined : "Lotin harflari, raqamlar, . _ - (3–64)"}>
              <Input value={form.login} onChange={(e) => setForm({...form, login: e.target.value})} disabled={!!form.id} pattern="[a-zA-Z0-9_.\-]{3,64}" autoCapitalize="none" required />
            </Field>
            <Field label="Email (ixtiyoriy)">
              <Input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Rol">
                <Select value={form.role} onChange={(e) => setForm({...form, role: e.target.value as Form['role']})} disabled={isSelf}>
                  <option value="Barber">Usta</option>
                  <option value="Admin">Admin</option>
                </Select>
              </Field>
              {form.role === 'Barber' ? (
                <Field label="Qaysi usta">
                  <Select value={form.barberId ?? ''} onChange={(e) => setForm({...form, barberId: Number(e.target.value)})} required>
                    {barbers.data?.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
            </div>
            <Field
              label="Telegram (ixtiyoriy)"
              hint={
                form.telegramLinked
                  ? "✓ Ulangan — yangi zapislar shu Telegram'ga keladi"
                  : "@username yoki raqamli ID. Xodim @NewyorkBarber_bot ga /start yozganda ulanadi"
              }
            >
              <Input value={form.telegram} onChange={(e) => setForm({...form, telegram: e.target.value, telegramLinked: false})} placeholder="@username" autoCapitalize="none" autoComplete="off" />
            </Field>
            <Field label={form.id ? "Yangi parol (o'zgartirmaslik uchun bo'sh qoldiring)" : 'Parol'} hint="Kamida 8 belgi">
              <Input type="password" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} autoComplete="new-password" minLength={form.id && !form.password ? undefined : 8} required={!form.id} />
            </Field>
            {form.id ? <Toggle checked={form.isActive} onChange={(isActive) => !isSelf && setForm({...form, isActive})} label={isSelf ? "Faol (o'zingizni bloklab bo'lmaydi)" : 'Faol (kira oladi)'} /> : null}
            <div className="flex justify-between gap-2 pt-2">
              {form.id && !isSelf ? (
                <Btn type="button" variant="danger" onClick={() => confirm("Akkauntni o'chirasizmi?") && remove.mutate(form.id!)}>
                  O'chirish
                </Btn>
              ) : (
                <span />
              )}
              <Btn type="submit" disabled={!passwordOk || save.isPending}>
                Saqlash
              </Btn>
            </div>
          </form>
        ) : null}
      </Modal>
    </>
  );
}
