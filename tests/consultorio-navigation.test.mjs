import test from 'node:test';
import assert from 'node:assert/strict';

const api = await import('../pwa/consultorio-navigation.ts').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const patients = [
  {id:1,name:'Álvaro Oliveira',nickname:'Vavá',phone:'(11) 99999-8888',cpf:'529.982.247-25',tags:'Esporte, Retorno',goal:'Ganho de massa',createdAt:'2026-01-01T10:00:00Z'},
  {id:2,name:'Cláudia Sousa',phone:'',birthDate:'',goal:'Saúde intestinal',biologicalCondition:'Gestante',tags:'Gestação; Retorno',createdAt:'2026-09-20T09:00:00Z'},
  {id:3,name:'Bruna Lima',phone:'',goal:'Rotina alimentar',createdAt:'2026-05-10T14:00:00Z'},
];

test('busca combina termos sem acentos em nome, apelido, tags e objetivo', () => {
  assert.equal(typeof api.listPatients,'function');
  assert.deepEqual(api.listPatients(patients,{query:'  vava esporte massa  ',sort:'name'}).map(p=>p.id),[1]);
  assert.deepEqual(api.listPatients(patients,{query:'claudia saude',sort:'name'}).map(p=>p.id),[2]);
  assert.deepEqual(api.listPatients(patients,{query:'retorno inexistente',sort:'name'}),[]);
});

test('busca encontra telefone e CPF digitados sem pontuação', () => {
  assert.equal(typeof api.listPatients,'function');
  assert.deepEqual(api.listPatients(patients,{query:'11999998888',sort:'name'}).map(p=>p.id),[1]);
  assert.deepEqual(api.listPatients(patients,{query:'52998224725',sort:'name'}).map(p=>p.id),[1]);
  assert.deepEqual(api.listPatients(patients,{query:'529.982.247-25',sort:'name'}).map(p=>p.id),[1]);
});

test('filtros usam vínculos reais e tags inteiras mantendo cadastros antigos', () => {
  assert.equal(typeof api.listPatients,'function');
  assert.deepEqual(api.listPatients(patients,{sort:'name',filter:'withoutPlan',plannedPatientIds:[1],tag:'RETORNO'}).map(p=>p.id),[2]);
  assert.deepEqual(api.listPatients(patients,{sort:'name',filter:'upcoming',upcomingPatientIds:[3]}).map(p=>p.id),[3]);
  assert.deepEqual(api.listPatients(patients,{sort:'name',filter:'gestante'}).map(p=>p.id),[2]);
  assert.deepEqual(api.listPatients(patients,{sort:'name',tag:'Ret'}),[]);
  assert.deepEqual(api.listPatients(patients,{sort:'name',filter:'withoutRecord',recordPatientIds:[1,2]}).map(p=>p.id),[3]);
});

test('ordenação por cadastro e atividade não altera os dados originais', () => {
  assert.equal(typeof api.listPatients,'function');
  assert.equal(typeof api.patientLastActivity,'function');
  const activity=[{patientId:1,date:'2026-10-02T10:00:00Z'},{patientId:3,date:'2026-10-01'},{patientId:2,date:'2026-01-01'}];
  assert.deepEqual(api.listPatients(patients,{sort:'created'}).map(p=>p.id),[2,3,1]);
  assert.deepEqual(api.listPatients(patients,{sort:'activity',activity}).map(p=>p.id),[1,3,2]);
  assert.equal(api.patientLastActivity(patients[1],activity),'2026-09-20T09:00:00Z');
  assert.deepEqual(patients.map(p=>p.id),[1,2,3]);
});

test('semana começa na segunda e atravessa mês e ano sem alterar o dia local', () => {
  assert.equal(typeof api.calendarDays,'function');
  assert.deepEqual(api.calendarDays('2026-01-01','week'),['2025-12-29','2025-12-30','2025-12-31','2026-01-01','2026-01-02','2026-01-03','2026-01-04']);
});

test('mês cobre seis semanas incluindo os dias adjacentes', () => {
  assert.equal(typeof api.calendarDays,'function');
  const days=api.calendarDays('2026-02-12','month');
  assert.equal(days.length,42);
  assert.equal(days[0],'2026-01-26');
  assert.equal(days.at(-1),'2026-03-08');
  assert.equal(days.filter(day=>day.startsWith('2026-02')).length,28);
});

test('navegação mensal limita o dia ao último do mês de destino', () => {
  assert.equal(typeof api.shiftCalendarPeriod,'function');
  assert.equal(api.shiftCalendarPeriod('2026-01-31','month',1),'2026-02-28');
  assert.equal(api.shiftCalendarPeriod('2024-01-31','list',1),'2024-02-29');
  assert.equal(api.shiftCalendarPeriod('2026-12-31','week',1),'2027-01-07');
  assert.equal(api.shiftCalendarPeriod('2026-01-01','month',-1),'2025-12-01');
});

test('consultas mantêm a data e o horário registrados inclusive meia-noite', () => {
  assert.equal(typeof api.appointmentsOnDay,'function');
  assert.equal(typeof api.calendarRange,'function');
  const appointments=[{id:1,startsAt:'2026-10-02T23:30:00'},{id:2,startsAt:'2026-10-03T00:00:00'},{id:3,startsAt:'2026-10-02T08:15:00'},{id:4,startsAt:'2026-10-02T08:15:00'}];
  assert.deepEqual(api.appointmentsOnDay(appointments,'2026-10-02').map(a=>a.id),[3,4,1]);
  assert.deepEqual(api.calendarRange('2026-10-02','list'),{start:'2026-10-01',end:'2026-10-31'});
  assert.deepEqual(appointments.map(a=>a.id),[1,2,3,4]);
});

test('atualização remota preserva o rascunho e a versão capturada do mesmo paciente', () => {
  assert.equal(typeof api.keepPatientDraft,'function');
  const draft={patientId:1,title:'Edição ainda não salva',version:3,meals:[{foods:'Arroz 100 g'}]};
  const refreshed={patientId:1,title:'Plano atualizado em outra máquina',version:4,meals:[{foods:'Batata 80 g'}]};
  assert.equal(api.keepPatientDraft(draft,refreshed),draft);
  assert.equal(api.keepPatientDraft({...draft,version:null},refreshed).version,null);
});

test('trocar paciente substitui o rascunho sem levar texto ou versão do anterior', () => {
  assert.equal(typeof api.keepPatientDraft,'function');
  const previous={patientId:1,title:'Texto do paciente 1',version:9};
  const selected={patientId:2,title:'Texto do paciente 2',version:null};
  assert.equal(api.keepPatientDraft(previous,selected),selected);
  assert.equal(api.keepPatientDraft(previous,{patientId:null,title:'',version:null}).patientId,null);
});
