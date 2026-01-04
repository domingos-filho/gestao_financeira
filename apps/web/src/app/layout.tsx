import "./globals.css";
import { Space_Grotesk, Manrope } from "next/font/google";
import { Providers } from "./providers";
import { SwRegister } from "./sw-register";

const space = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space"
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope"
});

export const metadata = {
  title: "Gestao Financeira",
  description: "Controle financeiro offline-first",
  manifest: "/manifest.json",
  themeColor: "#1c6e6d"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${space.variable} ${manrope.variable} bg-background text-foreground`}>
        <Providers>
          <SwRegister />
          {children}
        </Providers>
      </body>
    </html>
  );
}
