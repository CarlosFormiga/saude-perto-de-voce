# Revisão de regras de negócio e compliance

Data da revisão: 15/08/2026.

O MVP foi revisado em regras funcionais, segurança, LGPD, transparência e acessibilidade. Foram corrigidas reservas duplicáveis, rastreabilidade de lote, transições de status, liberação antecipada de entrega, upload permissivo, tentativas ilimitadas de login, segregação de perfis, data artificial de atualização e ausência de canal do titular.

## Classificação

- Lei nº 14.654/2023: pronto tecnicamente; o município deve garantir alimentação e conferência ao menos quinzenal.
- LGPD: controles técnicos parciais; governança formal permanece pré-requisito.
- Segurança: build, typecheck e lint aprovados; auditoria das dependências de produção sem vulnerabilidades conhecidas na data da revisão.
- Acessibilidade: fundamentos semânticos e responsivos presentes; auditoria eMAG/WCAG e teste com usuários permanecem obrigatórios.
- Assistência farmacêutica: fluxo suporta conferência, reserva FEFO e saída por lote; protocolos profissionais devem ser definidos pelo município.
- Web Push: adesão explícita por aparelho, revogação disponível, mensagens genéricas na tela bloqueada e aviso interno como registro principal. Endpoint e chaves da assinatura são dados pessoais técnicos e devem seguir retenção, controle de acesso e resposta a incidentes definidos pelo município.

O relatório completo está nos arquivos `Revisao-Regras-Negocio-Compliance-Saude-Perto-de-Voce.docx` e `.pdf`.
