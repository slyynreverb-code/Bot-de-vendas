# Atualização do servidor pelo Discord

O comando `/servidor atualizar` reaproveita o configurador de categorias do projeto. Ele consulta a estrutura, apresenta uma prévia privada e aguarda a confirmação de quem abriu essa prévia. Só então aplica o lote aprovado em `server-update.json`, consultado no GitHub a cada prévia e confirmação.

O lote atual contém somente **Combos** (`config.categoryBatch = ['category-combos']`) e prepara estes três canais de texto:

- `「📈」ᴇᴠᴏʟᴜᴄᴀᴏ`: combos de level e maestria.
- `「⚔️」ᴇqᴜɪᴘᴀᴍᴇɴᴛᴏꜱ`: combos de armas e acessórios.
- `「👹」ꜰᴀʀᴍ`: pacotes de farm de chefes, Yetis e materiais.

A sequência da área de produtos será **Robux → Combos → Contas**, imediatamente após Avaliações. Robux e Contas mantêm suas identidades e recebem apenas o ajuste de posição. A ordenação das categorias planejadas presentes aparece na prévia.

O comando não executa a aplicação completa do V16: preserva o nome KAMUI, cargos, AutoMod, Gamepass, tickets e as configurações de categorias/canais fora de Combos. Não exclui canais nem conteúdos, não transfere tickets e não configura o Ticket King. Os novos canais são criados vazios, sem painéis ou mensagens de venda.

O planejamento passa a **22 categorias, 53 canais permanentes e 26 cargos**, incluindo o canal avulso de status e excluindo tickets dinâmicos. Essa é a configuração preparada no projeto; a criação no Discord acontece somente depois de confirmar a prévia.

## Variáveis de ambiente

Configure os valores como secrets do Codespaces ou da hospedagem, com acesso ao repositório:

| Variável | Uso |
| --- | --- |
| `DISCORD_TOKEN` | Token do mesmo bot, obrigatório. |
| `DISCORD_GUILD_ID` | ID do servidor autorizado. `GUILD_ID` também é aceito. |
| `DISCORD_OWNER_ROLE_ID` | Opcional: ID do cargo Owner autorizado, especialmente se ele não tiver Administrator. |

Não é necessário um Client ID adicional: o registro identifica o aplicativo pelo token do bot. Se `GUILD_ID` e `DISCORD_GUILD_ID` estiverem definidos, precisam conter o mesmo ID. O projeto não carrega `.env` automaticamente; disponibilize as variáveis ao processo. Não publique o token no repositório ou em mensagens.

Quando `DISCORD_OWNER_ROLE_ID` estiver ausente, o bot pode usar o ID já persistido em `role-1` no arquivo `.state/ID_DO_SERVIDOR.json`. Se nenhum ID aprovado estiver disponível, essa alternativa de acesso por cargo não é concedida; o dono real e membros com Administrator continuam elegíveis.

## Quem pode executar

O bot aceita uma destas condições:

- Ser o dono real do servidor.
- Possuir o cargo Owner identificado pelo ID aprovado.
- Possuir a permissão nativa Administrator.

Um cargo chamado Owner ou Administrador não é suficiente por si só. No planejamento V16, o cargo `🩸 Administrador` possui permissões de moderação, mas não recebe Administrator global automaticamente.

A verificação ocorre ao solicitar a prévia e novamente ao confirmar. O botão pertence ao solicitante e só vale no servidor autorizado. Mensagens diretas, outros servidores, confirmações expiradas e cliques de outros membros não autorizam a aplicação.

O comando usa Administrator como permissão padrão na interface do Discord. Para um Owner sem essa permissão, autorize também o cargo em **Configurações do servidor → Integrações → aplicativo do bot → comando servidor**. Isso permite que o Discord mostre o comando; o código ainda exige o ID aprovado do cargo.

## Primeiro teste no Codespaces

Abra o repositório no Codespaces pelo navegador, inclusive no Android/DeX. Confirme que os secrets estão disponíveis e, se acabou de alterá-los, pare e reabra o Codespace. No terminal do projeto:

~~~bash
nvm install 24
nvm use 24
npm install
npm run check
npm test
npm run commands:register
npm start
~~~

O projeto exige Node.js 24.17.0 ou superior. O registro publica o comando somente no servidor configurado e preserva comandos de outros nomes. Registrar não cria categorias ou canais.

## Atualizar o bot já instalado no Codespace

Se `/servidor atualizar` já está registrado, o lote de Combos não exige novo registro nem novas dependências. No terminal do bot, pressione **Ctrl+C** e execute, na branch `destny/estrutura-v16`:

~~~bash
git pull --ff-only
npm start
~~~

Quando o bot estiver online, execute `/servidor atualizar` no Discord e confira uma nova prévia. Uma prévia aberta antes do reinício não pode ser reutilizada. A atualização do código e a aplicação das alterações no servidor são etapas separadas.

Se o comando não aparecer, confira o ID do servidor, o resultado do registro e o acesso do usuário nas Integrações. A aplicação precisa estar instalada com os escopos `bot` e `applications.commands`. No Developer Portal, o gerador de convites fica em **OAuth2 → URL Generator**. Não habilite intents privilegiados para esta funcionalidade: apenas Guilds é usado.

O bot mantém as exigências do configurador existente: o cargo técnico precisa ter Administrator e ficar acima dos cargos administrados. Isso não concede automaticamente acesso a quem apenas possui um cargo com nome semelhante.

## Uso e confirmação

