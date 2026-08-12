from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs"
OUT.mkdir(exist_ok=True)

NAVY = "17324D"
GREEN = "087A5B"
MINT = "E7F4EF"
LIGHT = "E8EEF5"
PALE = "F4F6F9"
MUTED = "637381"
WHITE = "FFFFFF"


def font(run, size=None, color=None, bold=None, italic=None):
    run.font.name = "Calibri"
    run._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), "Calibri")
    run._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), "Calibri")
    if size is not None:
        run.font.size = Pt(size)
    if color:
        run.font.color.rgb = RGBColor.from_string(color)
    if bold is not None:
        run.bold = bold
    if italic is not None:
        run.italic = italic


def shade(cell, color):
    props = cell._tc.get_or_add_tcPr()
    node = props.find(qn("w:shd")) or OxmlElement("w:shd")
    if node.getparent() is None:
        props.append(node)
    node.set(qn("w:fill"), color)


def margins(cell, top=80, start=120, bottom=80, end=120):
    props = cell._tc.get_or_add_tcPr()
    node = props.first_child_found_in("w:tcMar")
    if node is None:
        node = OxmlElement("w:tcMar")
        props.append(node)
    for key, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        edge = node.find(qn(f"w:{key}")) or OxmlElement(f"w:{key}")
        if edge.getparent() is None:
            node.append(edge)
        edge.set(qn("w:w"), str(value))
        edge.set(qn("w:type"), "dxa")


def set_table_geometry(table, widths):
    table.autofit = False
    props = table._tbl.tblPr
    width = props.find(qn("w:tblW")) or OxmlElement("w:tblW")
    if width.getparent() is None:
        props.append(width)
    width.set(qn("w:w"), "9360")
    width.set(qn("w:type"), "dxa")
    indent = props.find(qn("w:tblInd")) or OxmlElement("w:tblInd")
    if indent.getparent() is None:
        props.append(indent)
    indent.set(qn("w:w"), "120")
    indent.set(qn("w:type"), "dxa")
    grid = table._tbl.tblGrid
    for child in list(grid):
        grid.remove(child)
    for value in widths:
        col = OxmlElement("w:gridCol")
        col.set(qn("w:w"), str(value))
        grid.append(col)
    for row in table.rows:
        for cell, value in zip(row.cells, widths):
            cell.width = Inches(value / 1440)
            cell._tc.get_or_add_tcPr().tcW.set(qn("w:w"), str(value))
            cell._tc.get_or_add_tcPr().tcW.set(qn("w:type"), "dxa")


def configure(doc, title, proposal=False):
    sec = doc.sections[0]
    sec.page_width, sec.page_height = Inches(8.5), Inches(11)
    sec.top_margin = sec.bottom_margin = sec.left_margin = sec.right_margin = Inches(1)
    sec.header_distance = sec.footer_distance = Inches(0.49)
    normal = doc.styles["Normal"]
    normal.font.name, normal.font.size = "Calibri", Pt(11)
    normal.paragraph_format.space_after = Pt(8 if proposal else 6)
    normal.paragraph_format.line_spacing = 1.333 if proposal else 1.25
    normal.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY if proposal else WD_ALIGN_PARAGRAPH.LEFT
    specs = (("Title", 29, NAVY, 0, 12), ("Heading 1", 16, GREEN, 18, 10),
             ("Heading 2", 13, GREEN, 12 if proposal else 14, 6 if proposal else 7),
             ("Heading 3", 12, NAVY, 8 if proposal else 10, 4 if proposal else 5))
    for name, size, color, before, after in specs:
        style = doc.styles[name]
        style.font.name, style.font.size = "Calibri", Pt(size)
        style.font.bold, style.font.color.rgb = True, RGBColor.from_string(color)
        style.paragraph_format.space_before, style.paragraph_format.space_after = Pt(before), Pt(after)
        style.paragraph_format.keep_with_next = True
    for name in ("List Bullet", "List Number"):
        style = doc.styles[name]
        style.font.name, style.font.size = "Calibri", Pt(11)
        style.paragraph_format.left_indent = Inches(0.375)
        style.paragraph_format.first_line_indent = Inches(-0.188)
        style.paragraph_format.space_after = Pt(4)
        style.paragraph_format.line_spacing = 1.25
    header = sec.header.paragraphs[0]
    header.text = "SAÚDE PERTO DE VOCÊ  |  ALTair/SP"
    font(header.runs[0], 8, MUTED, True)
    footer = sec.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    font(footer.add_run("Material demonstrativo • Agosto de 2026"), 8, MUTED)
    doc.core_properties.title = title
    doc.core_properties.subject = "Transformação digital da saúde pública municipal"
    doc.core_properties.author = "Saúde Perto de Você"


