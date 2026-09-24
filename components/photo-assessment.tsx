"use client";

import { type ChangeEvent, type FormEvent, type KeyboardEvent, type MouseEvent, useEffect, useMemo, useState } from "react";
import { Camera, Check, Images, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { toast } from "sonner";
import { serverClient, type ClinicClient } from "@/lib/clinic-client";
import { estimateBodyFromPhotos, type MarkedPhoto, type Point, type RegionMarks } from "@/lib/photo-estimate";

export type PhotoAssessmentRecord = {
  id: number; patientId: number; measuredOn: string; heightCm: number;
  frontWidthCm: number; sideDepthCm: number; waistEstimateCm: number; createdAt: string;
  abdomenEstimateCm?: number | null; hipEstimateCm?: number | null;
  tapeMeasures?: { waistCm?: number | null; abdomenCm?: number | null; hipCm?: number | null };
};

type Marker = "head" | "feet" | "left" | "right" | "abdomenLeft" | "abdomenRight" | "hipLeft" | "hipRight";
type Draft = { file: File; url: string; width: number; height: number; points: Record<Marker, Point | null> };
const allMarkers: { key: Marker; label: string; short: string }[] = [
  { key: "head", label: "Alto da cabeça", short: "Cabeça" },
  { key: "feet", label: "Base dos pés", short: "Pés" },
  { key: "left", label: "Borda esquerda da cintura", short: "Cintura E" },
  { key: "right", label: "Borda direita da cintura", short: "Cintura D" },
  { key: "abdomenLeft", label: "Borda esquerda do abdômen", short: "Abdômen E" },
  { key: "abdomenRight", label: "Borda direita do abdômen", short: "Abdômen D" },
  { key: "hipLeft", label: "Borda esquerda do quadril", short: "Quadril E" },
  { key: "hipRight", label: "Borda direita do quadril", short: "Quadril D" },
];

function blankPoints(): Draft["points"] { return { head: null, feet: null, left: null, right: null, abdomenLeft: null, abdomenRight: null, hipLeft: null, hipRight: null }; }
function complete(draft: Draft | null, extended: boolean): draft is Draft {
  return !!draft && allMarkers.slice(0, extended ? 8 : 4).every(({ key }) => draft.points[key] !== null);
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

function PhotoMarker({ label, draft, active, setActive, setPoint, onPhotoReady, extended }: {
  label: string; draft: Draft | null; active: Marker; setActive: (key: Marker) => void; setPoint: (key: Marker, point: Point) => void;
  onPhotoReady: (draft: Draft) => void; extended: boolean;
}) {
  const markers = allMarkers.slice(0, extended ? 8 : 4);
  const [zoom, setZoom] = useState(1);
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
    setPoint(active, { x: Math.max(0, Math.min(1, point.x + offset.x * (event.shiftKey ? 0.1 : 1))), y: Math.max(0, Math.min(1, point.y + offset.y * (event.shiftKey ? 0.1 : 1))) });
  }
  return <div className="photo-mark-card">
    <strong>{label}</strong>
    {draft ? <>
      <label className="photo-zoom">Ampliar foto: {zoom}× <input type="range" min="1" max="3" step="0.5" value={zoom} onChange={event => setZoom(Number(event.target.value))} /></label>
      <div className="photo-mark-scroll"><div className="photo-mark-image" style={{ width: `${zoom * 100}%`, maxWidth: "none" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={draft.url} alt={`Foto ${label.toLowerCase()} para marcar o corpo`} />
        <button type="button" className="photo-click-layer" aria-label={`Marcar ${markers.find((item) => item.key === active)?.label} na foto ${label.toLowerCase()}. Use as setas para ajustar.`} onClick={clickImage} onKeyDown={moveMarker} />
        {markers.map(({ key, short }) => draft.points[key] && <span className={`photo-point photo-point-${key}`} key={key} style={{ left: `${draft.points[key]!.x * 100}%`, top: `${draft.points[key]!.y * 100}%` }} aria-hidden="true">{short}</span>)}
      </div></div>
      <div className="photo-mark-buttons" aria-label={`Pontos da foto ${label.toLowerCase()}`}>
        {markers.map(({ key, label: pointLabel }) => <button type="button" key={key} className={active === key ? "chosen" : ""} aria-pressed={active === key} onClick={() => setActive(key)}>{draft.points[key] ? "✓ " : "○ "}{pointLabel}</button>)}
      </div>
      <small>Toque na foto para marcar o ponto selecionado. Toque no nome do ponto para corrigir. Use Shift + setas para ajuste fino.</small>
    </> : <div className="photo-upload-placeholder"><Camera size={25} /><span>Escolha a foto {label.toLowerCase()} abaixo</span></div>}
    <label className="photo-file-picker"><Images size={17} /> {draft ? "Trocar foto" : "Escolher foto"}<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={(event: ChangeEvent<HTMLInputElement>) => {
      const selected = event.target.files?.[0];
      if (selected) void preparePhoto(selected).then((value) => { setActive("head"); onPhotoReady(value); })
        .catch((error) => toast.error(error instanceof Error ? error.message : "Foto inválida."));
      event.target.value = "";
    }} /></label>
  </div>;
}

function StoredPhoto({ client, id, view, alt }: { client: ClinicClient; id: number; view: "front" | "side"; alt: string }) {
  const [source, setSource] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true; let url = "";
    setSource(""); setFailed(false);
    void client.photoUrl(id, view).then(value => {
      url = value;
      if (active) setSource(value);
      else if (value.startsWith("blob:")) URL.revokeObjectURL(value);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; if (url.startsWith("blob:")) URL.revokeObjectURL(url); };
  }, [client, id, view]);
  if (failed) return <p role="status">Não foi possível abrir esta foto.</p>;
  return source ? <img src={source} alt={alt} loading="lazy" onError={() => setFailed(true)} /> : <p role="status">Abrindo foto...</p>;
}

export default function PhotoAssessment({ client = serverClient, patientId, patientName, entries, onSaved, today, formatDay }: {
  client?: ClinicClient; patientId: number; patientName: string; entries: PhotoAssessmentRecord[];
  onSaved: () => Promise<void>; today: string; formatDay: (day: string) => string;
}) {
  const extended = client !== serverClient;
  const [tape, setTape] = useState({ waistCm: "", abdomenCm: "", hipCm: "" });
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

  const regions = useMemo((): RegionMarks => {
    if (!extended || !complete(front, true) || !complete(side, true)) return {};
    return Object.fromEntries((["abdomen", "hip"] as const).map(key => [key, {
      front: { left: front.points[`${key}Left`]!, right: front.points[`${key}Right`]! },
      side: { left: side.points[`${key}Left`]!, right: side.points[`${key}Right`]! },
    }]));
  }, [front, side, extended]);
  const calculation = useMemo(() => {
    if (!complete(front, extended) || !complete(side, extended) || !height) return { result: null, error: "" };
    try { return { result: estimateBodyFromPhotos(Number(height), marked(front), marked(side), regions), error: "" }; }
    catch (error) { return { result: null, error: error instanceof Error ? error.message : "Confira as marcações." }; }
  }, [front, side, height, extended, regions]);
  const { result } = calculation;
  const older = entries.find((entry) => entry.id === olderId);
  const newer = entries.find((entry) => entry.id === newerId);

  function closeDialog(value: boolean) {
    if (saving) return;
    setOpen(value);
    if (!value) { setFront(null); setSide(null); setHeight(""); setTape({ waistCm: "", abdomenCm: "", hipCm: "" }); setConsent(false); setDate(today); }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!front || !side || !result || !consent) { toast.error("Marque os pontos nas duas fotos e confirme a autorização."); return; }
    const body = new FormData();
    body.set("patientId", String(patientId)); body.set("measuredOn", date);
    body.set("heightCm", height); body.set("consent", "yes");
    body.set("front", front.file); body.set("side", side.file);
    body.set("marks", JSON.stringify({ front: marked(front), side: marked(side) }));
    if (extended) {
      body.set("regionMarks", JSON.stringify(regions));
      body.set("tapeMeasures", JSON.stringify(Object.fromEntries(Object.entries(tape).map(([key, value]) => [key, value === "" ? null : Number(value)]))));
    }
    setSaving(true);
    try {
      const response = await client.request("/api/photos", { method: "POST", body });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível salvar a avaliação.");
      await onSaved();
      setOpen(false); setFront(null); setSide(null); setHeight(""); setTape({ waistCm: "", abdomenCm: "", hipCm: "" }); setConsent(false); setDate(today);
      toast.success("Avaliação por fotos salva no prontuário.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar."); }
    finally { setSaving(false); }
  }
  async function remove(id: number) {
    setDeletingId(id);
    try {
      const response = await client.request(`/api/photos?id=${id}`, { method: "DELETE" });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível remover.");
      await onSaved();
      toast.success("Fotos e avaliação removidas.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível remover."); }
    finally { setDeletingId(null); }
  }

  return <section className="surface photo-assessment-surface">
    <div className="section-heading"><div><span className="eyebrow">AVALIAÇÃO VISUAL</span><h2>Fotos e medidas corporais</h2></div><button className="button button-primary" onClick={() => setOpen(true)}><Camera size={18} /> Avaliar por fotos</button></div>
    <p className="photo-description">Fotografe o corpo inteiro de frente e de lado, com a câmera na mesma altura e roupa semelhante em cada avaliação. Marque cabeça, pés e as bordas de cada região para obter estimativas visuais.</p>
    {entries.length ? <>
      <div className="photo-compare-toolbar"><div className="field"><label htmlFor="photo-old">Comparar data anterior</label><NativeSelect id="photo-old" value={olderId ?? ""} onChange={(event) => setOlderId(Number(event.target.value))}><NativeSelectOption value="">Selecione uma data</NativeSelectOption>{entries.map((entry) => <NativeSelectOption key={entry.id} value={entry.id}>{formatDay(entry.measuredOn)}</NativeSelectOption>)}</NativeSelect></div><div className="field"><label htmlFor="photo-new">Com data recente</label><NativeSelect id="photo-new" value={newerId ?? ""} onChange={(event) => setNewerId(Number(event.target.value))}><NativeSelectOption value="">Selecione uma data</NativeSelectOption>{entries.map((entry) => <NativeSelectOption key={entry.id} value={entry.id}>{formatDay(entry.measuredOn)}</NativeSelectOption>)}</NativeSelect></div><div className="field"><label htmlFor="photo-angle">Ângulo</label><NativeSelect id="photo-angle" value={angle} onChange={(event) => setAngle(event.target.value as "front" | "side")}><NativeSelectOption value="front">Frente</NativeSelectOption><NativeSelectOption value="side">Lado</NativeSelectOption></NativeSelect></div></div>
      <div className="photo-compare-grid">{[{ entry: older, label: "Antes" }, { entry: newer, label: "Depois" }].map(({ entry, label }) => <div className="photo-compare-card" key={label}>{entry ? <><div className="photo-compare-heading"><strong>{label} · {formatDay(entry.measuredOn)}</strong><AlertDialog><AlertDialogTrigger asChild><button className="photo-remove" aria-label={`Remover avaliação de ${formatDay(entry.measuredOn)}`} title="Remover avaliação" disabled={deletingId !== null}><Trash2 size={17} /></button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remover esta avaliação?</AlertDialogTitle><AlertDialogDescription>As duas fotos e a estimativa dessa data serão apagadas do prontuário de {patientName}.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => void remove(entry.id)}>Remover fotos</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>
        {/* eslint-disable-next-line @next/next/no-img-element */}<StoredPhoto client={client} id={entry.id} view={angle} alt={`Avaliação ${angle === "front" ? "frontal" : "lateral"} de ${patientName} em ${formatDay(entry.measuredOn)}`} />
        <MeasureTable entry={entry} /><div className="photo-compare-stats">Altura informada: {entry.heightCm} cm</div></> : <div className="photo-empty-slot">{label === "Antes" ? "Selecione outra data para comparar." : "Selecione uma avaliação."}</div>}</div>)}</div>
      <p className="photo-caution">Estimativa geométrica a partir das marcações em duas fotos. Roupa, postura e distância da câmera alteram o resultado. Confirme a circunferência da cintura com fita métrica antes de usar em decisões clínicas. A foto não mede hidratação nem percentual de gordura.</p>
    </> : <div className="photo-empty-state"><Camera size={24} /><div><strong>Sem avaliações por fotos</strong><span>Adicione a primeira para acompanhar a evolução visual de {patientName}.</span></div></div>}

    <Dialog open={open} onOpenChange={closeDialog}><DialogContent className="form-dialog photo-dialog"><DialogHeader><DialogTitle>Nova avaliação por fotos</DialogTitle><DialogDescription>{patientName} · fotografe o corpo inteiro de frente e de lado, com os pés visíveis.</DialogDescription></DialogHeader><form onSubmit={save} className="modal-form"><div className="form-grid"><div className="field"><label htmlFor="photo-date">Data</label><Input id="photo-date" type="date" required value={date} onChange={(event) => setDate(event.target.value)} /></div><div className="field"><label htmlFor="photo-height">Altura medida (cm)</label><Input id="photo-height" type="number" min="60" max="230" step="0.1" inputMode="decimal" required placeholder="Ex.: 178" value={height} onChange={(event) => setHeight(event.target.value)} /></div></div>
      <p className="photo-instructions">Use fundo simples, câmera nivelada e distância suficiente para mostrar cabeça e pés. Escolha as fotos e toque em cada ponto indicado. Marque as bordas da mesma região no mesmo nível nas duas vistas.</p>
      {extended && <p className="photo-instructions">Registre cintura, abdômen e quadril separadamente. Use os pontos anatômicos definidos pela profissional e repita o mesmo protocolo nas próximas avaliações. A foto não identifica esses pontos automaticamente.</p>}
      <div className="photo-mark-grid"><PhotoMarker extended={extended} label="Frente" draft={front} active={activeFront} setActive={setActiveFront} setPoint={(key, point) => mark("front", key, point)} onPhotoReady={setFront} /><PhotoMarker extended={extended} label="Lado" draft={side} active={activeSide} setActive={setActiveSide} setPoint={(key, point) => mark("side", key, point)} onPhotoReady={setSide} /></div>
      {calculation.error && <p className="photo-caution" role="alert">{calculation.error}</p>}
      {extended && <fieldset className="photo-tape"><legend>Conferência com fita métrica (opcional)</legend><p>Use os mesmos pontos anatômicos marcados nas fotos. Esses valores ficam separados das estimativas.</p><div className="form-grid">{([ ["waistCm", "Cintura"], ["abdomenCm", "Abdômen"], ["hipCm", "Quadril"] ] as const).map(([key, label]) => <div className="field" key={key}><label htmlFor={`tape-${key}`}>{label} com fita (cm)</label><Input id={`tape-${key}`} type="number" min="0.1" max="400" step="0.1" value={tape[key]} onChange={event => setTape(current => ({ ...current, [key]: event.target.value }))} /></div>)}</div></fieldset>}
      {result && <MeasureTable entry={{ ...result, tapeMeasures: Object.fromEntries(Object.entries(tape).map(([key, value]) => [key, value === "" ? null : Number(value)])) }} />}
      <p className="photo-caution">Esta é uma aproximação pela imagem, sem precisão clínica. Faça a medida de cintura com fita para confirmar.</p>
      <label className="photo-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required /> Tenho autorização do paciente para guardar estas fotografias no prontuário.</label>
      <DialogFooter><button type="button" className="button button-secondary" onClick={() => closeDialog(false)} disabled={saving}>Cancelar</button><button type="submit" className="button button-primary" disabled={saving || !result || !consent}><Check size={17} /> {saving ? "Salvando fotos..." : "Salvar avaliação"}</button></DialogFooter>
    </form></DialogContent></Dialog>
  </section>;
}

function MeasureTable({ entry }: { entry: Pick<PhotoAssessmentRecord, "waistEstimateCm" | "abdomenEstimateCm" | "hipEstimateCm" | "tapeMeasures"> }) {
  const rows = [
    { label: "Cintura", estimate: entry.waistEstimateCm, tape: entry.tapeMeasures?.waistCm },
    { label: "Abdômen", estimate: entry.abdomenEstimateCm, tape: entry.tapeMeasures?.abdomenCm },
    { label: "Quadril", estimate: entry.hipEstimateCm, tape: entry.tapeMeasures?.hipCm },
  ];
  const cm = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return <div className="photo-measures-table"><table><caption>Medidas em centímetros · estimativas geométricas</caption><thead><tr><th>Região</th><th>Foto ≈</th><th>Fita</th><th>Foto − fita</th></tr></thead><tbody>{rows.map(row => <tr key={row.label}><th>{row.label}</th><td>{row.estimate == null ? "Não avaliado" : cm(row.estimate)}</td><td>{row.tape == null ? "—" : cm(row.tape)}</td><td>{row.estimate == null || row.tape == null ? "—" : cm(row.estimate - row.tape)}</td></tr>)}</tbody></table></div>;
}
