"use client";

import {type ReactNode, type FormEvent, useCallback, useEffect, useMemo, useRef, useState} from "react";
import {serverClient, type ClinicClient} from "@/lib/clinic-client";
import {
  Activity, ArrowLeft, ArrowRight, Baby, CalendarDays, Camera, Check, ChevronRight,
  ClipboardCheck, ClipboardList, Clock3, FileText, FlaskConical, FolderOpen,
  LayoutDashboard, ListPlus, NotebookPen, Pill, Plus, Printer, Receipt, Ruler, Search,
  Settings2, Stethoscope, Target, Users, Utensils, X, Calculator, type LucideIcon,
} from "lucide-react";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Input} from "@/components/ui/input";
import {NativeSelect, NativeSelectOption} from "@/components/ui/native-select";
import {Textarea} from "@/components/ui/textarea";
import {Toaster} from "@/components/ui/sonner";
import AiAssistant from "@/components/ai-assistant";
import PhotoAssessment, {type PhotoAssessmentRecord} from "@/components/photo-assessment";
import ClinicalRecordPanel, {type ClinicalRecord} from "@/components/clinical-record-panel";
import ClinicalEntryPanel from "@/components/clinical-entry-panel";
import ConsultorioAgenda, {type Appointment} from "@/components/consultorio-agenda";
import {printablePlanHTML} from "../pwa/plan-print";
import {ENTRY_MODULES, type ClinicalEntry, type EntryModule} from "../pwa/consultorio-types";
import {keepPatientDraft, listPatients, patientLastActivity, patientTags, type ActivityStamp, type PatientFilter, type PatientSort} from "../pwa/consultorio-navigation";
import {toast} from "sonner";
import "../app/consultorio.css";

type Patient = {
  id: number; name: string; phone: string; birthDate: string; goal: string; notes: string; createdAt: string;
  nickname?: string; email?: string; cpf?: string; sex?: "" | "Masculino" | "Feminino" | "Outro";
  biologicalCondition?: "" | "Normal" | "Gestante" | "Lactante"; tags?: string; _version?: number;
};
type Measurement = {id: number; patientId: number; measuredOn: string; weightKg: number | null; waistCm: number | null; notes: string};
type Meal = {time: string; label: string; foods: string};
type MealPlan = {id: number; patientId: number; title: string; instructions: string; mealsJson: string; updatedAt: string; _version?: number};
type PlanDraft = {patientId: number | null; title: string; instructions: string; meals: Meal[]; version: number | null; loadedAt?: string};
type Workspace = {
  patients: Patient[]; appointments: Appointment[]; measurements: Measurement[]; plans: MealPlan[];
  photoAssessments: PhotoAssessmentRecord[]; clinicalRecords?: ClinicalRecord[]; clinicalEntries?: ClinicalEntry[];
};
type Section = "overview" | "patients" | "agenda";
type PatientView = EntryModule | "profile" | "followup" | "anamnesis" | "photos" | "anthropometry" | "plans";
type PatientForm = Omit<Patient, "id" | "createdAt" | "_version">;
type SiteTool = {name: string; title: string; description: string; inputSchema: object; annotations: {readOnlyHint: boolean; untrustedContentHint: boolean}; execute: (input: unknown) => Promise<unknown>};
type SiteModelContext = {registerTool: (tool: SiteTool, options: {signal: AbortSignal}) => void | Promise<void>};

const emptyWorkspace: Workspace = {patients: [], appointments: [], measurements: [], plans: [], photoAssessments: [], clinicalRecords: [], clinicalEntries: []};
const emptyPatient: PatientForm = {name: "", phone: "", birthDate: "", goal: "", notes: "", nickname: "", email: "", cpf: "", sex: "", biologicalCondition: "", tags: ""};
const firstMeals: Meal[] = [{time: "07:00", label: "Café da manhã", foods: ""}, {time: "12:00", label: "Almoço", foods: ""}, {time: "19:00", label: "Jantar", foods: ""}];
const nav: {value: Section; label: string; icon: LucideIcon}[] = [
  {value: "overview", label: "Painel", icon: LayoutDashboard},
  {value: "patients", label: "Pacientes", icon: Users},
  {value: "agenda", label: "Agenda", icon: CalendarDays},
];
const patientNavigation: {value: PatientView; label: string; icon: LucideIcon; group: string; description: string}[] = [
  {value: "profile", label: "Perfil", icon: Users, group: "Paciente", description: "Cadastro e visão do acompanhamento."},
  {value: "pharma", label: "Fármaco-nutrientes", icon: Pill, group: "Avaliação", description: "Medicamentos, avaliação e conduta profissional."},
  {value: "followup", label: "Acompanhamento", icon: Activity, group: "Avaliação", description: "Acompanhe os registros de peso ao longo do tempo."},
  {value: "assessment", label: "Avaliação integrada", icon: ClipboardCheck, group: "Avaliação", description: "Reúna a avaliação e a conduta da consulta."},
  {value: "consultations", label: "Histórico de consultas", icon: CalendarDays, group: "Avaliação", description: "Registre atendimentos e consulte o histórico."},
  {value: "anamnesis", label: "Anamnese geral", icon: Stethoscope, group: "Avaliação", description: "Histórico clínico, hábitos e ficha de acompanhamento."},
  {value: "questionnaires", label: "Questionários", icon: ClipboardList, group: "Avaliação", description: "Registre as respostas e sua avaliação."},
  {value: "labs", label: "Exames", icon: FlaskConical, group: "Avaliação", description: "Resultados informados e interpretação profissional."},
  {value: "photos", label: "Evolução fotográfica", icon: Camera, group: "Avaliação", description: "Fotos comparativas e estimativas geométricas por marcação."},
  {value: "anthropometry", label: "Antropometria", icon: Ruler, group: "Avaliação", description: "Peso, medidas e ficha antropométrica."},
  {value: "gestation", label: "Gestação", icon: Baby, group: "Avaliação", description: "Avaliação e acompanhamento nutricional na gestação."},
  {value: "energy", label: "Cálculo energético", icon: Calculator, group: "Conduta", description: "Estimativa energética e meta definida pela profissional."},
  {value: "plans", label: "Planejamento alimentar", icon: Utensils, group: "Conduta", description: "Organize refeições, porções e orientações do plano."},
  {value: "supplements", label: "Suplementos", icon: Pill, group: "Conduta", description: "Registre suplementação e conduta profissional."},
  {value: "goals", label: "Metas", icon: Target, group: "Conduta", description: "Objetivos acordados e acompanhamento das metas."},
  {value: "compounds", label: "Manipulados", icon: FlaskConical, group: "Conduta", description: "Composição e orientações informadas pela profissional."},
  {value: "guidance", label: "Orientações", icon: FileText, group: "Conduta", description: "Orientações individuais para o acompanhamento."},
  {value: "attachments", label: "Arquivos", icon: FolderOpen, group: "Documentação", description: "Documentos e imagens vinculados ao prontuário."},
  {value: "notes", label: "Prontuário", icon: NotebookPen, group: "Documentação", description: "Anotações e evolução clínica da profissional."},
  {value: "documents", label: "Documentos / atestados", icon: FileText, group: "Documentação", description: "Prepare, revise e imprima documentos do paciente."},
  {value: "finance", label: "Recibos / financeiro", icon: Receipt, group: "Documentação", description: "Receitas, despesas, pagamentos e recibos."},
];