def cover(doc, kicker, title, subtitle, proposal=False):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(82 if proposal else 105)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER if proposal else WD_ALIGN_PARAGRAPH.LEFT
    font(p.add_run(kicker.upper()), 11, GREEN, True)
    p = doc.add_paragraph(style="Title")
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER if proposal else WD_ALIGN_PARAGRAPH.LEFT
    p.add_run(title)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER if proposal else WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.space_after = Pt(28)
    font(p.add_run(subtitle), 14, MUTED)
    box = doc.add_table(rows=1, cols=1)
    box.alignment = WD_TABLE_ALIGNMENT.LEFT
    cell = box.cell(0, 0)
    shade(cell, NAVY)
    margins(cell, 240, 260, 240, 260)
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(5)
    font(p.add_run("Cuidado simples para quem precisa. Gestão clara para quem atende."), 17, WHITE, True)
    p = cell.add_paragraph("Medicamentos, agendamentos, especialidades e comunicação em uma experiência inclusiva e rastreável.")
    p.paragraph_format.space_after = Pt(0)
    font(p.runs[0], 10, "CDE2DA")
    set_table_geometry(box, [9360])
    p = doc.add_paragraph("Versão demonstrativa • Prefeitura de Altair/SP")
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER if proposal else WD_ALIGN_PARAGRAPH.LEFT
    font(p.runs[0], 9, MUTED)
    doc.add_page_break()


def table(doc, headers, rows, widths):
    t = doc.add_table(rows=1, cols=len(headers))
    t.alignment = WD_TABLE_ALIGNMENT.LEFT
    for idx, text in enumerate(headers):
        c = t.rows[0].cells[idx]
        shade(c, LIGHT)
        margins(c)
        c.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        p = c.paragraphs[0]
        p.paragraph_format.space_after = Pt(0)
        font(p.add_run(text), 9, NAVY, True)
    for row in rows:
        cells = t.add_row().cells
        for idx, text in enumerate(row):
            cells[idx].vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            margins(cells[idx])
            if len(t.rows) % 2 == 1:
                shade(cells[idx], PALE)
            p = cells[idx].paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            font(p.add_run(str(text)), 9, NAVY)
    set_table_geometry(t, widths)
    return t


def bullets(doc, items, numbered=False):
    for item in items:
        doc.add_paragraph(item, style="List Number" if numbered else "List Bullet")


def callout(doc, label, text):
    t = doc.add_table(rows=1, cols=1)
    c = t.cell(0, 0)
    shade(c, MINT)
    margins(c, 170, 210, 170, 210)
    p = c.paragraphs[0]
    p.paragraph_format.space_after = Pt(3)
    font(p.add_run(label), 10, GREEN, True)
    p = c.add_paragraph(text)
    p.paragraph_format.space_after = Pt(0)
    font(p.runs[0], 10, NAVY)
    set_table_geometry(t, [9360])


