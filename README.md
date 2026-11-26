# Controle de ponto da loja

Sistema web para a funcionária registrar o ponto pelo celular e para a dona da loja cadastrar funcionários e tirar relatórios.

**Funcionária** (`/ponto`)
- Quatro batidas por dia, sempre nessa ordem: chegada, saída para o almoço, volta do almoço e ida embora.
- Um botão grande mostra só a próxima batida e pede confirmação antes de gravar.
- A hora gravada é a do servidor, não a do celular, então mexer no relógio do aparelho não muda nada.
- Ela consulta o próprio histórico do mês em `/ponto/historico`.

**Administradora** (`/admin`)
- **Painel do dia:** quem está trabalhando, no almoço, já saiu ou ainda não chegou (atualiza sozinho a cada minuto).
- **Funcionários:** cadastrar, editar, desativar (o histórico fica) e redefinir senha.
- **Relatórios:** espelho de ponto do mês por funcionário, com total de horas, dias incompletos, **impressão/PDF** (com linhas de assinatura) e **planilha CSV** que abre direto no Excel.
- **Ajustes:** lançar uma batida esquecida ou anular uma errada. O motivo é obrigatório, o lançamento aparece marcado como manual no relatório, e nada é apagado do banco.

## Jornada e banco de horas

A funcionária sempre registra as 4 batidas. A jornada é definida no cadastro (ou em **Funcionários → Editar**), por dia da semana:

- **Sem horário fixo (padrão):** só o total de horas do dia (ex.: `08:24`). Ela escolhe quando entra, almoça e sai, e o horário da loja (ex.: 09:00 às 19:00) serve de referência.
- **Horário fixo de entrada e saída** (opcional): o total é calculado pelos horários, descontando o almoço.
- **Horário fixo de almoço** (opcional), com ou sem entrada e saída fixas.

Como o saldo é calculado:

- Saldo do dia = trabalhado − previsto. Diferença de até **10 minutos** no dia não conta; acima disso conta **inteira** (`TOLERANCE_MINUTES` em `src/lib/schedule.ts`).
- Dia de trabalho passado sem batida é **Falta**. O dia de hoje entra no saldo assim que as 4 batidas são registradas. Dias futuros e dias com batida faltando (**Incompleto**) ficam fora do saldo.
- Quando o saldo acumulado é negativo, o relatório (da administradora e da funcionária) destaca as **Horas pendentes para pagar**. Elas são abatidas automaticamente pelas horas extras de outros dias.
- Avisos que não mexem no saldo: **Atraso** (na entrada ou na volta do almoço, quando o horário é fixo) e **Fora do horário da loja**. O sistema não bloqueia a batida.
- **Abono** (botão *Ajustar* no relatório), por dia ou período: *Feriado ou folga* não exige trabalho, e o que for trabalhado vira hora extra. *Atestado ou abono* nunca gera débito.
- O saldo **acumula** desde a data de início da jornada. Cada alteração de jornada vale a partir da data informada, sem mudar o cálculo dos dias anteriores.
- Funcionário desativado para de acumular na data da desativação. Se for reativado, lance um abono para o período em que esteve fora.

Banco de horas tem regras trabalhistas próprias (acordo por escrito e prazo para compensar). Confirme com o contador antes de usar o saldo para pagar ou descontar.

## Stack

Next.js 16 (App Router) + TypeScript + Tailwind 4 + PostgreSQL + Drizzle ORM. O login usa cookie assinado (`jose`) e senhas com `bcryptjs`.

## Rodando no seu computador

```bash
npm install
cp .env.example .env        # edite SESSION_SECRET, ADMIN_PASSWORD, STORE_NAME
docker compose up -d        # PostgreSQL local
npm run db:migrate          # cria as tabelas
npm run db:seed             # cria a conta da administradora
npm run dev                 # http://localhost:3000
```

Entre com o `ADMIN_USERNAME` e a `ADMIN_PASSWORD` do `.env`, cadastre a funcionária em **Funcionários → Novo funcionário** e entregue o usuário e a senha a ela.

Comandos úteis: `npm run build`, `npm run lint`, `npm run typecheck`, `npm run db:generate` (gera uma nova migration depois de mexer em `src/db/schema.ts`).

## Publicando (para sua mãe e a funcionária usarem de verdade)

O sistema precisa ficar num endereço com **HTTPS** (o cookie de login só é enviado por HTTPS em produção). Um caminho simples e gratuito para começar:

