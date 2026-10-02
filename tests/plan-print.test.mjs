import test from 'node:test';import assert from 'node:assert/strict';
const api=await import('../pwa/plan-print.ts');
// Guard saved patient text from becoming active content in the print window.
test('impressão escapa nomes, alimentos e orientações preservando o conteúdo',()=>{
 assert.equal(typeof api.printablePlanHTML,'function');
 const html=api.printablePlanHTML({name:'Paciente <script>malicioso</script>',date:'02/10/2026',logoUrl:'https://diw87.github.io/NutriMara/marakesia-logo.png',plan:{title:'Plano <img src=x>',instructions:'Orientação & cuidado',meals:[{time:'07:00',label:'Café',foods:'Banana: 100 g\nAveia: 30 g'}]}});
 assert.doesNotMatch(html,/<script>malicioso|<img src=x>/);assert.match(html,/&lt;script&gt;malicioso/);assert.match(html,/Orientação &amp; cuidado/);assert.match(html,/Banana: 100 g/);assert.match(html,/Aveia: 30 g/);assert.match(html,/02\/10\/2026/);assert.match(html,/CRN 11-6356/);
});
test('impressão rejeita logo com protocolo ativo e plano sem refeições',()=>{
 assert.equal(typeof api.printablePlanHTML,'function');
 const input={name:'Paciente',date:'02/10/2026',logoUrl:'javascript:alert(1)',plan:{title:'Plano',instructions:'',meals:[{time:'07:00',label:'Café',foods:'Banana 100 g'}]}};
 assert.throws(()=>api.printablePlanHTML(input),/Logo/);
 assert.throws(()=>api.printablePlanHTML({...input,logoUrl:'file:///private/logo.png'}),/Logo/);
 assert.throws(()=>api.printablePlanHTML({...input,logoUrl:'https://exemplo.com/logo.png',plan:{...input.plan,meals:[]}}),/refeições/);
});
