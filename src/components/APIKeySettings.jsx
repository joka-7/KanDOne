import { useState, useRef, useCallback } from 'react';
import { X, Eye, EyeOff, ExternalLink, CheckCircle, Trash2, Settings, Globe } from 'lucide-react';
import GithubIcon from './GithubIcon';
import { ModelPicker } from 'modeldispatcher-react-ui';
import 'modeldispatcher-react-ui/styles.css';
import {
  loadConfig,
  saveConfig,
  loadExternalChatFavorite,
  saveExternalChatFavorite,
} from 'modeldispatcher-browser-agent';
import { loadAIConfigFromStorage, isAIReady, PROVIDERS } from '../services/aiAssistant';
import { dispatcherFeatures } from '../modeldispatcher.config';
import { useModalA11y } from '../hooks/useModalA11y';

const PROVIDER_ORDER = ['gemini', 'groq', 'ollama', 'anthropic', 'openai'];

/** The shared <ModelPicker> settings screen — add one or more providers
 * with pooled keys, pick a favorite free AI app. Live-saves on every
 * change (ModelPicker's own convention), so a single Close is enough. */
function NewApiKeySettings({ t, onClose }) {
  const [pickerConfig, setPickerConfig] = useState(loadConfig);
  const [favorite, setFavorite] = useState(loadExternalChatFavorite);

  const dialogRef = useRef(null);
  const handleClose = useCallback(() => onClose(), [onClose]);
  useModalA11y(dialogRef, handleClose);

  function handleConfigChange(next) {
    setPickerConfig(next);
    saveConfig(next);
    loadAIConfigFromStorage(); // re-sync aiAssistant's in-memory config + fire AI_CONFIG_UPDATED
  }

  function handleFavoriteChange(next) {
    setFavorite(next);
    saveExternalChatFavorite(next);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="api-key-settings-title"
        tabIndex={-1}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden outline-none"
      >
        <div className="bg-gradient-to-r from-purple-600 to-indigo-700 p-5 text-white flex items-center justify-between">
          <div id="api-key-settings-title" className="flex items-center gap-2 font-bold text-lg">
            <Settings size={20} /> {t('settings.title', 'Settings')}
          </div>
          <button type="button" onClick={handleClose} aria-label={t('chat.close', 'Close')} className="text-white/70 hover:text-white"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto flex-1 min-h-0">
          <div className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm">
            <span className="flex-shrink-0" aria-hidden>⚠️</span>
            <p>{t('settings.securityNotice', 'API keys are stored in this browser only. Anyone with access to this device, or a malicious extension, could read them. Job and chat data you send is transmitted to your chosen AI provider under your account.')}</p>
          </div>

          <ModelPicker
            config={pickerConfig}
            onConfigChange={handleConfigChange}
            externalChatFavorite={favorite}
            onExternalChatFavoriteChange={handleFavoriteChange}
          />

          <button
            onClick={handleClose}
            className="w-full py-2.5 rounded-lg font-bold text-white bg-purple-600 hover:bg-purple-700 transition-colors"
          >
            {t('settings.done', 'Done')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** The app's original hand-built AI settings — single provider/key/model.
 * Kept byte-for-byte in behavior as the fallback when
 * `dispatcherFeatures.ui` is off (see modeldispatcher.config.js). */
function LegacyApiKeySettings({ t, onClose }) {
  const saved = {
    provider: localStorage.getItem('aiProvider') || 'gemini',
    apiKey: localStorage.getItem('aiApiKey') || '',
    model: localStorage.getItem('aiModel') || '',
    ollamaUrl: localStorage.getItem('ollamaUrl') || 'http://localhost:11434',
  };

  const [provider, setProvider] = useState(saved.provider);
  const [apiKey, setApiKey] = useState(saved.apiKey);
  const [model, setModel] = useState(saved.model || PROVIDERS[saved.provider]?.defaultModel || '');
  const [ollamaUrl, setOllamaUrl] = useState(saved.ollamaUrl);
  const [visible, setVisible] = useState(false);
  const [done, setDone] = useState(false);

  const pInfo = PROVIDERS[provider];
  const isOllama = provider === 'ollama';
  const aiReady = isOllama || !!apiKey.trim();

  const handleProviderChange = (p) => {
    setProvider(p);
    setApiKey(localStorage.getItem('aiApiKey') || '');
    setModel(PROVIDERS[p]?.defaultModel || '');
    setVisible(false);
  };

  const handleSave = () => {
    const key = apiKey.trim();
    const effectiveModel = model.trim() || pInfo.defaultModel;
    localStorage.setItem('aiProvider', provider);
    localStorage.setItem('aiApiKey', key);
    localStorage.setItem('aiModel', effectiveModel);
    if (isOllama) localStorage.setItem('ollamaUrl', ollamaUrl.trim());
    loadAIConfigFromStorage();

    setDone(true);
    setTimeout(() => { setDone(false); onClose(); }, 900);
  };

  const handleClear = () => {
    ['aiProvider', 'aiApiKey', 'aiModel', 'ollamaUrl'].forEach(k => localStorage.removeItem(k));
    window.location.reload();
  };

  const alreadySet = isAIReady();
  const dialogRef = useRef(null);
  const handleClose = useCallback(() => onClose(), [onClose]);
  useModalA11y(dialogRef, handleClose);

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="api-key-settings-title"
        tabIndex={-1}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden outline-none"
      >
        <div className="bg-gradient-to-r from-purple-600 to-indigo-700 p-5 text-white flex items-center justify-between">
          <div id="api-key-settings-title" className="flex items-center gap-2 font-bold text-lg">
            <Settings size={20} /> {t('settings.title', 'Settings')}
          </div>
          <button type="button" onClick={handleClose} aria-label={t('chat.close', 'Close')} className="text-white/70 hover:text-white"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto flex-1 min-h-0">
          <div className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm">
            <span className="flex-shrink-0" aria-hidden>⚠️</span>
            <p>{t('settings.securityNotice', 'API keys are stored in this browser only. Anyone with access to this device, or a malicious extension, could read them. Job and chat data you send is transmitted to your chosen AI provider under your account.')}</p>
          </div>

          {alreadySet && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
              <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
              {t('settings.keyActive', 'AI is active')} — {PROVIDERS[localStorage.getItem('aiProvider') || 'gemini']?.name}
            </div>
          )}

          {/* Provider selector */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              {t('settings.providerLabel', 'AI Provider')}
            </label>
            <div className="grid grid-cols-1 gap-2">
              {PROVIDER_ORDER.map(id => {
                const p = PROVIDERS[id];
                return (
                  <button
                    key={id}
                    onClick={() => handleProviderChange(id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                      provider === id
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-100 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${provider === id ? 'bg-purple-500' : 'bg-gray-200'}`} />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm text-gray-800">{p.name}</span>
                    </div>
                    {p.free && (
                      <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-bold flex-shrink-0">
                        FREE
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Key / URL input */}
          {isOllama ? (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">
                {t('settings.ollamaUrl', 'Ollama URL')}
              </label>
              <input
                type="text"
                value={ollamaUrl}
                onChange={e => setOllamaUrl(e.target.value)}
                placeholder="http://localhost:11434"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm font-mono"
              />
              <p className="text-xs text-gray-500 mt-1">{t('settings.ollamaNote', 'Make sure Ollama is running locally with CORS enabled.')}</p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">
                {t('settings.apiKeyLabel', 'API Key')}
              </label>
              <div className="relative">
                <input
                  type={visible ? 'text' : 'password'}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder={pInfo?.placeholder || ''}
                  className="w-full p-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                />
                <button type="button" onClick={() => setVisible(v => !v)} aria-label={visible ? t('settings.hideKey', 'Hide API key') : t('settings.showKey', 'Show API key')} className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">{t('settings.keyNote', 'Stored only in this browser.')}</p>
            </div>
          )}

          {/* Model override */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">
              {t('settings.modelLabel', 'Model')} <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={model}
              onChange={e => setModel(e.target.value)}
              placeholder={pInfo?.defaultModel || ''}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm font-mono"
            />
          </div>

          {/* Get key link */}
          {pInfo?.infoUrl && (
            <a href={pInfo.infoUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-800 font-medium">
              <ExternalLink size={14} /> {pInfo.infoText}
            </a>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleSave}
              className={`flex-1 py-2.5 rounded-lg font-bold text-white transition-colors ${
                done ? 'bg-green-500' : 'bg-purple-600 hover:bg-purple-700'
              }`}
            >
              {done ? `✓ ${t('settings.saved', 'Saved!')}` : aiReady ? t('settings.save', 'Save & Enable AI') : t('settings.saveSettings', 'Save Settings')}
            </button>
            {alreadySet && (
              <button type="button" onClick={handleClear} aria-label={t('settings.clearKey', 'Remove')} className="px-4 py-2.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors" title={t('settings.clearKey', 'Remove')}>
                <Trash2 size={16} />
              </button>
            )}
          </div>

          <div className="flex items-center justify-center gap-4 pt-2 border-t border-gray-100">
            <a href="https://github.com/joka-7" target="_blank" rel="noreferrer" aria-label="GitHub" className="text-gray-400 hover:text-gray-600 transition-colors">
              <GithubIcon size={16} />
            </a>
            <a href="https://jk-dev-7.vercel.app" target="_blank" rel="noreferrer" aria-label="jk.dev portfolio" className="text-gray-400 hover:text-gray-600 transition-colors">
              <Globe size={16} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function APIKeySettings(props) {
  return dispatcherFeatures.ui ? <NewApiKeySettings {...props} /> : <LegacyApiKeySettings {...props} />;
}
