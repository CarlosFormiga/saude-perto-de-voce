# Saúde Perto de Você — MVP

PWA municipal para consulta pública de estoque, solicitação e agendamento de medicamentos, gestão da farmácia e mapeamento de demanda por especialistas.

## Demonstração pública

- Aplicação: `https://cooperinventory.onrender.com/saude`
- Repositório do produto: `https://github.com/CarlosFormiga/saude-perto-de-voce`

## Executar localmente

Requer Node.js 22.13 ou superior.

```bash
npm install
npm run dev
```

O endereço é exibido no terminal. Nesta entrega, o serviço está ativo em `http://localhost:3003`.

## Acessos de demonstração

- Cidadã validada: CPF `123.456.789-09`, senha `Cidadao@2026`.
- Teste de nova ativação: CPF `111.222.333-44`, nascimento `18/06/1972`, código `SAUDE-2026`.
- Farmácia: `admin@altair.sp.gov.br`, senha `Admin@2026`.

> Todos os nomes, CPFs, dados clínicos e movimentações são fictícios e exclusivos da demonstração.

## Cenário demonstrativo

- 24 medicamentos com lotes, validades e saldos variados.
- 15 cidadãos distribuídos por bairros e distrito, em diferentes etapas de validação.
- Solicitações para retirada e entrega em estados de análise, aprovação, separação e conclusão.
- Demandas de Cardiologia, Ortopedia, Oftalmologia e Dermatologia, com consultas notificadas e confirmadas.

## O que está incluído

- Portal público de estoque em tempo real e destaque da Lei nº 14.654/2023.
- Ativação por CPF, nascimento e código fornecido pela prefeitura.
- Primeira retirada presencial e liberação posterior de entrega domiciliar.
- Retirada em blocos de 15 minutos e entrega em faixas de 1 hora, com 24 horas de antecedência.
- Solicitações, reserva FEFO, dispensação por lote, notificações e aviso de reposição.
- Portal de especialidades, intenção de consulta e agenda com aviso aos interessados.
- Chat interno cidadão–farmácia e envio protegido de documentos ao armazenamento R2.
- Dashboard administrativo, KPIs, capacidade por horário e usuários com papéis controlados.
- Importação XML de produtos/lotes e cargas CSV de inventário e cidadãos.
- Banco D1/SQLite local, migrações Drizzle, trilha de auditoria e PWA com service worker.

## Formatos de importação

- Inventário CSV: `codigo,nome,lote,validade,saldo`
- Cidadãos CSV: `cpf,nome,nascimento,endereco,bairro,codigo_ativacao`
- XML: itens com `cProd`, `xProd`, `qCom` e, quando disponíveis, `nLote`, `qLote`, `dVal`.

O arquivo [tests/estoque-exemplo.xml](./tests/estoque-exemplo.xml) pode ser usado para demonstração.

## Qualidade

```bash
npm run lint
npx tsc --noEmit
npm run build
node --test tests/rendered-html.test.mjs
```

O armazenamento local do D1 e R2 fica em `.wrangler/` e não deve ser versionado.
