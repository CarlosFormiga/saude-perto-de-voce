"use client";

import { FormEvent, useEffect, useState } from "react";
import { PortalLink as Link, usePortalRouter } from "../portal-navigation";

export function AuthPortal({ initialMode = "citizen" }: { initialMode?: "citizen" | "admin" | "activate" }) {
  const [mode, setMode] = useState(initialMode);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const router = usePortalRouter();
  useEffect(() => { fetch("/api/portal?action=session").then((r) => r.json() as Promise<{role?:string}>).then((data) => { if (data.role === "citizen") router.replace("/cidadao"); if (data.role === "admin") router.replace("/admin"); }); }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setMessage(""); setError(false);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const action = mode === "activate" ? "activate" : "login";
    const response = await fetch("/api/portal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, mode, ...values }) });
    const data = await response.json() as {message?:string;role?:string}; setLoading(false);
    if (!response.ok) { setError(true); setMessage(data.message ?? "Não foi possível continuar."); return; }
    router.replace(data.role === "admin" ? "/admin" : "/cidadao");
  }

  return <main className="auth-layout">
    <aside className="auth-aside"><Link className="brand" href="/"><span className="brand-mark" style={{background:"white",color:"var(--green)"}}>+</span><span>Saúde Perto de Você<small style={{color:"#dff5ec"}}>Portal Municipal de Saúde</small></span></Link><div><span className="eyebrow">Acesso simples e seguro</span><h1>Cuide da sua saúde sem enfrentar filas.</h1><p>Solicite medicamentos, escolha o melhor horário e acompanhe os serviços de saúde do município.</p></div><small>Se precisar de ajuda, procure sua Unidade de Saúde.</small></aside>
    <section className="auth-main"><div className="auth-card">
      <Link href="/" className="muted" style={{fontSize:14}}>← Voltar ao portal público</Link>
      <h2 style={{marginTop:22}}>{mode === "activate" ? "Ative seu acesso" : "Entre no portal"}</h2>
      <p className="muted">{mode === "activate" ? "Use os dados e o código entregues pela prefeitura." : "Seus dados ficam protegidos e não aparecem na consulta pública."}</p>
      {mode !== "activate" && <div className="tabs"><button className={`tab ${mode === "citizen" ? "active" : ""}`} onClick={() => setMode("citizen")}>Sou cidadão</button><button className={`tab ${mode === "admin" ? "active" : ""}`} onClick={() => setMode("admin")}>Sou da farmácia</button></div>}
      <form className="form-grid" onSubmit={submit}>
        {mode === "admin" ? <><div className="field"><label htmlFor="login">E-mail</label><input id="login" name="login" type="email" autoComplete="username" required placeholder="nome@prefeitura.gov.br" /></div><div className="field"><label htmlFor="password">Senha</label><input id="password" name="password" type="password" autoComplete="current-password" required /></div></> : <>
          <div className="field"><label htmlFor="cpf">CPF</label><input id="cpf" name="cpf" inputMode="numeric" autoComplete="username" maxLength={14} required placeholder="000.000.000-00" /></div>
          {mode === "activate" && <><div className="field"><label htmlFor="birthDate">Data de nascimento</label><input id="birthDate" name="birthDate" type="date" required /></div><div className="field"><label htmlFor="code">Código entregue pela prefeitura</label><input id="code" name="code" autoCapitalize="characters" required placeholder="Ex.: ALTA-2026" /></div></>}
          <div className="field"><label htmlFor="password">{mode === "activate" ? "Crie uma senha" : "Senha"}</label><input id="password" name="password" type="password" minLength={mode==="activate"?10:8} autoComplete={mode === "activate" ? "new-password" : "current-password"} required /><span className="hint">{mode==="activate"?"Use 10 caracteres ou mais.":"Informe sua senha."}</span></div>
        </>}
        {message && <div role="alert" className={`alert ${error ? "alert-error" : "alert-success"}`}>{message}</div>}
        <button className="btn btn-primary btn-block" disabled={loading}>{loading ? "Aguarde..." : mode === "activate" ? "Ativar meu acesso" : "Entrar"}</button>
      </form>
      {mode === "citizen" && <p style={{textAlign:"center",marginTop:18,fontSize:14}}>Primeiro acesso? <button onClick={() => setMode("activate")} style={{border:0,background:"none",color:"var(--green)",fontWeight:800,cursor:"pointer"}}>Ative aqui</button></p>}
      {mode === "activate" && <p style={{textAlign:"center",marginTop:18,fontSize:14}}>Já ativou? <button onClick={() => setMode("citizen")} style={{border:0,background:"none",color:"var(--green)",fontWeight:800,cursor:"pointer"}}>Entre aqui</button></p>}
      <div className="demo-box"><strong>Acessos de demonstração</strong><br />Cidadão validado: CPF 123.456.789-09 · senha Cidadao@2026<br />Nova ativação: CPF 111.222.333-44 · nascimento 18/06/1972 · código SAUDE-2026<br />Farmácia: admin@altair.sp.gov.br · senha Admin@2026</div>
    </div></section>
  </main>;
}
