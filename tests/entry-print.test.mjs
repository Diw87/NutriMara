import test from 'node:test';
import assert from 'node:assert/strict';

let api = {};
try { api = await import('../pwa/entry-print.ts'); } catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}

const patient = {id:7,name:'Ana Nascimento',phone:'',birthDate:'1990-05-12'};
const saved = {
  id:22,patientId:7,module:'documents',title:'Relatório nutricional',recordedOn:'2026-10-02',
  status:'Finalizado',fields:{documentType:'Relatório',body:'Primeira linha\nSegunda linha',purpose:'Acompanhamento'},
  createdAt:'2026-10-02T12:00:00Z',updatedAt:'2026-10-02T12:00:00Z',
};
const logoUrl = 'https://diw87.github.io/NutriMara/marakesia-logo.png';

// Omitting escaping here would let saved patient or clinical text execute in a print window.
test('imprime documento salvo com identidade, campos específicos e texto escapado',()=>{
  assert.equal(typeof api.printableEntryHTML,'function');
  const html=api.printableEntryHTML({patient:{...patient,name:'Ana <script>alert(1)</script>'},entry:{...saved,title:'Relatório <img src=x onerror=alert(1)>',fields:{...saved.fields,body:'Linha <svg onload=alert(1)>\nA & B "teste"',purpose:"Uso 'profissional'"}},logoUrl});
  assert.match(html,/Ana &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html,/Relatório &lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html,/Linha &lt;svg onload=alert\(1\)&gt;\nA &amp; B &quot;teste&quot;/);
  assert.match(html,/Uso &#39;profissional&#39;/);
  assert.doesNotMatch(html,/<script>alert\(1\)|<svg onload|<img src=x/);
  assert.match(html,/Conteúdo do documento/);
  assert.match(html,/Finalidade/);
  assert.match(html,/02\/10\/2026/);
  assert.match(html,/Finalizado/);
  assert.match(html,/CRN 11-6356/);
  assert.match(html,/size:A4/);
  assert.match(html,/white-space:pre-wrap/);
  assert.match(html,/Imprimir \/ Salvar como PDF/);
});

// A wrong patient binding would emit another person's clinical document.
test('recusa impressão de rascunho não salvo e de registro de outro paciente',()=>{
  assert.equal(typeof api.printableEntryHTML,'function');
  assert.throws(()=>api.printableEntryHTML({patient,entry:{...saved,id:0},logoUrl}),/salvo/);
  assert.throws(()=>api.printableEntryHTML({patient,entry:{...saved,patientId:9},logoUrl}),/paciente/);
});

// Active or malformed image URLs must not become print-window markup or executable content.
test('recusa protocolos ativos, credenciais e URL de logo ausente',()=>{
  assert.equal(typeof api.printableEntryHTML,'function');
  for(const unsafe of ['javascript:alert(1)','data:image/svg+xml,<svg onload=alert(1)>','file:///private/logo.png','https://user:pass@example.com/logo.png',null,'']) {
    assert.throws(()=>api.printableEntryHTML({patient,entry:saved,logoUrl:unsafe}),/Logo/);
  }
});

// Historical optional values must not crash printing or turn into misleading literal text.
test('tolera valores opcionais ausentes sem inventar conteúdo clínico',()=>{
  assert.equal(typeof api.printableEntryHTML,'function');
  const html=api.printableEntryHTML({patient:{...patient,phone:null,birthDate:null},entry:{...saved,fields:{documentType:'Relatório',body:'Conteúdo registrado',purpose:null,legacy:undefined}},logoUrl});
  assert.match(html,/Conteúdo registrado/);
  assert.doesNotMatch(html,/null|undefined|Finalidade/);
});

// Attachment printing must describe a private file without embedding an arbitrary active asset.
test('imprime metadados de anexo sem incorporar URL nem conteúdo do arquivo',()=>{
  assert.equal(typeof api.printableEntryHTML,'function');
  const html=api.printableEntryHTML({patient,entry:{...saved,module:'attachments',title:'Exame anexado',fields:{description:'Resultado enviado pela paciente'},attachment:{name:'exame <script>.pdf',contentType:'application/pdf',size:2048}},logoUrl});
  assert.match(html,/Resultado enviado pela paciente/);
  assert.match(html,/exame &lt;script&gt;\.pdf/);
  assert.match(html,/application\/pdf/);
  assert.doesNotMatch(html,/<iframe|<object|<embed|src="exame/);
});

// Each record must use its own module fields instead of a generic document-only print path.
test('imprime os campos de exame e financeiro com rótulos próprios',()=>{
  assert.equal(typeof api.printableEntryHTML,'function');
  const lab=api.printableEntryHTML({patient,entry:{...saved,module:'labs',fields:{examName:'Glicemia',result:'95',unit:'mg/dL',reference:'70–99',professionalInterpretation:'Avaliação registrada pela profissional'}},logoUrl});
  assert.match(lab,/Nome do exame/);assert.match(lab,/Glicemia/);assert.match(lab,/Unidade/);assert.match(lab,/mg\/dL/);assert.match(lab,/Interpretação profissional/);
  const finance=api.printableEntryHTML({patient,entry:{...saved,module:'finance',fields:{amount:'150,00',direction:'Receita',paymentStatus:'Pago',paymentMethod:'Pix',description:'Consulta nutricional'}},logoUrl});
  assert.match(finance,/Valor \(R\$\)/);assert.match(finance,/150,00/);assert.match(finance,/Forma de pagamento/);assert.match(finance,/Pix/);
});
