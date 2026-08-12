from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, KeepTogether

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs"
NAVY = colors.HexColor("#17324D")
GREEN = colors.HexColor("#087A5B")
MINT = colors.HexColor("#E7F4EF")
LIGHT = colors.HexColor("#E8EEF5")
PALE = colors.HexColor("#F4F6F9")
MUTED = colors.HexColor("#637381")


def styles():
    base = getSampleStyleSheet()
    return {
        "body": ParagraphStyle("body", parent=base["BodyText"], fontName="Helvetica", fontSize=10.2, leading=13.5, textColor=NAVY, spaceAfter=7),
        "h1": ParagraphStyle("h1", parent=base["Heading1"], fontName="Helvetica-Bold", fontSize=16, leading=19, textColor=GREEN, spaceBefore=14, spaceAfter=8, keepWithNext=True),
        "h2": ParagraphStyle("h2", parent=base["Heading2"], fontName="Helvetica-Bold", fontSize=12.5, leading=15, textColor=GREEN, spaceBefore=10, spaceAfter=5, keepWithNext=True),
        "title": ParagraphStyle("title", parent=base["Title"], fontName="Helvetica-Bold", fontSize=28, leading=32, textColor=NAVY, spaceAfter=10),
        "subtitle": ParagraphStyle("subtitle", parent=base["BodyText"], fontName="Helvetica", fontSize=13, leading=17, textColor=MUTED, spaceAfter=24),
        "kicker": ParagraphStyle("kicker", parent=base["BodyText"], fontName="Helvetica-Bold", fontSize=9, leading=11, textColor=GREEN, spaceAfter=8),
        "bullet": ParagraphStyle("bullet", parent=base["BodyText"], fontName="Helvetica", fontSize=10, leading=13, textColor=NAVY, leftIndent=16, firstLineIndent=-8, spaceAfter=4),
        "callout_label": ParagraphStyle("callout_label", parent=base["BodyText"], fontName="Helvetica-Bold", fontSize=9, leading=11, textColor=GREEN, spaceAfter=3),
        "callout": ParagraphStyle("callout", parent=base["BodyText"], fontName="Helvetica", fontSize=10, leading=13, textColor=NAVY),
        "coverbox": ParagraphStyle("coverbox", parent=base["BodyText"], fontName="Helvetica-Bold", fontSize=15, leading=19, textColor=colors.white, spaceAfter=5),
        "coverbody": ParagraphStyle("coverbody", parent=base["BodyText"], fontName="Helvetica", fontSize=9.5, leading=13, textColor=colors.HexColor("#CDE2DA")),
    }


def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica-Bold", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(inch, 10.70 * inch, "SAÚDE PERTO DE VOCÊ  |  ALTAIR/SP")
    canvas.setFont("Helvetica", 7.5)
    canvas.drawRightString(7.5 * inch, 0.48 * inch, f"Material demonstrativo • Agosto de 2026  |  {doc.page}")
    canvas.restoreState()


def cover(st, kicker, title, subtitle):
    content = Paragraph("<b>Cuidado simples para quem precisa. Gestão clara para quem atende.</b><br/><font size='9'>Medicamentos, agendamentos, especialidades e comunicação em uma experiência inclusiva e rastreável.</font>", st["coverbox"])
    box = Table([[content]], colWidths=[6.5*inch])
    box.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,-1), NAVY), ("BOX", (0,0), (-1,-1), 0, NAVY),
                             ("LEFTPADDING", (0,0), (-1,-1), 18), ("RIGHTPADDING", (0,0), (-1,-1), 18),
                             ("TOPPADDING", (0,0), (-1,-1), 17), ("BOTTOMPADDING", (0,0), (-1,-1), 17)]))
    return [Spacer(1, 0.9*inch), Paragraph(kicker.upper(), st["kicker"]), Paragraph(title, st["title"]),
            Paragraph(subtitle, st["subtitle"]), box, Spacer(1, 14), Paragraph("Versão demonstrativa • Prefeitura de Altair/SP", st["kicker"]), PageBreak()]


def data_table(st, headers, rows, widths):
    data = [[Paragraph(f"<b>{x}</b>", st["body"]) for x in headers]]
    data += [[Paragraph(str(x), st["body"]) for x in row] for row in rows]
    t = Table(data, colWidths=[x*inch for x in widths], repeatRows=1, hAlign="LEFT")
    commands = [("BACKGROUND", (0,0), (-1,0), LIGHT), ("TEXTCOLOR", (0,0), (-1,-1), NAVY),
                ("GRID", (0,0), (-1,-1), 0.5, colors.HexColor("#C7D2DC")), ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
                ("LEFTPADDING", (0,0), (-1,-1), 7), ("RIGHTPADDING", (0,0), (-1,-1), 7),
                ("TOPPADDING", (0,0), (-1,-1), 5), ("BOTTOMPADDING", (0,0), (-1,-1), 5)]
    for idx in range(2, len(data), 2):
        commands.append(("BACKGROUND", (0,idx), (-1,idx), PALE))
    t.setStyle(TableStyle(commands))
    return t


