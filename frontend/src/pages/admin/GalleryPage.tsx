import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {useRef, useState} from 'react';
import {adminApi, type GalleryItem} from '../../api/admin';
import {Btn, Empty, errorText, Field, Input, LangFields, Modal, PageHeader, useToast} from '../../components/admin/kit';
import {Spinner} from '../../components/ui';

export default function GalleryPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const items = useQuery({queryKey: ['admin-gallery'], queryFn: adminApi.gallery});
  const [editing, setEditing] = useState<GalleryItem | null>(null);

  const refresh = () => {
    qc.invalidateQueries({queryKey: ['admin-gallery']});
    qc.invalidateQueries({queryKey: ['site']});
  };

  const upload = useMutation({
    mutationFn: (files: File[]) => adminApi.uploadGallery(files),
    onSuccess: (r) => {
      toast(`${r.length} ta rasm yuklandi`);
      refresh();
    },
    onError: (e) => toast(errorText(e), 'error'),
  });
  const save = useMutation({
    mutationFn: (g: GalleryItem) => adminApi.updateGallery(g.id, g.caption, g.sortOrder),
    onSuccess: () => {
      toast('Saqlandi');
      setEditing(null);
      refresh();
    },
    onError: (e) => toast(errorText(e), 'error'),
  });
  const remove = useMutation({
    mutationFn: (id: number) => adminApi.deleteGallery(id),
    onSuccess: () => {
      toast("O'chirildi");
      setEditing(null);
      refresh();
    },
  });

  return (
    <>
      <PageHeader
        title="Galereya"
        sub="Ishlaringiz rasmlari — saytda galereya bo'limida ko'rinadi"
        actions={
          <>
            <input
              ref={input}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []).slice(0, 10);
                if (files.length) upload.mutate(files);
                e.target.value = '';
              }}
            />
            <Btn onClick={() => input.current?.click()} disabled={upload.isPending}>
              {upload.isPending ? <Spinner /> : '+ Rasm yuklash'}
            </Btn>
          </>
        }
      />
      <p className="-mt-3 mb-5 text-xs opacity-60">Bir vaqtda 10 tagacha rasm · JPG, PNG, WEBP · har biri 5 MB gacha</p>
      {items.isLoading ? (
        <Spinner className="h-8 w-8" />
      ) : !items.data?.length ? (
        <Empty>Galereya bo'sh. Rasmlar yuklanmaguncha bu bo'lim saytda ko'rinmaydi.</Empty>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {items.data.map((g) => (
            <button key={g.id} type="button" onClick={() => setEditing(g)} className="group relative overflow-hidden rounded-2xl border-2 border-navy/15 bg-white">
              <img src={g.url} alt={g.caption.uz} className="aspect-square w-full object-cover transition group-hover:scale-105" loading="lazy" />
              {g.caption.uz ? <span className="absolute inset-x-0 bottom-0 bg-ink/60 px-2 py-1 text-xs text-white">{g.caption.uz}</span> : null}
            </button>
          ))}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Rasm">
        {editing ? (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(editing);
            }}
          >
            <img src={editing.url} alt="" className="max-h-64 w-full rounded-2xl object-cover" />
            <LangFields label="Izoh" value={editing.caption} onChange={(caption) => setEditing({...editing, caption})} />
            <Field label="Tartib">
              <Input type="number" value={editing.sortOrder} onChange={(e) => setEditing({...editing, sortOrder: Number(e.target.value)})} />
            </Field>
            <div className="flex justify-between gap-2">
              <Btn type="button" variant="danger" onClick={() => confirm("Rasmni o'chirasizmi?") && remove.mutate(editing.id)}>
                O'chirish
              </Btn>
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
