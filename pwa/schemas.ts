import { z } from "zod";
import { moneyToCents } from './consultorio-data.ts';

const short = (max: number) => z.string().trim().max(max);
export const idSchema = z.number().int().positive().safe();
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
});
export const patientSchema = z.object({ name: short(120).min(2), phone: short(40).default(""), birthDate: z.union([dateSchema, z.literal("")]).default(""), goal: short(240).default(""), notes: short(3000).default(""),
  nickname: short(120).optional(), email: z.union([short(254).email(), z.literal("")]).optional(), cpf: short(20).optional(),
  sex: z.enum(["", "Masculino", "Feminino", "Outro"]).optional(), biologicalCondition: z.enum(["", "Normal", "Gestante", "Lactante"]).optional(), tags: short(1000).optional(),
});
export const appointmentSchema = z.object({ patientId: idSchema, startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/).refine(v => dateSchema.safeParse(v.slice(0, 10)).success), kind: z.enum(["Consulta", "Retorno"]), notes: short(1000).default("") });
export const statusSchema = z.enum(["Agendada", "Concluída", "Cancelada"]);
export const measurementSchema = z.object({ patientId: idSchema, measuredOn: dateSchema, weightKg: z.number().positive().max(600).nullable(), waistCm: z.number().positive().max(400).nullable(), notes: short(1000).default("") });
export const mealsSchema = z.array(z.object({ time: short(12), label: short(80).min(1), foods: short(700).min(1) })).min(1).max(12);
export const planSchema = z.object({ patientId: idSchema, title: short(120).min(2), instructions: short(2000).default(""), meals: mealsSchema });
const optionalMeasure = (max: number) => z.number().positive().max(max).nullable();
export const clinicalRecordInputSchema = z.object({
  patientId: idSchema,
  consultationDate: dateSchema,
  mainComplaint: short(2000).default(""),
  clinicalHistory: short(5000).default(""),
  diagnoses: short(3000).default(""),
  medications: short(3000).default(""),
  allergies: short(2000).default(""),
  surgeries: short(2000).default(""),
  familyHistory: short(2000).default(""),
  bowelHabits: short(1200).default(""),
  sleep: short(1200).default(""),
  physicalActivity: short(1800).default(""),
  waterIntake: short(1200).default(""),
  foodRoutine: short(5000).default(""),
  restrictions: short(2000).default(""),
  weightKg: optionalMeasure(600),
  heightCm: optionalMeasure(250),
  waistCm: optionalMeasure(400),
  hipCm: optionalMeasure(400),
  bodyFatPct: z.number().positive().max(100).nullable(),
  bloodPressure: short(80).default(""),
  goals: short(3000).default(""),
  conduct: short(5000).default(""),
  returnDate: z.union([dateSchema, z.literal("")]).default(""),
  professionalNotes: short(5000).default(""),
});
export const clinicalRecordSchema = clinicalRecordInputSchema.extend({ id: idSchema, updatedAt: z.string().datetime() });
export const entryModuleSchema = z.enum(['pharma','assessment','consultations','questionnaires','labs','gestation','energy','supplements','goals','compounds','guidance','attachments','notes','documents','finance']);
export const attachmentMetadataSchema = z.object({ name: short(255).min(1), contentType: z.enum(['application/pdf','image/png','image/jpeg']), size: z.number().int().positive().max(10 * 1024 * 1024) });
const clinicalEntryFieldsSchema = z.object({ patientId: idSchema, module: entryModuleSchema, title: short(120).min(2), recordedOn: dateSchema, status: z.enum(['Rascunho','Finalizado','Arquivado']), fields: z.record(short(80).min(1), z.string().max(20000)).refine(value => Object.keys(value).length <= 80) });
function validateFinance(value: z.infer<typeof clinicalEntryFieldsSchema>, ctx: z.RefinementCtx) {
  if (value.module !== 'finance' || value.status !== 'Finalizado') return;
  try { moneyToCents(value.fields.amount); } catch { ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fields','amount'], message: 'Informe um valor monetário positivo válido.' }); }
  if (!['Receita','Despesa'].includes(value.fields.direction)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fields','direction'], message: 'Escolha Receita ou Despesa.' });
  if (!['Pendente','Pago'].includes(value.fields.paymentStatus)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fields','paymentStatus'], message: 'Escolha Pendente ou Pago.' });
}
export const clinicalEntryInputSchema = clinicalEntryFieldsSchema.superRefine(validateFinance);
export const clinicalEntrySchema = clinicalEntryFieldsSchema.extend({ id: idSchema, createdAt: z.string().datetime(), updatedAt: z.string().datetime(), attachment: attachmentMetadataSchema.optional() }).superRefine(validateFinance).refine(value => !value.attachment || value.module === 'attachments');
export const attachmentInputSchema = z.object({ patientId: idSchema, title: short(120).min(2), recordedOn: dateSchema, description: short(20000).default(''), status: z.enum(['Rascunho','Finalizado','Arquivado']).default('Finalizado') });
const point = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });
const marked = z.object({ width: z.number().int().min(200).max(5000), height: z.number().int().min(400).max(5000), head: point, feet: point, left: point, right: point });
export const marksSchema = z.object({ front: marked, side: marked });
const edges = z.object({ left: point, right: point });
const regionPair = z.object({ front: edges, side: edges });
export const regionMarksSchema = z.object({ abdomen: regionPair.optional(), hip: regionPair.optional() });
export const tapeMeasuresSchema = z.object({ waistCm: optionalMeasure(400).optional(), abdomenCm: optionalMeasure(400).optional(), hipCm: optionalMeasure(400).optional() });

export const photoInputSchema = z.object({ patientId: idSchema, measuredOn: dateSchema, heightCm: z.number().min(60).max(230) });
const photoRecord = photoInputSchema.extend({ id: idSchema, frontWidthCm: z.number().positive(), sideDepthCm: z.number().positive(), waistEstimateCm: z.number().positive(), abdomenEstimateCm: optionalMeasure(400).optional(), hipEstimateCm: optionalMeasure(400).optional(), tapeMeasures: tapeMeasuresSchema.optional(), regionMarks: regionMarksSchema.optional(), marks: marksSchema.optional(), createdAt: z.string().datetime() });
export const workspaceSchema = z.object({
  patients: z.array(patientSchema.extend({ id: idSchema, createdAt: z.string().datetime() })).max(50000),
  appointments: z.array(appointmentSchema.extend({ id: idSchema, status: statusSchema })).max(200000),
  measurements: z.array(measurementSchema.extend({ id: idSchema }).refine(v => v.weightKg !== null || v.waistCm !== null, "Informe o peso ou a cintura.")).max(200000),
  plans: z.array(z.object({ id: idSchema, patientId: idSchema, title: short(120).min(2), instructions: short(2000), mealsJson: z.string().max(20000).refine(v => { try { return mealsSchema.safeParse(JSON.parse(v)).success; } catch { return false; } }), updatedAt: z.string().datetime() })).max(50000),
  photoAssessments: z.array(photoRecord).max(50000),
  clinicalRecords: z.array(clinicalRecordSchema).max(50000).default([]),
  clinicalEntries: z.array(clinicalEntrySchema).max(200000).default([]),
});
const attachmentBase64 = z.string().min(4).max(13981016).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/);
export const backupSchema = z.object({ format: z.literal("nutrimara-backup"), version: z.union([z.literal(1), z.literal(2), z.literal(3)]), id: z.string().uuid(), exportedAt: z.string().datetime(), workspace: workspaceSchema,
  photos: z.array(z.object({ id: idSchema, front: z.string().min(4).max(5600000), side: z.string().min(4).max(5600000) })).max(50000),
  attachments: z.array(z.object({ id: idSchema, data: attachmentBase64 })).max(50000).default([]),
});
export type Workspace = z.infer<typeof workspaceSchema>;
export type Backup = z.infer<typeof backupSchema>;
export type PhotoRecord = z.infer<typeof photoRecord>;