def callout(st, label, text):
    t = Table([[Paragraph(label, st["callout_label"]), Paragraph(text, st["callout"])]], colWidths=[1.35*inch, 5.15*inch])
    t.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,-1), MINT), ("VALIGN", (0,0), (-1,-1), "TOP"),
                           ("LEFTPADDING", (0,0), (-1,-1), 10), ("RIGHTPADDING", (0,0), (-1,-1), 10),
                           ("TOPPADDING", (0,0), (-1,-1), 9), ("BOTTOMPADDING", (0,0), (-1,-1), 9)]))
    return t


def add_bullets(flow, st, items, numbered=False):
    for i, item in enumerate(items, 1):
        marker = f"{i}." if numbered else "-"
        flow.append(Paragraph(f"{marker} {item}", st["bullet"]))


def build_manual():
    st, flow = styles(), []
    flow += cover(st, "Guia de uso", "Saúde Perto de Você", "Manual da demonstração para cidadãos e equipes municipais")
    flow += [Paragraph("1. Comece por aqui", st["h1"]), Paragraph("O Saúde Perto de Você reúne o estoque público de medicamentos, solicitações, retirada ou entrega agendada, demanda por especialistas e comunicação com a farmácia. A navegação do cidadão foi desenhada para celular, com linguagem direta e poucos passos; o painel administrativo prioriza informação operacional e indicadores.", st["body"]), Paragraph("Endereço e acessos", st["h2"]), Paragraph("Abra o endereço público informado na entrega. Todos os dados são fictícios e exclusivos da demonstração.", st["body"]),
             data_table(st, ["Cenário", "Identificação", "Senha / código"], [("Cidadã validada", "CPF 123.456.789-09", "Cidadao@2026"), ("Nova ativação", "CPF 111.222.333-44 • 18/06/1972", "SAUDE-2026"), ("Admin da farmácia", "admin@altair.sp.gov.br", "Admin@2026")], [1.35, 3.15, 2.0]), Spacer(1,10), callout(st, "Cenário carregado", "24 medicamentos, 15 cidadãos, lotes e validades, solicitações em múltiplas etapas, quatro especialidades, consultas previstas, mensagens e avisos.")]
    flow += [Paragraph("2. Portal público", st["h1"])]
    add_bullets(flow, st, ["Pesquise o medicamento pelo nome, princípio ativo ou código.", "Confira disponibilidade, apresentação, necessidade de receita e data de atualização.", "Acesse o portal do cidadão ou o painel da farmácia pelo botão de entrada."], True)
    flow.append(Paragraph("A consulta pública atende à obrigação de transparência prevista na Lei nº 14.654/2023. O MVP atualiza a visão operacional a cada movimentação, superando a frequência mínima quinzenal exigida pela lei.", st["body"]))
    flow += [Paragraph("3. Ativação e primeiro acesso", st["h1"])]
    add_bullets(flow, st, ["Selecione Primeiro acesso e informe CPF, data de nascimento e código entregue pela prefeitura.", "Crie uma senha com pelo menos oito caracteres.", "Envie os documentos solicitados pelo portal.", "Na primeira retirada, compareça presencialmente para conferência documental.", "Após a validação, a entrega domiciliar pode ser habilitada conforme as regras municipais."], True)
    flow += [callout(st, "Teste recomendado", "Use Ana Lúcia Souza: CPF 111.222.333-44, nascimento 18/06/1972 e código SAUDE-2026."), Paragraph("4. Jornada do cidadão", st["h1"]), Paragraph("Solicitar medicamento", st["h2"])]
    add_bullets(flow, st, ["Entre como Maria Aparecida e escolha Solicitar medicamento.", "Selecione produto e quantidade; anexe a receita quando necessário.", "Escolha retirada ou entrega. Retiradas usam intervalos de 15 minutos; entregas usam faixas de uma hora e exigem 24 horas de antecedência.", "Revise e envie. O protocolo aparece imediatamente."], True)
    flow += [Paragraph("Quando não houver saldo", st["h2"]), Paragraph("O cidadão registra a necessidade em um toque e recebe aviso quando um novo lote torna o item disponível.", st["body"]), Paragraph("Consultas e especialidades", st["h2"]), Paragraph("O cidadão vê próximos atendimentos, registra uma intenção por especialidade e recebe data, horário e local quando a prefeitura cria a agenda. A tela inicial separa consultas pendentes de confirmação e já confirmadas.", st["body"]), Paragraph("5. Painel da farmácia", st["h1"]),
             data_table(st, ["Área", "Uso principal"], [("Visão geral", "KPIs de pedidos, estoque, atendimentos e cidadãos."), ("Solicitações", "Analisar, aprovar, preparar e concluir."), ("Estoque", "Produtos, lotes, validade, saldo e movimentação."), ("Agenda", "Horários, capacidade, retirada e entrega."), ("Especialidades", "Demanda, escalas, confirmação e situação."), ("Cidadãos", "Cadastro, validação, documentos e importação."), ("Chat e equipe", "Mensagens e acessos controlados.")], [1.6, 4.9]), Paragraph("Fluxo de uma solicitação", st["h2"])]
    add_bullets(flow, st, ["Recebida: conferir cidadão, receita, produto, quantidade e modalidade.", "Aprovada: reservar o lote pelo critério FEFO.", "Pronta: avisar que retirada ou entrega foi preparada.", "Concluída: registrar a saída física por lote."], True)
    flow += [Paragraph("6. Agendas e capacidade", st["h1"]), Paragraph("A equipe cadastra horários e capacidade máxima por faixa. O painel mostra quantos agendamentos ocupam cada período, reduzindo concentração e filas.", st["body"]), PageBreak(), Spacer(1, 0.42*inch), data_table(st, ["Modalidade", "Granularidade", "Regra"], [("Retirada", "15 minutos", "Capacidade simultânea configurável."), ("Entrega", "1 hora", "Mínimo de 24 horas de antecedência."), ("Especialista", "Data e hora", "Local obrigatoriamente cadastrado.")], [1.35, 1.45, 3.7]), Paragraph("A situação da consulta pode ser alterada para planejada, confirmada, concluída ou cancelada. Cada mudança gera aviso aos cidadãos vinculados.", st["body"]), Paragraph("7. Importações e cadastros", st["h1"]), data_table(st, ["Carga", "Campos mínimos"], [("Inventário CSV", "codigo, nome, lote, validade, saldo"), ("Cidadãos CSV", "cpf, nome, nascimento, endereco, bairro, codigo_ativacao"), ("XML de produto", "cProd, xProd, qCom; nLote, qLote e dVal quando disponíveis")], [1.45, 5.05]), Paragraph("Produtos inexistentes são criados na importação do XML e também podem ser cadastrados manualmente. Ações sensíveis deixam trilha de auditoria.", st["body"]), Paragraph("8. Roteiro de demonstração", st["h1"])]
    add_bullets(flow, st, ["Pesquise Losartana e Azitromicina para contrastar saldo e item zerado.", "Ative Ana Lúcia e mostre a primeira retirada presencial.", "Entre como Maria e solicite retirada ou entrega.", "Mostre consultas pendentes e confirmadas.", "Entre como admin e percorra KPIs, solicitações, lotes, horários e demanda.", "Altere a situação de uma consulta e mostre o aviso.", "Encerre no portal público e destaque a Lei nº 14.654/2023."], True)
    flow += [Paragraph("9. Limites do MVP", st["h1"]), Paragraph("A versão demonstra experiência e regras. Para produção serão necessários banco persistente gerenciado, domínio e identidade oficiais, política LGPD, backup, monitoramento, homologação de segurança e treinamento.", st["body"])]
    path = OUT / "Manual-Saude-Perto-de-Voce.pdf"
    SimpleDocTemplate(str(path), pagesize=letter, leftMargin=inch, rightMargin=inch, topMargin=0.78*inch, bottomMargin=0.68*inch, title="Manual Saúde Perto de Você").build(flow, onFirstPage=header_footer, onLaterPages=header_footer)
    return path


