import { z } from "zod";

const short = (max: number) => z.string().trim().max(max);
export const idSchema = z.number().int().positive().safe();
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
});
export const patientSchema = z.object({ name: short(120).min(2), phone: short(40).default(""), birthDate: z.union([dateSchema, z.literal("")]).default(""), goal: short(240).default(""), notes: short(3000).default("") });
export const appointmentSchema = z.object({ patientId: idSchema, startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/).refine(v => dateSchema.safeParse(v.slice(0, 10)).success), kind: z.enum(["Consulta", "Retorno"]), notes: short(1000).default("") });
export const statusSchema = z.enum(["Agendada", "Concluída", "Cancelada"]);
export const measurementSchema = z.object({ patientId: idSchema, measuredOn: dateSchema, weightKg: z.number().positive().max(600).nullable(), waistCm: z.number().positive().max(400).nullable(), notes: short(1000).default("") });
export const mealsSchema = z.array(z.object({ time: short(12), label: short(80).min(1), foods: short(700).min(1) })).min(1).max(12);
export const planSchema = z.object({ patientId: idSchema, title: short(120).min(2), instructions: short(2000).default(""), meals: mealsSchema });
const point = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });
const marked = z.object({ width: z.number().int().min(200).max(5000), height: z.number().int().min(400).max(5000), head: point, feet: point, left: point, right: point });
export const marksSchema = z.object({ front: marked, side: marked });
export const photoInputSchema = z.object({ patientId: idSchema, measuredOn: dateSchema, heightCm: z.number().min(60).max(230) });
const photoRecord = photoInputSchema.extend({ id: idSchema, frontWidthCm: z.number().positive(), sideDepthCm: z.number().positive(), waistEstimateCm: z.number().positive(), createdAt: z.string().datetime() });
export const workspaceSchema = z.object({
  patients: z.array(patientSchema.extend({ id: idSchema, createdAt: z.string().datetime() })).max(50000),
  appointments: z.array(appointmentSchema.extend({ id: idSchema, status: statusSchema })).max(200000),
  measurements: z.array(measurementSchema.extend({ id: idSchema }).refine(v => v.weightKg !== null || v.waistCm !== null, "Informe o peso ou a cintura.")).max(200000),
  plans: z.array(z.object({ id: idSchema, patientId: idSchema, title: short(120).min(2), instructions: short(2000), mealsJson: z.string().max(20000).refine(v => { try { return mealsSchema.safeParse(JSON.parse(v)).success; } catch { return false; } }), updatedAt: z.string().datetime() })).max(50000),
  photoAssessments: z.array(photoRecord).max(50000),
});
export const backupSchema = z.object({ format: z.literal("nutrimara-backup"), version: z.literal(1), id: z.string().uuid(), exportedAt: z.string().datetime(), workspace: workspaceSchema,
  photos: z.array(z.object({ id: idSchema, front: z.string().min(4).max(5600000), side: z.string().min(4).max(5600000) })).max(50000),
});
export type Workspace = z.infer<typeof workspaceSchema>;
export type Backup = z.infer<typeof backupSchema>;
export type PhotoRecord = z.infer<typeof photoRecord>;
