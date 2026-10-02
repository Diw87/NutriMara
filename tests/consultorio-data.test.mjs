import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('../pwa/consultorio-data.ts');
// Catch changes to coefficients, units or rounding of the published adult equation.
test('calcula gasto de repouso e multiplicador informado com resultados conhecidos',()=>{
 assert.equal(typeof api.calculateEnergy,'function');
 assert.deepEqual(api.calculateEnergy({weightKg:100,heightCm:178,age:39,sex:'Masculino',multiplier:1.2}),{restingKcal:1922.5,totalKcal:2307});
 assert.deepEqual(api.calculateEnergy({weightKg:60,heightCm:160,age:40,sex:'Feminino',multiplier:1.5,condition:'Normal'}),{restingKcal:1239,totalKcal:1858.5});
});
test('não extrapola a fórmula para idade fora da referência, gestação ou entradas inválidas',()=>{
 assert.equal(typeof api.calculateEnergy,'function');
 const input={weightKg:100,heightCm:178,age:39,sex:'Masculino',multiplier:1.2};
 for(const changed of [{age:18},{age:79},{condition:'Gestante'},{condition:'Lactante'},{weightKg:NaN},{weightKg:0},{heightCm:Infinity},{heightCm:100},{multiplier:0},{multiplier:3},{sex:'Outro'}])assert.throws(()=>api.calculateEnergy({...input,...changed}));
});
// Integer cents prevent accumulated binary-float rounding and ambiguous separators.
test('interpreta valores monetários brasileiros sem truncar casas decimais',()=>{
 assert.equal(typeof api.moneyToCents,'function');
 for(const [value,want] of [['1.234,56',123456],['12.5',1250],['12,05',1205],['R$ 120,50',12050]])assert.equal(api.moneyToCents(value),want);
 for(const value of ['0','-1','12,005','NaN','1.23,45','1e3','100000000.01'])assert.throws(()=>api.moneyToCents(value));
});
test('resumo financeiro usa registros finalizados e distingue pago e pendente',()=>{
 assert.equal(typeof api.financeTotals,'function');
 const item=(id,amount,direction='Receita',paymentStatus='Pago',status='Finalizado',module='finance')=>({id,patientId:1,module,title:'Registro teste',recordedOn:'2026-10-02',status,fields:{amount,direction,paymentStatus},createdAt:'2026-10-02T12:00:00Z',updatedAt:'2026-10-02T12:00:00Z'});
 assert.deepEqual(api.financeTotals([item(1,'120.50'),item(2,'20,49','Despesa'),item(3,'50,00','Receita','Pendente'),item(4,'9000','Receita','Pago','Arquivado'),item(5,'90','Receita','Pago','Rascunho'),item(6,'99','Receita','Pago','Finalizado','notes')]),{incomePaid:12050,expensePaid:2049,pendingIncome:5000,balance:10001});
});
