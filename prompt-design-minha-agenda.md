# Prompt para o Claude Design — Minha Agenda

Cole o bloco abaixo no Claude Design.

```
Desenhe todas as telas de "Minha Agenda" (nome de trabalho): um app web de agendamento pessoal, no estilo do Calendly, mas só com o básico. Um dono (Alexandre) configura os tipos de reunião e a disponibilidade; qualquer pessoa com o link escolhe um horário, sem criar conta. A reunião vai para o Google Agenda do dono com Google Meet.

Gere cada tela em dois tamanhos (celular 375 px e desktop 1280 px), em modo claro e escuro.

## Direção visual (obrigatória)
- Estilo Apple: apple.com, Calendário do macOS, App Store Connect. Muito espaço em branco, nada de sombra pesada.
- Tipografia de sistema: -apple-system, "SF Pro Display", "SF Pro Text", "Helvetica Neue". Títulos grandes, peso 700, tracking negativo. Horários com números tabulares, formato 24 h.
- Cor de destaque única: azul #0071e3 (claro) / #0a84ff (escuro): dias com horário, horário selecionado, botões primários, item ativo do menu. Fundo branco/preto; superfícies #f5f5f7 / #1c1c1e; texto secundário #6e6e73 / #98989d.
- Cores semânticas só com significado: vermelho #ff3b30/#ff453a = cancelar/cancelada/erro; verde #34c759/#30d158 = confirmada; laranja #ff9500/#ff9f0a = atenção (reconectar Google, e-mail não enviado). O azul nunca indica status.
- Cards com cantos de 22–24 px, sem borda, sobre a superfície; hairlines de 1 px em listas. Dias do calendário em círculos de 44 px; horários em pílulas de largura total com 44 px de altura.
- Ícones de traço fino (estilo lucide).

## Navegação do painel do dono — menu lateral estilo App Store Connect (desktop ≥ 1024 px)
- Dois grupos com título em negrito escuro, caixa normal (sem MAIÚSCULAS): "Agenda" (Tipos de evento, Reuniões) e "Configurar" (Disponibilidade, Conta).
- Itens indentados sob o grupo, sem marcador ou bolinha.
- Traço fino (hairline) entre os grupos.
- Um item ativo por vez: texto azul #0071e3 com leve pílula azul clara ao fundo.
- Rodapé: nome e e-mail da conta, link "Ver minha página", botão "Sair".
- Abaixo de 1024 px o menu vira gaveta aberta por um botão no topo.
- Faixa laranja no topo do conteúdo quando a agenda está desconectada: "Sua agenda do Google foi desconectada. Ninguém consegue marcar até você reconectar." + botão "Reconectar Google".

## Página pública (convidado)
Uma coluna no celular. No desktop, cartão central de até 1.000 px com duas colunas: resumo à esquerda, calendário à direita. Ao escolher o dia, os horários aparecem ao lado do calendário no desktop e abaixo dele no celular. Sem logo de terceiros. Rodapé discreto com "Privacidade".

## Fluxo principal do convidado
Página da conta → Escolher horário (dia → horário → "Próximo") → Seus dados → "Confirmar reunião" → Confirmado. Pelo link do e-mail: Gerenciar reserva → Remarcar (mesmo calendário) ou Cancelar.

## Telas

### [Público] Entrar — /entrar
Logo/nome do app, botão "Entrar com Google". Estados de erro: "Este e-mail não tem acesso." e "Para funcionar, marque as duas permissões de agenda." (com "Tentar de novo").

### [Dono] Tipos de evento — /painel/tipos
Lista de cards: nome (ex.: "Entrevistas", "Reunião de 2h", "Reunião de 1,5h", "Reunião de 1h", "Reunião de 30 minutos"), duração ("1 h", "1 h 30 min", "30 min"), "Google Meet", selos "Oculto"/"Inativo" quando for o caso, botões "Copiar link" (vira "Link copiado." por 2 s) e "Abrir". Botão "Novo tipo". Reordenar: arrastar no desktop, setas no celular. Link "Ver minha página" no topo.
Estado vazio: "Nenhum tipo de reunião ainda." + "Criar o primeiro".

### [Dono] Editar tipo — /painel/tipos/[id] e /painel/tipos/novo
Uma tela só, em grupos:
- Básico: Nome, Duração (15–240 min), Descrição, Endereço (`{domínio}/{conta}/` + campo editável; erro "Esse endereço já está em uso.").
- Local: Google Meet (liga/desliga).
- Regras: Antecedência mínima (padrão 4 h), Até quantos dias à frente (padrão 60), Intervalo antes e depois (padrão 0), Horários começam a cada (padrão 30 min).
- Visibilidade: Mostrar na minha página (liga/desliga; desligado = só pelo link), Ativo.
Botões Salvar e Excluir (vermelho, com confirmação).

### [Dono] Reuniões — /painel/reunioes
Abas Próximas, Passadas, Canceladas. Agrupado por dia ("terça-feira, 4 de novembro"); linha com hora, nome do convidado, tipo e e-mail; selo verde "Confirmada" ou vermelho "Cancelada".
Estado vazio: "Nenhuma reunião marcada." Estado carregando: esqueleto das linhas.

### [Dono] Detalhe da reunião — /painel/reunioes/[id]
Convidado, e-mail, tipo, data e hora, link do Meet, observação, histórico de remarcação ("Remarcada de 4/11 10:30"), situação dos e-mails (com "E-mail não enviado" em laranja e botão "Reenviar"). Botão "Cancelar reunião" (vermelho) com campo de motivo opcional e confirmação. Para reuniões passadas ou canceladas, sem botão de cancelar.

### [Dono] Disponibilidade — /painel/disponibilidade
Três blocos na mesma tela, cada um com seu Salvar:
1. Horários semanais: uma linha por dia (D S T Q Q S S em círculos), faixas como "10:30 – 12:00" e "14:30 – 18:00", botão + para nova faixa, × para remover, ícone "copiar para…" outros dias. Dia sem faixa: "Indisponível". Erro: "Esses horários se sobrepõem."
2. Datas específicas: lista de datas futuras com o ajuste ("Indisponível" ou faixas); botão "Adicionar data" abre um calendário e a escolha entre "Indisponível o dia todo" e faixas próprias.
3. Feriados: chave geral "Brasil" e a lista com a próxima data e uma chave cada: Confraternização Universal, Carnaval (segunda), Carnaval (terça), Quarta-feira de Cinzas, Sexta-feira Santa, Tiradentes, Dia do Trabalho, Corpus Christi, Independência, Nossa Senhora Aparecida, Finados, Proclamação da República, Consciência Negra, Natal.

### [Dono] Conta — /painel/conta
Nome de exibição; Endereço (`{domínio}/` + slug, com indicação de disponível/indisponível ao digitar; ao trocar: "Links antigos deixam de funcionar. Continuar?"); Mensagem de boas-vindas (até 300 caracteres); Fuso horário; bloco "Google Agenda" (e-mail conectado, "Consultando sua agenda principal", situação verde "Conectada" ou laranja "Desconectada", botão "Reconectar"); "Excluir conta" (vermelho; pede digitar o endereço para confirmar).

### [Convidado] Página da conta — /{slug}
Nome do dono, mensagem de boas-vindas (ou "Escolha um tipo de reunião."), cards dos tipos visíveis com nome, duração e seta.

### [Convidado] Escolher horário — /{slug}/{tipo}
Esquerda: nome do dono, nome do tipo, duração, "Google Meet", descrição. Direita: "Escolha uma data e horário", calendário do mês com setas (dias com horário em azul dentro de círculo claro, sem horário em cinza, hoje com ponto embaixo), "Fuso horário" com seletor (ex.: "Horário de Brasília"). Ao tocar no dia: lista de horários em pílulas; ao tocar num horário, ele se divide em [horário] + botão azul "Próximo".
Depois: "Seus dados" com Nome, E-mail, "Algo que eu deva saber? (opcional)" e "Confirmar reunião".
Estados: carregando (esqueleto do calendário); "Sem horários neste mês." + "Ver próximo mês"; erro "Não consegui consultar a agenda agora. Tente de novo em instantes."; "Agenda temporariamente indisponível."; "Esse horário acabou de ser reservado. Escolha outro."; "Não consegui criar a reunião. Nada foi marcado. Tente de novo."; "Você já tem reuniões marcadas comigo. Para marcar outra, cancele uma delas pelo link do e-mail."; tipo inativo: "Este tipo de reunião não está disponível."

### [Convidado] Confirmado — /{slug}/{tipo}/confirmado
Ícone de confirmação verde, "Reunião marcada.", resumo (tipo, dia e hora no fuso do convidado, link do Meet), "Enviamos a confirmação para {email}. O convite do Google Agenda também já chegou."

### [Convidado] Gerenciar reserva — /r/{token}
"Sua reunião": resumo + botões "Remarcar" e "Cancelar reunião". Cancelar abre motivo opcional e confirmação → "Reunião cancelada. Avisei {nome do dono}." Estados: "Este link não é válido."; reserva já cancelada; reserva remarcada (com link para a nova); "Esta reunião já aconteceu ou está acontecendo." (sem botões).

### [Convidado] Remarcar — /r/{token}/remarcar
Mesmo calendário e lista de horários da tela de escolha, com o horário atual indicado no topo; botão final "Confirmar novo horário" (sem pedir nome e e-mail de novo).

### [Público] Não encontrada — 404
"Página não encontrada."

### E-mails (HTML simples)
Fundo branco, título grande, botão azul arredondado, rodapé discreto. Desenhe dois modelos: confirmação para o convidado (com botões "Entrar no Meet", "Remarcar", "Cancelar") e aviso para o dono ("Nova reunião: {convidado} · {dd/mm hh:mm}").

Use só os textos acima; quando faltar texto, use placeholder marcado como [placeholder: …].
```
