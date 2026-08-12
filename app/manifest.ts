import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Saúde Perto de Você",
    short_name: "Saúde Municipal",
    description: "Medicamentos, agendamentos e especialistas em um só lugar.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f7f5",
    theme_color: "#087a55",
    lang: "pt-BR",
  };
}
