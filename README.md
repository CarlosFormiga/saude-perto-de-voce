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

- Portal público de estoque com data da última movimentação real e apoio ao atendimento da Lei nº 14.654/2023.
- Ativação por CPF, nascimento e código fornecido pela prefeitura.
- Entrega domiciliar somente após validação documental e primeira retirada presencial concluída.
- Retirada em blocos de 15 minutos e entrega em faixas de 1 hora, com 24 horas de antecedência.
- Solicitações com máquina de estados, reserva FEFO vinculada ao lote, motivo de recusa, dispensação rastreável e aviso de reposição.
- Portal de especialidades, intenção de consulta e agenda com aviso aos interessados.
- Chat interno cidadão–farmácia, Web Push por aparelho e envio protegido de documentos ao armazenamento R2.
- Dashboard, KPIs, capacidade concorrente, auditoria, fila de privacidade e RBAC por operador/gestor/superadmin.
- Importação XML de produtos/lotes e cargas CSV de inventário e cidadãos.
- Banco D1/SQLite local, migrações Drizzle, trilha de auditoria e PWA com service worker para cache e alertas em segundo plano.
- Proteções de login, cookie seguro e uploads PDF/JPG/PNG com validação de conteúdo e limite de 5 MB.

## Compliance e limites

- O produto oferece prontidão técnica; não constitui certificação jurídica, farmacêutica, de segurança ou acessibilidade.
- Antes da produção, o município deve definir controlador, encarregado, bases legais, retenção, inventário de tratamentos, RIPD quando aplicável, contratos e resposta a incidentes.
- A acessibilidade deve ser homologada segundo a Lei nº 13.146/2015 e eMAG/WCAG, incluindo testes por teclado, leitor de tela e com usuários.
- A demonstração pública é exclusivamente fictícia. Dados reais exigem ambiente segregado e homologado.
- Web Push exige adesão explícita do cidadão em cada aparelho. A tela bloqueada usa mensagens genéricas; os detalhes permanecem no portal autenticado. WhatsApp e SMS não estão incluídos.

Documentos principais: manual, pitch, revisão de compliance e roteiro da apresentação estão na pasta `docs/` em DOCX e PDF.

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
npm audit --omit=dev
```

O armazenamento local do D1 e R2 fica em `.wrangler/` e não deve ser versionado.

## Configuração do Web Push

Gere um par VAPID exclusivo com `npm run push:keys`. Configure `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` no cofre de segredos da hospedagem; use `.dev.vars.example` apenas como referência. A chave privada nunca deve ser versionada. Sem essas variáveis, o portal preserva os avisos internos e oculta o botão de ativação.

Os eventos cobertos são: recebimento e mudança de situação de solicitações, reposição de estoque acompanhada, publicação/alteração de consulta e nova mensagem da farmácia. Assinaturas expiradas são inativadas automaticamente após resposta 404/410 do provedor ou falhas repetidas.
