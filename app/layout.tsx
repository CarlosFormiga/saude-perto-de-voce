import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "./components/PwaRegister";

export const metadata: Metadata = {
  title: { default: "Saúde Perto de Você", template: "%s | Saúde Perto de Você" },
  description: "Portal municipal de medicamentos, agendamentos e especialidades.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#087a55" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><PwaRegister />{children}</body></html>;
}
