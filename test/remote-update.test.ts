import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { config } from '../src/config/destny-store.config.js';
import { activeConfig, withConfiguration } from '../src/config/runtime-config.js';
import { loadManifest, validateManifest, RemoteUpdateService } from '../src/modules/discord-update/remote.js';
const guild='1566968913449848984';
const manifest=JSON.parse(await readFile('server-update.json','utf8'));
test('manifesto atual é válido e não substitui cargos ou configurações globais',()=>{
 const result=validateManifest(manifest,guild);
 assert.deepEqual(result.roles,config.roles);
 assert.deepEqual(result.guild,config.guild);
 assert.deepEqual(result.categoryBatch,['category-combos']);
 for(const changed of [{...manifest,guildId:'wrong'},{...manifest,roles:[]},{...manifest,categoryBatch:['unknown']},{...manifest,categories:[manifest.categories[0],manifest.categories[0]]}])
  assert.throws(()=>validateManifest(changed,guild));
 const invalid=structuredClone(manifest);invalid.categories[0].channels[0].type=99;
 assert.throws(()=>validateManifest(invalid,guild));
});
test('configurações concorrentes permanecem isoladas durante operações assíncronas',async()=>{
 const a=validateManifest(manifest,guild), b=validateManifest(manifest,guild);
 a.categories[0].name='Primeira'; b.categories[0].name='Segunda';
 const results=await Promise.all([a,b].map(value=>withConfiguration(value,async()=>{
  await new Promise(resolve=>setTimeout(resolve,5));return activeConfig.categories[0].name;
 })));
 assert.deepEqual(results,['Primeira','Segunda']);
 assert.equal(activeConfig.categories[0].name,config.categories[0].name);
});
test('busca novamente a configuração e detecta revisão nova sem reiniciar',async()=>{
 let calls=0;
 const request:typeof fetch=async(input,init)=>{
  assert.match(String(input),/^https:\/\/raw.githubusercontent.com\/slyynreverb-code\/Bot-de-vendas\/destny\/estrutura-v16\/server-update.json\?fresh=/);
  assert.equal(init?.redirect,'error');
  const next=structuredClone(manifest); if(calls++)next.categories[0].name='Nova entrada';
  return new Response(JSON.stringify(next));
 };
 const first=await loadManifest(guild,request),second=await loadManifest(guild,request);
 assert.notEqual(first.revision,second.revision);
 assert.equal(second.configuration.categories[0].name,'Nova entrada');
 assert.equal(calls,2);
});
test('falhas HTTP, rede, manifesto inválido e tamanho excessivo bloqueiam antes de escrever',async()=>{
 const cases:Array<typeof fetch>=[async()=>new Response('',{status:404}),async()=>{throw Error('private token');},async()=>new Response('{}'),async()=>new Response('x'.repeat(1024*1024+1))];
 for(const request of cases){
  let touched=false;
  const api={get:async()=>{touched=true;return{};},post:async()=>{touched=true;return{};},patch:async()=>{touched=true;return{};}};
  const service=new RemoteUpdateService(api,guild,{},request);
  await assert.rejects(service.preview());
  await assert.rejects(service.apply('old','1567254332238340297'));
  assert.equal(touched,false);
 }
});