function today() { return new Date().toLocaleDateString("sv-SE", {timeZone: "America/Sao_Paulo"}); }
function formatDay(day: string) {
  if (!day) return "—";
  if (day.endsWith("Z")) return new Date(day).toLocaleDateString("pt-BR", {day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo"});
  return new Date(day.slice(0, 10) + "T12:00:00").toLocaleDateString("pt-BR", {day: "2-digit", month: "short", year: "numeric"});
}
function formatLongDay(day: string) { return new Date(day + "T12:00:00").toLocaleDateString("pt-BR", {weekday: "long", day: "numeric", month: "long"}); }
function parseMeals(raw: string): Meal[] {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter(meal => meal && typeof meal.foods === "string").map(meal => ({time: typeof meal.time === "string" ? meal.time : "", label: typeof meal.label === "string" ? meal.label : "", foods: meal.foods})) : [];
  } catch { return []; }
}
function planDraftFromSaved(patientId: number | null, plan?: MealPlan): PlanDraft {
  return {patientId, title: plan?.title ?? "Plano alimentar", instructions: plan?.instructions ?? "", meals: plan ? parseMeals(plan.mealsJson) : firstMeals.map(meal => ({...meal})), version: plan?._version ?? null, loadedAt: plan?.updatedAt};
}
function number(value: number | null, suffix: string) { return value === null ? "—" : value.toLocaleString("pt-BR", {maximumFractionDigits: 1}) + " " + suffix; }
function initials(name: string) { return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join(""); }
function ageFromDate(value: string) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  const now = today();
  const age = Number(now.slice(0, 4)) - year - (now.slice(5) < String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0") ? 1 : 0);
  return age >= 0 ? age : null;
}
function statusClass(status: string) { return status.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }

function EmptyState({title, description, action, onAction, icon: Icon = ClipboardList}: {title: string; description: string; action?: string; onAction?: () => void; icon?: LucideIcon}) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={23}/></div><h3>{title}</h3><p>{description}</p>{action && onAction && <button className="button button-primary" onClick={onAction}><Plus size={17}/>{action}</button>}</div>;
}
function DataPair({label, children}: {label: string; children: ReactNode}) { return <div className="consultorio-data-pair"><dt>{label}</dt><dd>{children || "Não informado"}</dd></div>; }
function WeightChart({measurements}: {measurements: Measurement[]}) {
  const values = measurements.filter(item => item.weightKg !== null).slice().sort((a, b) => a.measuredOn.localeCompare(b.measuredOn) || a.id - b.id).slice(-8);
  if (values.length < 2) return <p className="chart-placeholder">Registre pelo menos duas pesagens para acompanhar a curva de evolução.</p>;
  const weights = values.map(item => item.weightKg as number);
  const low = Math.min(...weights) - 1; const high = Math.max(...weights) + 1;
  const points = values.map((item, index) => ({x: 34 + index * 592 / (values.length - 1), y: 170 - ((item.weightKg as number) - low) / (high - low) * 135}));
  return <div className="chart-wrap"><svg viewBox="0 0 660 210" role="img" aria-label={"Evolução do peso: de " + number(weights[0], "kg") + " a " + number(weights.at(-1) ?? null, "kg")}>
    {[45, 105, 165].map(y => <line key={y} x1="34" x2="626" y1={y} y2={y} stroke="#e5eeec" strokeDasharray="5 6"/>)}
    <polyline points={points.map(point => point.x + "," + point.y).join(" ")} fill="none" stroke="#118e8a" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    {points.map((point, index) => <g key={values[index].id}><circle cx={point.x} cy={point.y} r="6" fill="#118e8a" stroke="white" strokeWidth="3"/><title>{formatDay(values[index].measuredOn) + ": " + number(values[index].weightKg, "kg")}</title></g>)}
    <text x="34" y="204" fill="#708788" fontSize="13">{formatDay(values[0].measuredOn)}</text><text x="626" y="204" textAnchor="end" fill="#708788" fontSize="13">{formatDay(values.at(-1)!.measuredOn)}</text>
  </svg></div>;
}