1. Execute `/servidor atualizar` no servidor autorizado.
2. Confira as categorias, canais e alterações de ordem apresentados na prévia privada.
3. Clique em **Aplicar** para executar ou em **Cancelar** para encerrar.
4. Aguarde o resultado antes de iniciar outra atualização.

A prévia expira após cinco minutos. Só o solicitante pode confirmá-la. Reiniciar o bot encerra as prévias pendentes; execute o comando novamente. Se o plano ou a estrutura relevante mudar entre a prévia e a confirmação, o bot exige outra prévia antes de alterar a estrutura.

A aplicação mantém o estado dos IDs a cada criação, permitindo continuar depois de uma falha sem duplicar os elementos já persistidos. As respostas administrativas são privadas. Os relatórios locais ficam em `reports/`.

## Execução em produção

O bot precisa de um processo contínuo. Codespaces pode pausar; GitHub Actions não é uma hospedagem permanente para um bot conectado. A escolha da plataforma e o deploy real continuam a cargo do operador.

Para executar o código compilado em uma máquina com Node.js 24:

~~~bash
npm ci
npm run check
npm test
npm run build
npm run commands:register
npm run start:prod
~~~

O build gera `dist/bot.js` e `dist/register-commands.js`. Em um ambiente com apenas dependências de produção, o registro pode ser executado diretamente:

~~~bash
node dist/register-commands.js
~~~

Use o gerenciador de processos da hospedagem para reiniciar o bot após falhas e para encerrar o processo anterior antes de iniciar uma nova versão. Preserve o diretório de trabalho, `.state/` e os relatórios. Configure apenas **uma réplica**.

### Docker opcional

O Dockerfile incluído compila o TypeScript em uma etapa separada e executa o bot como usuário sem privilégios. Ele não contém o token. Para construir a imagem, em uma máquina com Docker:

~~~bash
docker build -t kamui-bot .
~~~

Injete as variáveis no processo do operador ou pela configuração de secrets da plataforma. O exemplo abaixo repassa as variáveis já presentes sem colocar seus valores no histórico dos comandos:

~~~bash
docker run --rm \
  -e DISCORD_TOKEN \
  -e DISCORD_GUILD_ID \
  -e GUILD_ID \
  -e DISCORD_OWNER_ROLE_ID \
  kamui-bot node dist/register-commands.js
~~~

Para a execução contínua com volumes persistentes:

~~~bash
docker volume create kamui-state
docker volume create kamui-reports
docker run -d --name kamui-bot --restart unless-stopped --init \
  -e DISCORD_TOKEN \
  -e DISCORD_GUILD_ID \
  -e GUILD_ID \
  -e DISCORD_OWNER_ROLE_ID \
  --mount source=kamui-state,target=/app/.state \
  --mount source=kamui-reports,target=/app/reports \
  kamui-bot
~~~

Se já existe um arquivo de estado no Codespace, migre-o preservando os IDs para o volume antes de usar o bot na hospedagem. Não inclua estado ou secrets na imagem Docker. Pare a instância antiga antes de começar a usar a nova.

### Concorrência e persistência

A aplicação no Discord e a aplicação pelo terminal compartilham a trava `.state/ID_DO_SERVIDOR.lock`. Isso impede duas aplicações ao mesmo tempo quando ambos usam o mesmo diretório persistente. A trava local não coordena cópias em máquinas ou volumes diferentes: mantenha uma única instância ativa por servidor e não aplique pelo Codespace enquanto outra hospedagem estiver operando.

Após uma interrupção abrupta, uma trava pode permanecer. Primeiro confirme que nenhuma aplicação continua executando; só depois revise a trava manualmente. A recuperação nunca deve apagar o arquivo `.state/ID_DO_SERVIDOR.json`, pois ele preserva as identidades dos canais e cargos.

## Atualização remota de categorias e canais

Depois de instalar esta versão uma vez (`git pull --ff-only` e `npm start`), mudanças de estrutura não exigem novo pull ou reinício. O bot consulta `server-update.json` da branch `destny/estrutura-v16` deste repositório ao executar `/servidor atualizar` e novamente ao confirmar.

Fluxo: solicite a alteração, publique o JSON revisado no GitHub, execute o comando no Discord e confirme a prévia. O arquivo contém schemaVersion, guildId, categories e categoryBatch. Mantenha as chaves existentes para preservar os IDs. O lote deve selecionar somente as categorias que realmente terão canais/configurações alterados; a ordem das categorias existentes também aparece na prévia. Não há exclusão automática.

O bot valida esquema, servidor, identidades únicas, tipos de canal, permissões e limites antes de usar o arquivo. Se GitHub estiver indisponível ou o arquivo for inválido, bloqueia a operação; não aplica uma cópia antiga silenciosamente. Se a revisão remota mudar após a prévia, exige nova confirmação. Configurações simultâneas ficam isoladas por interação.

A origem remota é fixa neste repositório público, sem envio do token Discord ao GitHub. O arquivo não aceita código, tokens, cargos, nome do servidor ou AutoMod. Nunca coloque secrets nele. Atualizações do programa e novas funcionalidades ainda precisam de publicação/reinício; este fluxo automatiza categorias, canais e organização enquanto o bot estiver online. Codespaces suspenso continua deixando o bot offline.

O configurador legado pelo terminal continua usando `src/config/destny-store.config.ts`; `/servidor atualizar` usa o JSON remoto. Para manter ambas as formas alinhadas, atualize também a configuração local ao publicar mudanças de estrutura.
