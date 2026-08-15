"use client";

import { useEffect, useMemo, useState } from "react";
import { PortalLink as Link } from "../portal-navigation";

type Product = { id: string; code: string; name: string; active_ingredient: string; presentation: string; unit: string; available: number; minimum_stock: number; delivery_allowed: number };

function stock(product: Product) {
  const available = Number(product.available);
  if (available <= 0) return { label: "Sem estoque", className: "stock stock-out" };
  if (available <= Number(product.minimum_stock)) return { label: "Estoque baixo", className: "stock stock-low" };
  return { label: "Disponível", className: "stock stock-ok" };
}

export function PublicPortal() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  useEffect(() => { fetch("/api/portal?action=public").then((r) => r.json() as Promise<{products?:Product[];updatedAt?:string}>).then((data) => { setProducts(data.products ?? []); setUpdatedAt(data.updatedAt ?? ""); }); }, []);
  const filtered = useMemo(() => products.filter((product) => `${product.name} ${product.active_ingredient} ${product.code}`.toLowerCase().includes(query.toLowerCase())), [products, query]);
  return <>
    <header className="topbar"><div className="topbar-inner">
      <Link className="brand" href="/"><span className="brand-mark">+</span><span>Saúde Perto de Você<small>Portal Municipal de Saúde</small></span></Link>
      <div className="top-actions"><a className="btn btn-ghost" href="#estoque">Consultar estoque</a><Link className="btn btn-primary" href="/entrar">Entrar</Link></div>
    </div></header>
    <main className="container">
      <section className="hero">
        <div className="hero-main"><span className="eyebrow">Cuidado simples e acessível</span><h1>Sua saúde mais perto de você.</h1><p>Consulte medicamentos, organize sua retirada e acompanhe quando os especialistas estarão no município.</p><div className="hero-actions"><Link className="btn btn-secondary" href="/entrar">Acessar meu portal</Link><a className="btn btn-ghost" style={{color:"white",borderColor:"rgba(255,255,255,.4)"}} href="#estoque">Ver medicamentos</a></div></div>
        <div className="hero-side">
          <a className="quick-card" href="#estoque"><span className="quick-icon">Rx</span><h3>Consulte o estoque</h3><p>Veja se o medicamento está disponível antes de sair de casa.</p></a>
          <Link className="quick-card" href="/entrar"><span className="quick-icon">◷</span><h3>Agende sem filas</h3><p>Escolha um horário para retirar ou receber seu medicamento.</p></Link>
          <Link className="quick-card" href="/entrar"><span className="quick-icon">♡</span><h3>Especialistas</h3><p>Veja as datas e informe de qual atendimento você precisa.</p></Link>
        </div>
      </section>
      <section className="section legal"><span style={{fontSize:24}}>§</span><div><strong>Transparência que cuida de você</strong>Este portal apoia o atendimento à Lei nº 14.654/2023, que determina a divulgação eletrônica e acessível dos estoques das farmácias públicas do SUS, com atualização no mínimo quinzenal. A data abaixo corresponde à última movimentação registrada no inventário.</div></section>
      <section className="section" id="estoque">
        <div className="section-heading"><div><span className="eyebrow" style={{color:"var(--green)"}}>Consulta pública</span><h2>Estoque de medicamentos</h2><p className="muted">Estoque consolidado da Farmácia Municipal. Não é necessário entrar para consultar.</p></div></div>
        <label className="searchbox"><span aria-hidden="true">⌕</span><input aria-label="Buscar medicamento" placeholder="Digite o nome do medicamento..." value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <div className="grid grid-3" style={{marginTop:16}}>{filtered.map((product) => { const status=stock(product); return <article className="card medicine-card" key={product.id}><div className="medicine-title"><div><h3>{product.name}</h3><div className="medicine-meta">{product.presentation} · cód. {product.code}</div></div><span className={status.className}>{status.label}</span></div><div className="medicine-meta">Princípio ativo: {product.active_ingredient}</div>{Number(product.available)>0 && <strong>{Number(product.available)} {product.unit}(s) disponíveis</strong>}<div className="medicine-meta">{product.delivery_allowed ? "Pode ser solicitado para entrega após validação." : "Retirada presencial obrigatória."}</div></article>; })}</div>
        {!filtered.length && <div className="empty">Nenhum medicamento encontrado. Tente outro nome.</div>}
        {updatedAt && <p className="updated">Última atualização do inventário: {new Date(updatedAt).toLocaleString("pt-BR")}. O saldo pode mudar durante a análise; a dispensação depende das regras do SUS, da receita e da conferência da farmácia.</p>}
      </section>
      <section className="section panel"><div className="panel-body"><h2>Privacidade, acessibilidade e atendimento</h2><p className="muted">A consulta de estoque não exibe dados pessoais. No portal autenticado, o município trata dados cadastrais e de saúde para executar o serviço público. O cidadão pode solicitar acesso, correção, informações ou revisão pela área Privacidade. Antes da implantação, a prefeitura deve publicar o contato do encarregado, a política de retenção e o canal alternativo de atendimento acessível.</p></div></section>
    </main>
  </>;
}
