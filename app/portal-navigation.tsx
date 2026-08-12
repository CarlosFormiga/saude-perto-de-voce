"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";

declare global {
  interface Window { __SAUDE_STATIC_NAV__?: (path: string) => void }
}

export function goTo(path: string, replace = false) {
  if (typeof window === "undefined") return;
  if (window.__SAUDE_STATIC_NAV__) { window.__SAUDE_STATIC_NAV__(path); return; }
  if (replace) window.location.replace(path); else window.location.assign(path);
}

const portalRouter = { replace: (path: string) => goTo(path, true), push: (path: string) => goTo(path) };
export function usePortalRouter() { return portalRouter; }

export function PortalLink({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) {
  return <a href={href} {...props} onClick={(event) => { props.onClick?.(event); if (!event.defaultPrevented && window.__SAUDE_STATIC_NAV__) { event.preventDefault(); goTo(href); } }}>{children}</a>;
}
