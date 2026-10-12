import {useQuery} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {adminApi} from '../../api/admin';
import {Empty, PageHeader, Panel, StatusBadge, money} from '../../components/admin/kit';
import {Spinner} from '../../components/ui';
import {parts} from '../../lib/dates';

const DAYS = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];

function StatCard({label, value, sub, accent}: {label: string; value: string; sub?: string; accent?: boolean}) {
  return (
    <div className={accent ? 'rounded-2xl bg-navy p-5 text-cream' : 'rounded-2xl border-2 border-navy/15 bg-white p-5'}>
      <p className="text-xs font-bold tracking-[0.2em] uppercase opacity-70">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
      {sub ? <p className="mt-1 text-xs opacity-70">{sub}</p> : null}
    </div>
  );
}

export default function DashboardPage() {
  const {data, isLoading} = useQuery({queryKey: ['stats'], queryFn: adminApi.stats, refetchInterval: 60_000});
  if (isLoading || !data) return <Spinner className="h-8 w-8" />;

  const max = Math.max(1, ...data.last7Days.map((d) => d.count));
  return (
    <>
      <PageHeader title="Boshqaruv" sub="Bugungi holat va oxirgi 7 kun" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard accent label="Bugun zapislar" value={String(data.todayCount)} sub={money(data.todayRevenue)} />
        <StatCard label="Kutilayotgan" value={String(data.upcomingCount)} sub="Kelajakdagi faol zapislar" />
        <StatCard label="7 kunlik daromad" value={money(data.weekRevenue)} sub={`${data.weekCount} ta zapis`} />
        <StatCard label="Kelmaganlar (7 kun)" value={String(data.noShowWeek)} sub="Status: Kelmadi" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Oxirgi 7 kun — zapislar">
          <div className="flex items-end gap-3">
            {data.last7Days.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-xs font-bold">{d.count}</span>
                <div className="flex h-40 w-full items-end">
                  <div
                    className="w-full rounded-t-lg bg-gradient-to-t from-navy to-cherry transition-all"
                    style={{height: Math.max(4, Math.round((d.count / max) * 160))}}
                    title={`${d.count} ta · ${money(d.revenue)}`}
                  />
                </div>
                <span className="text-xs opacity-70">{DAYS[parts(d.date).weekday]}</span>
                <span className="text-[10px] opacity-50">{parts(d.date).day}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Ustalar (7 kun)">
          <ul className="divide-y divide-navy/10">
            {data.barbers.map((b) => (
              <li key={b.barberId} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-bold">{b.name}</p>
                  <p className="text-xs opacity-60">Bugun: {b.todayCount} ta</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{b.weekCount} ta</p>
                  <p className="text-xs opacity-60">{money(b.weekRevenue)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Navbatdagi zapislar" className="mt-6">
        {data.nextUp.length === 0 ? (
          <Empty>Hozircha kelajakdagi zapis yo'q</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs tracking-wider uppercase opacity-60">
                <tr>
                  <th className="py-2">Sana</th>
                  <th>Vaqt</th>
                  <th>Mijoz</th>
                  <th>Xizmat</th>
                  <th>Usta</th>
                  <th>Holat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/10">
                {data.nextUp.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2.5">{a.date}</td>
                    <td className="font-bold">{a.time}</td>
                    <td>
                      {a.clientName}
                      <span className="block text-xs opacity-60">{a.clientPhone}</span>
                    </td>
                    <td>{a.serviceName.uz}</td>
                    <td>{a.barberName}</td>
                    <td>
                      <StatusBadge status={a.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Link to="/admin/appointments" className="mt-4 inline-block text-sm font-bold text-cherry hover:underline">
          Barcha zapislar →
        </Link>
      </Panel>
    </>
  );
}
