"use client";

import { type ReactNode, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { serverClient, type ClinicClient } from "@/lib/clinic-client";
import {
  Activity, ArrowRight, CalendarDays, Check, ChevronRight, ClipboardList,
  Clock3, FileText, HeartPulse, LayoutDashboard, ListPlus, Plus, Search, Stethoscope,
  TrendingDown, Users, Utensils, X,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import PhotoAssessment, { type PhotoAssessmentRecord } from "@/components/photo-assessment";
import ClinicalRecordPanel, { type ClinicalRecord } from "@/components/clinical-record-panel";
import { toast } from "sonner";

type Patient = { id: number; name: string; phone: string; birthDate: string; goal: string; notes: string; createdAt: string };
type Appointment = { id: number; patientId: number; startsAt: string; kind: string; status: "Agendada" | "Concluída" | "Cancelada"; notes: string };
type Measurement = { id: number; patientId: number; measuredOn: string; weightKg: number | null; waistCm: number | null; notes: string };
type Meal = { time: string; label: string; foods: string };
type MealPlan = { id: number; patientId: number; title: string; instructions: string; mealsJson: string; updatedAt: string };
type Workspace = { patients: Patient[]; appointments: Appointment[]; measurements: Measurement[]; plans: MealPlan[]; photoAssessments: PhotoAssessmentRecord[]; clinicalRecords?: ClinicalRecord[] };
type Section = "overview" | "patients" | "agenda" | "plans" | "evolution" | "records" | "preview";
type SiteTool = { name: string; title: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean; untrustedContentHint: boolean }; execute: (input: unknown) => Promise<unknown> };
type SiteModelContext = { registerTool: (tool: SiteTool, options: { signal: AbortSignal }) => void | Promise<void> };

const emptyWorkspace: Workspace = { patients: [], appointments: [], measurements: [], plans: [], photoAssessments: [], clinicalRecords: [] };
const emptyPatient = { name: "", phone: "", birthDate: "", goal: "", notes: "" };
const firstMeals: Meal[] = [
  { time: "07:00", label: "Café da manhã", foods: "" },
  { time: "12:00", label: "Almoço", foods: "" },
  { time: "19:00", label: "Jantar", foods: "" },
];
const nav: { value: Section; label: string; icon: typeof Users }[] = [
  { value: "overview", label: "Visão geral", icon: LayoutDashboard },
  { value: "patients", label: "Pacientes", icon: Users },
  { value: "agenda", label: "Agenda", icon: CalendarDays },
  { value: "plans", label: "Planos", icon: Utensils },
  { value: "evolution", label: "Evolução", icon: Activity },
  { value: "records", label: "Fichas", icon: FileText },
  { value: "preview", label: "Visão do paciente", icon: HeartPulse },
];

function today() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}
function formatDay(day: string) {
  if (!day) return "—";
  if (day.endsWith("Z")) return new Date(day).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });
  return new Date(`${day.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}
function formatLongDay(day: string) {
  return new Date(`${day}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
}
function parseMeals(raw: string): Meal[] {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((meal) => meal && typeof meal.foods === "string") : [];
  } catch { return []; }
}
function number(value: number | null, suffix: string) {
  return value === null ? "—" : `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${suffix}`;
}
function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function PatientPicker({ patients, value, onChange }: { patients: Patient[]; value: number | null; onChange: (id: number) => void }) {
  return (
    <label className="picker-field">
      <span>Paciente</span>
      <NativeSelect value={value ?? ""} onChange={(event) => onChange(Number(event.target.value))} className="patient-select" disabled={!patients.length}>
        {!patients.length && <NativeSelectOption value="">Nenhum paciente cadastrado</NativeSelectOption>}
        {patients.map((patient) => <NativeSelectOption key={patient.id} value={patient.id}>{patient.name}</NativeSelectOption>)}
      </NativeSelect>
    </label>
  );
}

function EmptyState({ title, description, action, onAction, icon: Icon = ClipboardList }: {
  title: string; description: string; action?: string; onAction?: () => void; icon?: typeof Users;
}) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={23} /></div><h3>{title}</h3><p>{description}</p>{action && onAction && <button className="button button-primary" onClick={onAction}><Plus size={17} />{action}</button>}</div>;
}

