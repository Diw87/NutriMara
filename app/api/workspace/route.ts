import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const short = (max: number) => z.string().trim().max(max);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const patientSchema = z.object({
  name: short(120).min(2),
  phone: short(40).default(""),
  birthDate: z.union([date, z.literal("")]).default(""),
  goal: short(240).default(""),
  notes: short(3000).default(""),
});
const appointmentSchema = z.object({
  patientId: z.number().int().positive(),
  startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  kind: z.enum(["Consulta", "Retorno"]),
  notes: short(1000).default(""),
});
const measurementSchema = z.object({
  patientId: z.number().int().positive(),
  measuredOn: date,
  weightKg: z.number().positive().max(600).nullable(),
  waistCm: z.number().positive().max(400).nullable(),
  notes: short(1000).default(""),
}).refine(value => value.weightKg !== null || value.waistCm !== null, "Informe peso ou cintura.");
const mealSchema = z.object({
  time: short(12),
  label: short(80).min(1),
  foods: short(700).min(1),
});
const planSchema = z.object({
  patientId: z.number().int().positive(),
  title: short(120).min(2),
  instructions: short(2000).default(""),
  meals: z.array(mealSchema).min(1).max(12),
});

function database() {
  if (!env.DB) throw new Error("DATABASE_UNAVAILABLE");
  return env.DB;
}

function problem(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function failure(error: unknown) {
  if (error instanceof z.ZodError) return problem(error.issues[0]?.message === "Informe peso ou cintura." ? "Informe peso ou cintura." : "Confira os campos e tente novamente.", 400);
  if (error instanceof SyntaxError) return problem("Não foi possível ler os dados enviados.", 400);
  console.error("NutriMara workspace request failed", error);
  return problem("Não foi possível acessar os registros agora. Tente novamente.", 503);
}

async function ownedPatient(db: D1Database, ownerId: string, patientId: number) {
  return db.prepare("SELECT id FROM patients WHERE id = ? AND owner_id = ?")
    .bind(patientId, ownerId).first<{ id: number }>();
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return problem("Entre na sua conta para ver os registros.", 401);
  try {
    const db = database();
    const [patients, appointments, measurements, plans, photoAssessments] = await Promise.all([
      db.prepare("SELECT id, name, phone, birth_date AS birthDate, goal, notes, created_at AS createdAt FROM patients WHERE owner_id = ? ORDER BY name COLLATE NOCASE").bind(user.userId).all(),
      db.prepare("SELECT id, patient_id AS patientId, starts_at AS startsAt, kind, status, notes FROM appointments WHERE owner_id = ? ORDER BY starts_at DESC").bind(user.userId).all(),
      db.prepare("SELECT id, patient_id AS patientId, measured_on AS measuredOn, weight_kg AS weightKg, waist_cm AS waistCm, notes FROM measurements WHERE owner_id = ? ORDER BY measured_on DESC, id DESC").bind(user.userId).all(),
      db.prepare("SELECT id, patient_id AS patientId, title, instructions, meals_json AS mealsJson, updated_at AS updatedAt FROM meal_plans WHERE owner_id = ?").bind(user.userId).all(),
      db.prepare("SELECT id, patient_id AS patientId, measured_on AS measuredOn, height_cm AS heightCm, front_width_cm AS frontWidthCm, side_depth_cm AS sideDepthCm, waist_estimate_cm AS waistEstimateCm, created_at AS createdAt FROM photo_assessments WHERE owner_id = ? ORDER BY measured_on DESC, id DESC").bind(user.userId).all(),
    ]);
    return Response.json({
      patients: patients.results,
      appointments: appointments.results,
      measurements: measurements.results,
      plans: plans.results,
      photoAssessments: photoAssessments.results,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return problem("Entre na sua conta para alterar os registros.", 401);
  try {
    const raw: unknown = await request.json();
    const body = z.object({ action: z.string() }).passthrough().parse(raw);
    const db = database();

    if (body.action === "createPatient") {
      const input = patientSchema.parse(body);
      const result = await db.prepare("INSERT INTO patients (owner_id, name, phone, birth_date, goal, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(user.userId, input.name, input.phone, input.birthDate, input.goal, input.notes, new Date().toISOString()).run();
      return Response.json({ id: result.meta.last_row_id }, { status: 201 });
    }

    if (body.action === "updatePatient") {
      const input = patientSchema.extend({ id: z.number().int().positive() }).parse(body);
      const result = await db.prepare("UPDATE patients SET name = ?, phone = ?, birth_date = ?, goal = ?, notes = ? WHERE id = ? AND owner_id = ?")
        .bind(input.name, input.phone, input.birthDate, input.goal, input.notes, input.id, user.userId).run();
      if (!result.meta.changes) return problem("Paciente não encontrado.", 404);
      return Response.json({ ok: true });
    }

    if (body.action === "createAppointment") {
      const input = appointmentSchema.parse(body);
      if (!(await ownedPatient(db, user.userId, input.patientId))) return problem("Paciente não encontrado.", 404);
      const result = await db.prepare("INSERT INTO appointments (owner_id, patient_id, starts_at, kind, status, notes) VALUES (?, ?, ?, ?, 'Agendada', ?)")
        .bind(user.userId, input.patientId, input.startsAt, input.kind, input.notes).run();
      return Response.json({ id: result.meta.last_row_id }, { status: 201 });
    }

    if (body.action === "setAppointmentStatus") {
      const input = z.object({ id: z.number().int().positive(), status: z.enum(["Agendada", "Concluída", "Cancelada"]) }).parse(body);
      const result = await db.prepare("UPDATE appointments SET status = ? WHERE id = ? AND owner_id = ?")
        .bind(input.status, input.id, user.userId).run();
      if (!result.meta.changes) return problem("Consulta não encontrada.", 404);
      return Response.json({ ok: true });
    }

    if (body.action === "addMeasurement") {
      const input = measurementSchema.parse(body);
      if (!(await ownedPatient(db, user.userId, input.patientId))) return problem("Paciente não encontrado.", 404);
      const result = await db.prepare("INSERT INTO measurements (owner_id, patient_id, measured_on, weight_kg, waist_cm, notes) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(user.userId, input.patientId, input.measuredOn, input.weightKg, input.waistCm, input.notes).run();
      return Response.json({ id: result.meta.last_row_id }, { status: 201 });
    }

    if (body.action === "savePlan") {
      const input = planSchema.parse(body);
      if (!(await ownedPatient(db, user.userId, input.patientId))) return problem("Paciente não encontrado.", 404);
      const now = new Date().toISOString();
      await db.prepare(`INSERT INTO meal_plans (owner_id, patient_id, title, instructions, meals_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(patient_id) DO UPDATE SET title = excluded.title,
          instructions = excluded.instructions, meals_json = excluded.meals_json,
          updated_at = excluded.updated_at WHERE meal_plans.owner_id = excluded.owner_id`)
        .bind(user.userId, input.patientId, input.title, input.instructions, JSON.stringify(input.meals), now).run();
      return Response.json({ ok: true });
    }

    return problem("Ação desconhecida.", 400);
  } catch (error) {
    return failure(error);
  }
}
