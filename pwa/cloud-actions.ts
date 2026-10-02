import { patientSchema, appointmentSchema, measurementSchema, clinicalRecordInputSchema, clinicalEntryInputSchema, planSchema, statusSchema, idSchema } from './schemas.ts';
export type CloudRecord = { id: number; kind: string; data: Record<string, unknown>; version: number };
export function mutationFor(body: Record<string, unknown>, records: CloudRecord[]) {
 let kind: string; let data: Record<string, unknown>; let existing: CloudRecord | undefined;
 const stamp = new Date().toISOString();
 switch(body.action) {
 case 'createPatient': kind='patients'; data={...patientSchema.parse(body),createdAt:stamp}; break;
 case 'updatePatient': kind='patients'; existing=records.find(r=>r.kind===kind&&r.id===idSchema.parse(body.id)); if(!existing) throw Error('Paciente não encontrado.'); data={...existing.data,...patientSchema.parse(body)}; break;
 case 'createAppointment': kind='appointments'; data={...appointmentSchema.parse(body),status:'Agendada'}; break;
 case 'setAppointmentStatus': kind='appointments'; existing=records.find(r=>r.kind===kind&&r.id===idSchema.parse(body.id)); if(!existing) throw Error('Consulta não encontrada.'); data={...existing.data,status:statusSchema.parse(body.status)}; break;
 case 'addMeasurement': kind='measurements'; data=measurementSchema.parse(body); if(data.weightKg===null&&data.waistCm===null) throw Error('Informe peso ou cintura.'); break;
 case 'savePlan': { kind='plans'; const {meals,...rest}=planSchema.parse(body); data={...rest,mealsJson:JSON.stringify(meals),updatedAt:stamp}; existing=records.find(r=>r.kind===kind&&r.data.patientId===data.patientId); break; }
 case 'saveClinicalRecord': kind='clinicalRecords'; data={...clinicalRecordInputSchema.parse(body),updatedAt:stamp}; existing=records.find(r=>r.kind===kind&&r.data.patientId===data.patientId); break;
 case 'saveClinicalEntry': {
  kind='clinicalEntries'; const input=clinicalEntryInputSchema.parse(body);
  if(body.id!==undefined){
   existing=records.find(r=>r.kind===kind&&r.id===idSchema.parse(body.id));
   if(!existing)throw Error('Registro não encontrado.');
   if(existing.data.patientId!==input.patientId||existing.data.module!==input.module)throw Error('O vínculo do paciente e do módulo não pode ser alterado.');
  }
  data={...(existing?.data??{createdAt:stamp}),...input,updatedAt:stamp};break;
 }
 default: throw Error('Ação desconhecida.');
 }
 return { kind, data, id:existing?.id??null, version:existing?.version??null };
}
