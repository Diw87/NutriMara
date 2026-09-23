import { useEffect, useRef, useState } from "react";
import { Download, HardDrive, Upload, WifiOff, Smartphone } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { toast } from "sonner";
import type { createLocalStore } from "./local-store";

type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
export default function PwaTools({ store, onImported }: { store: ReturnType<typeof createLocalStore>; onImported: () => void }) {
  const [installPrompt, setInstallPrompt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [offlineReady, setOfflineReady] = useState(false);
  const [help, setHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const display = matchMedia("(display-mode: standalone)");
    const updateInstalled = () => setInstalled(display.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    const onPrompt = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallEvent); };
    const onInstalled = () => { setInstalled(true); setInstallPrompt(null); toast.success("NutriMara instalado."); };
    const connection = () => setOnline(navigator.onLine);
    updateInstalled();
    display.addEventListener("change", updateInstalled);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("online", connection); window.addEventListener("offline", connection);
    let active = true;
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      const base = new URL(import.meta.env.BASE_URL, window.location.origin);
      void navigator.serviceWorker.register(new URL("sw.js", base).href, { scope: base.pathname }).then(async () => {
        await navigator.serviceWorker.ready;
        if (active) setOfflineReady(true);
      }).catch(() => { if (active) toast.error("Não foi possível preparar o uso sem internet. Reabra o aplicativo quando estiver conectado."); });
    }
    return () => {
      active = false; display.removeEventListener("change", updateInstalled);
      window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("online", connection); window.removeEventListener("offline", connection);
    };
  }, []);

  async function install() {
    if (!installPrompt) { setHelp(true); return; }
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
      void navigator.storage?.persist?.().catch(() => false);
    } catch { setInstallPrompt(null); setHelp(true); }
  }
  async function exportData() {
    setBusy(true);
    try {
      const data = await store.exportBackup();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
      const anchor = document.createElement("a"); anchor.href = url;
      anchor.download = `NutriMara-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
      toast.success("Cópia preparada. Guarde o arquivo baixado em um local seguro.");
      void navigator.storage?.persist?.().catch(() => false);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível exportar a cópia."); }
    finally { setBusy(false); }
  }
  async function importData(file: File) {
    setBusy(true);
    try {
      const result = await store.importBackup(JSON.parse(await file.text()));
      onImported();
      toast.success(`Cópia importada: ${result.addedPatients} paciente(s). Os registros existentes foram mantidos.`);
    } catch (error) { toast.error(error instanceof SyntaxError ? "Escolha um arquivo de backup do NutriMara." : error instanceof Error ? error.message : "Não foi possível importar a cópia."); }
    finally { setBusy(false); }
  }
  return <>
    <section className="pwa-bar" aria-label="Instalação e cópias de segurança">
      <div className="pwa-storage"><HardDrive size={19} /><div><strong>Dados neste dispositivo</strong><span>{!online ? <><WifiOff size={13} /> Sem internet</> : offlineReady ? "Pronto para usar sem internet" : "Faça cópias de segurança regularmente"}</span></div></div>
      <div className="pwa-actions">
        <button className="button button-secondary" disabled={busy} onClick={() => void exportData()}><Download size={16} /> Exportar cópia</button>
        <button className="button button-secondary" disabled={busy} onClick={() => importInput.current?.click()}><Upload size={16} /> Importar cópia</button>
        {!installed && <button className="button button-primary" onClick={() => void install()}><Smartphone size={16} /> Instalar aplicativo</button>}
      </div>
      <input className="pwa-file-input" ref={importInput} type="file" accept=".json,application/json" aria-label="Importar cópia do NutriMara" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void importData(file); }} />
    </section>
    <p className="pwa-data-note">Os registros e fotos ficam neste navegador, sem sincronização automática. Exporte uma cópia antes de trocar de aparelho ou limpar os dados. Importar acrescenta os registros da cópia sem apagar os atuais.</p>
    <Dialog open={help} onOpenChange={setHelp}><DialogContent className="form-dialog"><DialogHeader><DialogTitle>Instalar o NutriMara</DialogTitle><DialogDescription>Abra pelo link do GitHub e adicione o aplicativo ao seu dispositivo.</DialogDescription></DialogHeader><div className="install-help"><p><strong>Android ou computador:</strong> no Chrome ou Edge, abra o menu do navegador e procure “Instalar aplicativo” ou “Adicionar à tela inicial”.</p><p><strong>iPhone ou iPad:</strong> abra no Safari, toque em Compartilhar e escolha “Adicionar à Tela de Início”.</p><p>Exporte uma cópia antes de instalar ou mudar de navegador. Se necessário, importe a cópia no aplicativo.</p></div><button className="button button-primary" onClick={() => setHelp(false)}>Entendi</button></DialogContent></Dialog>
  </>;
}