1. Crie um banco PostgreSQL no [Neon](https://neon.tech) (ou Supabase/Railway) e copie a connection string. No Neon, prefira a versão **pooled** (`-pooler`).
2. Suba o projeto para um repositório no GitHub e importe na [Vercel](https://vercel.com).
3. Na Vercel, defina as variáveis de ambiente: `DATABASE_URL`, `SESSION_SECRET` (gere com `openssl rand -base64 48`) e `STORE_NAME`.
4. No seu computador, com `DATABASE_URL` apontando para o banco de produção (e `ADMIN_PASSWORD` definida), rode uma vez `npm run db:migrate` e `npm run db:seed`.
   **Em toda atualização que traga uma migration nova** (pasta `drizzle/`), rode `npm run db:migrate` contra o banco de produção **antes** de publicar o código novo. O código novo lê colunas e tabelas que só existem depois da migration, e sem ela o login quebra.
5. Abra o endereço da Vercel no celular da funcionária e use **Adicionar à tela inicial** para ficar como um aplicativo.

Não testei a publicação em nenhum provedor. Só rodei o sistema localmente, com testes de ponta a ponta em navegador.

## Sobre validade legal

O controle de ponto é obrigatório para estabelecimentos com **mais de 20 funcionários**; abaixo disso é facultativo. Este sistema é um controle interno, **não é um REP-P certificado** pela Portaria MTP 671/2021. Se for usar o espelho de ponto como prova em uma questão trabalhista, ou se a loja crescer, confirme com o contador da loja o que vale no caso de vocês.

## Segurança, em resumo

- Senhas guardadas com bcrypt; sessão de 12 horas em cookie `httpOnly`.
- Regra de senha (`src/lib/password.ts`): mínimo de 10 caracteres, sem senhas óbvias (como `1234567890`), sem conter o nome de usuário. Vale para cadastro, redefinição, troca e para o `db:seed`.
- Redefinir ou trocar a senha derruba as sessões abertas (`users.session_version` vai dentro do cookie e é conferido a cada requisição). Quem trocou a própria senha continua logado no aparelho em uso.
- Bloqueio de 15 minutos depois de 10 senhas erradas para o mesmo usuário (de qualquer IP) ou 20 erradas vindas do mesmo IP. Os contadores ficam no banco (`login_attempts`), então valem com várias instâncias e sobrevivem a reinícios. Efeito colateral: quem souber o usuário pode travar o login dele por 15 minutos.
- O IP vem do `x-forwarded-for`, que na Vercel é preenchido pela plataforma. Em outro host, só funciona direito com um proxy seu na frente sobrescrevendo esse cabeçalho.
- Cabeçalhos de segurança (`next.config.ts`): CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` e HSTS (só em produção). O CSP usa `'unsafe-inline'` em scripts e estilos porque o Next injeta código inline para hidratar a página.
- Toda página e toda ação do painel conferem se o usuário é administrador no servidor.
- Funcionário desativado perde o acesso na hora, mesmo logado.
- O banco impede duas batidas ativas do mesmo tipo no mesmo dia (índice único), o que protege contra toque duplo e duas abas abertas.
- Sair (logout) apaga o cookie do aparelho, mas não invalida o cookie em si: ele vale até expirar (12 h) ou até a senha mudar.

## Mapa do código

```
src/db/schema.ts            tabelas: users, punches, work_schedules, day_offs, login_attempts
src/lib/schedule.ts         regras da jornada e do banco de horas
src/lib/time.ts             tudo que mexe com data/hora no fuso de São Paulo
src/lib/punches.ts          ordem das 4 batidas, próximo tipo, cálculo de horas trabalhadas
src/lib/report.ts           monta o relatório do mês (uma linha por dia)
src/lib/session.ts, auth.ts login por cookie assinado; requireAdmin / requireEmployee
src/app/(app)/ponto/        tela da funcionária e a ação que grava a batida
src/app/(app)/admin/        painel, funcionários, relatórios (+ CSV) e ajustes
src/components/             tabela do mês, linha com ajuste, botões, relógio
scripts/seed.ts             cria a administradora
drizzle/                    migrations SQL
```

## Ideias para depois

- Registrar o pagamento de horas extras (baixa no saldo do banco).
- Restringir a batida à rede wi-fi ou à localização da loja.
- Feriado lançado de uma vez para todos os funcionários.
- Aviso para a administradora quando alguém esquece a saída.