function WeightChart({ measurements }: { measurements: Measurement[] }) {
  const values = measurements.filter((item) => item.weightKg !== null).slice().sort((a, b) => a.measuredOn.localeCompare(b.measuredOn)).slice(-8);
  if (values.length < 2) return <p className="chart-placeholder">Registre pelo menos duas pesagens para acompanhar a curva de evolução.</p>;
  const weights = values.map((item) => item.weightKg as number);
  const low = Math.min(...weights) - 1;
  const high = Math.max(...weights) + 1;
  const points = values.map((item, index) => ({
    x: 34 + (index * 592) / (values.length - 1),
    y: 170 - (((item.weightKg as number) - low) / (high - low)) * 135,
  }));
  return <div className="chart-wrap"><svg viewBox="0 0 660 210" role="img" aria-label={`Evolução do peso: de ${number(weights[0], "kg")} a ${number(weights.at(-1) ?? null, "kg")}`}>
    {[45, 105, 165].map((y) => <line key={y} x1="34" x2="626" y1={y} y2={y} stroke="#e5eeec" strokeDasharray="5 6" />)}
    <polyline points={points.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#118e8a" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    {points.map((p, index) => <g key={values[index].id}><circle cx={p.x} cy={p.y} r="6" fill="#118e8a" stroke="white" strokeWidth="3" /><title>{formatDay(values[index].measuredOn)}: {number(values[index].weightKg, "kg")}</title></g>)}
    <text x="34" y="204" fill="#708788" fontSize="13">{formatDay(values[0].measuredOn)}</text>
    <text x="626" y="204" textAnchor="end" fill="#708788" fontSize="13">{formatDay(values.at(-1)!.measuredOn)}</text>
  </svg></div>;
}

export default function ClinicApp({ client = serverClient, tools }: { client?: ClinicClient; tools?: ReactNode } = {}) {
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState<Section>("overview");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [patientOpen, setPatientOpen] = useState(false);
  const [editPatientId, setEditPatientId] = useState<number | null>(null);
  const [patientForm, setPatientForm] = useState(emptyPatient);
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const [appointmentForm, setAppointmentForm] = useState({ patientId: 0, startsAt: "", kind: "Consulta", notes: "" });
  const [measurementOpen, setMeasurementOpen] = useState(false);
  const [measurementForm, setMeasurementForm] = useState({ measuredOn: today(), weightKg: "", waistCm: "", notes: "" });
  const [planTitle, setPlanTitle] = useState("Plano alimentar");
  const [planInstructions, setPlanInstructions] = useState("");
  const [meals, setMeals] = useState<Meal[]>(firstMeals);

  const load = useCallback(async () => {
    try {
      const response = await client.request("/api/workspace", { cache: "no-store" });
      const payload = await response.json() as Workspace & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível carregar os registros.");
      setData(payload);
      setError("");
      setSelectedId((current) => payload.patients.some((patient: Patient) => patient.id === current) ? current : payload.patients[0]?.id ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar os registros.");
    } finally { setLoading(false); }
  }, [client]);
  useEffect(() => { void load(); }, [load]);

  const workspace = data ? { ...emptyWorkspace, ...data, clinicalRecords: data.clinicalRecords ?? [] } : emptyWorkspace;
  const clinicalEnabled = data?.clinicalRecords !== undefined;
  const selected = workspace.patients.find((patient) => patient.id === selectedId) ?? null;
  const selectedPlan = workspace.plans.find((plan) => plan.patientId === selectedId) ?? null;
  const selectedMeasurements = useMemo(() => workspace.measurements.filter((item) => item.patientId === selectedId), [workspace.measurements, selectedId]);
  const selectedPhotos = useMemo(() => workspace.photoAssessments.filter((item) => item.patientId === selectedId), [workspace.photoAssessments, selectedId]);
  const selectedClinicalRecord = workspace.clinicalRecords?.find((item) => item.patientId === selectedId) ?? null;
  const upcoming = workspace.appointments.filter((appointment) => appointment.status === "Agendada" && appointment.startsAt.slice(0, 10) >= today()).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const appointmentsSorted = workspace.appointments.slice().sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const visiblePatients = workspace.patients.filter((patient) => `${patient.name} ${patient.goal}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));
  const currentWeight = selectedMeasurements.find((item) => item.weightKg !== null);

  useEffect(() => {
    if (selectedPlan) {
      setPlanTitle(selectedPlan.title);
      setPlanInstructions(selectedPlan.instructions);
      setMeals(parseMeals(selectedPlan.mealsJson));
    } else {
      setPlanTitle("Plano alimentar");
      setPlanInstructions("");
      setMeals(firstMeals.map((meal) => ({ ...meal })));
    }
  }, [selectedId, selectedPlan?.updatedAt]);

  async function mutate(payload: Record<string, unknown>, confirmation: string): Promise<{ id?: number; ok?: boolean } | null> {
    setBusy(true);
    try {
      const response = await client.request("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { error?: string; id?: number; ok?: boolean };
      if (!response.ok) throw new Error(result.error ?? "Não foi possível salvar.");
      await load();
      toast.success(confirmation);
      return result;
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível salvar.");
      return null;
    } finally { setBusy(false); }
  }

  function openNewPatient() {
    setEditPatientId(null);
    setPatientForm(emptyPatient);
    setPatientOpen(true);
  }
  function openEditPatient(patient: Patient) {
    setEditPatientId(patient.id);
    setPatientForm({ name: patient.name, phone: patient.phone, birthDate: patient.birthDate, goal: patient.goal, notes: patient.notes });
    setPatientOpen(true);
  }
  async function savePatient(event: FormEvent) {
    event.preventDefault();
    const result = await mutate({ action: editPatientId ? "updatePatient" : "createPatient", ...(editPatientId ? { id: editPatientId } : {}), ...patientForm }, editPatientId ? "Cadastro atualizado." : "Paciente cadastrado.");
    if (result) {
      setPatientOpen(false);
      if (result.id) setSelectedId(result.id);
      setSection("patients");
    }
  }
  function openNewAppointment() {
    setAppointmentForm({ patientId: selectedId ?? workspace.patients[0]?.id ?? 0, startsAt: "", kind: "Consulta", notes: "" });
    setAppointmentOpen(true);
  }
  async function saveAppointment(event: FormEvent) {
    event.preventDefault();
    const result = await mutate({ action: "createAppointment", ...appointmentForm }, "Consulta agendada.");
    if (result) { setAppointmentOpen(false); setSection("agenda"); }
  }
  async function saveMeasurement(event: FormEvent) {
    event.preventDefault();
    if (!selectedId) return;
    const result = await mutate({ action: "addMeasurement", patientId: selectedId, measuredOn: measurementForm.measuredOn,
      weightKg: measurementForm.weightKg === "" ? null : Number(measurementForm.weightKg),
      waistCm: measurementForm.waistCm === "" ? null : Number(measurementForm.waistCm), notes: measurementForm.notes }, "Medidas registradas.");
    if (result) { setMeasurementOpen(false); setSection("evolution"); }
  }
  async function savePlan(event: FormEvent) {
    event.preventDefault();
    if (!selectedId) return;
    const validMeals = meals.map((meal) => ({ time: meal.time.trim(), label: meal.label.trim(), foods: meal.foods.trim() })).filter((meal) => meal.label && meal.foods);
    if (!validMeals.length) { toast.error("Preencha pelo menos uma refeição para salvar o plano."); return; }
    await mutate({ action: "savePlan", patientId: selectedId, title: planTitle, instructions: planInstructions, meals: validMeals }, "Plano alimentar salvo.");
  }
  function updateMeal(index: number, field: keyof Meal, value: string) {
    setMeals((current) => current.map((meal, mealIndex) => mealIndex === index ? { ...meal, [field]: value } : meal));
  }
  function selectPatient(id: number, destination: Section = "patients") { setSelectedId(id); setSection(destination); }

  useEffect(() => {
    const context = (document as Document & { modelContext?: SiteModelContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: SiteTool) => {
      try { void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(console.error); }
      catch (cause) { console.error(cause); }
    };
    register({
      name: "listar_pacientes", title: "Listar pacientes",
      description: "Lista os pacientes cadastrados no consultório atual, sem devolver anotações clínicas.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      async execute() {
        const response = await client.request("/api/workspace", { cache: "no-store" });
        const result = await response.json() as Workspace & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Não foi possível listar os pacientes.");
        return { patients: result.patients.map(({ id, name, goal }) => ({ id, name, goal })) };
      },
    });
    register({
      name: "cadastrar_paciente", title: "Cadastrar paciente",
      description: "Cadastra um paciente no mesmo consultório e atualiza a lista visível.",
      inputSchema: { type: "object", properties: {
        name: { type: "string", minLength: 2, maxLength: 120 },
        phone: { type: "string", maxLength: 40 }, goal: { type: "string", maxLength: 240 },
      }, required: ["name"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Informe o nome do paciente.");
        const values = input as Record<string, unknown>;
        const name = typeof values.name === "string" ? values.name.trim() : "";
        const phone = typeof values.phone === "string" ? values.phone.trim() : "";
        const goal = typeof values.goal === "string" ? values.goal.trim() : "";
        if (name.length < 2 || name.length > 120 || phone.length > 40 || goal.length > 240 || Object.keys(values).some((key) => !["name", "phone", "goal"].includes(key))) throw new Error("Confira os dados do paciente.");
        const response = await client.request("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "createPatient", name, phone, goal, birthDate: "", notes: "" }) });
        const result = await response.json() as { id?: number; error?: string };
        if (!response.ok || !result.id) throw new Error(result.error ?? "Não foi possível cadastrar o paciente.");
        await load();
        setSelectedId(result.id);
        setSection("patients");
        return { id: result.id, name };
      },
    });
    return () => lifecycle.abort();
  }, [load, client]);

  return <div className="app-shell">
    <Toaster richColors position="top-right" />
    <header className="site-header">
      <div className="header-inner">
        <div className="brand"><img className="brand-logo" src={client.assetUrl("marakesia-logo.png")} alt="Logo da nutricionista Marakesia Nascimento, CRN 11-6356" width={112} height={112} fetchPriority="high" /><div><strong>Nutri<span>Mara</span></strong><small>Consultório digital</small></div></div>
        <div className="header-user"><span className="professional-label">Marakesia Nascimento <span>· CRN 11-6356</span></span><span className="professional-avatar">MN</span></div>
      </div>
    </header>
    {tools}

    <main className="page-wrap">
      <Tabs value={section} onValueChange={(value) => setSection(value as Section)} className="workspace-tabs">
        <div className="nav-row"><TabsList aria-label="Seções do consultório" className="main-nav">{nav.filter(({ value }) => value !== "records" || clinicalEnabled).map(({ value, label, icon: Icon }) => <TabsTrigger key={value} value={value} className="nav-trigger"><Icon size={17} /><span>{label}</span></TabsTrigger>)}</TabsList></div>

        {error && !data ? <div className="load-error" role="alert"><h2>Não foi possível abrir o consultório</h2><p>{error}</p><button className="button button-primary" onClick={() => { setLoading(true); void load(); }}>Tentar novamente</button></div> : null}

        <TabsContent value="overview" className="tab-panel">
          <section className="overview-hero">
            <div className="hero-copy"><span className="eyebrow light">CONSULTÓRIO MARAKESIA NASCIMENTO</span><h1>Seu cuidado começa com organização.</h1><p>{formatLongDay(today())} · Acompanhe seus pacientes em cada etapa.</p><div className="hero-actions"><button className="button button-light" onClick={openNewPatient}><Plus size={18} /> Novo paciente</button><button className="button button-outline-light" onClick={() => setSection("agenda")}>Ver agenda <ArrowRight size={17} /></button></div></div>
            <div className="hero-aside"><div className="hero-aside-icon"><CalendarDays size={23} /></div><span>Próxima consulta</span>{upcoming[0] ? <><strong>{workspace.patients.find((p) => p.id === upcoming[0].patientId)?.name ?? "Paciente"}</strong><small>{formatDay(upcoming[0].startsAt)} · {upcoming[0].startsAt.slice(11, 16)}</small></> : <><strong>Agenda livre</strong><small>As próximas consultas aparecem aqui.</small></>}</div>
          </section>
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-icon teal"><Users size={21} /></div><span>Pacientes cadastrados</span><strong>{workspace.patients.length}</strong><small>Prontuários em sua área</small></div>
            <div className="stat-card"><div className="stat-icon blue"><CalendarDays size={21} /></div><span>Consultas agendadas</span><strong>{upcoming.length}</strong><small>A partir de hoje</small></div>
            <div className="stat-card"><div className="stat-icon green"><ClipboardList size={21} /></div><span>Planos alimentares</span><strong>{workspace.plans.length}</strong><small>Planos salvos</small></div>
          </div>
          <div className="overview-grid">
            <section className="surface overview-agenda"><div className="section-heading"><div><span className="eyebrow">ROTINA</span><h2>Próximas consultas</h2></div><button className="text-button" onClick={() => setSection("agenda")}>Abrir agenda <ArrowRight size={16} /></button></div>
              {upcoming.length ? <div className="compact-list">{upcoming.slice(0, 4).map((appointment) => <div className="compact-appointment" key={appointment.id}><div className="date-tile"><strong>{appointment.startsAt.slice(8, 10)}</strong><small>{new Date(`${appointment.startsAt.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</small></div><div><strong>{workspace.patients.find((p) => p.id === appointment.patientId)?.name ?? "Paciente"}</strong><span>{appointment.kind} · {appointment.startsAt.slice(11, 16)}</span></div><ChevronRight size={18} className="muted-chevron" /></div>)}</div> : <EmptyState icon={CalendarDays} title="Sua agenda está livre" description="Marque consultas para manter os atendimentos organizados." action={workspace.patients.length ? "Agendar consulta" : "Cadastrar paciente"} onAction={workspace.patients.length ? openNewAppointment : openNewPatient} />}
            </section>
            <section className="surface overview-actions"><div className="section-heading"><div><span className="eyebrow">ATALHOS</span><h2>Continue de onde parou</h2></div></div><div className="action-list"><button onClick={() => setSection("patients")}><span className="action-icon"><Users size={19} /></span><span><strong>Pacientes</strong><small>Cadastros e informações</small></span><ArrowRight size={17} /></button><button onClick={() => setSection("plans")}><span className="action-icon"><Utensils size={19} /></span><span><strong>Planos alimentares</strong><small>Organize refeições e orientações</small></span><ArrowRight size={17} /></button><button onClick={() => setSection("evolution")}><span className="action-icon"><TrendingDown size={19} /></span><span><strong>Evolução</strong><small>Registre peso e medidas</small></span><ArrowRight size={17} /></button></div></section>
          </div>
        </TabsContent>

        <TabsContent value="patients" className="tab-panel"><div className="page-heading"><div><span className="eyebrow">ACOMPANHAMENTO</span><h1>Pacientes</h1><p>Informações de quem você acompanha, sempre à mão.</p></div><button className="button button-primary" onClick={openNewPatient}><Plus size={18} /> Novo paciente</button></div>
          {workspace.patients.length ? <div className="patients-layout"><section className="surface patient-list"><div className="list-header"><h2>Todos os pacientes <span>{workspace.patients.length}</span></h2><label className="search-field"><Search size={17} /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar paciente" aria-label="Buscar paciente" /></label></div>
            <div className="patient-rows">{visiblePatients.map((patient) => <button key={patient.id} className={`patient-row ${selectedId === patient.id ? "selected" : ""}`} onClick={() => setSelectedId(patient.id)}><span className="patient-avatar">{initials(patient.name)}</span><span className="patient-row-name"><strong>{patient.name}</strong><small>{patient.goal || "Objetivo ainda não informado"}</small></span><ChevronRight size={18} /></button>)}{!visiblePatients.length && <div className="inline-empty">Nenhum paciente encontrado para esta busca.</div>}</div></section>
            <section className="surface patient-detail">{selected ? <><div className="detail-top"><span className="detail-avatar">{initials(selected.name)}</span><div><span className="eyebrow">PRONTUÁRIO</span><h2>{selected.name}</h2><small>Cadastrado em {formatDay(selected.createdAt)}</small></div></div><div className="detail-data"><div><span>Objetivo</span><strong>{selected.goal || "Não informado"}</strong></div><div><span>Telefone</span><strong>{selected.phone || "Não informado"}</strong></div><div><span>Nascimento</span><strong>{selected.birthDate ? formatDay(selected.birthDate) : "Não informado"}</strong></div><div><span>Último peso</span><strong>{number(workspace.measurements.find((item) => item.patientId === selected.id && item.weightKg !== null)?.weightKg ?? null, "kg")}</strong></div></div>{selected.notes && <div className="note-box"><span>Observações</span><p>{selected.notes}</p></div>}<div className="detail-actions"><button className="button button-primary" onClick={() => selectPatient(selected.id, "plans")}><Utensils size={17} /> Plano alimentar</button>{clinicalEnabled && <button className="button button-secondary" onClick={() => selectPatient(selected.id, "records")}><FileText size={17} /> Ficha clínica</button>}<button className="button button-secondary" onClick={() => selectPatient(selected.id, "evolution")}>Fotos e medidas</button><button className="button button-secondary" onClick={() => openEditPatient(selected)}>Editar cadastro</button></div></> : <EmptyState title="Selecione um paciente" description="Escolha um cadastro para visualizar os detalhes." />}</section></div> : <div className="surface"><EmptyState icon={Users} title="Seu primeiro paciente começa aqui" description="Cadastre nome e objetivo. Depois você pode adicionar consultas, medidas e o plano alimentar." action="Cadastrar paciente" onAction={openNewPatient} /></div>}
        </TabsContent>

        <TabsContent value="agenda" className="tab-panel"><div className="page-heading"><div><span className="eyebrow">ATENDIMENTO</span><h1>Agenda</h1><p>Consulte horários e acompanhe o status de cada atendimento.</p></div><button className="button button-primary" onClick={workspace.patients.length ? openNewAppointment : openNewPatient}><Plus size={18} /> {workspace.patients.length ? "Nova consulta" : "Cadastrar paciente"}</button></div>
          <section className="surface appointments-surface">{appointmentsSorted.length ? <><div className="list-header"><h2>Consultas <span>{appointmentsSorted.length}</span></h2><span className="quiet-label">Mais recentes primeiro</span></div><div className="appointment-list">{appointmentsSorted.map((appointment) => <div className="appointment-row" key={appointment.id}><div className="appointment-time"><CalendarDays size={19} /><div><strong>{formatDay(appointment.startsAt)}</strong><small>{appointment.startsAt.slice(11, 16)}</small></div></div><div className="appointment-patient"><strong>{workspace.patients.find((patient) => patient.id === appointment.patientId)?.name ?? "Paciente"}</strong><small>{appointment.kind}{appointment.notes ? ` · ${appointment.notes}` : ""}</small></div><span className={`status status-${appointment.status.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`}>{appointment.status}</span>{appointment.status === "Agendada" && <div className="row-actions"><button aria-label="Marcar consulta como concluída" title="Concluir" onClick={() => void mutate({ action: "setAppointmentStatus", id: appointment.id, status: "Concluída" }, "Consulta concluída.")}><Check size={17} /></button><button aria-label="Cancelar consulta" title="Cancelar" onClick={() => void mutate({ action: "setAppointmentStatus", id: appointment.id, status: "Cancelada" }, "Consulta cancelada.")}><X size={17} /></button></div>}</div>)}</div></> : <EmptyState icon={CalendarDays} title="Nenhuma consulta marcada" description="As consultas aparecerão aqui assim que você agendar a primeira." action={workspace.patients.length ? "Agendar consulta" : "Cadastrar paciente"} onAction={workspace.patients.length ? openNewAppointment : openNewPatient} />}</section>
        </TabsContent>

        <TabsContent value="plans" className="tab-panel"><div className="page-heading"><div><span className="eyebrow">PRESCRIÇÃO</span><h1>Plano alimentar</h1><p>Organize as refeições e orientações de cada paciente.</p></div>{workspace.patients.length > 0 && <span className="privacy-note"><Stethoscope size={17} /> Acompanhamento individual</span>}</div>
          {workspace.patients.length ? <><div className="toolbar-surface"><PatientPicker patients={workspace.patients} value={selectedId} onChange={setSelectedId} />{selectedPlan && <span className="last-saved">Salvo em {formatDay(selectedPlan.updatedAt)}</span>}</div><form className="plan-layout" onSubmit={savePlan}><section className="surface plan-editor"><div className="section-heading"><div><span className="eyebrow">ORGANIZAÇÃO DIÁRIA</span><h2>Refeições</h2></div><span className="meal-count">{meals.length} {meals.length === 1 ? "refeição" : "refeições"}</span></div><div className="field"><label htmlFor="plan-title">Título do plano</label><Input id="plan-title" value={planTitle} onChange={(event) => setPlanTitle(event.target.value)} maxLength={120} required /></div>
            <div className="meal-list">{meals.map((meal, index) => <div className="meal-card" key={index}><div className="meal-card-head"><span className="meal-index">{String(index + 1).padStart(2, "0")}</span><strong>Refeição {index + 1}</strong><button type="button" className="icon-button" aria-label={`Remover refeição ${index + 1}`} onClick={() => setMeals((current) => current.filter((_, mealIndex) => mealIndex !== index))}><X size={17} /></button></div><div className="meal-fields"><div className="field time-field"><label htmlFor={`meal-time-${index}`}>Horário</label><Input id={`meal-time-${index}`} type="time" value={meal.time} onChange={(event) => updateMeal(index, "time", event.target.value)} /></div><div className="field"><label htmlFor={`meal-label-${index}`}>Nome da refeição</label><Input id={`meal-label-${index}`} value={meal.label} maxLength={80} onChange={(event) => updateMeal(index, "label", event.target.value)} placeholder="Ex.: Lanche da tarde" /></div></div><div className="field"><label htmlFor={`meal-foods-${index}`}>Alimentos e quantidades</label><Textarea id={`meal-foods-${index}`} value={meal.foods} maxLength={700} onChange={(event) => updateMeal(index, "foods", event.target.value)} placeholder="Descreva os alimentos, porções e substituições" rows={2} /></div></div>)}</div><button type="button" className="add-meal" onClick={() => setMeals((current) => [...current, { time: "", label: "", foods: "" }])} disabled={meals.length >= 12}><ListPlus size={18} /> Adicionar refeição</button></section><aside className="surface plan-notes"><div className="section-heading"><div><span className="eyebrow">ORIENTAÇÕES</span><h2>Cuidados do plano</h2></div></div><div className="field"><label htmlFor="plan-instructions">Orientações gerais</label><Textarea id="plan-instructions" value={planInstructions} onChange={(event) => setPlanInstructions(event.target.value)} maxLength={2000} rows={8} placeholder="Hidratação, rotina, observações e combinações feitas em consulta" /></div><p className="editor-hint">O plano fica salvo para este paciente e pode ser atualizado a qualquer momento.</p><button type="submit" className="button button-primary button-wide" disabled={busy}><Check size={17} /> {busy ? "Salvando..." : "Salvar plano alimentar"}</button><button type="button" className="button button-secondary button-wide" onClick={() => setSection("preview")}>Ver visão do paciente <ArrowRight size={17} /></button></aside></form></> : <div className="surface"><EmptyState icon={Utensils} title="Primeiro, cadastre um paciente" description="Cada plano alimentar fica associado ao prontuário da pessoa atendida." action="Cadastrar paciente" onAction={openNewPatient} /></div>}
        </TabsContent>

        <TabsContent value="evolution" className="tab-panel"><div className="page-heading"><div><span className="eyebrow">RESULTADOS</span><h1>Evolução</h1><p>Registre medidas e veja a trajetória de cada paciente.</p></div>{selected && <button className="button button-primary" onClick={() => { setMeasurementForm({ measuredOn: today(), weightKg: "", waistCm: "", notes: "" }); setMeasurementOpen(true); }}><Plus size={18} /> Registrar medidas</button>}</div>
          {workspace.patients.length ? <><div className="toolbar-surface"><PatientPicker patients={workspace.patients} value={selectedId} onChange={setSelectedId} /></div><div className="evolution-grid"><section className="surface chart-surface"><div className="section-heading"><div><span className="eyebrow">HISTÓRICO</span><h2>Evolução do peso</h2></div><div className="chart-current"><small>Último registro</small><strong>{number(currentWeight?.weightKg ?? null, "kg")}</strong></div></div><WeightChart measurements={selectedMeasurements} /></section><section className="surface measure-surface"><div className="section-heading"><div><span className="eyebrow">MEDIDAS</span><h2>Registros</h2></div><span className="meal-count">{selectedMeasurements.length}</span></div>{selectedMeasurements.length ? <div className="measure-list">{selectedMeasurements.map((item) => <div className="measure-row" key={item.id}><div><strong>{formatDay(item.measuredOn)}</strong>{item.notes && <small>{item.notes}</small>}</div><div><strong>{number(item.weightKg, "kg")}</strong><small>Cintura: {number(item.waistCm, "cm")}</small></div></div>)}</div> : <div className="mini-empty"><p>Nenhuma medida registrada para {selected?.name}.</p><button className="text-button" onClick={() => setMeasurementOpen(true)}>Registrar medidas <ArrowRight size={16} /></button></div>}</section></div>{selected && <PhotoAssessment key={selected.id} client={client} patientId={selected.id} patientName={selected.name} entries={selectedPhotos} onSaved={load} today={today()} formatDay={formatDay} />}</> : <div className="surface"><EmptyState icon={Activity} title="Acompanhe a evolução" description="Cadastre um paciente e comece a registrar peso e medidas." action="Cadastrar paciente" onAction={openNewPatient} /></div>}
        </TabsContent>

        <TabsContent value="records" className="tab-panel"><div className="page-heading"><div><span className="eyebrow">DOCUMENTAÇÃO CLÍNICA</span><h1>Ficha do paciente</h1><p>Preencha, salve no prontuário e imprima ou gere um PDF pelo navegador.</p></div>{selected && <span className="privacy-note"><Stethoscope size={17} /> Ficha profissional</span>}</div>
          {clinicalEnabled && selected ? <><div className="toolbar-surface"><PatientPicker patients={workspace.patients} value={selectedId} onChange={setSelectedId} />{selectedClinicalRecord && <span className="last-saved">Ficha atualizada em {formatDay(selectedClinicalRecord.updatedAt)}</span>}</div><ClinicalRecordPanel key={selected.id} client={client} patient={selected} record={selectedClinicalRecord} onSaved={load} /></> : <div className="surface"><EmptyState icon={FileText} title="Primeiro, cadastre um paciente" description="A ficha clínica ficará ligada ao prontuário selecionado." action="Cadastrar paciente" onAction={openNewPatient} /></div>}
        </TabsContent>

        <TabsContent value="preview" className="tab-panel"><div className="page-heading"><div><span className="eyebrow">ACOMPANHAMENTO</span><h1>Visão do paciente</h1><p>Confira como as orientações ficam organizadas para consulta.</p></div><span className="preview-badge">Prévia dentro do consultório</span></div>
          {workspace.patients.length ? <><div className="toolbar-surface"><PatientPicker patients={workspace.patients} value={selectedId} onChange={setSelectedId} /></div><div className="preview-layout"><div className="preview-context"><div className="context-icon"><HeartPulse size={27} /></div><h2>Um plano claro para seguir todos os dias.</h2><p>Esta prévia ajuda a revisar as refeições e orientações registradas para {selected?.name}. O acesso individual do paciente ainda não está ativado.</p><button className="button button-secondary" onClick={() => setSection("plans")}>Editar plano <ArrowRight size={17} /></button></div><div className="phone-frame"><div className="phone-top"><span>NutriMara</span><HeartPulse size={18} /></div><div className="phone-greeting"><small>PLANO ALIMENTAR</small><h3>Olá, {selected?.name.split(" ")[0]}!</h3><p>Seu cuidado, um dia de cada vez.</p></div>{selectedPlan ? <><div className="phone-plan-title"><span>PLANO ATUAL</span><strong>{selectedPlan.title}</strong></div><div className="phone-meals">{parseMeals(selectedPlan.mealsJson).map((meal, index) => <div className="phone-meal" key={index}><small>{meal.time || "Refeição"}</small><strong>{meal.label}</strong><p>{meal.foods}</p></div>)}</div>{selectedPlan.instructions && <div className="phone-note"><strong>Orientações</strong><p>{selectedPlan.instructions}</p></div>}</> : <div className="phone-empty"><Utensils size={28} /><strong>Plano em preparação</strong><p>Assim que for salvo, as refeições aparecerão aqui.</p></div>}<div className="phone-bottom"><span><Utensils size={16} /> Plano</span><span><Activity size={16} /> Evolução</span></div></div></div></> : <div className="surface"><EmptyState icon={HeartPulse} title="Prévia disponível após o cadastro" description="Cadastre um paciente para visualizar o plano alimentar no formato compacto." action="Cadastrar paciente" onAction={openNewPatient} /></div>}
        </TabsContent>
      </Tabs>
      <footer className="site-footer"><span>NutriMara · Marakesia Nascimento · CRN 11-6356</span><span>Um espaço para cuidar com atenção.</span></footer>
    </main>

    <Dialog open={patientOpen} onOpenChange={setPatientOpen}><DialogContent className="form-dialog"><DialogHeader><DialogTitle>{editPatientId ? "Editar paciente" : "Novo paciente"}</DialogTitle><DialogDescription>Dados essenciais para começar o acompanhamento.</DialogDescription></DialogHeader><form onSubmit={savePatient} className="modal-form"><div className="field"><label htmlFor="patient-name">Nome completo *</label><Input id="patient-name" required minLength={2} maxLength={120} value={patientForm.name} onChange={(event) => setPatientForm({ ...patientForm, name: event.target.value })} /></div><div className="form-grid"><div className="field"><label htmlFor="patient-phone">Telefone</label><Input id="patient-phone" type="tel" maxLength={40} value={patientForm.phone} onChange={(event) => setPatientForm({ ...patientForm, phone: event.target.value })} placeholder="(00) 00000-0000" /></div><div className="field"><label htmlFor="patient-birth">Nascimento</label><Input id="patient-birth" type="date" value={patientForm.birthDate} onChange={(event) => setPatientForm({ ...patientForm, birthDate: event.target.value })} /></div></div><div className="field"><label htmlFor="patient-goal">Objetivo do acompanhamento</label><Input id="patient-goal" maxLength={240} value={patientForm.goal} onChange={(event) => setPatientForm({ ...patientForm, goal: event.target.value })} placeholder="Ex.: melhorar hábitos alimentares" /></div><div className="field"><label htmlFor="patient-notes">Observações</label><Textarea id="patient-notes" rows={3} maxLength={3000} value={patientForm.notes} onChange={(event) => setPatientForm({ ...patientForm, notes: event.target.value })} placeholder="Anotações importantes para o atendimento" /></div><DialogFooter><button className="button button-secondary" type="button" onClick={() => setPatientOpen(false)}>Cancelar</button><button className="button button-primary" disabled={busy} type="submit">{busy ? "Salvando..." : editPatientId ? "Salvar alterações" : "Cadastrar paciente"}</button></DialogFooter></form></DialogContent></Dialog>

    <Dialog open={appointmentOpen} onOpenChange={setAppointmentOpen}><DialogContent className="form-dialog"><DialogHeader><DialogTitle>Agendar consulta</DialogTitle><DialogDescription>Escolha o paciente e o horário do atendimento.</DialogDescription></DialogHeader><form className="modal-form" onSubmit={saveAppointment}><div className="field"><label htmlFor="appointment-patient">Paciente *</label><NativeSelect id="appointment-patient" className="full-select" value={appointmentForm.patientId} onChange={(event) => setAppointmentForm({ ...appointmentForm, patientId: Number(event.target.value) })}>{workspace.patients.map((patient) => <NativeSelectOption value={patient.id} key={patient.id}>{patient.name}</NativeSelectOption>)}</NativeSelect></div><div className="form-grid"><div className="field"><label htmlFor="appointment-date">Data e hora *</label><Input id="appointment-date" type="datetime-local" required value={appointmentForm.startsAt} onChange={(event) => setAppointmentForm({ ...appointmentForm, startsAt: event.target.value })} /></div><div className="field"><label htmlFor="appointment-kind">Tipo</label><NativeSelect id="appointment-kind" className="full-select" value={appointmentForm.kind} onChange={(event) => setAppointmentForm({ ...appointmentForm, kind: event.target.value })}><NativeSelectOption value="Consulta">Consulta</NativeSelectOption><NativeSelectOption value="Retorno">Retorno</NativeSelectOption></NativeSelect></div></div><div className="field"><label htmlFor="appointment-notes">Observações</label><Textarea id="appointment-notes" value={appointmentForm.notes} maxLength={1000} onChange={(event) => setAppointmentForm({ ...appointmentForm, notes: event.target.value })} rows={3} /></div><DialogFooter><button className="button button-secondary" type="button" onClick={() => setAppointmentOpen(false)}>Cancelar</button><button className="button button-primary" type="submit" disabled={busy}>{busy ? "Salvando..." : "Agendar"}</button></DialogFooter></form></DialogContent></Dialog>

    <Dialog open={measurementOpen} onOpenChange={setMeasurementOpen}><DialogContent className="form-dialog"><DialogHeader><DialogTitle>Registrar medidas</DialogTitle><DialogDescription>{selected?.name ?? "Paciente"} · informe peso ou cintura.</DialogDescription></DialogHeader><form className="modal-form" onSubmit={saveMeasurement}><div className="field"><label htmlFor="measure-date">Data *</label><Input id="measure-date" type="date" required value={measurementForm.measuredOn} onChange={(event) => setMeasurementForm({ ...measurementForm, measuredOn: event.target.value })} /></div><div className="form-grid"><div className="field"><label htmlFor="measure-weight">Peso (kg)</label><Input id="measure-weight" type="number" inputMode="decimal" min="0.1" max="600" step="0.1" value={measurementForm.weightKg} onChange={(event) => setMeasurementForm({ ...measurementForm, weightKg: event.target.value })} placeholder="Ex.: 72,5" /></div><div className="field"><label htmlFor="measure-waist">Cintura (cm)</label><Input id="measure-waist" type="number" inputMode="decimal" min="0.1" max="400" step="0.1" value={measurementForm.waistCm} onChange={(event) => setMeasurementForm({ ...measurementForm, waistCm: event.target.value })} placeholder="Ex.: 86" /></div></div><div className="field"><label htmlFor="measure-notes">Observações</label><Textarea id="measure-notes" value={measurementForm.notes} maxLength={1000} onChange={(event) => setMeasurementForm({ ...measurementForm, notes: event.target.value })} rows={3} /></div><DialogFooter><button className="button button-secondary" type="button" onClick={() => setMeasurementOpen(false)}>Cancelar</button><button className="button button-primary" type="submit" disabled={busy}>{busy ? "Salvando..." : "Salvar medidas"}</button></DialogFooter></form></DialogContent></Dialog>
    {loading && !data && !error && <div className="loading-indicator" role="status"><Clock3 size={18} /> Abrindo consultório...</div>}
  </div>;
}
