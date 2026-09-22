import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { estimateWaistFromPhotos, type MarkedPhoto } from "@/lib/photo-estimate";
import { validatePhotoBytes } from "@/lib/photo-upload";
import { z } from "zod";

export const dynamic = "force-dynamic";

const pointSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });
const photoSchema = z.object({
  width: z.number().int().min(200).max(5000),
  height: z.number().int().min(400).max(5000),
  head: pointSchema, feet: pointSchema, left: pointSchema, right: pointSchema,
});
const marksSchema = z.object({ front: photoSchema, side: photoSchema });

function unavailable(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function resources() {
  if (!env.DB || !env.BUCKET) throw new Error("STORAGE_UNAVAILABLE");
  return { db: env.DB, bucket: env.BUCKET };
}

function identifier(request: Request) {
  const value = new URL(request.url).searchParams.get("id");
  const id = Number(value);
  return value && Number.isSafeInteger(id) && id > 0 ? id : null;
}

function reportFailure(error: unknown) {
  if (error instanceof z.ZodError || error instanceof SyntaxError) return unavailable("Confira os dados da avaliação e tente novamente.", 400);
  console.error("NutriMara photo request failed", error);
  return unavailable("Não foi possível acessar as fotos agora. Tente novamente.", 503);
}

type StoredPhoto = { frontKey: string; sideKey: string };

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return unavailable("Entre na sua conta para acessar as fotos.", 401);
  const id = identifier(request);
  const view = new URL(request.url).searchParams.get("view");
  if (!id || (view !== "front" && view !== "side")) return unavailable("Foto não encontrada.", 404);
  try {
    const { db, bucket } = resources();
    const assessment = await db.prepare("SELECT front_key AS frontKey, side_key AS sideKey FROM photo_assessments WHERE id = ? AND owner_id = ?")
      .bind(id, user.userId).first<StoredPhoto>();
    if (!assessment) return unavailable("Foto não encontrada.", 404);
    const image = await bucket.get(view === "front" ? assessment.frontKey : assessment.sideKey);
    if (!image) return unavailable("Foto não encontrada.", 404);
    return new Response(image.body, { headers: {
      "Content-Type": "image/jpeg", "Content-Disposition": "inline", "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) { return reportFailure(error); }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return unavailable("Entre na sua conta para salvar as fotos.", 401);
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 9 * 1024 * 1024) return unavailable("Reduza o tamanho das fotos e tente novamente.", 413);
  try {
    const { db, bucket } = resources();
    const form = await request.formData();
    const frontFile = form.get("front");
    const sideFile = form.get("side");
    if (!(frontFile instanceof File) || !(sideFile instanceof File) || form.get("consent") !== "yes") {
      return unavailable("Inclua duas fotos e confirme a autorização do paciente.", 400);
    }
    const patientId = z.coerce.number().int().positive().parse(form.get("patientId"));
    const measuredOn = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(form.get("measuredOn"));
    const heightCm = z.coerce.number().min(60).max(230).parse(form.get("heightCm"));
    const marks = marksSchema.parse(JSON.parse(z.string().parse(form.get("marks")))) as { front: MarkedPhoto; side: MarkedPhoto };
    let result;
    try { result = estimateWaistFromPhotos(heightCm, marks.front, marks.side); }
    catch (error) { return unavailable(error instanceof Error ? error.message : "Confira os pontos marcados.", 400); }

    const patient = await db.prepare("SELECT id FROM patients WHERE id = ? AND owner_id = ?")
      .bind(patientId, user.userId).first();
    if (!patient) return unavailable("Paciente não encontrado.", 404);
    if (frontFile.size > 4 * 1024 * 1024 || sideFile.size > 4 * 1024 * 1024) return unavailable("Use fotos JPG com até 4 MB.", 413);
    const [frontBytes, sideBytes] = await Promise.all([
      frontFile.arrayBuffer().then((value) => new Uint8Array(value)),
      sideFile.arrayBuffer().then((value) => new Uint8Array(value)),
    ]);
    try {
      validatePhotoBytes(frontBytes, frontFile.type);
      validatePhotoBytes(sideBytes, sideFile.type);
    } catch (error) { return unavailable(error instanceof Error ? error.message : "Fotos inválidas.", 400); }

    const frontKey = `patient-photos/${crypto.randomUUID()}.jpg`;
    const sideKey = `patient-photos/${crypto.randomUUID()}.jpg`;
    try {
      await bucket.put(frontKey, frontBytes, { httpMetadata: { contentType: "image/jpeg" } });
      await bucket.put(sideKey, sideBytes, { httpMetadata: { contentType: "image/jpeg" } });
      const saved = await db.prepare(`INSERT INTO photo_assessments
        (owner_id, patient_id, measured_on, height_cm, front_key, side_key, front_width_cm, side_depth_cm, waist_estimate_cm, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
        user.userId, patientId, measuredOn, heightCm, frontKey, sideKey,
        result.frontWidthCm, result.sideDepthCm, result.waistEstimateCm, new Date().toISOString(),
      ).run();
      return Response.json({ id: saved.meta.last_row_id, ...result }, { status: 201, headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      await Promise.allSettled([bucket.delete(frontKey), bucket.delete(sideKey)]);
      throw error;
    }
  } catch (error) { return reportFailure(error); }
}

export async function DELETE(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return unavailable("Entre na sua conta para remover as fotos.", 401);
  const id = identifier(request);
  if (!id) return unavailable("Avaliação não encontrada.", 404);
  try {
    const { db, bucket } = resources();
    const assessment = await db.prepare("SELECT front_key AS frontKey, side_key AS sideKey FROM photo_assessments WHERE id = ? AND owner_id = ?")
      .bind(id, user.userId).first<StoredPhoto>();
    if (!assessment) return unavailable("Avaliação não encontrada.", 404);
    await Promise.all([bucket.delete(assessment.frontKey), bucket.delete(assessment.sideKey)]);
    await db.prepare("DELETE FROM photo_assessments WHERE id = ? AND owner_id = ?").bind(id, user.userId).run();
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return reportFailure(error); }
}
