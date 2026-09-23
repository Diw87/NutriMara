import { z } from "zod";
import { estimateWaistFromPhotos } from "../lib/photo-estimate.ts";
import { validatePhotoBytes } from "../lib/photo-upload.ts";
import { appointmentSchema, backupSchema, clinicalRecordInputSchema, idSchema, marksSchema, measurementSchema, patientSchema, photoInputSchema, planSchema, statusSchema, type Backup, type PhotoRecord, type Workspace } from "./schemas.ts";

const stores = ["patients", "appointments", "measurements", "plans", "photoAssessments", "clinicalRecords", "imports"];
type SavedPhoto = PhotoRecord & { front: Blob; side: Blob };
class LocalError extends Error { status: number; constructor(message: string, status = 400) { super(message); this.status = status; } }
function read<T>(request: IDBRequest<T>): Promise<T> { return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
function metadata({ front: _front, side: _side, ...record }: SavedPhoto): PhotoRecord { return record; }
function sortWorkspace(value: Workspace): Workspace {
  value.patients.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  value.appointments.sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  value.measurements.sort((a, b) => b.measuredOn.localeCompare(a.measuredOn) || b.id - a.id);
  value.photoAssessments.sort((a, b) => b.measuredOn.localeCompare(a.measuredOn) || b.id - a.id);
  return value;
}
async function toBase64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
function fromBase64(value: string) {
  const bytes = Uint8Array.from(atob(value), c => c.charCodeAt(0));
  validatePhotoBytes(bytes, "image/jpeg");
  return new Blob([bytes], { type: "image/jpeg" });
}

export function createLocalStore(name = "nutrimara-local-v1", factory: IDBFactory = globalThis.indexedDB) {
  let connection: Promise<IDBDatabase> | undefined;
  function open() {
    if (!factory) return Promise.reject(new LocalError("Este navegador não permite salvar os registros. Abra o aplicativo em uma janela normal do Chrome, Edge ou Safari."));
    if (!connection) connection = new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(name, 2);
      request.onupgradeneeded = () => {
        for (const store of stores) if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store, { keyPath: "id", autoIncrement: store !== "imports" });
      };
      request.onsuccess = () => { const db = request.result; db.onversionchange = () => { db.close(); connection = undefined; }; resolve(db); };
      request.onerror = () => { connection = undefined; reject(request.error); };
      request.onblocked = () => { connection = undefined; reject(new LocalError("Feche outras janelas do NutriMara e tente novamente.")); };
    });
    return connection;
  }
  async function transaction<T>(mode: IDBTransactionMode, body: (tx: IDBTransaction) => Promise<T>): Promise<T> {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(stores, mode);
      let result: T; let failure: unknown;
      tx.oncomplete = () => resolve(result);
      tx.onerror = tx.onabort = () => reject(failure ?? tx.error ?? new Error("Não foi possível salvar no dispositivo."));
      void body(tx).then(value => { result = value; }).catch(error => { failure = error; try { tx.abort(); } catch { reject(error); } });
    });
  }
  async function snapshot(tx: IDBTransaction) {
    const [patients, appointments, measurements, plans, photos, clinicalRecords] = await Promise.all(stores.slice(0, 6).map(store => read(tx.objectStore(store).getAll())));
    return { workspace: sortWorkspace({ patients, appointments, measurements, plans, photoAssessments: (photos as SavedPhoto[]).map(metadata), clinicalRecords }), photos: photos as SavedPhoto[] };
  }
  async function ownedPatient(tx: IDBTransaction, id: number) {
    if (!await read(tx.objectStore("patients").get(id))) throw new LocalError("Paciente não encontrado.", 404);
  }
  async function workspaceMutation(raw: unknown) {
    const body = z.object({ action: z.string() }).passthrough().parse(raw);
    return transaction("readwrite", async tx => {
      if (body.action === "createPatient") {
        const input = patientSchema.parse(body);
        return { id: Number(await read(tx.objectStore("patients").add({ ...input, createdAt: new Date().toISOString() }))) };
      }
      if (body.action === "updatePatient") {
        const input = patientSchema.extend({ id: idSchema }).parse(body);
        const store = tx.objectStore("patients"); const existing = await read(store.get(input.id));
        if (!existing) throw new LocalError("Paciente não encontrado.", 404);
        await read(store.put({ ...existing, ...input })); return { ok: true };
      }
      if (body.action === "setAppointmentStatus") {
        const input = z.object({ id: idSchema, status: statusSchema }).parse(body);
        const store = tx.objectStore("appointments"); const existing = await read(store.get(input.id));
        if (!existing) throw new LocalError("Consulta não encontrada.", 404);
        await read(store.put({ ...existing, status: input.status })); return { ok: true };
      }
      if (body.action === "createAppointment") {
        const input = appointmentSchema.parse(body); await ownedPatient(tx, input.patientId);
        return { id: Number(await read(tx.objectStore("appointments").add({ ...input, status: "Agendada" }))) };
      }
      if (body.action === "addMeasurement") {
        const input = measurementSchema.parse(body);
        if (input.weightKg === null && input.waistCm === null) throw new LocalError("Informe peso ou cintura.");
        await ownedPatient(tx, input.patientId);
        return { id: Number(await read(tx.objectStore("measurements").add(input))) };
      }
      if (body.action === "savePlan") {
        const { meals, ...input } = planSchema.parse(body); await ownedPatient(tx, input.patientId);
        const store = tx.objectStore("plans"); const existing = (await read(store.getAll())).find(item => item.patientId === input.patientId);
        await read(store.put({ ...input, ...(existing ? { id: existing.id } : {}), mealsJson: JSON.stringify(meals), updatedAt: new Date().toISOString() })); return { ok: true };
      }
      if (body.action === "saveClinicalRecord") {
        const input = clinicalRecordInputSchema.parse(body); await ownedPatient(tx, input.patientId);
        const store = tx.objectStore("clinicalRecords"); const existing = (await read(store.getAll())).find(item => item.patientId === input.patientId);
        const id = Number(await read(store.put({ ...input, ...(existing ? { id: existing.id } : {}), updatedAt: new Date().toISOString() })));
        return { id, ok: true };
      }
      throw new LocalError("Ação desconhecida.");
    });
  }
  async function savePhotos(form: FormData) {
    const front = form.get("front"), side = form.get("side");
    if (!(front instanceof Blob) || !(side instanceof Blob) || form.get("consent") !== "yes") throw new LocalError("Inclua duas fotos e confirme a autorização do paciente.");
    const input = photoInputSchema.parse({ patientId: Number(form.get("patientId")), measuredOn: form.get("measuredOn"), heightCm: Number(form.get("heightCm")) });
    const marks = marksSchema.parse(JSON.parse(String(form.get("marks"))));
    const result = estimateWaistFromPhotos(input.heightCm, marks.front, marks.side);
    for (const file of [front, side]) validatePhotoBytes(new Uint8Array(await file.arrayBuffer()), file.type);
    return transaction("readwrite", async tx => {
      await ownedPatient(tx, input.patientId);
      const id = Number(await read(tx.objectStore("photoAssessments").add({ ...input, ...result, createdAt: new Date().toISOString(), front, side })));
      return { id, ...result };
    });
  }
  async function request(path: string, init: RequestInit = {}) {
    try {
      const url = new URL(path, "https://nutrimara.invalid");
      const method = init.method ?? "GET";
      if (url.pathname === "/api/workspace" && method === "GET") return Response.json(await transaction("readonly", async tx => (await snapshot(tx)).workspace));
      if (url.pathname === "/api/workspace" && method === "POST") {
        const body = JSON.parse(String(init.body));
        const result = await workspaceMutation(body);
        return Response.json(result, { status: ["createPatient", "createAppointment", "addMeasurement"].includes(body.action) ? 201 : 200 });
      }
      if (url.pathname === "/api/photos" && method === "POST" && init.body instanceof FormData) return Response.json(await savePhotos(init.body), { status: 201 });
      if (url.pathname === "/api/photos" && method === "DELETE") {
        const id = idSchema.parse(Number(url.searchParams.get("id")));
        await transaction("readwrite", async tx => {
          const store = tx.objectStore("photoAssessments");
          if (!await read(store.get(id))) throw new LocalError("Avaliação não encontrada.", 404);
          await read(store.delete(id));
        });
        return Response.json({ ok: true });
      }
      throw new LocalError("Operação indisponível nesta versão.", 404);
    } catch (error) {
      let message = "Não foi possível acessar os dados deste dispositivo. Tente novamente.";
      let status = 500;
      if (error instanceof z.ZodError || error instanceof SyntaxError) { message = "Confira os campos e tente novamente."; status = 400; }
      else if (error instanceof LocalError) { message = error.message; status = error.status; }
      else if (error instanceof Error && error.name === "QuotaExceededError") message = "O armazenamento está cheio. Exporte uma cópia de segurança antes de liberar espaço.";
      else if (error instanceof Error && error.name !== "UnknownError") message = error.message;
      return Response.json({ error: message }, { status });
    }
  }
  async function photoUrl(id: number, view: "front" | "side") {
    const photo = await transaction("readonly", tx => read(tx.objectStore("photoAssessments").get(id))) as SavedPhoto | undefined;
    if (!photo) throw new LocalError("Foto não encontrada.", 404);
    return URL.createObjectURL(photo[view]);
  }
  async function exportBackup(): Promise<Backup> {
    const value = await transaction("readonly", snapshot);
    const photos = [];
    for (const photo of value.photos) photos.push({ id: photo.id, front: await toBase64(photo.front), side: await toBase64(photo.side) });
    return { format: "nutrimara-backup", version: 1, id: crypto.randomUUID(), exportedAt: new Date().toISOString(), workspace: value.workspace, photos };
  }
  async function importBackup(raw: unknown) {
    const parsed = backupSchema.safeParse(raw);
    if (!parsed.success) throw new LocalError("Arquivo de backup inválido ou de uma versão incompatível.");
    const backup = parsed.data;
    const patientIds = new Set(backup.workspace.patients.map(p => p.id));
    const photoIds = new Set(backup.workspace.photoAssessments.map(p => p.id));
    for (const records of Object.values(backup.workspace)) {
      if (new Set(records.map(r => r.id)).size !== records.length) throw new LocalError("O backup contém registros duplicados.");
      for (const record of records) if ("patientId" in record && !patientIds.has(record.patientId)) throw new LocalError("O backup contém um vínculo de paciente inválido.");
    }
    if (new Set(backup.workspace.plans.map(p => p.patientId)).size !== backup.workspace.plans.length) throw new LocalError("O backup contém planos duplicados.");
    if (backup.photos.length !== photoIds.size || new Set(backup.photos.map(p => p.id)).size !== photoIds.size || backup.photos.some(p => !photoIds.has(p.id))) throw new LocalError("O backup não contém todas as fotografias.");
    const blobs = new Map<number, { front: Blob; side: Blob }>();
    try { for (const p of backup.photos) blobs.set(p.id, { front: fromBase64(p.front), side: fromBase64(p.side) }); }
    catch { throw new LocalError("O backup contém uma fotografia inválida."); }
    return transaction("readwrite", async tx => {
      if (await read(tx.objectStore("imports").get(backup.id))) throw new LocalError("Esta cópia de segurança já foi importada.");
      const remapped = new Map<number, number>();
      for (const { id, ...patient } of backup.workspace.patients) remapped.set(id, Number(await read(tx.objectStore("patients").add(patient))));
      for (const key of ["appointments", "measurements", "plans", "photoAssessments", "clinicalRecords"] as const) {
        for (const { id, patientId, ...record } of backup.workspace[key]) await read(tx.objectStore(key).add({ ...record, patientId: remapped.get(patientId), ...(key === "photoAssessments" ? blobs.get(id) : {}) }));
      }
      await read(tx.objectStore("imports").add({ id: backup.id, importedAt: new Date().toISOString() }));
      return { addedPatients: remapped.size };
    });
  }
  return { request, photoUrl, exportBackup, importBackup };
}
