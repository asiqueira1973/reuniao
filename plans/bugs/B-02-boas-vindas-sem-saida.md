# B-02 — Boas-vindas sem saída

Registrado em 06/11/2026: o Alexandre tentou apagar a conta do Gmail (sem aceite dos Termos) e não conseguiu. Enquanto `termos_aceitos_em` é nulo, o painel mostra só as boas-vindas, sem "Sair" nem "Excluir conta"; a única saída era aceitar os Termos.

## Reprodução
Banco local, conta `alexandre` com `termos_aceitos_em = null`: `/painel/tipos` mostra as boas-vindas; não há "Sair" nem "Excluir" na tela (conferido no navegador).

## Correção
Na tela de boas-vindas: botão "Sair" (formulário POST /sair) e "Não quero usar o Reunião" → confirmação → `DELETE /api/painel/conta` com o endereço da própria conta (mesma rota da tela Conta: revoga o token no Google e apaga em cascata) → volta para a página inicial.

## Teste
Rota: conta sem aceite consegue se excluir (o servidor nunca exigiu o aceite para isso; o teste trava esse comportamento). Tela: conferida no navegador antes e depois.
