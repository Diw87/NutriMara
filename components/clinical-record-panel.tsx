"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, FileText, Printer, Save, Stethoscope } from "lucide-react";
import type { ClinicClient } from "@/lib/clinic-client";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export type ClinicalRecord = {
  id: number;
  patientId: number;
  consultationDate: string;
  mainComplaint: string;
  clinicalHistory: string;
  diagnoses: string;
  medications: string;
  allergies: string;
  surgeries: string;
  familyHistory: string;
  bowelHabits: string;
  sleep: string;
  physicalActivity: string;
  waterIntake: string;
  foodRoutine: string;
  restrictions: string;
  weightKg: number | null;
  heightCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
  bodyFatPct: number | null;
  bloodPressure: string;
  goals: string;
  conduct: string;
  returnDate: string;
  professionalNotes: string;
  updatedAt: string;
};

type Patient = { id: number; name: string; phone: string; birthDate: string; goal: string; notes: string; createdAt: string };
type ClinicalForm = Omit<ClinicalRecord, "id" | "patientId" | "updatedAt" | "weightKg" | "heightCm" | "waistCm" | "hipCm" | "bodyFatPct"> & {
  weightKg: string;
  heightCm: string;
  waistCm: string;
  hipCm: string;
  bodyFatPct: string;
};

const emptyForm = (date: string): ClinicalForm => ({
  consultationDate: date, mainComplaint: "", clinicalHistory: "", diagnoses: "", medications: "", allergies: "", surgeries: "", familyHistory: "",
  bowelHabits: "", sleep: "", physicalActivity: "", waterIntake: "", foodRoutine: "", restrictions: "", weightKg: "", heightCm: "", waistCm: "", hipCm: "", bodyFatPct: "", bloodPressure: "", goals: "", conduct: "", returnDate: "", professionalNotes: "",
});

