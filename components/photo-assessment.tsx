"use client";

import { type ChangeEvent, type FormEvent, type KeyboardEvent, type MouseEvent, useEffect, useMemo, useState } from "react";
import { Camera, Check, Images, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { toast } from "sonner";
import { estimateWaistFromPhotos, type MarkedPhoto, type Point } from "@/lib/photo-estimate";

export type PhotoAssessmentRecord = {
  id: number; patientId: number; measuredOn: string; heightCm: number;
  frontWidthCm: number; sideDepthCm: number; waistEstimateCm: number; createdAt: string;
};

type Marker = "head" | "feet" | "left" | "right";
type Draft = { file: File; url: string; width: number; height: number; points: Record<Marker, Point | null> };
const markers: { key: Marker; label: string; short: string }[] = [
  { key: "head", label: "Alto da cabeça", short: "Cabeça" },
  { key: "feet", label: "Base dos pés", short: "Pés" },
  { key: "left", label: "Borda esquerda da cintura", short: "Cintura E" },
  { key: "right", label: "Borda direita da cintura", short: "Cintura D" },
];

function blankPoints(): Draft["points"] { return { head: null, feet: null, left: null, right: null }; }
function complete(draft: Draft | null): draft is Draft {
  return !!draft && markers.every(({ key }) => draft.points[key] !== null);
}
function marked(draft: Draft): MarkedPhoto {
  return { width: draft.width, height: draft.height, ...draft.points } as MarkedPhoto;
}

async function preparePhoto(file: File): Promise<Draft> {
  if (!(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(file.type)) || file.size > 15 * 1024 * 1024) {
    throw new Error("Escolha uma foto JPG, PNG ou WebP de até 15 MB.");
  }
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Não foi possível abrir essa foto no navegador. Tente usar JPG."));
      element.src = sourceUrl;
    });
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.round(image.naturalWidth * scale);
    const height = Math.round(image.naturalHeight * scale);
    if (width < 200 || height < 400) throw new Error("Use uma foto vertical do corpo inteiro, com boa resolução.");
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar a foto.");
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob) throw new Error("Não foi possível converter a foto para JPG.");
    if (blob.size > 4 * 1024 * 1024) throw new Error("A foto continua muito grande. Use uma resolução menor.");
    const output = new File([blob], "avaliacao.jpg", { type: "image/jpeg" });
    return { file: output, url: URL.createObjectURL(output), width, height, points: blankPoints() };
  } finally { URL.revokeObjectURL(sourceUrl); }
}

