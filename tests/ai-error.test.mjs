import test from 'node:test';
import assert from 'node:assert/strict';
import {aiError} from '../supabase/functions/_shared/ai-error.ts';
test('separa cota de limite temporário e não devolve detalhes secretos',()=>{
 assert.match(aiError(429,'insufficient_quota'),/sem créditos/);
 assert.match(aiError(429,'rate_limit_exceeded'),/Aguarde/);
 assert.match(aiError(401,'invalid_api_key'),/chave OpenAI foi recusada/);
 assert.match(aiError(404,'model_not_found'),/modelo/);
 assert.equal(aiError(500,'segredo'),aiError(500,null));
});
