import { useState } from "react";
import { createRoot } from "react-dom/client";
import ClinicApp from "../components/clinic-app";
import { createLocalStore } from "./local-store";
import PwaTools from "./pwa-tools";
import "../app/globals.css";
import "./pwa.css";

const store = createLocalStore();
const client = { request: store.request, photoUrl: store.photoUrl, assetUrl: (name: string) => `${import.meta.env.BASE_URL}${name}` };
function App() {
  const [revision, setRevision] = useState(0);
  return <ClinicApp key={revision} client={client} tools={<PwaTools store={store} onImported={() => setRevision(value => value + 1)} />} />;
}
createRoot(document.getElementById("root")!).render(<App />);