def manual():
    doc = Document()
    configure(doc, "Manual de uso — Saúde Perto de Você")
    cover(doc, "Guia de uso", "Saúde Perto de Você", "Manual da demonstração para cidadãos e equipes municipais")
    doc.add_heading("1. Comece por aqui", 1)
    doc.add_paragraph("O Saúde Perto de Você reúne o estoque público de medicamentos, solicitações, retirada ou entrega agendada, demanda por especialistas e comunicação com a farmácia. A navegação do cidadão foi desenhada para celular, com linguagem direta e poucos passos; o painel administrativo prioriza informação operacional e indicadores.")
    doc.add_heading("Endereço e acessos", 2)
    doc.add_paragraph("Abra o endereço público informado na entrega. Todos os dados abaixo são fictícios e exclusivos da demonstração.")
    table(doc, ["Cenário", "Identificação", "Senha / código"], [
        ("Cidadã validada", "CPF 123.456.789-09", "Cidadao@2026"),
        ("Nova ativação", "CPF 111.222.333-44 • 18/06/1972", "SAUDE-2026"),
        ("Admin da farmácia", "admin@altair.sp.gov.br", "Admin@2026"),
    ], [1900, 4000, 3460])
    callout(doc, "Cenário carregado", "24 medicamentos, 15 cidadãos, lotes e validades, solicitações em múltiplas etapas, quatro especialidades, consultas previstas, mensagens e avisos.")

    doc.add_heading("2. Portal público", 1)
    bullets(doc, [
        "Pesquise o medicamento pelo nome, princípio ativo ou código.",
        "Confira disponibilidade, apresentação, necessidade de receita e data de atualização.",
        "Acesse o portal do cidadão ou o painel da farmácia pelo botão de entrada.",
    ], numbered=True)
    doc.add_paragraph("A consulta pública atende à obrigação de transparência prevista na Lei nº 14.654/2023. O MVP atualiza a visão operacional a cada movimentação, superando a frequência mínima quinzenal exigida pela lei.")

    doc.add_heading("3. Ativação e primeiro acesso", 1)
    bullets(doc, [
        "Selecione Primeiro acesso e informe CPF, data de nascimento e código entregue pela prefeitura.",
        "Crie uma senha com pelo menos oito caracteres.",
        "Envie os documentos solicitados pelo portal.",
        "Na primeira retirada, compareça presencialmente para conferência documental.",
        "Após a validação, a entrega domiciliar pode ser habilitada conforme as regras municipais.",
    ], numbered=True)
    callout(doc, "Teste recomendado", "Use Ana Lúcia Souza para percorrer a ativação: CPF 111.222.333-44, nascimento 18/06/1972 e código SAUDE-2026.")

    doc.add_heading("4. Jornada do cidadão", 1)
    doc.add_heading("Solicitar medicamento", 2)
    bullets(doc, [
        "Entre como Maria Aparecida e escolha Solicitar medicamento.",
        "Selecione o produto e a quantidade; anexe a receita quando necessário.",
        "Escolha retirada ou entrega. Retiradas usam intervalos de 15 minutos; entregas usam faixas de uma hora e exigem ao menos 24 horas de antecedência.",
        "Revise e envie. O protocolo aparece imediatamente para acompanhamento.",
    ], numbered=True)
    doc.add_heading("Quando não houver saldo", 2)
    doc.add_paragraph("O cidadão registra a necessidade em um toque. Quando um novo lote for importado ou lançado e o saldo voltar a ficar disponível, o sistema cria um aviso no portal.")
    doc.add_heading("Consultas e especialidades", 2)
    doc.add_paragraph("Em Consultar especialidades, o cidadão vê os próximos atendimentos e registra uma única intenção por especialidade. Quando a prefeitura cria uma agenda, os interessados recebem os detalhes de data, horário e local e podem confirmar presença enquanto houver capacidade.")
    doc.add_heading("Tela inicial", 2)
    doc.add_paragraph("A página principal destaca consultas pendentes de confirmação e já confirmadas, pedidos recentes, notificações e atalhos. O chat mantém a conversa com a farmácia dentro do sistema, sem depender de WhatsApp.")

    doc.add_heading("5. Painel da farmácia", 1)
    table(doc, ["Área", "Uso principal"], [
        ("Visão geral", "KPIs de pedidos, estoque baixo, atendimentos e cidadãos."),
        ("Solicitações", "Analisar, aprovar, preparar, entregar/retirar e concluir."),
        ("Estoque", "Produtos, lotes, validade, saldo, reserva e movimentação."),
        ("Agenda", "Horários, capacidade simultânea, retirada e entrega."),
        ("Especialidades", "Demanda, escalas, confirmação e situação da consulta."),
        ("Cidadãos", "Cadastro, validação, documentos e importação em massa."),
        ("Chat", "Mensagens e avisos vinculados ao cidadão."),
        ("Equipe", "Usuários administrativos e acessos controlados."),
    ], [2050, 7310])
    doc.add_heading("Fluxo de uma solicitação", 2)
    bullets(doc, [
        "Recebida: conferir cidadão, receita, produto, quantidade e modalidade.",
        "Aprovada: o sistema reserva o lote pelo critério FEFO, priorizando a validade mais próxima.",
        "Pronta: informar ao cidadão que a retirada ou entrega foi preparada.",
        "Concluída: registrar a saída física por lote e encerrar o atendimento.",
    ], numbered=True)

    doc.add_heading("6. Agendas e capacidade", 1)
    doc.add_paragraph("A equipe cadastra previamente os horários disponíveis. A capacidade máxima por faixa é configurável e o painel mostra quantos agendamentos já ocupam cada período, reduzindo concentração e filas.")
    table(doc, ["Modalidade", "Granularidade", "Regra do MVP"], [
        ("Retirada", "15 minutos", "Capacidade simultânea configurável."),
        ("Entrega", "1 hora", "Mínimo de 24 horas de antecedência."),
        ("Especialista", "Data e hora da escala", "Local obrigatoriamente cadastrado."),
    ], [1800, 1900, 5660])
    doc.add_paragraph("A situação da consulta pode ser alterada no painel administrativo: planejada, confirmada, concluída ou cancelada. Cada mudança gera aviso aos cidadãos vinculados.")

    doc.add_heading("7. Importações e cadastros", 1)
    table(doc, ["Carga", "Campos mínimos"], [
        ("Inventário CSV", "codigo, nome, lote, validade, saldo"),
        ("Cidadãos CSV", "cpf, nome, nascimento, endereco, bairro, codigo_ativacao"),
        ("XML de produto", "cProd, xProd, qCom e, quando disponíveis, nLote, qLote, dVal"),
    ], [1900, 7460])
    doc.add_paragraph("Produtos inexistentes são criados durante a importação do XML; a equipe também pode cadastrá-los manualmente. Toda ação sensível deixa trilha de auditoria.")

    doc.add_heading("8. Roteiro de demonstração", 1)
    bullets(doc, [
        "Abra a consulta pública e pesquise Losartana e Azitromicina para contrastar saldo disponível e item zerado.",
        "Ative o acesso de Ana Lúcia e mostre a regra da primeira retirada presencial.",
        "Entre como Maria, solicite um medicamento e escolha retirada ou entrega.",
        "Mostre os cards de consultas pendentes e confirmadas e confirme uma agenda.",
        "Entre como admin, percorra KPIs, solicitações, lotes, horários e demanda por especialidade.",
        "Altere a situação de uma consulta e mostre a notificação correspondente.",
        "Encerre no portal público e destaque a Lei nº 14.654/2023.",
    ], numbered=True)
    doc.add_heading("9. Limites do MVP", 1)
    doc.add_paragraph("A versão demonstra experiência, regras e integração dos fluxos. Os dados são fictícios. Para produção municipal serão necessários banco persistente gerenciado, domínio e identidade visual oficiais, política LGPD, rotinas de backup, monitoramento, homologação de segurança e treinamento da equipe.")
    path = OUT / "Manual-Saude-Perto-de-Voce.docx"
    doc.save(path)
    return path