def build_pitch():
    st, flow = styles(), []
    flow += cover(st, "Proposta municipal", "Saúde Perto de Você", "Medicamentos e consultas mais perto do cidadão — gestão orientada por demanda")
    flow += [Paragraph("A ideia central", st["h1"]), Paragraph("<b>A prefeitura deixa de organizar a saúde apenas pela fila e passa a organizar pelo que a população realmente precisa.</b>", st["subtitle"]), Paragraph("O cidadão consulta estoque, agenda retirada ou entrega, registra necessidade de especialista e recebe informações claras. A equipe ganha previsibilidade, rastreabilidade e indicadores para planejar atendimento, compras e escalas.", st["body"]), Paragraph("O problema que resolvemos", st["h1"])]
    add_bullets(flow, st, ["Deslocamentos sem garantia de medicamento disponível.", "Filas concentradas e pouca previsibilidade.", "Estoque, lotes e validades em controles manuais.", "Demanda por especialistas conhecida tarde demais.", "Comunicação fragmentada entre cidadão e farmácia.", "Dificuldade para comprovar transparência do estoque público."])
    flow += [callout(st, "Obrigação transformada em serviço", "A Lei nº 14.654/2023 exige publicação eletrônica dos estoques das farmácias públicas do SUS, ao menos quinzenal. A proposta entrega uma visão operacional mais frequente e útil."), Paragraph("A solução", st["h1"]), data_table(st, ["Frente", "Entrega"], [("Transparência", "Portal público de estoque e data de atualização."), ("Acesso", "PWA mobile-first, ativação e validação presencial."), ("Medicamentos", "Pedido, agenda, lotes, validade e FEFO."), ("Especialidades", "Intenção, mapa de demanda, escalas e confirmações."), ("Gestão", "KPIs, usuários, importações e auditoria."), ("Comunicação", "Chat e notificações no próprio portal.")], [1.45, 5.05]), Paragraph("Valor para cada público", st["h1"]), data_table(st, ["Público", "Valor percebido"], [("Cidadão", "Menos viagens perdidas, menos fila e informação simples."), ("Farmácia", "Fila organizada, lote correto e trabalho rastreável."), ("Secretaria", "Demanda real por produto, bairro e especialidade."), ("Gestão", "Decisões com dados e visão de capacidade."), ("Controle interno", "Histórico de reservas, saídas e alterações.")], [1.55, 4.95]), Paragraph("Por que começar agora", st["h1"]), Paragraph("O MVP concentra os fluxos de maior impacto sem exigir aplicativo em lojas, WhatsApp ou integrações complexas. A PWA permite validar rapidamente linguagem, operação, logística de entrega e regras de atendimento.", st["body"]), Paragraph("Escopo recomendado do piloto", st["h2"])]
    add_bullets(flow, st, ["Uma farmácia municipal e locais previamente cadastrados.", "Carga inicial de cidadãos, produtos, lotes, validades e saldos.", "Retirada em 15 minutos e entrega em faixas de uma hora.", "Quatro especialidades prioritárias com mapa de demanda.", "Treinamento, acompanhamento e reunião semanal de ajustes."])
    flow += [Paragraph("Indicadores do piloto", st["h1"]), data_table(st, ["Indicador", "O que demonstra"], [("Consultas ao estoque", "Informação antes do deslocamento."), ("Volume por faixa", "Redução de fila e equilíbrio da capacidade."), ("Pedidos atendidos", "Efetividade e disponibilidade real."), ("Alertas de reposição", "Demanda reprimida e resposta."), ("Intenções por especialidade", "Base objetiva para concentrar escalas."), ("Confirmação de consultas", "Aderência à agenda municipal.")], [2.4, 4.1]), PageBreak(), Spacer(1, 0.42*inch), Paragraph("Evolução independente: teleconsulta", st["h1"]), Paragraph("A teleconsulta pode ampliar cobertura com custo menor enquanto a demanda não justifica presença frequente de determinado especialista. Deve ser contratada e avaliada separadamente do MVP.", st["body"]), Paragraph("Próximo passo", st["h1"]), Paragraph("Reunir Saúde, Farmácia, Atenção Básica, TI e Controle Interno para fechar dados iniciais, capacidade, bairros de entrega, documentos, responsáveis e indicadores dos primeiros 60 dias.", st["body"]), callout(st, "Proposta de decisão", "Aprovar um piloto assistido, medir adesão e impacto operacional e então expandir gradualmente para toda a rede municipal."), Paragraph("O que a gestão leva ao final do piloto", st["h2"])]
    add_bullets(flow, st, ["Uma base confiável de demanda por medicamento e especialidade.", "Métricas de fila, capacidade, atendimento e adesão.", "Regras operacionais validadas com cidadãos e servidores.", "Um plano objetivo de expansão para a rede municipal."])
    path = OUT / "Pitch-Comercial-Saude-Perto-de-Voce-Altair.pdf"
    SimpleDocTemplate(str(path), pagesize=letter, leftMargin=inch, rightMargin=inch, topMargin=0.78*inch, bottomMargin=0.68*inch, title="Pitch Saúde Perto de Você").build(flow, onFirstPage=header_footer, onLaterPages=header_footer)
    return path


if __name__ == "__main__":
    print(build_manual())
    print(build_pitch())
