import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';
import {adminApi, type ReviewInput} from '../../api/admin';
import {Btn, Empty, errorText, Field, Input, Modal, PageHeader, Textarea, Toggle, useToast} from '../../components/admin/kit';
import {Spinner, Stars} from '../../components/ui';
import {cn} from '../../lib/cn';

const EMPTY: ReviewInput = {authorName: '', rating: 5, text: '', isPublished: true};

export default function ReviewsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const reviews = useQuery({queryKey: ['admin-reviews'], queryFn: adminApi.reviews});
  const [editing, setEditing] = useState<{id: number | null; data: ReviewInput} | null>(null);

  const refresh = () => {
    qc.invalidateQueries({queryKey: ['admin-reviews']});
    qc.invalidateQueries({queryKey: ['site']});
  };
  const save = useMutation({
    mutationFn: (e: {id: number | null; data: ReviewInput}) => (e.id ? adminApi.updateReview(e.id, e.data) : adminApi.createReview(e.data).then(() => undefined)),
    onSuccess: () => {
      toast('Saqlandi');
      setEditing(null);
      refresh();
    },
    onError: (e) => toast(errorText(e), 'error'),
  });
  const remove = useMutation({
    mutationFn: (id: number) => adminApi.deleteReview(id),
    onSuccess: () => {
      toast("O'chirildi");
      setEditing(null);
      refresh();
    },
  });

  return (
    <>
      <PageHeader title="Sharhlar" sub="Mijozlar fikri — saytda chop etilganlari ko'rinadi" actions={<Btn onClick={() => setEditing({id: null, data: EMPTY})}>+ Sharh qo'shish</Btn>} />
      {reviews.isLoading ? (
        <Spinner className="h-8 w-8" />
      ) : !reviews.data?.length ? (
        <Empty>Hali sharh yo'q</Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {reviews.data.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setEditing({id: r.id, data: {authorName: r.authorName, rating: r.rating, text: r.text, isPublished: r.isPublished}})}
              className={cn('rounded-2xl border-2 bg-white p-5 text-left hover:border-cherry', r.isPublished ? 'border-navy/15' : 'border-dashed border-zinc-300 opacity-60')}
            >
              <div className="flex items-center justify-between">
                <p className="font-bold">{r.authorName}</p>
                <Stars value={r.rating} />
              </div>
              <p className="mt-2 text-sm">{r.text}</p>
              <p className="mt-2 text-xs opacity-60">
                {new Date(r.createdAt).toLocaleDateString('ru-RU')} · {r.isPublished ? 'Chop etilgan' : 'Yashirin'}
              </p>
            </button>
          ))}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Sharhni tahrirlash' : 'Yangi sharh'}>
        {editing ? (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(editing);
            }}
          >
            <Field label="Muallif">
              <Input value={editing.data.authorName} onChange={(e) => setEditing({...editing, data: {...editing.data, authorName: e.target.value}})} maxLength={100} required />
            </Field>
            <div>
              <p className="mb-1 text-xs font-bold tracking-wider uppercase text-navy/70">Baho</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setEditing({...editing, data: {...editing.data, rating: n}})} className={cn('text-3xl', n <= editing.data.rating ? 'text-cherry' : 'text-zinc-300')} aria-label={`${n} yulduz`}>
                    ★
                  </button>
                ))}
              </div>
            </div>
            <Field label="Matn">
              <Textarea value={editing.data.text} onChange={(e) => setEditing({...editing, data: {...editing.data, text: e.target.value}})} maxLength={1000} required />
            </Field>
            <Toggle checked={editing.data.isPublished} onChange={(isPublished) => setEditing({...editing, data: {...editing.data, isPublished}})} label="Saytda chop etish" />
            <div className="flex justify-between gap-2 pt-2">
              {editing.id ? (
                <Btn type="button" variant="danger" onClick={() => confirm("Sharhni o'chirasizmi?") && remove.mutate(editing.id!)}>
                  O'chirish
                </Btn>
              ) : (
                <span />
              )}
              <Btn type="submit" disabled={save.isPending}>
                Saqlash
              </Btn>
            </div>
          </form>
        ) : null}
      </Modal>
    </>
  );
}
