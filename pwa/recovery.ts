export function recoveryFromHash(hash:string, now=Date.now()/1000){
 const p=new URLSearchParams(hash.replace(/^#/,''));
 const access_token=p.get('access_token');const refresh_token=p.get('refresh_token');const seconds=Number(p.get('expires_in'));
 if(p.get('type')!=='recovery'||!access_token||!refresh_token||!Number.isFinite(seconds)||seconds<=0||seconds>86400)return null;
 return {access_token,refresh_token,expires_at:now+seconds};
}
