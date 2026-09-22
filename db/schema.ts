import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const patients = sqliteTable("patients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull().default(""),
  birthDate: text("birth_date").notNull().default(""),
  goal: text("goal").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull().default(""),
}, (table) => [index("idx_patients_owner_name").on(table.ownerId, table.name)]);

export const appointments = sqliteTable("appointments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerId: text("owner_id").notNull(),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  startsAt: text("starts_at").notNull(),
  kind: text("kind").notNull().default("Consulta"),
  status: text("status").notNull().default("Agendada"),
  notes: text("notes").notNull().default(""),
}, (table) => [index("idx_appointments_owner_date").on(table.ownerId, table.startsAt)]);

export const measurements = sqliteTable("measurements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerId: text("owner_id").notNull(),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  measuredOn: text("measured_on").notNull(),
  weightKg: real("weight_kg"),
  waistCm: real("waist_cm"),
  notes: text("notes").notNull().default(""),
}, (table) => [index("idx_measurements_owner_patient_date").on(table.ownerId, table.patientId, table.measuredOn)]);

export const photoAssessments = sqliteTable("photo_assessments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerId: text("owner_id").notNull(),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  measuredOn: text("measured_on").notNull(),
  heightCm: real("height_cm").notNull(),
  frontKey: text("front_key").notNull(),
  sideKey: text("side_key").notNull(),
  frontWidthCm: real("front_width_cm").notNull(),
  sideDepthCm: real("side_depth_cm").notNull(),
  waistEstimateCm: real("waist_estimate_cm").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("idx_photo_assessments_owner_patient_date").on(table.ownerId, table.patientId, table.measuredOn)]);

export const mealPlans = sqliteTable("meal_plans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerId: text("owner_id").notNull(),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  title: text("title").notNull(),
  instructions: text("instructions").notNull().default(""),
  mealsJson: text("meals_json").notNull().default("[]"),
  updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("uidx_meal_plans_patient").on(table.patientId), index("idx_meal_plans_owner").on(table.ownerId)]);