export default function ClinicApp({client = serverClient, tools}: {client?: ClinicClient; tools?: ReactNode} = {}) {
  const [data, setData] = useState<Workspace | null>(null);
  const latestWorkspace = useRef<Workspace | null>(null);
  const [error, setError] = useState("");
  const [mutationError, setMutationError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState<Section>("overview");
  const [patientViewOpen, setPatientViewOpen] = useState(false);
  const [patientView, setPatientView] = useState<PatientView>("profile");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [patientFilter, setPatientFilter] = useState<PatientFilter>("all");
  const [patientSort, setPatientSort] = useState<PatientSort>("activity");
  const [tagFilter, setTagFilter] = useState("");
  const [patientOpen, setPatientOpen] = useState(false);
  const [editPatientId, setEditPatientId] = useState<number | null>(null);
  const [patientEditVersion, setPatientEditVersion] = useState<number | undefined>();
  const [patientForm, setPatientForm] = useState<PatientForm>({...emptyPatient});
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const [appointmentForm, setAppointmentForm] = useState({patientId: 0, startsAt: "", kind: "Consulta", notes: ""});
  const [measurementOpen, setMeasurementOpen] = useState(false);
  const [measurementForm, setMeasurementForm] = useState({patientId: null as number | null, measuredOn: today(), weightKg: "", waistCm: "", notes: ""});
  const [planDraft, setPlanDraft] = useState<PlanDraft>(() => planDraftFromSaved(null));
  const [planPreview, setPlanPreview] = useState(false);
  const [draftSelectionId, setDraftSelectionId] = useState<number | null>(selectedId);
  const planTitle = planDraft.title;
  const planInstructions = planDraft.instructions;
  const meals = planDraft.meals;

  // Reset patient-bound dialogs before children can render the next patient's identity.
  if (draftSelectionId !== selectedId) {
    setDraftSelectionId(selectedId);
    setPatientOpen(false); setMeasurementOpen(false); setAppointmentOpen(false); setPlanPreview(false); setMutationError("");
    setMeasurementForm({patientId: selectedId, measuredOn: today(), weightKg: "", waistCm: "", notes: ""});
  }

  const load = useCallback(async () => {
    try {
      const response = await client.request("/api/workspace", {cache: "no-store"});
      const payload = await response.json() as Workspace & {error?: string};
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível carregar os registros.");
      latestWorkspace.current = payload; setData(payload); setError("");
      setSelectedId(current => payload.patients.some(patient => patient.id === current) ? current : payload.patients[0]?.id ?? null);
      return payload;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível carregar os registros."); return null; }
    finally { setLoading(false); }
  }, [client]);
  useEffect(() => {
    let cancelled = false;
    // The deferred start also avoids a duplicate request during React's mount/cleanup check.
    void Promise.resolve().then(() => { if (!cancelled) void load(); });
    return () => { cancelled = true; };
  }, [load]);

  const workspace = useMemo(() => ({...emptyWorkspace, ...data, clinicalRecords: data?.clinicalRecords ?? [], clinicalEntries: data?.clinicalEntries ?? []}), [data]);
  const selected = workspace.patients.find(patient => patient.id === selectedId) ?? null;
  const selectedPlan = workspace.plans.find(plan => plan.patientId === selectedId) ?? null;
  const selectedMeasurements = useMemo(() => workspace.measurements.filter(item => item.patientId === selectedId).sort((a, b) => b.measuredOn.localeCompare(a.measuredOn) || b.id - a.id), [workspace.measurements, selectedId]);
  const selectedPhotos = useMemo(() => workspace.photoAssessments.filter(item => item.patientId === selectedId), [workspace.photoAssessments, selectedId]);
  const selectedClinicalRecord = workspace.clinicalRecords.find(item => item.patientId === selectedId) ?? null;
  const selectedEntries = workspace.clinicalEntries.filter(item => item.patientId === selectedId);
  const upcoming = workspace.appointments.filter(appointment => appointment.status === "Agendada" && appointment.startsAt.slice(0, 10) >= today()).sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id - b.id);
  const todaysAppointments = upcoming.filter(appointment => appointment.startsAt.slice(0, 10) === today());
  const activity = useMemo<ActivityStamp[]>(() => [
    ...workspace.measurements.map(item => ({patientId: item.patientId, date: item.measuredOn})),
    ...workspace.plans.map(item => ({patientId: item.patientId, date: item.updatedAt})),
    ...workspace.photoAssessments.map(item => ({patientId: item.patientId, date: item.createdAt || item.measuredOn})),
    ...workspace.clinicalRecords.map(item => ({patientId: item.patientId, date: item.updatedAt})),
    ...workspace.clinicalEntries.map(item => ({patientId: item.patientId, date: item.updatedAt})),
    ...workspace.appointments.filter(item => item.status === "Concluída" && item.startsAt.slice(0, 10) <= today()).map(item => ({patientId: item.patientId, date: item.startsAt})),
  ], [workspace]);
  const plannedPatientIds = workspace.plans.map(plan => plan.patientId);
  const recordPatientIds = workspace.clinicalRecords.map(record => record.patientId);
  const visiblePatients = listPatients(workspace.patients, {query: search, filter: patientFilter, sort: patientSort, tag: tagFilter, plannedPatientIds, recordPatientIds, upcomingPatientIds: upcoming.map(item => item.patientId), activity});
  const recentPatients = listPatients(workspace.patients, {sort: "activity", activity}).slice(0, 6);
  const availableTags = [...new Set(workspace.patients.flatMap(patient => patientTags(patient.tags)))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const currentWeight = selectedMeasurements.find(item => item.weightKg !== null);
  const selectedUpcoming = upcoming.find(item => item.patientId === selectedId);
  const activeNavigation = patientNavigation.find(item => item.value === patientView)!;
  const activeModule = ENTRY_MODULES.includes(patientView as EntryModule) ? patientView as EntryModule : null;
  const aiContext = JSON.stringify({
    objetivo: selected?.goal || "Não informado",
    ficha: selectedClinicalRecord ? Object.fromEntries(Object.entries(selectedClinicalRecord).filter(([key]) => !["id", "patientId", "updatedAt"].includes(key))) : null,
    medidas: selectedMeasurements.map(({measuredOn, weightKg, waistCm}) => ({data: measuredOn, pesoKg: weightKg, cinturaFitaCm: waistCm})),
    estimativasPorFotos: selectedPhotos.map(({measuredOn, waistEstimateCm, abdomenEstimateCm, hipEstimateCm, tapeMeasures}) => ({data: measuredOn, cinturaEstimadaCm: waistEstimateCm, abdomenEstimadoCm: abdomenEstimateCm, quadrilEstimadoCm: hipEstimateCm, fita: tapeMeasures})),
    variacaoPesoKg: selectedMeasurements.filter(item => item.weightKg !== null).length >= 2 ? Number((selectedMeasurements.filter(item => item.weightKg !== null)[0].weightKg! - selectedMeasurements.filter(item => item.weightKg !== null).at(-1)!.weightKg!).toFixed(2)) : null,
  }, null, 2);

  useEffect(() => {
    // Refreshing other modules keeps this patient's draft and the version that supplied it.
    const saved = latestWorkspace.current?.plans.find(plan => plan.patientId === selectedId);
    setPlanDraft(current => keepPatientDraft(current, planDraftFromSaved(selectedId, saved)));
  }, [selectedId, selectedPlan?.updatedAt, selectedPlan?._version]);

  async function refreshWorkspace() { await load(); }
  async function reloadClinicalEntries() {
    if (!await load()) throw new Error("O registro foi salvo, mas não foi possível recarregar o histórico. Atualize os dados para conferir.");
  }
  async function mutate(payload: Record<string, unknown>, confirmation: string): Promise<{id?: number; ok?: boolean; version?: number; workspace: Workspace | null} | null> {
    setBusy(true); setMutationError("");
    try {
      const response = await client.request("/api/workspace", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(payload)});
      const result = await response.json() as {error?: string; id?: number; ok?: boolean; version?: number};
      if (!response.ok) throw new Error(result.error ?? "Não foi possível salvar.");
      const reloaded = await load(); toast.success(confirmation); return {...result, workspace: reloaded};
    } catch (cause) { const message = cause instanceof Error ? cause.message : "Não foi possível salvar."; setMutationError(message); toast.error(message); return null; }
    finally { setBusy(false); }
  }
  function navigate(destination: Section) { setSection(destination); if (destination === "patients") setPatientViewOpen(false); }
  function selectPatient(id: number, destination: PatientView = "profile") { setSelectedId(id); setPatientView(destination); setPatientViewOpen(true); setSection("patients"); setPlanPreview(false); }
  function openNewPatient() { setMutationError(""); setEditPatientId(null); setPatientEditVersion(undefined); setPatientForm({...emptyPatient}); setPatientOpen(true); }
  function openEditPatient(patient: Patient) {
    setMutationError(""); setEditPatientId(patient.id); setPatientEditVersion(patient._version);
    setPatientForm({...emptyPatient, name: patient.name, phone: patient.phone, birthDate: patient.birthDate, goal: patient.goal, notes: patient.notes,
      nickname: patient.nickname ?? "", email: patient.email ?? "", cpf: patient.cpf ?? "", sex: patient.sex ?? "", biologicalCondition: patient.biologicalCondition ?? "", tags: patient.tags ?? ""});
    setPatientOpen(true);
  }
  async function savePatient(event: FormEvent) {
    event.preventDefault();
    const result = await mutate({action: editPatientId ? "updatePatient" : "createPatient", ...(editPatientId ? {id: editPatientId, _version: patientEditVersion} : {}), ...patientForm}, editPatientId ? "Cadastro atualizado." : "Paciente cadastrado.");
    if (result) { setPatientOpen(false); const id = result.id ?? editPatientId; if (id) selectPatient(id); else navigate("patients"); }
  }
  function openNewAppointment(day?: string, kind = "Consulta", patientId = selectedId ?? workspace.patients[0]?.id ?? 0) {
    setMutationError(""); setAppointmentForm({patientId, startsAt: day ? day + "T08:00" : "", kind, notes: ""}); setAppointmentOpen(true);
  }
  async function saveAppointment(event: FormEvent) {
    event.preventDefault();
    const result = await mutate({action: "createAppointment", ...appointmentForm}, "Consulta agendada.");
    if (result) { setAppointmentOpen(false); setSection("agenda"); }
  }
  function openMeasurement() { setMutationError(""); setMeasurementForm({patientId: selectedId, measuredOn: today(), weightKg: "", waistCm: "", notes: ""}); setMeasurementOpen(true); }
  async function saveMeasurement(event: FormEvent) {
    event.preventDefault(); if (!selectedId || measurementForm.patientId !== selectedId) return;
    if (!measurementForm.weightKg && !measurementForm.waistCm) { toast.error("Informe peso ou cintura para registrar."); return; }
    const result = await mutate({action: "addMeasurement", patientId: selectedId, measuredOn: measurementForm.measuredOn,
      weightKg: measurementForm.weightKg === "" ? null : Number(measurementForm.weightKg), waistCm: measurementForm.waistCm === "" ? null : Number(measurementForm.waistCm), notes: measurementForm.notes}, "Medidas registradas.");
    if (result) setMeasurementOpen(false);
  }
  async function savePlan(event: FormEvent) {
    event.preventDefault(); if (!selectedId || planDraft.patientId !== selectedId) return;
    const validMeals = meals.map(meal => ({time: meal.time.trim(), label: meal.label.trim(), foods: meal.foods.trim()})).filter(meal => meal.label && meal.foods);
    if (!validMeals.length) { toast.error("Preencha pelo menos uma refeição para salvar o plano."); return; }
    const owner = selectedId;
    const submitted = planDraft;
    const result = await mutate({action: "savePlan", patientId: owner, title: planTitle, instructions: planInstructions, meals: validMeals, _version: planDraft.version}, "Plano alimentar salvo.");
    const saved = result?.workspace?.plans.find(plan => plan.patientId === owner);
    if (result) setPlanDraft(current => {
      if (current.patientId !== owner) return current;
      if (current === submitted && saved) return planDraftFromSaved(owner, saved);
      return {...current, version: result.version ?? current.version};
    });
  }
  async function reloadPlan() {
    if (!selectedId) return;
    const owner = selectedId;
    setBusy(true);
    try {
      const reloaded = await load();
      if (reloaded) { setPlanDraft(current => current.patientId === owner ? planDraftFromSaved(owner, reloaded.plans.find(plan => plan.patientId === owner)) : current); setMutationError(""); }
    } finally { setBusy(false); }
  }
  function setPlanTitle(value: string) { setPlanDraft(current => current.patientId === selectedId ? {...current, title: value} : current); }
  function setPlanInstructions(value: string) { setPlanDraft(current => current.patientId === selectedId ? {...current, instructions: value} : current); }
  function setMeals(value: Meal[] | ((current: Meal[]) => Meal[])) { setPlanDraft(current => current.patientId === selectedId ? {...current, meals: typeof value === "function" ? value(current.meals) : value} : current); }
  function printSavedPlan() {
    if (!selected || !selectedPlan || selectedPlan.patientId !== selected.id) return;
    try {
      const html = printablePlanHTML({name: selected.name, date: formatDay(selectedPlan.updatedAt), logoUrl: new URL(client.assetUrl("marakesia-logo.png"), window.location.href).href, plan: {title: selectedPlan.title, instructions: selectedPlan.instructions, meals: parseMeals(selectedPlan.mealsJson)}});
      const popup = window.open("", "_blank");
      if (!popup) { toast.error("Permita a abertura da janela de impressão neste navegador e tente novamente."); return; }
      popup.opener = null; popup.document.write(html); popup.document.close(); popup.focus();
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Não foi possível preparar a impressão."); }
  }
  function updateMeal(index: number, field: keyof Meal, value: string) { setMeals(current => current.map((meal, mealIndex) => mealIndex === index ? {...meal, [field]: value} : meal)); }

  useEffect(() => {
    const context = (document as Document & {modelContext?: SiteModelContext}).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: SiteTool) => { try { void Promise.resolve(context.registerTool(tool, {signal: lifecycle.signal})).catch(console.error); } catch (cause) { console.error(cause); } };
    register({
      name: "listar_pacientes", title: "Listar pacientes", description: "Lista os pacientes cadastrados no consultório atual, sem devolver anotações clínicas.",
      inputSchema: {type: "object", properties: {}, additionalProperties: false}, annotations: {readOnlyHint: true, untrustedContentHint: false},
      async execute() {
        const response = await client.request("/api/workspace", {cache: "no-store"});
        const result = await response.json() as Workspace & {error?: string};
        if (!response.ok) throw new Error(result.error ?? "Não foi possível listar os pacientes.");
        return {patients: result.patients.map(({id, name, goal}) => ({id, name, goal}))};
      },
    });
    register({
      name: "cadastrar_paciente", title: "Cadastrar paciente", description: "Cadastra um paciente no mesmo consultório e atualiza a lista visível.",
      inputSchema: {type: "object", properties: {name: {type: "string", minLength: 2, maxLength: 120}, phone: {type: "string", maxLength: 40}, goal: {type: "string", maxLength: 240}}, required: ["name"], additionalProperties: false},
      annotations: {readOnlyHint: false, untrustedContentHint: false},
      async execute(input) {
        if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Informe o nome do paciente.");
        const values = input as Record<string, unknown>;
        const name = typeof values.name === "string" ? values.name.trim() : ""; const phone = typeof values.phone === "string" ? values.phone.trim() : ""; const goal = typeof values.goal === "string" ? values.goal.trim() : "";
        if (name.length < 2 || name.length > 120 || phone.length > 40 || goal.length > 240 || Object.keys(values).some(key => !["name", "phone", "goal"].includes(key))) throw new Error("Confira os dados do paciente.");
        const response = await client.request("/api/workspace", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({action: "createPatient", name, phone, goal, birthDate: "", notes: ""})});
        const result = await response.json() as {id?: number; error?: string};
        if (!response.ok || !result.id) throw new Error(result.error ?? "Não foi possível cadastrar o paciente.");
        await load(); setSelectedId(result.id); setPatientView("profile"); setPatientViewOpen(true); setSection("patients"); return {id: result.id, name};
      },
    });
    return () => lifecycle.abort();
  }, [load, client]);

  function measurementsPanel() {
    return <div className="consultorio-measurements-grid"><section className="surface chart-surface"><div className="section-heading"><div><span className="eyebrow">PESO REGISTRADO</span><h2>Evolução do peso</h2></div><div className="chart-current"><small>Último registro</small><strong>{number(currentWeight?.weightKg ?? null, "kg")}</strong></div></div><WeightChart measurements={selectedMeasurements}/></section>
      <section className="surface measure-surface"><div className="section-heading"><div><span className="eyebrow">ANTROPOMETRIA</span><h2>Histórico de medidas</h2></div><span className="meal-count">{selectedMeasurements.length}</span></div>{selectedMeasurements.length ? <div className="measure-list">{selectedMeasurements.map(item => <div className="measure-row" key={item.id}><div><strong>{formatDay(item.measuredOn)}</strong>{item.notes && <small>{item.notes}</small>}</div><div><strong>{number(item.weightKg, "kg")}</strong><small>Cintura: {number(item.waistCm, "cm")}</small></div></div>)}</div> : <div className="mini-empty"><p>Nenhuma medida registrada para {selected?.name}.</p><button className="text-button" onClick={openMeasurement}>Registrar medidas <ArrowRight size={16}/></button></div>}</section>
    </div>;
  }

  function profileContent() {
    if (!selected) return null;
    const age = ageFromDate(selected.birthDate);
    const recentEntries = selectedEntries.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4);
    const shortcuts: {label: string; icon: LucideIcon; action: () => void}[] = [
      {label: "Registrar consulta", icon: NotebookPen, action: () => setPatientView("consultations")},
      {label: "Agendar retorno", icon: CalendarDays, action: () => openNewAppointment(undefined, "Retorno", selected.id)},
      {label: "Anamnese", icon: Stethoscope, action: () => setPatientView("anamnesis")},
      {label: "Antropometria", icon: Ruler, action: () => setPatientView("anthropometry")},
      {label: "Plano alimentar", icon: Utensils, action: () => setPatientView("plans")},
      {label: "Orientações", icon: FileText, action: () => setPatientView("guidance")},
      {label: "Fotos", icon: Camera, action: () => setPatientView("photos")},
    ];
    return <div className="consultorio-profile">
      <section className="surface consultorio-profile-shortcuts"><div className="section-heading"><div><span className="eyebrow">ATENDIMENTO</span><h2>Iniciar ou continuar o cuidado</h2></div></div><div className="consultorio-shortcuts">{shortcuts.map(({label, icon: Icon, action}) => <button key={label} onClick={action}><Icon size={19}/><span>{label}</span><ChevronRight size={15}/></button>)}</div></section>
      <div className="consultorio-profile-metrics">
        <div><span>Próximo atendimento</span><strong>{selectedUpcoming ? formatDay(selectedUpcoming.startsAt) : "Sem agendamento"}</strong><small>{selectedUpcoming ? selectedUpcoming.startsAt.slice(11, 16) + " · " + selectedUpcoming.kind : "Agende uma consulta ou retorno"}</small></div>
        <div><span>Último peso</span><strong>{number(currentWeight?.weightKg ?? null, "kg")}</strong><small>{currentWeight ? formatDay(currentWeight.measuredOn) : "Nenhuma pesagem registrada"}</small></div>
        <div><span>Plano alimentar</span><strong>{selectedPlan ? "Plano salvo" : "Em preparação"}</strong><small>{selectedPlan ? formatDay(selectedPlan.updatedAt) : "Abra o planejamento alimentar"}</small></div>
      </div>
      <section className="surface consultorio-profile-data"><div className="section-heading"><div><span className="eyebrow">IDENTIFICAÇÃO</span><h2>Dados do paciente</h2></div><button className="text-button" onClick={() => openEditPatient(selected)}>Editar cadastro <ArrowRight size={16}/></button></div><dl className="consultorio-data-grid">
        <DataPair label="Nome completo">{selected.name}</DataPair><DataPair label="Apelido">{selected.nickname}</DataPair><DataPair label="Nascimento">{selected.birthDate ? formatDay(selected.birthDate) + (age !== null ? " · " + age + " anos" : "") : ""}</DataPair>
        <DataPair label="Telefone">{selected.phone}</DataPair><DataPair label="E-mail">{selected.email}</DataPair><DataPair label="CPF">{selected.cpf}</DataPair>
        <DataPair label="Gênero">{selected.sex}</DataPair><DataPair label="Condição biológica">{selected.biologicalCondition}</DataPair><DataPair label="Cadastro">{formatDay(selected.createdAt)}</DataPair>
      </dl><div className="consultorio-profile-objective"><span>Objetivo do acompanhamento</span><p>{selected.goal || "Objetivo ainda não informado."}</p></div>{patientTags(selected.tags).length > 0 && <div className="consultorio-tags">{patientTags(selected.tags).map(tag => <span key={tag}>{tag}</span>)}</div>}{selected.notes && <div className="note-box"><span>Observações do cadastro</span><p>{selected.notes}</p></div>}</section>
      <section className="surface consultorio-profile-history"><div className="section-heading"><div><span className="eyebrow">PRONTUÁRIO</span><h2>Registros recentes</h2></div><button className="text-button" onClick={() => setPatientView("notes")}>Abrir prontuário <ArrowRight size={16}/></button></div>{recentEntries.length ? <div className="consultorio-recent-records">{recentEntries.map(entry => <button key={entry.id} onClick={() => setPatientView(entry.module)}><span className="action-icon"><FileText size={18}/></span><div><strong>{entry.title}</strong><small>{patientNavigation.find(item => item.value === entry.module)?.label} · {formatDay(entry.recordedOn)} · {entry.status}</small></div><ChevronRight size={17}/></button>)}</div> : <div className="mini-empty"><p>Os novos registros clínicos de {selected.name} aparecerão aqui. A anamnese, os planos e as medidas já salvos continuam nos seus módulos.</p></div>}</section>
    </div>;
  }

  function planContent() {
    if (!selected) return null;
    if (planDraft.patientId !== selected.id) return <div className="surface consultorio-loading" role="status">Abrindo plano do paciente...</div>;
    return <div className="consultorio-plan">
      <div className="consultorio-plan-toolbar"><div className="consultorio-segmented" role="group" aria-label="Visualização do plano"><button className={!planPreview ? "active" : ""} aria-pressed={!planPreview} onClick={() => setPlanPreview(false)}>Editar plano</button><button className={planPreview ? "active" : ""} aria-pressed={planPreview} disabled={!selectedPlan} onClick={() => setPlanPreview(true)}>Prévia do plano salvo</button></div><div className="consultorio-plan-actions"><button className="button button-secondary" disabled={busy} onClick={() => void reloadPlan()}>Recarregar plano salvo</button>{selectedPlan && <button className="button button-secondary" onClick={printSavedPlan}><Printer size={17}/>Imprimir / PDF</button>}</div></div>
      {mutationError && <p className="consultorio-mutation-error" role="alert">{mutationError} Sua edição foi mantida.</p>}
      {planPreview && selectedPlan ? <article className="surface consultorio-plan-preview"><div className="consultorio-preview-heading"><span className="eyebrow">PRÉVIA INTERNA · PLANO SALVO</span><h2>{selectedPlan.title}</h2><p>{selected.name} · Atualizado em {formatDay(selectedPlan.updatedAt)}</p></div><div className="consultorio-preview-meals">{parseMeals(selectedPlan.mealsJson).map((meal, index) => <section key={index}><time>{meal.time || "Refeição"}</time><div><h3>{meal.label}</h3><p>{meal.foods}</p></div></section>)}</div>{selectedPlan.instructions && <div className="consultorio-preview-instructions"><h3>Orientações gerais</h3><p>{selectedPlan.instructions}</p></div>}</article> : <>
        {client.cloud && <AiAssistant key={selected.id} mode="plan" context={aiContext} plan={{title: planTitle, instructions: planInstructions, meals}} onApply={draft => {setPlanTitle(draft.title); setPlanInstructions(draft.instructions); setMeals(draft.meals);}}/>}
        {planDraft.loadedAt && <p className="consultorio-saved-label">Plano do editor carregado da versão salva em {formatDay(planDraft.loadedAt)}.</p>}
        <form className="consultorio-plan-layout" onSubmit={savePlan}><section className="surface plan-editor"><div className="section-heading"><div><span className="eyebrow">ORGANIZAÇÃO DIÁRIA</span><h2>Refeições</h2></div><span className="meal-count">{meals.length} {meals.length === 1 ? "refeição" : "refeições"}</span></div><div className="field"><label htmlFor="plan-title">Título do plano</label><Input id="plan-title" value={planTitle} onChange={event => setPlanTitle(event.target.value)} minLength={2} maxLength={120} required/></div>
          <div className="meal-list">{meals.map((meal, index) => <div className="meal-card" key={index}><div className="meal-card-head"><span className="meal-index">{String(index + 1).padStart(2, "0")}</span><strong>Refeição {index + 1}</strong><button type="button" className="icon-button" aria-label={"Remover refeição " + (index + 1)} onClick={() => setMeals(current => current.filter((_, mealIndex) => mealIndex !== index))}><X size={17}/></button></div><div className="meal-fields"><div className="field time-field"><label htmlFor={"meal-time-" + index}>Horário</label><Input id={"meal-time-" + index} type="time" value={meal.time} onChange={event => updateMeal(index, "time", event.target.value)}/></div><div className="field"><label htmlFor={"meal-label-" + index}>Nome da refeição</label><Input id={"meal-label-" + index} value={meal.label} maxLength={80} onChange={event => updateMeal(index, "label", event.target.value)} placeholder="Ex.: Lanche da tarde"/></div></div><div className="field"><label htmlFor={"meal-foods-" + index}>Alimentos e quantidades</label><Textarea id={"meal-foods-" + index} value={meal.foods} maxLength={700} onChange={event => updateMeal(index, "foods", event.target.value)} placeholder="Descreva alimentos, porções e substituições" rows={3}/></div></div>)}</div><button type="button" className="add-meal" onClick={() => setMeals(current => [...current, {time: "", label: "", foods: ""}])} disabled={meals.length >= 12}><ListPlus size={18}/>Adicionar refeição</button></section>
          <aside className="surface plan-notes"><div className="section-heading"><div><span className="eyebrow">ORIENTAÇÕES</span><h2>Cuidados do plano</h2></div></div><div className="field"><label htmlFor="plan-instructions">Orientações gerais</label><Textarea id="plan-instructions" value={planInstructions} onChange={event => setPlanInstructions(event.target.value)} maxLength={2000} rows={8} placeholder="Hidratação, rotina e combinações feitas em consulta"/></div><p className="editor-hint">Revise as refeições e orientações antes de salvar para {selected.name}.</p><button type="submit" className="button button-primary button-wide" disabled={busy || planDraft.patientId !== selectedId}><Check size={17}/>{busy ? "Salvando..." : "Salvar plano alimentar"}</button>{selectedPlan && <button type="button" className="button button-secondary button-wide" onClick={printSavedPlan}><Printer size={17}/>Imprimir plano salvo / PDF</button>}</aside>
        </form>
      </>}
    </div>;
  }

  function patientContent() {
    if (!selected) return null;
    if (patientView === "profile") return profileContent();
    if (patientView === "plans") return planContent();
    if (patientView === "photos") return <PhotoAssessment key={selected.id} client={client} patientId={selected.id} patientName={selected.name} entries={selectedPhotos} onSaved={refreshWorkspace} today={today()} formatDay={formatDay}/>;
    if (patientView === "anamnesis") return <ClinicalRecordPanel key={selected.id + ":anamnesis"} client={client} patient={selected} record={selectedClinicalRecord} onSaved={refreshWorkspace}/>;
    if (patientView === "followup" || patientView === "anthropometry") return <div className="consultorio-evolution"><div className="consultorio-module-actions"><button className="button button-primary" onClick={openMeasurement}><Plus size={17}/>Registrar peso e cintura</button>{patientView === "followup" && <button className="button button-secondary" onClick={() => setPatientView("anthropometry")}><Ruler size={17}/>Abrir antropometria</button>}</div>{measurementsPanel()}{patientView === "followup" && client.cloud && <AiAssistant key={selected.id} mode="evolution" context={aiContext}/>} {patientView === "anthropometry" && <div className="consultorio-anthropometry-record"><ClinicalRecordPanel key={selected.id + ":anthropometry"} client={client} patient={selected} record={selectedClinicalRecord} onSaved={refreshWorkspace}/></div>}</div>;
    if (activeModule) return <>
      <ClinicalEntryPanel key={selected.id + ":" + activeModule} client={client} patient={selected} module={activeModule} entries={selectedEntries.filter(entry => entry.module === activeModule)} onSaved={reloadClinicalEntries}/>
      {activeModule === "consultations" && <section className="surface consultorio-appointment-history"><div className="section-heading"><div><span className="eyebrow">AGENDA</span><h2>Agendamentos anteriores</h2></div><button className="text-button" onClick={() => setSection("agenda")}>Abrir agenda <ArrowRight size={16}/></button></div><p className="consultorio-section-description">O agendamento e o registro da consulta são mantidos separadamente.</p>{workspace.appointments.filter(item => item.patientId === selected.id && item.startsAt.slice(0, 10) <= today()).length ? <div className="consultorio-history-list">{workspace.appointments.filter(item => item.patientId === selected.id && item.startsAt.slice(0, 10) <= today()).sort((a, b) => b.startsAt.localeCompare(a.startsAt)).map(item => <div key={item.id}><div><strong>{formatDay(item.startsAt)} · {item.startsAt.slice(11, 16)}</strong><small>{item.kind}{item.notes ? " · " + item.notes : ""}</small></div><span className={"status status-" + statusClass(item.status)}>{item.status}</span></div>)}</div> : <div className="mini-empty"><p>Nenhum agendamento anterior para este paciente.</p></div>}</section>}
    </>;
    return null;
  }

  return <div className="app-shell consultorio-shell">
    <Toaster richColors position="top-right"/>
    <header className="site-header"><div className="header-inner"><button className="brand consultorio-brand" onClick={() => navigate("overview")} aria-label="Abrir painel do NutriMara"><img className="brand-logo" src={client.assetUrl("marakesia-logo.png")} alt="Nutricionista Marakesia Nascimento, CRN 11-6356" width={72} height={72} fetchPriority="high"/><div><strong>Nutri<span>Mara</span></strong><small>Consultório digital</small></div></button><nav className="consultorio-primary-nav" aria-label="Navegação principal">{nav.map(({value, label, icon: Icon}) => <button key={value} className={section === value ? "active" : ""} aria-current={section === value ? "page" : undefined} onClick={() => navigate(value)}><Icon size={18}/><span>{label}</span></button>)}</nav><div className="header-user"><span className="professional-label">Marakesia Nascimento<small>Nutricionista · CRN 11-6356</small></span><span className="professional-avatar">MN</span></div></div></header>
    {tools && <details className="consultorio-tools"><summary><Settings2 size={16}/><span>Conta, backup e aplicativo</span></summary><div className="consultorio-tools-content">{tools}</div></details>}
    <main className="page-wrap consultorio-main">
      {loading && !data ? <section className="surface consultorio-loading" role="status"><Clock3 size={24}/><h1>Abrindo consultório...</h1><p>Carregando pacientes e registros.</p></section> : error && !data ? <section className="surface load-error" role="alert"><h1>Não foi possível abrir o consultório</h1><p>{error}</p><button className="button button-primary" onClick={() => {setLoading(true); void load();}}>Tentar novamente</button></section> : <>
        {error && <div className="consultorio-refresh-error" role="alert"><p>Não foi possível atualizar os registros. {error}</p><button className="button button-secondary" onClick={() => void load()}>Tentar novamente</button></div>}
        {mutationError && !patientOpen && !appointmentOpen && !measurementOpen && !(section === "patients" && patientViewOpen && patientView === "plans") && <p className="consultorio-mutation-error" role="alert">{mutationError}</p>}
        {section === "overview" && <>
          <div className="page-heading"><div><span className="eyebrow">ROTINA DO CONSULTÓRIO</span><h1>Painel</h1><p>{formatLongDay(today())}</p></div><div className="consultorio-heading-actions"><button className="button button-secondary" onClick={() => workspace.patients.length ? openNewAppointment() : openNewPatient()}><CalendarDays size={17}/>Agendar consulta</button><button className="button button-primary" onClick={openNewPatient}><Plus size={18}/>Novo paciente</button></div></div>
          <div className="consultorio-dashboard-stats"><button onClick={() => navigate("patients")}><span className="action-icon"><Users size={21}/></span><div><span>Pacientes</span><strong>{workspace.patients.length}</strong><small>Cadastros no consultório</small></div><ChevronRight size={17}/></button><button onClick={() => setSection("agenda")}><span className="action-icon"><CalendarDays size={21}/></span><div><span>Atendimentos hoje</span><strong>{todaysAppointments.length}</strong><small>Consultas agendadas</small></div><ChevronRight size={17}/></button><button onClick={() => {setPatientFilter("withPlan"); setSearch(""); navigate("patients");}}><span className="action-icon"><Utensils size={21}/></span><div><span>Planos salvos</span><strong>{workspace.plans.length}</strong><small>Planejamentos alimentares</small></div><ChevronRight size={17}/></button></div>
          <div className="consultorio-dashboard-grid"><section className="surface consultorio-dashboard-patients"><div className="section-heading"><div><span className="eyebrow">PACIENTES</span><h2>Atividade recente</h2></div><button className="text-button" onClick={() => navigate("patients")}>Ver todos <ArrowRight size={16}/></button></div>{recentPatients.length ? <div className="consultorio-recent-patients">{recentPatients.map(patient => <button key={patient.id} onClick={() => selectPatient(patient.id)}><span className="patient-avatar">{initials(patient.name)}</span><div><strong>{patient.name}</strong><small>{patient.goal || "Objetivo ainda não informado"}</small></div><time>{formatDay(patientLastActivity(patient, activity))}</time><ChevronRight size={17}/></button>)}</div> : <EmptyState icon={Users} title="Comece pelo primeiro paciente" description="Cadastre o paciente para abrir o prontuário e organizar o acompanhamento." action="Cadastrar paciente" onAction={openNewPatient}/>}</section>
            <section className="surface consultorio-dashboard-agenda"><div className="section-heading"><div><span className="eyebrow">AGENDA</span><h2>Próximos atendimentos</h2></div><button className="text-button" onClick={() => setSection("agenda")}>Ver agenda <ArrowRight size={16}/></button></div>{upcoming.length ? <div className="consultorio-upcoming-list">{upcoming.slice(0, 5).map(appointment => <button key={appointment.id} onClick={() => selectPatient(appointment.patientId)}><div className="date-tile"><strong>{appointment.startsAt.slice(8, 10)}</strong><small>{new Date(appointment.startsAt.slice(0, 10) + "T12:00:00").toLocaleDateString("pt-BR", {month: "short"}).replace(".", "")}</small></div><div><strong>{workspace.patients.find(patient => patient.id === appointment.patientId)?.name ?? "Paciente"}</strong><small>{appointment.startsAt.slice(11, 16)} · {appointment.kind}</small></div><ChevronRight size={17}/></button>)}</div> : <EmptyState icon={CalendarDays} title="Nenhuma consulta agendada" description="Os próximos atendimentos aparecem aqui." action={workspace.patients.length ? "Agendar consulta" : "Cadastrar paciente"} onAction={() => workspace.patients.length ? openNewAppointment() : openNewPatient()}/>}</section></div>
        </>}

        {section === "patients" && (!patientViewOpen || !selected) && <>
          <div className="page-heading"><div><span className="eyebrow">CADASTROS E PRONTUÁRIOS</span><h1>Pacientes</h1><p>Encontre um paciente e abra seu acompanhamento.</p></div><button className="button button-primary" onClick={openNewPatient}><Plus size={18}/>Novo paciente</button></div>
          <section className="surface consultorio-patient-directory"><div className="consultorio-directory-controls"><label className="consultorio-directory-search"><Search size={19}/><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Nome, apelido, telefone, CPF, tags ou objetivo" aria-label="Buscar por nome, apelido, telefone, CPF, tags ou objetivo"/>{search && <button className="icon-button" onClick={() => setSearch("")} aria-label="Limpar busca"><X size={16}/></button>}</label><div className="consultorio-directory-filters"><label>Filtrar<select value={patientFilter} onChange={event => setPatientFilter(event.target.value as PatientFilter)}><option value="all">Todos os pacientes</option><option value="withPlan">Com plano alimentar</option><option value="withoutPlan">Sem plano alimentar</option><option value="upcoming">Com consulta agendada</option><option value="withoutRecord">Sem anamnese salva</option>{workspace.patients.some(patient => patient.biologicalCondition === "Gestante") && <option value="gestante">Gestantes</option>}{workspace.patients.some(patient => patient.biologicalCondition === "Lactante") && <option value="lactante">Lactantes</option>}</select></label>{availableTags.length > 0 && <label>Tags<select value={tagFilter} onChange={event => setTagFilter(event.target.value)}><option value="">Todas as tags</option>{availableTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}</select></label>}<label>Ordenar<select value={patientSort} onChange={event => setPatientSort(event.target.value as PatientSort)}><option value="activity">Última atividade</option><option value="name">Nome A–Z</option><option value="created">Cadastro mais recente</option></select></label></div></div>
            <div className="consultorio-directory-count" role="status">{visiblePatients.length} {visiblePatients.length === 1 ? "paciente" : "pacientes"}{visiblePatients.length !== workspace.patients.length ? " de " + workspace.patients.length : ""}{(search || patientFilter !== "all" || tagFilter) && <button className="text-button" onClick={() => {setSearch(""); setPatientFilter("all"); setTagFilter("");}}>Limpar filtros</button>}</div>
            {workspace.patients.length ? visiblePatients.length ? <><div className="consultorio-directory-column-head" aria-hidden="true"><span>Paciente</span><span>Contato</span><span>Acompanhamento</span><span>Última atividade</span><span/></div><div className="consultorio-directory-rows">{visiblePatients.map(patient => <button className="consultorio-directory-row" key={patient.id} onClick={() => selectPatient(patient.id)}><div className="consultorio-directory-identity"><span className="patient-avatar">{initials(patient.name)}</span><div><strong>{patient.name}</strong><small>{patient.nickname ? "Apelido: " + patient.nickname : patient.birthDate ? formatDay(patient.birthDate) : "Nascimento não informado"}</small></div></div><div className="consultorio-directory-contact"><span>{patient.phone || "Telefone não informado"}</span><small>{patient.email || (patient.cpf ? "CPF: " + patient.cpf : "")}</small></div><div className="consultorio-directory-goal"><span>{patient.goal || "Objetivo não informado"}</span>{patientTags(patient.tags).length > 0 && <small>{patientTags(patient.tags).slice(0, 2).join(" · ")}</small>}</div><time>{formatDay(patientLastActivity(patient, activity))}</time><ChevronRight size={18}/></button>)}</div></> : <EmptyState icon={Search} title="Nenhum paciente encontrado" description="Tente outro termo ou limpe os filtros para ver todos os cadastros."/> : <EmptyState icon={Users} title="Seu primeiro paciente começa aqui" description="Cadastre o paciente e abra seu prontuário para começar o acompanhamento." action="Cadastrar paciente" onAction={openNewPatient}/>}
          </section>
        </>}

        {section === "patients" && patientViewOpen && selected && <div className="consultorio-patient-workspace">
          <div className="consultorio-patient-topline"><button className="text-button" onClick={() => setPatientViewOpen(false)}><ArrowLeft size={17}/>Todos os pacientes</button><label className="consultorio-switch-patient"><span>Trocar paciente</span><select value={selected.id} onChange={event => selectPatient(Number(event.target.value), patientView)}>{listPatients(workspace.patients, {sort: "name"}).map(patient => <option key={patient.id} value={patient.id}>{patient.name}</option>)}</select></label></div>
          <section className="surface consultorio-patient-banner"><span className="detail-avatar">{initials(selected.name)}</span><div className="consultorio-patient-banner-copy"><span className="eyebrow">PRONTUÁRIO DO PACIENTE</span><h1>{selected.name}{selected.nickname && <small> · {selected.nickname}</small>}</h1><p>{selected.birthDate ? formatDay(selected.birthDate) : "Nascimento não informado"}{ageFromDate(selected.birthDate) !== null ? " · " + ageFromDate(selected.birthDate) + " anos" : ""}{selected.phone ? " · " + selected.phone : ""}</p></div><button className="button button-secondary" onClick={() => openEditPatient(selected)}>Editar cadastro</button></section>
          <label className="consultorio-patient-mobile-menu"><span>Seção do prontuário</span><select value={patientView} onChange={event => {setPatientView(event.target.value as PatientView); setPlanPreview(false);}}>{["Paciente", "Avaliação", "Conduta", "Documentação"].map(group => <optgroup key={group} label={group}>{patientNavigation.filter(item => item.group === group).map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</optgroup>)}</select></label>
          <div className="consultorio-patient-layout"><aside className="surface consultorio-patient-sidebar"><nav aria-label="Seções do prontuário">{["Paciente", "Avaliação", "Conduta", "Documentação"].map(group => <div className="consultorio-menu-group" key={group}><span>{group}</span><ul>{patientNavigation.filter(item => item.group === group).map(({value, label, icon: Icon}) => <li key={value}><button className={patientView === value ? "active" : ""} aria-current={patientView === value ? "page" : undefined} onClick={() => {setPatientView(value); setPlanPreview(false);}}><Icon size={17}/><span>{label}</span></button></li>)}</ul></div>)}</nav></aside><div className="consultorio-patient-content" key={selected.id}><div className="consultorio-module-heading"><h2>{activeNavigation.label}</h2><p>{activeNavigation.description}</p></div>{patientContent()}</div></div>
        </div>}

        {section === "agenda" && <><div className="page-heading"><div><span className="eyebrow">ATENDIMENTOS</span><h1>Agenda</h1><p>Organize consultas, retornos e horários do consultório.</p></div><button className="button button-primary" onClick={() => workspace.patients.length ? openNewAppointment() : openNewPatient()}><Plus size={18}/>{workspace.patients.length ? "Nova consulta" : "Cadastrar paciente"}</button></div><ConsultorioAgenda appointments={workspace.appointments} patients={workspace.patients} today={today()} busy={busy} onCreate={day => workspace.patients.length ? openNewAppointment(day) : openNewPatient()} onOpenPatient={id => selectPatient(id)} onStatus={async (id, status) => {await mutate({action: "setAppointmentStatus", id, status}, status === "Concluída" ? "Consulta concluída." : "Consulta cancelada.");}}/></>}
      </>}
      <footer className="site-footer"><span>NutriMara · Marakesia Nascimento · CRN 11-6356</span></footer>
    </main>

    <Dialog open={patientOpen} onOpenChange={setPatientOpen}><DialogContent className="form-dialog consultorio-patient-dialog"><DialogHeader><DialogTitle>{editPatientId ? "Editar paciente" : "Novo paciente"}</DialogTitle><DialogDescription>Dados de identificação e acompanhamento do paciente.</DialogDescription></DialogHeader><form onSubmit={savePatient} className="modal-form">{mutationError && <p className="consultorio-mutation-error" role="alert">{mutationError}</p>}<div className="field"><label htmlFor="patient-name">Nome completo *</label><Input id="patient-name" required minLength={2} maxLength={120} value={patientForm.name} onChange={event => setPatientForm({...patientForm, name: event.target.value})}/></div><div className="form-grid"><div className="field"><label htmlFor="patient-nickname">Apelido</label><Input id="patient-nickname" maxLength={120} value={patientForm.nickname} onChange={event => setPatientForm({...patientForm, nickname: event.target.value})}/></div><div className="field"><label htmlFor="patient-cpf">CPF</label><Input id="patient-cpf" inputMode="numeric" maxLength={20} value={patientForm.cpf} onChange={event => setPatientForm({...patientForm, cpf: event.target.value})}/></div></div><div className="form-grid"><div className="field"><label htmlFor="patient-phone">Telefone</label><Input id="patient-phone" type="tel" maxLength={40} value={patientForm.phone} onChange={event => setPatientForm({...patientForm, phone: event.target.value})} placeholder="(00) 00000-0000"/></div><div className="field"><label htmlFor="patient-email">E-mail</label><Input id="patient-email" type="email" maxLength={254} value={patientForm.email} onChange={event => setPatientForm({...patientForm, email: event.target.value})}/></div></div><div className="form-grid"><div className="field"><label htmlFor="patient-birth">Nascimento</label><Input id="patient-birth" type="date" value={patientForm.birthDate} onChange={event => setPatientForm({...patientForm, birthDate: event.target.value})}/></div><div className="field"><label htmlFor="patient-sex">Gênero</label><NativeSelect id="patient-sex" className="full-select" value={patientForm.sex} onChange={event => setPatientForm({...patientForm, sex: event.target.value as Patient["sex"]})}><NativeSelectOption value="">Não informado</NativeSelectOption><NativeSelectOption value="Masculino">Masculino</NativeSelectOption><NativeSelectOption value="Feminino">Feminino</NativeSelectOption><NativeSelectOption value="Outro">Outro</NativeSelectOption></NativeSelect></div></div><div className="form-grid"><div className="field"><label htmlFor="patient-condition">Condição biológica</label><NativeSelect id="patient-condition" className="full-select" value={patientForm.biologicalCondition} onChange={event => setPatientForm({...patientForm, biologicalCondition: event.target.value as Patient["biologicalCondition"]})}><NativeSelectOption value="">Não informada</NativeSelectOption><NativeSelectOption value="Normal">Normal</NativeSelectOption><NativeSelectOption value="Gestante">Gestante</NativeSelectOption><NativeSelectOption value="Lactante">Lactante</NativeSelectOption></NativeSelect></div><div className="field"><label htmlFor="patient-tags">Tags</label><Input id="patient-tags" maxLength={1000} value={patientForm.tags} onChange={event => setPatientForm({...patientForm, tags: event.target.value})} placeholder="Separe por vírgulas"/></div></div><div className="field"><label htmlFor="patient-goal">Objetivo do acompanhamento</label><Input id="patient-goal" maxLength={240} value={patientForm.goal} onChange={event => setPatientForm({...patientForm, goal: event.target.value})} placeholder="Ex.: melhorar hábitos alimentares"/></div><div className="field"><label htmlFor="patient-notes">Observações</label><Textarea id="patient-notes" rows={3} maxLength={3000} value={patientForm.notes} onChange={event => setPatientForm({...patientForm, notes: event.target.value})}/></div><DialogFooter><button className="button button-secondary" type="button" onClick={() => setPatientOpen(false)}>Cancelar</button><button className="button button-primary" disabled={busy} type="submit">{busy ? "Salvando..." : editPatientId ? "Salvar alterações" : "Cadastrar paciente"}</button></DialogFooter></form></DialogContent></Dialog>

    <Dialog open={appointmentOpen} onOpenChange={setAppointmentOpen}><DialogContent className="form-dialog"><DialogHeader><DialogTitle>Agendar consulta</DialogTitle><DialogDescription>Escolha o paciente e o horário local do atendimento.</DialogDescription></DialogHeader><form className="modal-form" onSubmit={saveAppointment}>{mutationError && <p className="consultorio-mutation-error" role="alert">{mutationError}</p>}<div className="field"><label htmlFor="appointment-patient">Paciente *</label><NativeSelect id="appointment-patient" className="full-select" required value={appointmentForm.patientId} onChange={event => setAppointmentForm({...appointmentForm, patientId: Number(event.target.value)})}>{workspace.patients.map(patient => <NativeSelectOption value={patient.id} key={patient.id}>{patient.name}</NativeSelectOption>)}</NativeSelect></div><div className="form-grid"><div className="field"><label htmlFor="appointment-date">Data e hora *</label><Input id="appointment-date" type="datetime-local" required value={appointmentForm.startsAt} onChange={event => setAppointmentForm({...appointmentForm, startsAt: event.target.value})}/></div><div className="field"><label htmlFor="appointment-kind">Tipo</label><NativeSelect id="appointment-kind" className="full-select" value={appointmentForm.kind} onChange={event => setAppointmentForm({...appointmentForm, kind: event.target.value})}><NativeSelectOption value="Consulta">Consulta</NativeSelectOption><NativeSelectOption value="Retorno">Retorno</NativeSelectOption></NativeSelect></div></div><div className="field"><label htmlFor="appointment-notes">Observações</label><Textarea id="appointment-notes" value={appointmentForm.notes} maxLength={1000} onChange={event => setAppointmentForm({...appointmentForm, notes: event.target.value})} rows={3}/></div><DialogFooter><button className="button button-secondary" type="button" onClick={() => setAppointmentOpen(false)}>Cancelar</button><button className="button button-primary" type="submit" disabled={busy || !appointmentForm.patientId}>{busy ? "Salvando..." : "Agendar"}</button></DialogFooter></form></DialogContent></Dialog>

    <Dialog open={measurementOpen} onOpenChange={setMeasurementOpen}><DialogContent className="form-dialog"><DialogHeader><DialogTitle>Registrar medidas</DialogTitle><DialogDescription>{selected?.name ?? "Paciente"} · informe peso ou cintura.</DialogDescription></DialogHeader><form className="modal-form" onSubmit={saveMeasurement}>{mutationError && <p className="consultorio-mutation-error" role="alert">{mutationError}</p>}<div className="field"><label htmlFor="measure-date">Data *</label><Input id="measure-date" type="date" required value={measurementForm.measuredOn} onChange={event => setMeasurementForm({...measurementForm, measuredOn: event.target.value})}/></div><div className="form-grid"><div className="field"><label htmlFor="measure-weight">Peso (kg)</label><Input id="measure-weight" type="number" inputMode="decimal" min="0.1" max="600" step="0.1" value={measurementForm.weightKg} onChange={event => setMeasurementForm({...measurementForm, weightKg: event.target.value})} placeholder="Ex.: 72,5"/></div><div className="field"><label htmlFor="measure-waist">Cintura (cm)</label><Input id="measure-waist" type="number" inputMode="decimal" min="0.1" max="400" step="0.1" value={measurementForm.waistCm} onChange={event => setMeasurementForm({...measurementForm, waistCm: event.target.value})} placeholder="Ex.: 86"/></div></div><div className="field"><label htmlFor="measure-notes">Observações</label><Textarea id="measure-notes" value={measurementForm.notes} maxLength={1000} onChange={event => setMeasurementForm({...measurementForm, notes: event.target.value})} rows={3}/></div><DialogFooter><button className="button button-secondary" type="button" onClick={() => setMeasurementOpen(false)}>Cancelar</button><button className="button button-primary" type="submit" disabled={busy}>{busy ? "Salvando..." : "Salvar medidas"}</button></DialogFooter></form></DialogContent></Dialog>
  </div>;
}
