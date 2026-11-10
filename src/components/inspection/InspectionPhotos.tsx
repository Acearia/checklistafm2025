import {useState} from "react";
import {ZoomIn} from "lucide-react";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {resolveAttachmentPreviewUrl, type AttachmentLike} from "@/lib/attachmentPreview";

export default function InspectionPhotos({photos}: {photos?: unknown[]}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [failed, setFailed] = useState<Set<number>>(() => new Set());
  const items = (photos || []).map(photo => typeof photo === "string" ? photo : resolveAttachmentPreviewUrl(photo as AttachmentLike));
  if (!items.length) return null;
  return <section className="mb-6" aria-label="Fotos do checklist">
    <h3 className="mb-3 font-semibold">Fotos anexadas ({items.length})</h3>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {items.map((src,index) => <figure key={index} className="rounded-md border bg-muted/30 p-2">
        {!src || failed.has(index) ? <p role="status" className="p-4 text-sm text-muted-foreground">Não foi possível carregar a foto {index+1}.</p> : <button type="button" className="block w-full rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" aria-label={`Ampliar foto ${index+1}`} onClick={() => setSelected(index)}>
          <img src={src} alt={`Foto ${index+1} do checklist`} className="max-h-64 w-full rounded object-contain" loading="lazy" onError={() => setFailed(previous => new Set([...previous,index]))} />
          <span className="no-print mt-2 inline-flex items-center gap-1 text-sm text-primary"><ZoomIn className="size-4" />Ampliar foto</span>
        </button>}
        <figcaption className="mt-2 text-center text-xs text-muted-foreground">Foto {index+1}</figcaption>
      </figure>)}
    </div>
    <Dialog open={selected !== null} onOpenChange={open => {if (!open) setSelected(null);}}><DialogContent className="no-print max-h-[95vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>Foto {selected === null ? "" : selected+1} do checklist</DialogTitle><DialogDescription>Imagem anexada durante a inspeção.</DialogDescription></DialogHeader>
      {selected !== null && <img src={items[selected]} alt={`Foto ${selected+1} ampliada`} className="max-h-[75vh] w-full object-contain" />}
    </DialogContent></Dialog>
  </section>;
}