function PhotoMarker({ label, draft, active, setActive, setPoint, onPhotoReady }: {
  label: string; draft: Draft | null; active: Marker; setActive: (key: Marker) => void; setPoint: (key: Marker, point: Point) => void;
  onPhotoReady: (draft: Draft) => void;
}) {
  function putPoint(x: number, y: number) {
    setPoint(active, { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) });
    const next = markers.findIndex(({ key }) => key === active) + 1;
    if (next < markers.length) setActive(markers[next].key);
  }
  function clickImage(event: MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    if (event.detail === 0) { putPoint(0.5, 0.5); return; }
    putPoint((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
  }
  function moveMarker(event: KeyboardEvent<HTMLButtonElement>) {
    const offsets: Record<string, Point> = {
      ArrowLeft: { x: -0.01, y: 0 }, ArrowRight: { x: 0.01, y: 0 },
      ArrowUp: { x: 0, y: -0.01 }, ArrowDown: { x: 0, y: 0.01 },
    };
    const offset = offsets[event.key];
    if (!offset || !draft) return;
    event.preventDefault();
    const point = draft.points[active] ?? { x: 0.5, y: 0.5 };
    setPoint(active, { x: Math.max(0, Math.min(1, point.x + offset.x)), y: Math.max(0, Math.min(1, point.y + offset.y)) });
  }
  return <div className="photo-mark-card">
    <strong>{label}</strong>
    {draft ? <>
      <div className="photo-mark-image">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={draft.url} alt={`Foto ${label.toLowerCase()} para marcar o corpo`} />
        <button type="button" className="photo-click-layer" aria-label={`Marcar ${markers.find((item) => item.key === active)?.label} na foto ${label.toLowerCase()}. Use as setas para ajustar.`} onClick={clickImage} onKeyDown={moveMarker} />
        {markers.map(({ key, short }) => draft.points[key] && <span className={`photo-point photo-point-${key}`} key={key} style={{ left: `${draft.points[key]!.x * 100}%`, top: `${draft.points[key]!.y * 100}%` }} aria-hidden="true">{short}</span>)}
      </div>
      <div className="photo-mark-buttons" aria-label={`Pontos da foto ${label.toLowerCase()}`}>
        {markers.map(({ key, label: pointLabel }) => <button type="button" key={key} className={active === key ? "chosen" : ""} aria-pressed={active === key} onClick={() => setActive(key)}>{draft.points[key] ? "✓ " : "○ "}{pointLabel}</button>)}
      </div>
      <small>Toque na foto para marcar o ponto selecionado. Toque no nome do ponto para corrigir.</small>
    </> : <div className="photo-upload-placeholder"><Camera size={25} /><span>Escolha a foto {label.toLowerCase()} abaixo</span></div>}
    <label className="photo-file-picker"><Images size={17} /> {draft ? "Trocar foto" : "Escolher foto"}<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={(event: ChangeEvent<HTMLInputElement>) => {
      const selected = event.target.files?.[0];
      if (selected) void preparePhoto(selected).then((value) => { setActive("head"); onPhotoReady(value); })
        .catch((error) => toast.error(error instanceof Error ? error.message : "Foto inválida."));
      event.target.value = "";
    }} /></label>
  </div>;
}

export default function PhotoAssessment({ patientId, patientName, entries, onSaved, today, formatDay }: {
  patientId: number; patientName: string; entries: PhotoAssessmentRecord[];
  onSaved: () => Promise<void>; today: string; formatDay: (day: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [front, setFront] = useState<Draft | null>(null);
  const [side, setSide] = useState<Draft | null>(null);
  const [activeFront, setActiveFront] = useState<Marker>("head");
  const [activeSide, setActiveSide] = useState<Marker>("head");
  const [date, setDate] = useState(today);
  const [height, setHeight] = useState("");
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [angle, setAngle] = useState<"front" | "side">("front");
  const [olderId, setOlderId] = useState<number | null>(null);
  const [newerId, setNewerId] = useState<number | null>(null);

  useEffect(() => () => { if (front) URL.revokeObjectURL(front.url); }, [front?.url]);
  useEffect(() => () => { if (side) URL.revokeObjectURL(side.url); }, [side?.url]);
  useEffect(() => { setOlderId(entries[1]?.id ?? null); setNewerId(entries[0]?.id ?? null); }, [patientId, entries[0]?.id, entries[1]?.id]);
  function mark(view: "front" | "side", key: Marker, point: Point) {
    const setter = view === "front" ? setFront : setSide;
    setter((current) => current ? { ...current, points: { ...current.points, [key]: point } } : current);
  }

  const result = useMemo(() => {
    if (!complete(front) || !complete(side) || !height) return null;
    try { return estimateWaistFromPhotos(Number(height), marked(front), marked(side)); }
    catch { return null; }
  }, [front, side, height]);
  const older = entries.find((entry) => entry.id === olderId);
  const newer = entries.find((entry) => entry.id === newerId);

  function closeDialog(value: boolean) {
    if (saving) return;
    setOpen(value);
    if (!value) { setFront(null); setSide(null); setHeight(""); setConsent(false); setDate(today); }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!front || !side || !result || !consent) { toast.error("Marque os pontos nas duas fotos e confirme a autorização."); return; }
    const body = new FormData();
    body.set("patientId", String(patientId)); body.set("measuredOn", date);
    body.set("heightCm", height); body.set("consent", "yes");
    body.set("front", front.file); body.set("side", side.file);
    body.set("marks", JSON.stringify({ front: marked(front), side: marked(side) }));
    setSaving(true);
    try {
      const response = await fetch("/api/photos", { method: "POST", body });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível salvar a avaliação.");
      await onSaved();
      setOpen(false); setFront(null); setSide(null); setHeight(""); setConsent(false); setDate(today);
      toast.success("Avaliação por fotos salva no prontuário.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar."); }
    finally { setSaving(false); }
  }
  async function remove(id: number) {
    setDeletingId(id);
    try {
      const response = await fetch(`/api/photos?id=${id}`, { method: "DELETE" });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível remover.");
      await onSaved();
      toast.success("Fotos e avaliação removidas.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível remover."); }
    finally { setDeletingId(null); }
  }

  return <section className="surface photo-assessment-surface">
    <div className="section-heading"><div><span className="eyebrow">AVALIAÇÃO VISUAL</span><h2>Fotos e medidas corporais</h2></div><button className="button button-primary" onClick={() => setOpen(true)}><Camera size={18} /> Avaliar por fotos</button></div>
    <p className="photo-description">Fotografe o corpo inteiro de frente e de lado, com a câmera na mesma altura e roupa semelhante em cada avaliação. Marque cabeça, pés e laterais da cintura para obter uma estimativa visual.</p>
    {entries.length ? <>
      <div className="photo-compare-toolbar"><div className="field"><label htmlFor="photo-old">Comparar data anterior</label><NativeSelect id="photo-old" value={olderId ?? ""} onChange={(event) => setOlderId(Number(event.target.value))}><NativeSelectOption value="">Selecione uma data</NativeSelectOption>{entries.map((entry) => <NativeSelectOption key={entry.id} value={entry.id}>{formatDay(entry.measuredOn)}</NativeSelectOption>)}</NativeSelect></div><div className="field"><label htmlFor="photo-new">Com data recente</label><NativeSelect id="photo-new" value={newerId ?? ""} onChange={(event) => setNewerId(Number(event.target.value))}><NativeSelectOption value="">Selecione uma data</NativeSelectOption>{entries.map((entry) => <NativeSelectOption key={entry.id} value={entry.id}>{formatDay(entry.measuredOn)}</NativeSelectOption>)}</NativeSelect></div><div className="field"><label htmlFor="photo-angle">Ângulo</label><NativeSelect id="photo-angle" value={angle} onChange={(event) => setAngle(event.target.value as "front" | "side")}><NativeSelectOption value="front">Frente</NativeSelectOption><NativeSelectOption value="side">Lado</NativeSelectOption></NativeSelect></div></div>
      <div className="photo-compare-grid">{[{ entry: older, label: "Antes" }, { entry: newer, label: "Depois" }].map(({ entry, label }) => <div className="photo-compare-card" key={label}>{entry ? <><div className="photo-compare-heading"><strong>{label} · {formatDay(entry.measuredOn)}</strong><AlertDialog><AlertDialogTrigger asChild><button className="photo-remove" aria-label={`Remover avaliação de ${formatDay(entry.measuredOn)}`} title="Remover avaliação" disabled={deletingId !== null}><Trash2 size={17} /></button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remover esta avaliação?</AlertDialogTitle><AlertDialogDescription>As duas fotos e a estimativa dessa data serão apagadas do prontuário de {patientName}.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => void remove(entry.id)}>Remover fotos</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>
        {/* eslint-disable-next-line @next/next/no-img-element */}<img src={`/api/photos?id=${entry.id}&view=${angle}`} alt={`Avaliação ${angle === "front" ? "frontal" : "lateral"} de ${patientName} em ${formatDay(entry.measuredOn)}`} loading="lazy" />
        <div className="photo-compare-stats"><span>Estimativa da cintura <strong>≈ {entry.waistEstimateCm} cm</strong></span><span>Altura informada: {entry.heightCm} cm</span></div></> : <div className="photo-empty-slot">{label === "Antes" ? "Selecione outra data para comparar." : "Selecione uma avaliação."}</div>}</div>)}</div>
      <p className="photo-caution">Estimativa geométrica a partir das marcações em duas fotos. Roupa, postura e distância da câmera alteram o resultado. Confirme a circunferência da cintura com fita métrica antes de usar em decisões clínicas. A foto não mede hidratação nem percentual de gordura.</p>
    </> : <div className="photo-empty-state"><Camera size={24} /><div><strong>Sem avaliações por fotos</strong><span>Adicione a primeira para acompanhar a evolução visual de {patientName}.</span></div></div>}

    <Dialog open={open} onOpenChange={closeDialog}><DialogContent className="form-dialog photo-dialog"><DialogHeader><DialogTitle>Nova avaliação por fotos</DialogTitle><DialogDescription>{patientName} · fotografe o corpo inteiro de frente e de lado, com os pés visíveis.</DialogDescription></DialogHeader><form onSubmit={save} className="modal-form"><div className="form-grid"><div className="field"><label htmlFor="photo-date">Data</label><Input id="photo-date" type="date" required value={date} onChange={(event) => setDate(event.target.value)} /></div><div className="field"><label htmlFor="photo-height">Altura medida (cm)</label><Input id="photo-height" type="number" min="60" max="230" step="0.1" inputMode="decimal" required placeholder="Ex.: 178" value={height} onChange={(event) => setHeight(event.target.value)} /></div></div>
      <p className="photo-instructions">Use fundo simples, câmera nivelada e distância suficiente para mostrar cabeça e pés. Escolha as fotos e toque em cada ponto indicado.</p>
      <div className="photo-mark-grid"><PhotoMarker label="Frente" draft={front} active={activeFront} setActive={setActiveFront} setPoint={(key, point) => mark("front", key, point)} onPhotoReady={setFront} /><PhotoMarker label="Lado" draft={side} active={activeSide} setActive={setActiveSide} setPoint={(key, point) => mark("side", key, point)} onPhotoReady={setSide} /></div>
      {result && <div className="photo-result" role="status"><strong>Estimativa visual: ≈ {result.waistEstimateCm} cm</strong><span>Largura frontal {result.frontWidthCm} cm · profundidade lateral {result.sideDepthCm} cm</span></div>}
      <p className="photo-caution">Esta é uma aproximação pela imagem, sem precisão clínica. Faça a medida de cintura com fita para confirmar.</p>
      <label className="photo-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required /> Tenho autorização do paciente para guardar estas fotografias no prontuário.</label>
      <DialogFooter><button type="button" className="button button-secondary" onClick={() => closeDialog(false)} disabled={saving}>Cancelar</button><button type="submit" className="button button-primary" disabled={saving || !result || !consent}><Check size={17} /> {saving ? "Salvando fotos..." : "Salvar avaliação"}</button></DialogFooter>
    </form></DialogContent></Dialog>
  </section>;
}
