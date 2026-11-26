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
5. Abra o endereço da Vercel no celular da funcionária e use **Adicionar à tela inicial** para ficar como um aplicativo.

Não testei a publicação em nenhum provedor. Só rodei o sistema localmente, com testes de ponta a ponta em navegador.

## Sobre validade legal

O controle de ponto é obrigatório para estabelecimentos com **mais de 20 funcionários**; abaixo disso é facultativo. Este sistema é um controle interno, **não é um REP-P certificado** pela Portaria MTP 671/2021. Se for usar o espelho de ponto como prova em uma questão trabalhista, ou se a loja crescer, confirme com o contador da loja o que vale no caso de vocês.

## Segurança, em resumo

- Senhas guardadas com bcrypt; sessão de 12 horas em cookie `httpOnly`.
- Toda página e toda ação do painel conferem se o usuário é administrador no servidor.
- Funcionário desativado perde o acesso na hora, mesmo logado.
- Bloqueio de 15 minutos depois de 6 senhas erradas (o contador fica na memória do servidor, então reinicia quando ele reinicia).
- O banco impede duas batidas ativas do mesmo tipo no mesmo dia (índice único), o que protege contra toque duplo e duas abas abertas.

## Mapa do código

```
src/db/schema.ts            tabelas: users e punches (e o índice único das batidas)
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

- Banco de horas e horas extras (hoje o relatório soma o trabalhado, sem comparar com a jornada contratada).
- Restringir a batida à rede wi-fi ou à localização da loja.
- Feriados e escala (dias que a funcionária não precisa vir).
- Aviso para a administradora quando alguém esquece a saída.
