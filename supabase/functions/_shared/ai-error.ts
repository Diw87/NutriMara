export function aiError(status:number, code:unknown):string {
 if(code==='insufficient_quota')return 'A API OpenAI está sem créditos ou atingiu a cota de faturamento. Confira o saldo na plataforma OpenAI; a assinatura ChatGPT não inclui créditos da API.';
 if(status===401)return 'A chave OpenAI foi recusada. Confira o valor de OPENAI_API_KEY nos Secrets do NutriMara; use uma chave da OpenAI, não do Supabase.';
 if(status===429)return 'A OpenAI limitou as solicitações neste momento. Aguarde um minuto e tente novamente.';
 if(status===403||code==='model_not_found')return 'A conta OpenAI não tem acesso ao modelo configurado. Confira OPENAI_MODEL e as permissões da chave.';
 if(status===400)return 'A OpenAI recusou a configuração da solicitação. Informe este erro para revisarmos o modelo e o formato de resposta.';
 return 'A OpenAI está indisponível neste momento. Tente novamente mais tarde.';
}
