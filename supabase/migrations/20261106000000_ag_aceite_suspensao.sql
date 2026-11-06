-- Spec v0.5, épicos 8.11 e 8.13 (cadastro aberto).
-- termos_aceitos_em: quando o dono aceitou os Termos de uso e a Política de privacidade na tela de
--   boas-vindas (prova do aceite, LGPD). Nulo = ainda não aceitou: o painel mostra as boas-vindas.
-- suspensa_em: conta suspensa por abuso (feito por SQL na v1). Preenchida = a página pública some
--   (404), não há horários nem reservas e o login é recusado. Nulo = conta normal.
alter table public.ag_contas
  add column termos_aceitos_em timestamptz,
  add column suspensa_em timestamptz;

comment on column public.ag_contas.termos_aceitos_em is 'Aceite dos Termos e da Privacidade (spec v0.5, 8.11). Nulo = boas-vindas pendentes.';
comment on column public.ag_contas.suspensa_em is 'Conta suspensa por abuso (spec v0.5, 8.13). Nulo = ativa.';
