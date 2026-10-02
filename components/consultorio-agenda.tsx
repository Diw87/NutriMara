"use client";

import {useMemo, useState} from "react";
import {CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Plus, X} from "lucide-react";
import {appointmentsOnDay, calendarDays, calendarRange, shiftCalendarPeriod, type CalendarView} from "../pwa/consultorio-navigation";

export type Appointment = {
  id: number; patientId: number; startsAt: string; kind: string;
  status: "Agendada" | "Concluída" | "Cancelada"; notes: string;
};
type AgendaPatient = {id: number; name: string};
const views: {value: CalendarView; label: string}[] = [{value: "month", label: "Mês"}, {value: "week", label: "Semana"}, {value: "list", label: "Lista"}];
const weekdays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function formatDate(day: string, long = false) {
  return new Date(`${day.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", long
    ? {weekday: "long", day: "numeric", month: "long"}
    : {day: "2-digit", month: "short"});
}
function statusClass(status: string) { return status.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }

export default function ConsultorioAgenda({appointments, patients, today, busy, onCreate, onOpenPatient, onStatus}: {
  appointments: Appointment[]; patients: AgendaPatient[]; today: string; busy: boolean;
  onCreate: (day?: string) => void; onOpenPatient: (id: number) => void;
  onStatus: (id: number, status: "Concluída" | "Cancelada") => void | Promise<void>;
}) {
  const [view, setView] = useState<CalendarView>("month");
  const [anchor, setAnchor] = useState(today);
  const [selectedDay, setSelectedDay] = useState(today);
  const [status, setStatus] = useState("all");
  const names = useMemo(() => new Map(patients.map(patient => [patient.id, patient.name])), [patients]);
  const visible = useMemo(() => appointments.filter(appointment => status === "all" || appointment.status === status), [appointments, status]);
  const range = calendarRange(anchor, view);
  const period = visible.filter(appointment => appointment.startsAt.slice(0, 10) >= range.start && appointment.startsAt.slice(0, 10) <= range.end)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id - b.id);
  const dayAppointments = appointmentsOnDay(visible, selectedDay);
  const periodLabel = view === "week" ? `${formatDate(range.start)} – ${formatDate(range.end)}`
    : new Date(`${anchor}T12:00:00`).toLocaleDateString("pt-BR", {month: "long", year: "numeric"});

  function move(direction: number) {
    const next = shiftCalendarPeriod(anchor, view, direction);
    setAnchor(next); setSelectedDay(next);
  }
  function jump(day: string) { if (day) { setAnchor(day); setSelectedDay(day); } }

  function appointmentRows(items: Appointment[], showDate: boolean) {
    return items.length ? <div className="consultorio-appointment-list">{items.map(appointment => <article className="consultorio-appointment" key={appointment.id}>
      <div className="consultorio-appointment-time"><Clock3 size={17}/><div><strong>{appointment.startsAt.slice(11, 16)}</strong>{showDate && <small>{formatDate(appointment.startsAt)}</small>}</div></div>
      <div className="consultorio-appointment-person"><button className="patient-name-link" disabled={!names.has(appointment.patientId)} onClick={() => onOpenPatient(appointment.patientId)}>{names.get(appointment.patientId) ?? "Cadastro indisponível"}</button><small>{appointment.kind}{appointment.notes ? ` · ${appointment.notes}` : ""}</small></div>
      <span className={`status status-${statusClass(appointment.status)}`}>{appointment.status}</span>
      {appointment.status === "Agendada" && <div className="consultorio-appointment-actions"><button className="icon-button" disabled={busy} onClick={() => void onStatus(appointment.id, "Concluída")} title="Concluir consulta" aria-label={`Concluir consulta de ${names.get(appointment.patientId) ?? "paciente"} às ${appointment.startsAt.slice(11, 16)}`}><Check size={17}/></button><button className="icon-button" disabled={busy} onClick={() => void onStatus(appointment.id, "Cancelada")} title="Cancelar consulta" aria-label={`Cancelar consulta de ${names.get(appointment.patientId) ?? "paciente"} às ${appointment.startsAt.slice(11, 16)}`}><X size={17}/></button></div>}
    </article>)}</div> : <div className="consultorio-agenda-empty"><CalendarDays size={24}/><strong>{status === "all" ? "Nenhuma consulta neste período" : "Nenhuma consulta com este status"}</strong><p>{status === "all" ? "Selecione outra data ou agende um atendimento." : "Altere o filtro para ver os demais atendimentos."}</p></div>;
  }

  return <div className="consultorio-agenda">
    <section className="surface consultorio-calendar">
      <div className="consultorio-calendar-toolbar">
        <div className="consultorio-calendar-period"><button className="icon-button" onClick={() => move(-1)} aria-label={view === "week" ? "Semana anterior" : "Mês anterior"}><ChevronLeft size={18}/></button><h2 aria-live="polite">{periodLabel}</h2><button className="icon-button" onClick={() => move(1)} aria-label={view === "week" ? "Próxima semana" : "Próximo mês"}><ChevronRight size={18}/></button><button className="button button-secondary calendar-today" onClick={() => jump(today)}>Hoje</button></div>
        <div className="consultorio-calendar-controls"><label className="calendar-jump">Ir para data<input type="date" value={anchor} onChange={event => jump(event.target.value)}/></label><div className="consultorio-segmented" role="group" aria-label="Visualização da agenda">{views.map(item => <button key={item.value} className={view === item.value ? "active" : ""} aria-pressed={view === item.value} onClick={() => setView(item.value)}>{item.label}</button>)}</div></div>
      </div>
      <div className="consultorio-calendar-summary"><span>{period.length} {period.length === 1 ? "atendimento no período" : "atendimentos no período"}</span><label>Status<select value={status} onChange={event => setStatus(event.target.value)}><option value="all">Todos</option><option value="Agendada">Agendadas</option><option value="Concluída">Concluídas</option><option value="Cancelada">Canceladas</option></select></label></div>

      {view === "month" && <div className="consultorio-month"><div className="consultorio-weekdays" aria-hidden="true">{weekdays.map(day => <span key={day}>{day}</span>)}</div><div className="consultorio-month-grid">{calendarDays(anchor, "month").map(day => {
        const items = appointmentsOnDay(visible, day);
        return <div key={day} className={`consultorio-calendar-day ${day.slice(0, 7) !== anchor.slice(0, 7) ? "is-outside" : ""} ${day === today ? "is-today" : ""} ${day === selectedDay ? "is-selected" : ""}`}>
          <button className="consultorio-day-number" onClick={() => setSelectedDay(day)} aria-pressed={day === selectedDay} aria-label={`${formatDate(day, true)}: ${items.length} ${items.length === 1 ? "consulta" : "consultas"}`}>{Number(day.slice(8, 10))}<span className="consultorio-day-count">{items.length || ""}</span></button>
          <div className="consultorio-day-events">{items.slice(0, 2).map(appointment => <button key={appointment.id} className={`consultorio-calendar-event event-${statusClass(appointment.status)}`} onClick={() => {setSelectedDay(day);}} title={`${appointment.startsAt.slice(11, 16)} · ${names.get(appointment.patientId) ?? "Paciente"} · ${appointment.status}`}><time>{appointment.startsAt.slice(11, 16)}</time><span>{names.get(appointment.patientId) ?? "Paciente"}</span></button>)}{items.length > 2 && <button className="consultorio-more-events" onClick={() => setSelectedDay(day)}>+{items.length - 2} {items.length === 3 ? "consulta" : "consultas"}</button>}</div>
        </div>;
      })}</div></div>}

      {view === "week" && <div className="consultorio-week-grid">{calendarDays(anchor, "week").map((day, index) => {
        const items = appointmentsOnDay(visible, day);
        return <section key={day} className={`consultorio-week-day ${day === today ? "is-today" : ""} ${day === selectedDay ? "is-selected" : ""}`}><button className="consultorio-week-day-heading" aria-pressed={day === selectedDay} onClick={() => setSelectedDay(day)}><small>{weekdays[index]}</small><strong>{Number(day.slice(8, 10))}</strong><span>{items.length} {items.length === 1 ? "consulta" : "consultas"}</span></button><div className="consultorio-week-events">{items.length ? items.map(appointment => <button key={appointment.id} className={`consultorio-calendar-event event-${statusClass(appointment.status)}`} onClick={() => setSelectedDay(day)}><time>{appointment.startsAt.slice(11, 16)}</time><span>{names.get(appointment.patientId) ?? "Paciente"}</span><small>{appointment.status}</small></button>) : <span className="consultorio-free-day">Livre</span>}</div><button className="consultorio-week-add" disabled={!patients.length} onClick={() => onCreate(day)} aria-label={`Agendar consulta em ${formatDate(day, true)}`}><Plus size={15}/><span>Agendar</span></button></section>;
      })}</div>}

      {view === "list" && appointmentRows(period, true)}
    </section>
    {view !== "list" && <section className="surface consultorio-day-detail"><div className="section-heading"><div><span className="eyebrow">ATENDIMENTOS DO DIA</span><h2>{formatDate(selectedDay, true)}</h2></div><button className="button button-secondary" disabled={!patients.length} onClick={() => onCreate(selectedDay)}><Plus size={17}/>Agendar neste dia</button></div>{appointmentRows(dayAppointments, false)}</section>}
  </div>;
}
