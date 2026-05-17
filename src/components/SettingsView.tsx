import { Download, KeyRound, Upload } from "lucide-react";
import { useState } from "react";
import { AppData, Category } from "../types";
import { categoryLabels } from "../data/catalog";
import { exportData, parseImportedData } from "../storage/localStore";
import { getMetadataProviders } from "../services/metadata";

export function SettingsView({
  data,
  onReplaceData,
  onUpdateData,
}: {
  data: AppData;
  onReplaceData: (data: AppData) => void;
  onUpdateData: (patch: Partial<AppData>) => void;
}) {
  const [importError, setImportError] = useState("");
  const providers = getMetadataProviders(data.settings);

  function importFile(file?: File) {
    if (!file) return;
    setImportError("");
    file.text()
      .then((text) => onReplaceData(parseImportedData(text)))
      .catch((error) => setImportError(error.message));
  }

  return (
    <main className="page">
      <section className="list-header">
        <div>
          <p className="eyebrow">Preferencias locais</p>
          <h1>Configuracoes</h1>
          <p>Status, backup JSON e chaves para buscas automaticas futuras.</p>
        </div>
      </section>

      <section className="settings-grid">
        <div className="setting-panel">
          <h2>Backup</h2>
          <p>Todos os seus dados ficam no navegador. Exporte JSON para guardar uma copia fora do localStorage.</p>
          <div className="button-row">
            <button className="primary" onClick={() => exportData(data)}><Download size={16} /> Exportar JSON</button>
            <label className="file-button">
              <Upload size={16} />
              Importar JSON
              <input type="file" accept="application/json" onChange={(event) => importFile(event.target.files?.[0])} />
            </label>
          </div>
          {importError ? <p className="form-error">{importError}</p> : null}
        </div>

        <div className="setting-panel">
          <h2>Chaves de APIs</h2>
          <p>Quando as integracoes forem ativadas, estas chaves serao usadas apenas localmente no seu navegador.</p>
          <div className="api-key-grid">
            {Object.keys(data.settings.apiKeys).concat(["igdb", "steam", "rawg", "googleBooks", "spotify", "lastfm", "tmdb", "omdb"])
              .filter((key, index, keys) => keys.indexOf(key) === index)
              .map((key) => (
                <label className="field" key={key}>
                  <span>{key}</span>
                  <input
                    value={String(data.settings.apiKeys[key as keyof typeof data.settings.apiKeys] ?? "")}
                    onChange={(event) => onUpdateData({ settings: { apiKeys: { ...data.settings.apiKeys, [key]: event.target.value } } })}
                    placeholder="Opcional"
                  />
                </label>
              ))}
          </div>
          <div className="provider-list">
            {providers.map((provider) => (
              <span key={provider.id} className={provider.configured ? "provider-ok" : "provider-pending"}>
                <KeyRound size={14} /> {provider.name} / {categoryLabels[provider.category]}
              </span>
            ))}
          </div>
        </div>

        <StatusManager data={data} onUpdateData={onUpdateData} />
      </section>
    </main>
  );
}

function StatusManager({ data, onUpdateData }: { data: AppData; onUpdateData: (patch: Partial<AppData>) => void }) {
  function updateCategory(category: Category, statuses: string[]) {
    onUpdateData({ statuses: { ...data.statuses, [category]: statuses.filter(Boolean) } });
  }

  return (
    <div className="setting-panel wide">
      <h2>Status personalizados</h2>
      <div className="status-columns">
        {(Object.keys(categoryLabels) as Category[]).map((category) => (
          <section key={category} className="status-box">
            <h3>{categoryLabels[category]}</h3>
            {data.statuses[category].map((status, index) => (
              <div className="repeat-row" key={`${category}-${index}`}>
                <input
                  value={status}
                  onChange={(event) => updateCategory(category, data.statuses[category].map((item, itemIndex) => itemIndex === index ? event.target.value : item))}
                />
                <button className="ghost compact" onClick={() => updateCategory(category, data.statuses[category].filter((_, itemIndex) => itemIndex !== index))}>Remover</button>
              </div>
            ))}
            <button className="ghost" onClick={() => updateCategory(category, [...data.statuses[category], "Novo status"])}>Criar status</button>
          </section>
        ))}
      </div>
    </div>
  );
}