def pitch():
    doc = Document()
    configure(doc, "Pitch comercial — Saúde Perto de Você para Altair/SP", proposal=True)
    cover(doc, "Proposta municipal", "Saúde Perto de Você", "Medicamentos e consultas mais perto do cidadão — gestão orientada por demanda", proposal=True)
    doc.add_heading("A ideia central", 1)
    p = doc.add_paragraph()
    font(p.add_run("A prefeitura deixa de organizar a saúde apenas pela fila e passa a organizar pelo que a população realmente precisa."), 15, NAVY, True)
    doc.add_paragraph("O cidadão consulta estoque, agenda retirada ou entrega, registra necessidade de especialista e recebe informações claras. A equipe ganha previsibilidade, rastreabilidade e indicadores para planejar atendimento, compras e escalas.")

    doc.add_heading("O problema que resolvemos", 1)
    bullets(doc, [
        "Deslocamentos sem garantia de que o medicamento está disponível.",
        "Filas concentradas e pouca previsibilidade de retirada.",
        "Estoque, lotes e validades dispersos em controles manuais.",
        "Demanda por especialistas conhecida tarde demais ou apenas por relatos.",
        "Comunicação fragmentada entre cidadão e farmácia.",
        "Dificuldade para cumprir e comprovar a transparência do estoque público.",
    ])
    callout(doc, "Obrigação transformada em serviço", "A Lei nº 14.654/2023 exige publicação eletrônica dos estoques das farmácias públicas do SUS, com atualização ao menos quinzenal. A proposta entrega uma visão operacional mais frequente e útil ao cidadão.")

    doc.add_heading("A solução", 1)
    table(doc, ["Frente", "Entrega"], [
        ("Transparência", "Portal público de estoque, pesquisa simples e data da atualização."),
        ("Acesso", "PWA mobile-first, ativação segura e primeira validação presencial."),
        ("Medicamentos", "Solicitação, retirada ou entrega, agenda, lotes, validade e FEFO."),
        ("Especialidades", "Intenção de consulta, mapa de demanda, escalas e confirmações."),
        ("Gestão", "KPIs, painéis, usuários controlados, importações e auditoria."),
        ("Comunicação", "Chat e notificações no próprio portal, sem integração externa inicial."),
    ], [1900, 7460])

    doc.add_heading("Valor para cada público", 1)
    table(doc, ["Público", "Valor percebido"], [
        ("Cidadão", "Menos viagens perdidas, menos fila e informação simples no celular."),
        ("Farmácia", "Fila organizada, lote correto, comunicação e trabalho rastreável."),
        ("Secretaria", "Demanda real por medicamento, bairro, modalidade e especialidade."),
        ("Gestão municipal", "Decisões com dados, transparência legal e visão de capacidade."),
        ("Controle interno", "Histórico de acessos, reservas, saídas e alterações."),
    ], [2000, 7360])

    doc.add_heading("Por que começar agora", 1)
    doc.add_paragraph("O MVP concentra os fluxos de maior impacto sem exigir aplicativo em lojas, WhatsApp ou integrações complexas. A PWA reduz atrito de adoção e permite validar rapidamente linguagem, capacidade operacional, logística de entrega e regras de atendimento.")
    doc.add_heading("Escopo recomendado do piloto", 2)
    bullets(doc, [
        "Uma farmácia municipal e locais de saúde previamente cadastrados.",
        "Carga inicial de cidadãos, produtos, lotes, validades e saldos.",
        "Retirada em blocos de 15 minutos e entrega em faixas de uma hora.",
        "Quatro especialidades prioritárias com mapa de demanda.",
        "Treinamento da equipe, acompanhamento de adoção e reunião semanal de ajustes.",
    ])

    doc.add_heading("Indicadores do piloto", 1)
    table(doc, ["Indicador", "O que demonstra"], [
        ("Consultas públicas ao estoque", "Informação chegando antes do deslocamento."),
        ("Tempo e volume por faixa", "Redução de fila e equilíbrio da capacidade."),
        ("Pedidos atendidos", "Efetividade da farmácia e disponibilidade real."),
        ("Alertas de reposição", "Demanda reprimida e resposta ao reabastecimento."),
        ("Intenções por especialidade", "Base objetiva para concentrar escalas médicas."),
        ("Confirmação de consultas", "Aderência à agenda criada pelo município."),
    ], [3400, 5960])

    doc.add_heading("Evolução independente: teleconsulta", 1)
    doc.add_paragraph("Como proposta complementar, a teleconsulta pode ampliar cobertura com custo menor, especialmente enquanto a demanda local não justifica a presença frequente de determinado especialista. Ela deve ser contratada e avaliada separadamente do MVP, preservando foco e clareza de implantação.")

    doc.add_heading("Próximo passo", 1)
    doc.add_paragraph("Realizar uma reunião de validação com Saúde, Farmácia, Atenção Básica, TI e Controle Interno. Em seguida, fechar dados iniciais, regras de capacidade, bairros atendidos por entrega, documentos de validação, responsáveis e indicadores dos primeiros 60 dias.")
    callout(doc, "Proposta de decisão", "Aprovar um piloto assistido, medir adesão e impacto operacional e então expandir gradualmente para toda a rede municipal.")
    path = OUT / "Pitch-Comercial-Saude-Perto-de-Voce-Altair.docx"
    doc.save(path)
    return path


if __name__ == "__main__":
    print(manual())
    print(pitch())
