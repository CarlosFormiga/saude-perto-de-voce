import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { PublicPortal } from "./app/components/PublicPortal";
import { AuthPortal } from "./app/components/AuthPortal";
import { CitizenPortal } from "./app/components/CitizenPortal";
import { AdminPortal } from "./app/components/AdminPortal";
import "./app/globals.css";
import { installDemoApi } from "./static/demo-api";

type Route = "/" | "/entrar" | "/ativar" | "/cidadao" | "/admin";

const routeFromLocation = (): Route => {
  const value = new URLSearchParams(location.search).get("tela") ?? "/";
  return (["/", "/entrar", "/ativar", "/cidadao", "/admin"].includes(value) ? value : "/") as Route;
};

function StaticApp() {
  const [route, setRoute] = useState<Route>(routeFromLocation);
  useEffect(() => {
    window.__SAUDE_STATIC_NAV__ = (path) => {
      const next = path as Route;
      history.pushState({}, "", next === "/" ? "/saude" : `/saude?tela=${encodeURIComponent(next)}`);
      setRoute(next);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    const pop = () => setRoute(routeFromLocation());
    addEventListener("popstate", pop);
    return () => { removeEventListener("popstate", pop); delete window.__SAUDE_STATIC_NAV__; };
  }, []);
  if (route === "/admin") return <AdminPortal />;
  if (route === "/cidadao") return <CitizenPortal />;
  if (route === "/ativar") return <AuthPortal initialMode="activate" />;
  if (route === "/entrar") return <AuthPortal />;
  return <PublicPortal />;
}

installDemoApi();
createRoot(document.getElementById("root")!).render(<React.StrictMode><StaticApp /></React.StrictMode>);
