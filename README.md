# KAMUI — configurador do servidor e comando administrativo

Projeto modular com o mesmo aplicativo e token do bot já criado. O planejamento existente contém 22 categorias, 50 canais permanentes e 26 cargos. O configurador pelo terminal continua disponível e encerra ao terminar. O novo módulo `/servidor atualizar` mantém o bot conectado para apresentar uma prévia privada e aplicar o lote de categorias aprovado, após confirmação no Discord.

Não implementa vendas, pagamentos, carrinho ou automação de tickets. O comando administrativo preserva o nome atual do servidor e as configurações fora do lote. As instruções de ativação estão em [Comando de atualização no Discord](#comando-de-atualização-no-discord) e no [guia completo](docs/discord-update.md).

## Preparação no Codespace

Use Node.js 24 atualizado (mínimo 24.17.0). Se necessário:

~~~bash
nvm install 24
nvm use 24
npm install
npm run check
npm test
~~~

O Codespace recebe os secrets DISCORD_TOKEN e DISCORD_GUILD_ID. GUILD_ID também é aceito, por compatibilidade com o V16. Nunca imprima o token. Não é preciso criar .env. O programa não carrega arquivos .env automaticamente.

A dependência ^14.16.3 seleciona a versão estável compatível da linha 14 no npm, não o código de desenvolvimento do GitHub. Após instalar e validar, preserve o package-lock.json gerado. As alterações são verificadas com TypeScript e testes automatizados de permissões e reexecução. A validação no servidor real acontece após a confirmação do operador.

## Simular

~~~bash
npm run setup:dry-run
~~~

Lê o Discord sem mutações. Mostra as criações, atualizações, sobrescritas, configurações nativas e necessidade de ordenar. IDs entre sinais <...> representam elementos ainda não criados. Salva somente um relatório local. Antes de aplicar, revise a prévia e as permissões.

Nas configurações do servidor Discord, o cargo técnico do bot precisa ter Administrator e ficar acima dos cargos que serão configurados. Isso é necessário para conceder Administrator aos dois cargos aprovados e respeitar a hierarquia oficial. Não atribua cargos Owner/Cofundador automaticamente a pessoas.

## Aplicar, com confirmação no terminal

~~~bash
npm run setup:apply
~~~

Digite APLICAR seguido de um espaço e do ID exato do servidor quando solicitado. Esta aplicação pelo terminal exige a confirmação interativa. O comando no Discord possui sua própria prévia e confirmação, descritas no final deste documento. Somente operadores com acesso autorizado ao Codespace/token devem executar o configurador.

A execução faz chamadas sequenciais, respeitando o gerenciamento de rate limits do discord.js REST. Identidades são persistidas em .state/ID.json a cada criação. Preserve essa pasta entre execuções (ela fica fora do Git) para reconhecer elementos renomeados sem duplicação. Nomes repetidos em categorias diferentes são distinguidos pelo pai. Interrupções podem deixar configuração parcial; execute novamente após resolver o erro. Não há rollback destrutivo.

Uma trava local impede duas aplicações simultâneas no mesmo Codespace. Após encerramento abrupto, confirme que nenhum processo continua executando antes de remover manualmente o arquivo .state/ID.lock.

## Verificar o resultado

~~~bash
npm run setup:verify
~~~

Relê a API e compara nomes, tipos, posições, cores, hoist, permissões, configurações nativas e AutoMod. reports/latest.json contém o resultado; reports/failure.json contém falhas sanitizadas. Não compartilhe relatórios sem revisar IDs internos.

Extra canais/cargos preexistentes são preservados e apontados como divergências; nunca são apagados para forçar contagens. Sobrescritas de membros ou cargos fora do planejamento nos canais adotados bloqueiam a execução para evitar sobrescrevê-las silenciosamente. Conflitos de nomes também bloqueiam antes das mutações. Nenhum conteúdo de canais é lido, apagado ou publicado.

## Limites que precisam ser revisados

- O código tenta ativar Comunidade, associar Regras/Avisos Staff e alertas nativos. Se a API recusar, registra pendência e aplica as configurações básicas independentes. Não inventa regras ou conteúdo.
- AutoMod usa filtro nativo de spam e limite de 5 menções com proteção de raids de menções. Discord pode limitar regras por tipo. Conflitos/capacidade insuficiente são registrados, sem excluir regras existentes.
- Palavras e domínios ficam vazios na configuração até serem fornecidos; esse filtro não é declarado ativo.
- Proteções adicionais de raids que dependem da interface Discord precisam de revisão manual.
- Não existe permissão Video separada; Stream cobre vídeo/compartilhamento.
- Permissões de múltiplos cargos se somam: quem tem Moderador e Atendente recebe o acesso de Atendente em Monitoramento. Administrator/proprietário real ignoram sobrescritas.
- A validação compara a política configurada; não certifica todos os acessos efetivos de membros com combinações de cargos ou exceções preexistentes. Nenhum cargo é atribuído automaticamente.
- Normalizações de nomes/posições pela API são reportadas como divergências, sem recriar elementos.
- Não habilita onboarding nem publica regras. Não modifica ícone/banner, tópicos comerciais ou mensagens.
- “complete” se refere às comparações automatizadas desta etapa. Leia também as pendências de segurança do relatório; recursos manuais não são declarados concluídos.

## Organização

src/config/destny-store.config.ts contém todos os dados V16, incluindo referências de fidelidade sem automação comercial.
src/modules/server-setup/policy.ts concentra permissões.
src/modules/server-setup/engine.ts identifica, simula, aplica e valida.
src/setup.ts faz autenticação, confirmação, persistência e relatórios.
src/bot.ts mantém a conexão do bot e recebe interações.
src/register-commands.ts registra o comando administrativo no servidor configurado.
src/modules/discord-update concentra autorização, prévias e aplicação do lote pelo Discord.

Módulos futuros poderão usar o mesmo aplicativo e token, sem alterar a identidade do bot. Nenhum módulo comercial antecipado foi criado.

Fonte de verdade: Destny_Store_Prompt_Mestre_V16.txt.

## Alterações aprovadas após o V16

- Atualizações foi movido para a primeira posição de Loja, com a chave de identidade preservada.
- Arquivos foi adicionado antes de Equipe, com Imagens e Textos. Após essa adição, eram 16 categorias, 49 canais e 26 cargos.
- Arquivos nega visualização a @everyone e concede acesso explícito somente a Owner. Os dois canais recebem a mesma política.
- Cofundador mantém Administrator, conforme o planejamento. Por limitação nativa do Discord, qualquer membro com Administrator (incluindo Cofundador e o bot) e o proprietário real podem ver Arquivos. Remover esse privilégio global exige uma decisão separada.
- Os canais são criados vazios, sem enviar imagens ou textos. Links de anexos Discord podem expirar; não são uma hospedagem permanente.

## Adições: Combos, Robux e Tickets

- `🔥 • 𝗖𝗢𝗠𝗕𝗢𝗦`: vazia por enquanto, logo após Loja.
- `💸 • 𝗥𝗢𝗕𝗨𝗫`: logo após Combos, com o único canal `「🎮」ɢᴀᴍᴇᴘᴀꜱꜱ`.
- Combos e Robux permitem leitura pública e publicação para Administrador/Atendente, além do acesso nativo de Owner/Cofundador.
- `🎫 • 𝗧𝗜𝗖𝗞𝗘𝗧𝗦`: vazia, logo após Atendimento; oculta para membros comuns e acessível à equipe autorizada. O sistema de tickets externo deve conceder acesso ao cliente em cada canal criado. O configurador não cria tickets nem altera canais de atendimento futuros.
- Após esse lote, o planejamento passou a **19 categorias, 50 canais permanentes e 26 cargos**. Monitoramento continua em último lugar entre as categorias planejadas.

O lote ativo foi atualizado para os três destinos específicos de tickets descritos abaixo. Para simular e aplicar o lote ativo:

~~~bash
npm run setup:additions:dry-run
npm run setup:additions
~~~

O segundo comando exige a confirmação `APLICAR ID` no terminal. Mantém o nome atual do servidor, os cargos, as opções nativas, o AutoMod e as permissões dos canais existentes fora deste lote. Reorganiza as categorias planejadas para inserir as novas nas posições aprovadas. `config.categoryBatch` define as categorias do lote ativo; as chaves anteriores são preservadas. O relatório `reports/category-additions.json` valida apenas esse lote; não certifica as configurações gerais.

O comando original `setup:apply` continua sendo uma reaplicação completa do planejamento, inclusive do nome definido em `config.name`.

## Destinos separados por tipo de ticket

O lote ativo de `setup:additions` cria ou atualiza exclusivamente estas três categorias privadas, logo após Atendimento e nesta ordem:

- `💳 • 𝗖𝗢𝗠𝗣𝗥𝗔𝗦`: destino de Compras e pagamentos.
- `📝 • 𝗦𝗘𝗥𝗩𝗜𝗖𝗢𝗦`: destino de Serviços personalizados.
- `🛠️ • 𝗦𝗨𝗣𝗢𝗥𝗧𝗘`: destino de Suporte ao servidor.

As três começam vazias. A equipe autorizada pode visualizar e publicar; `@everyone` e os cargos públicos não recebem acesso. Owner/Cofundador mantêm o acesso nativo de Administrator. Cada cliente deve receber acesso apenas ao seu próprio canal, configurado pelo Ticket King. O bot externo deve possuir as permissões necessárias para usar essas categorias.

A categoria antiga `🎫 • 𝗧𝗜𝗖𝗞𝗘𝗧𝗦`, suas permissões e os tickets existentes ficam preservados. Nenhum ticket é transferido, encerrado ou apagado. No painel do Ticket King, selecione o destino correspondente para cada uma das três opções. O configurador não altera a integração externa.

Total atual planejado: **22 categorias, 50 canais permanentes e 26 cargos**. Os canais criados pelo Ticket King são dinâmicos e não entram nessa contagem permanente.

O lote exige os cargos da equipe e as categorias Loja/Atendimento existentes. Outras adições ainda ausentes ficam pendentes de uma execução completa; não bloqueiam este lote e não são criadas por ele. A ordenação e a validação do lote consideram as categorias efetivamente presentes, mantendo Monitoramento no fim da sequência planejada. `setup:apply` continua sendo uma reaplicação completa, incluindo nome e configurações gerais.

## Comando de atualização no Discord

O comando `/servidor atualizar` usa exclusivamente o lote definido em `config.categoryBatch`. Nesta versão, o lote continua sendo **Compras, Serviços e Suporte**. Os três novos canais de Combos e a ordem Robux → Combos → Contas ainda dependem da autorização solicitada pelo usuário; não foram adicionados nesta implementação.

Pode usar o comando quem for o dono real do servidor, tiver o cargo Owner identificado pelo ID aprovado ou possuir a permissão nativa **Administrator**. O ID de Owner vem de `DISCORD_OWNER_ROLE_ID`, quando configurado, ou de `role-1` no arquivo `.state/ID_DO_SERVIDOR.json`. Nomes de cargos não concedem autorização. O comando confere o acesso novamente ao clicar em Aplicar.

Para ativar no Codespace, com os secrets `DISCORD_TOKEN` e `DISCORD_GUILD_ID` já disponíveis:

~~~bash
nvm use 24
npm install
npm run check
npm test
npm run commands:register
npm start
~~~

O registro cria ou atualiza somente o comando `servidor`; preserva outros comandos do aplicativo. Ele não aplica mudanças na estrutura. Use `/servidor atualizar` no servidor configurado, revise a prévia privada e clique em **Aplicar** ou **Cancelar**. A confirmação vale por cinco minutos e pertence à pessoa que solicitou a prévia. Mudanças no plano ou reinício do bot exigem uma nova prévia.

O comando fica disponível por padrão para administradores. Se um cargo Owner não tiver Administrator, libere esse cargo também em **Configurações do servidor → Integrações → aplicativo do bot → comando servidor**. A autorização por ID continua obrigatória dentro do bot. A aplicação deve ter os escopos `bot` e `applications.commands`; o runtime usa apenas o intent Guilds, sem intents privilegiados.

O bot precisa permanecer online para responder. Codespaces serve para testar, mas pode pausar. Para manter disponibilidade, execute uma única instância em uma hospedagem com processo contínuo e preserve `.state/` entre reinícios e publicações. Há um [guia de produção com Docker](docs/discord-update.md#execução-em-produção).

O comando aplica a configuração carregada no processo. Novas alterações do GitHub precisam ser implantadas e o bot reiniciado antes de aparecerem na prévia; ele não executa Git, comandos de terminal ou código enviado pelo Discord. Hospedagem permanente e atualização automática da plataforma não são provisionadas por esta implementação.
