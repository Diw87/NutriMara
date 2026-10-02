export const ENTRY_MODULES = ['pharma','assessment','consultations','questionnaires','labs','gestation','energy','supplements','goals','compounds','guidance','attachments','notes','documents','finance'] as const;
export type EntryModule = typeof ENTRY_MODULES[number];
export type EntryStatus = 'Rascunho' | 'Finalizado' | 'Arquivado';
export type EntryInput = {patientId:number;module:EntryModule;title:string;recordedOn:string;status:EntryStatus;fields:Record<string,string>};
export type ClinicalEntry = EntryInput & {id:number;createdAt:string;updatedAt:string;_version?:number;attachment?:{name:string;contentType:string;size:number}};
export type EntryPatient = {id:number;name:string;phone:string;birthDate:string;goal?:string;biologicalCondition?:string};