function currentDate() { return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }); }
function displayDate(value: string) { return value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—"; }
function displayValue(value: string) { return value.trim() || "Não informado"; }
function numberValue(value: string) { const parsed = Number(value.replace(",", ".")); return value.trim() === "" || !Number.isFinite(parsed) ? null : parsed; }
function formFromRecord(record: ClinicalRecord | null, patient: Patient) {
  if (!record) {
    const form = emptyForm(currentDate());
    return { ...form, mainComplaint: patient.goal ? `Objetivo informado: ${patient.goal}` : "" };
  }
  return Object.fromEntries(Object.entries(record).filter(([key]) => !["id", "patientId", "updatedAt"].includes(key)).map(([key, value]) => [key, value === null ? "" : String(value)])) as ClinicalForm;
}

function Field({ label, id, value, onChange, multiline = false, placeholder, type = "text" }: { label: string; id: string; value: string; onChange: (value: string) => void; multiline?: boolean; placeholder?: string; type?: string }) {
  return <div className="field"><label htmlFor={id}>{label}</label>{multiline ? <Textarea id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={4} /> : <Input id={id} type={type} step={type === "number" ? "any" : undefined} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />}</div>;
}

function PrintBlock({ label, value }: { label: string; value: string }) {
  return <div className="clinical-print-block"><span>{label}</span><p>{displayValue(value)}</p></div>;
}

export default function ClinicalRecordPanel({ client, patient, record, onSaved }: { client: ClinicClient; patient: Patient; record: ClinicalRecord | null; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<ClinicalForm>(() => formFromRecord(record, patient));
  const [busy, setBusy] = useState(false);
  useEffect(() => { setForm(formFromRecord(record, patient)); }, [record?.updatedAt, patient.id]);
  const bmi = useMemo(() => {
    const weight = numberValue(form.weightKg); const height = numberValue(form.heightCm);
    return weight && height ? weight / ((height / 100) ** 2) : null;
  }, [form.weightKg, form.heightCm]);
  const bmiLabel = bmi === null ? "Informe peso e altura" : "Valor calculado para avaliação profissional";
  const update = (key: keyof ClinicalForm, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try {
      const body = {
        action: "saveClinicalRecord", patientId: patient.id, ...form,
        weightKg: numberValue(form.weightKg), heightCm: numberValue(form.heightCm), waistCm: numberValue(form.waistCm), hipCm: numberValue(form.hipCm), bodyFatPct: numberValue(form.bodyFatPct),
      };
      const response = await client.request("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Não foi possível salvar a ficha.");
      await onSaved(); toast.success("Ficha clínica salva no prontuário.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar a ficha."); }
    finally { setBusy(false); }
  }

  return <>
    <div className="clinical-record-toolbar"><div><span className="eyebrow">PRONTUÁRIO CLÍNICO</span><h2>Ficha de acompanhamento</h2><p>Registre a avaliação e mantenha a ficha atualizada para {patient.name}.</p></div><div className="clinical-record-actions"><button type="button" className="button button-secondary" onClick={() => window.print()}><Printer size={17} /> Imprimir / PDF</button><button type="submit" form="clinical-record-form" className="button button-primary" disabled={busy}><Save size={17} /> {busy ? "Salvando..." : "Salvar ficha"}</button></div></div>
    <form id="clinical-record-form" className="clinical-record-form" onSubmit={save}>
      <section className="surface clinical-section"><div className="clinical-section-head"><div><span className="eyebrow">ATENDIMENTO</span><h3>Identificação da consulta</h3></div><CalendarDays size={21} /></div><div className="clinical-form-grid three"><Field label="Data da consulta" id="clinical-date" type="date" value={form.consultationDate} onChange={(value) => update("consultationDate", value)} /><Field label="Data do retorno" id="clinical-return" type="date" value={form.returnDate} onChange={(value) => update("returnDate", value)} /><div className="clinical-metric"><span>Última atualização</span><strong>{record ? displayDate(record.updatedAt.slice(0, 10)) : "Ainda não salva"}</strong></div></div></section>
      <section className="surface clinical-section"><div className="clinical-section-head"><div><span className="eyebrow">ANAMNESE</span><h3>Histórico e contexto clínico</h3></div><Stethoscope size={21} /></div><div className="clinical-form-grid two"><Field label="Queixa principal e objetivo" id="clinical-complaint" value={form.mainComplaint} onChange={(value) => update("mainComplaint", value)} multiline placeholder="Motivo da consulta, objetivo e expectativas" /><Field label="Histórico clínico atual" id="clinical-history" value={form.clinicalHistory} onChange={(value) => update("clinicalHistory", value)} multiline placeholder="Condições relatadas, evolução e sintomas" /><Field label="Diagnósticos e condições acompanhadas" id="clinical-diagnoses" value={form.diagnoses} onChange={(value) => update("diagnoses", value)} multiline /><Field label="Medicamentos e suplementos" id="clinical-medications" value={form.medications} onChange={(value) => update("medications", value)} multiline /><Field label="Alergias e intolerâncias" id="clinical-allergies" value={form.allergies} onChange={(value) => update("allergies", value)} multiline /><Field label="Cirurgias e antecedentes relevantes" id="clinical-surgeries" value={form.surgeries} onChange={(value) => update("surgeries", value)} multiline /><Field label="Histórico familiar" id="clinical-family" value={form.familyHistory} onChange={(value) => update("familyHistory", value)} multiline /><Field label="Restrições e preferências alimentares" id="clinical-restrictions" value={form.restrictions} onChange={(value) => update("restrictions", value)} multiline /></div></section>
      <section className="surface clinical-section"><div className="clinical-section-head"><div><span className="eyebrow">ROTINA</span><h3>Hábitos e alimentação</h3></div><FileText size={21} /></div><div className="clinical-form-grid two"><Field label="Rotina alimentar e recordatório" id="clinical-food" value={form.foodRoutine} onChange={(value) => update("foodRoutine", value)} multiline placeholder="Horários, refeições, preferências e dificuldades" /><Field label="Atividade física" id="clinical-activity" value={form.physicalActivity} onChange={(value) => update("physicalActivity", value)} multiline /><Field label="Sono e descanso" id="clinical-sleep" value={form.sleep} onChange={(value) => update("sleep", value)} multiline /><Field label="Hidratação" id="clinical-water" value={form.waterIntake} onChange={(value) => update("waterIntake", value)} multiline /><Field label="Funcionamento intestinal" id="clinical-bowel" value={form.bowelHabits} onChange={(value) => update("bowelHabits", value)} multiline /></div></section>
      <section className="surface clinical-section"><div className="clinical-section-head"><div><span className="eyebrow">AVALIAÇÃO</span><h3>Antropometria e sinais registrados</h3></div><span className="clinical-section-note">Valores informados na consulta</span></div><div className="clinical-form-grid five"><Field label="Peso (kg)" id="clinical-weight" type="number" value={form.weightKg} onChange={(value) => update("weightKg", value)} placeholder="Ex.: 72,5" /><Field label="Altura (cm)" id="clinical-height" type="number" value={form.heightCm} onChange={(value) => update("heightCm", value)} placeholder="Ex.: 165" /><Field label="Cintura (cm)" id="clinical-waist" type="number" value={form.waistCm} onChange={(value) => update("waistCm", value)} /><Field label="Quadril (cm)" id="clinical-hip" type="number" value={form.hipCm} onChange={(value) => update("hipCm", value)} /><Field label="Gordura (%)" id="clinical-body-fat" type="number" value={form.bodyFatPct} onChange={(value) => update("bodyFatPct", value)} /></div><div className="clinical-bmi"><div><span>IMC calculado</span><strong>{bmi === null ? "—" : bmi.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</strong></div><p>{bmiLabel}. O resultado deve ser interpretado junto à idade, composição corporal e quadro clínico.</p></div><div className="clinical-form-grid one"><Field label="Pressão arterial e outros sinais observados" id="clinical-pressure" value={form.bloodPressure} onChange={(value) => update("bloodPressure", value)} placeholder="Ex.: 120/80 mmHg" /></div></section>
      <section className="surface clinical-section"><div className="clinical-section-head"><div><span className="eyebrow">PLANO DE CUIDADO</span><h3>Metas e conduta registrada</h3></div><Check size={21} /></div><div className="clinical-form-grid two"><Field label="Metas acordadas" id="clinical-goals" value={form.goals} onChange={(value) => update("goals", value)} multiline placeholder="Metas mensuráveis para o próximo período" /><Field label="Conduta e orientações" id="clinical-conduct" value={form.conduct} onChange={(value) => update("conduct", value)} multiline placeholder="Orientações, encaminhamentos e plano de acompanhamento" /><Field label="Observações profissionais" id="clinical-notes" value={form.professionalNotes} onChange={(value) => update("professionalNotes", value)} multiline /></div></section>
    </form>
    {typeof document !== "undefined" && createPortal(<ClinicalPrintSheet patient={patient} form={form} bmi={bmi} logoUrl={client.assetUrl("marakesia-logo.png")} />, document.body)}
  </>;
}

function ClinicalPrintSheet({ patient, form, bmi, logoUrl }: { patient: Patient; form: ClinicalForm; bmi: number | null; logoUrl: string }) {
  return <article className="clinical-record-print"><header className="clinical-print-header"><img src={logoUrl} alt="Nutricionista Marakesia Nascimento" /><div><span>FICHA DE ACOMPANHAMENTO NUTRICIONAL</span><h1>Marakesia Nascimento</h1><p>Nutricionista · CRN 11-6356</p></div><time>{displayDate(form.consultationDate)}</time></header><div className="clinical-print-patient"><div><span>Paciente</span><strong>{patient.name}</strong></div><div><span>Telefone</span><strong>{displayValue(patient.phone)}</strong></div><div><span>Nascimento</span><strong>{displayDate(patient.birthDate)}</strong></div><div><span>Retorno</span><strong>{displayDate(form.returnDate)}</strong></div></div><div className="clinical-print-title">Avaliação clínica e nutricional</div><section className="clinical-print-section"><h2>Histórico e contexto</h2><div className="clinical-print-grid two"><PrintBlock label="Queixa principal e objetivo" value={form.mainComplaint} /><PrintBlock label="Histórico clínico atual" value={form.clinicalHistory} /><PrintBlock label="Diagnósticos e condições" value={form.diagnoses} /><PrintBlock label="Medicamentos e suplementos" value={form.medications} /><PrintBlock label="Alergias e intolerâncias" value={form.allergies} /><PrintBlock label="Cirurgias e antecedentes" value={form.surgeries} /><PrintBlock label="Histórico familiar" value={form.familyHistory} /><PrintBlock label="Restrições e preferências" value={form.restrictions} /></div></section><section className="clinical-print-section"><h2>Hábitos e alimentação</h2><div className="clinical-print-grid two"><PrintBlock label="Rotina alimentar" value={form.foodRoutine} /><PrintBlock label="Atividade física" value={form.physicalActivity} /><PrintBlock label="Sono" value={form.sleep} /><PrintBlock label="Hidratação" value={form.waterIntake} /><PrintBlock label="Funcionamento intestinal" value={form.bowelHabits} /></div></section><section className="clinical-print-section"><h2>Antropometria</h2><div className="clinical-print-measures"><div><span>Peso</span><strong>{displayValue(form.weightKg)} kg</strong></div><div><span>Altura</span><strong>{displayValue(form.heightCm)} cm</strong></div><div><span>IMC</span><strong>{bmi === null ? "—" : bmi.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</strong></div><div><span>Cintura</span><strong>{displayValue(form.waistCm)} cm</strong></div><div><span>Quadril</span><strong>{displayValue(form.hipCm)} cm</strong></div><div><span>Gordura</span><strong>{displayValue(form.bodyFatPct)}%</strong></div><div><span>Pressão / sinais</span><strong>{displayValue(form.bloodPressure)}</strong></div></div></section><section className="clinical-print-section"><h2>Metas e conduta</h2><div className="clinical-print-grid two"><PrintBlock label="Metas acordadas" value={form.goals} /><PrintBlock label="Conduta e orientações" value={form.conduct} /><PrintBlock label="Observações profissionais" value={form.professionalNotes} /></div></section><footer className="clinical-print-footer"><span>Documento de acompanhamento profissional · Emitido em {displayDate(currentDate())}</span><div>Assinatura profissional: __________________________________</div></footer></article>;
}
