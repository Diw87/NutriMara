import test from 'node:test';
import assert from 'node:assert/strict';

let api={};
try { api=await import('../pwa/consultorio-modules.ts'); } catch(error) {
  if(error.code!=='ERR_MODULE_NOT_FOUND') throw error;
}

// A missing patient/module filter would show another clinical record during editing.
test('histórico contém somente paciente e módulo atuais, sem alterar a lista original',()=>{
  assert.equal(typeof api.patientModuleEntries,'function');
  const entries=[
    {id:1,patientId:7,module:'notes',recordedOn:'2026-09-01',updatedAt:'2026-09-01',status:'Finalizado'},
    {id:2,patientId:8,module:'notes',recordedOn:'2026-10-02',updatedAt:'2026-10-02',status:'Finalizado'},
    {id:3,patientId:7,module:'labs',recordedOn:'2026-10-02',updatedAt:'2026-10-02',status:'Finalizado'},
    {id:4,patientId:7,module:'notes',recordedOn:'2026-10-02',updatedAt:'2026-10-02',status:'Arquivado'},
  ];
  assert.deepEqual(api.patientModuleEntries(entries,7,'notes').map(entry=>entry.id),[4,1]);
  assert.deepEqual(entries.map(entry=>entry.id),[1,2,3,4]);
});

// Drafts may be partial; finalized documents must contain the professional's actual text.
test('permite rascunho parcial e exige conteúdo antes de finalizar documento',()=>{
  assert.equal(typeof api.validateEntryFields,'function');
  assert.deepEqual(api.validateEntryFields('documents',{},'Rascunho'),[]);
  assert.match(api.validateEntryFields('documents',{},'Finalizado').join(' '),/Conteúdo do documento/);
  assert.deepEqual(api.validateEntryFields('documents',{documentType:'Relatório',body:'Avaliação registrada'},'Finalizado'),[]);
});

// A missing finite-number guard would allow NaN or negative clinical measures to be saved.
test('valida medidas informadas sem impedir registro energético manual por idade',()=>{
  assert.equal(typeof api.validateEntryFields,'function');
  assert.match(api.validateEntryFields('energy',{weightKg:'-2'},'Rascunho').join(' '),/Peso/);
  assert.match(api.validateEntryFields('energy',{heightCm:'NaN'},'Rascunho').join(' '),/Altura/);
  assert.deepEqual(api.validateEntryFields('energy',{weightKg:'50',heightCm:'160',age:'15',sex:'Feminino',multiplier:'1.2',targetKcal:'1800',notes:'Registro manual'},'Finalizado'),[]);
});

// Dropping the profile's Other condition would mislabel a manual energy evaluation as Normal.
test('permite registrar outra condição biológica com avaliação energética manual',()=>{
  assert.equal(typeof api.validateEntryFields,'function');
  assert.deepEqual(api.validateEntryFields('energy',{condition:'Outro',targetKcal:'1800',notes:'Avaliação individual manual'},'Finalizado'),[]);
});

// A permissive client picker could send active files or a file beyond the upload contract.
test('aceita apenas PDF PNG JPEG de até 10 MiB no seletor de anexos',()=>{
  assert.equal(typeof api.attachmentSelectionError,'function');
  for(const type of ['application/pdf','image/png','image/jpeg']) {
    assert.equal(api.attachmentSelectionError({type,size:10*1024*1024,name:'arquivo'}),'');
  }
  assert.match(api.attachmentSelectionError({type:'text/html',size:10,name:'ativo.html'}),/PDF, PNG ou JPEG/);
  assert.match(api.attachmentSelectionError({type:'image/svg+xml',size:10,name:'ativo.svg'}),/PDF, PNG ou JPEG/);
  assert.match(api.attachmentSelectionError({type:'application/pdf',size:10*1024*1024+1,name:'grande.pdf'}),/10 MiB/);
  assert.match(api.attachmentSelectionError({type:'application/pdf',size:0,name:'vazio.pdf'}),/vazio/);
});
