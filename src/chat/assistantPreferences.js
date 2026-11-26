import browserStorage from '../browser/storage.js';
import { modelProfileError, modelProviders, serverEndpoint } from '../assistant.js';
import { readConnection, writeConnection } from './connectionVault.js';
import { toolsOff } from './workspaceTools.js';

const previousEndpointKey = 'bito-c304.assistant-endpoint';
const pluginsKey = 'bito-c304.assistant-plugins';

export const defaultPlugins = {
  images: true,
  imageMotion: true,
  ...toolsOff,
  customize_dashboard: true,
  toolConnection: '',
};

export async function loadAssistantConnection() {
  const stored = await readConnection();
  if (stored === null) {
    const legacy = await browserStorage.getItem(previousEndpointKey);
    const value = legacy ?? import.meta.env.VITE_BUTLER_CHAT_URL;
    if (!value) return { type: 'none' };
    const endpoint = serverEndpoint(value);
    if (endpoint) return { type: 'server', endpoint };
    throw new Error('The saved connection URL is invalid.');
  }

  const value = JSON.parse(stored);
  if (value?.type === 'none') return { type: 'none' };
  if (value?.type === 'server' && typeof value.endpoint === 'string') {
    const endpoint = serverEndpoint(value.endpoint);
    if (endpoint) return { type: 'server', endpoint };
  }
  if (
    value?.type === 'model' &&
    value.profile &&
    typeof value.profile.model === 'string' &&
    typeof value.profile.key === 'string' &&
    typeof value.profile.baseUrl === 'string' &&
    modelProviders.some(({ value: name }) => name === value.profile?.provider) &&
    !modelProfileError(value.profile)
  ) {
    return {
      type: 'model',
      profile: { ...value.profile, mode: value.profile.mode === 'image' ? 'image' : 'chat' },
      verified: value.verified === true ? true : undefined,
      catalogVerified: value.catalogVerified === true ? true : undefined,
    };
  }
  throw new Error('The saved connection is invalid.');
}

export function saveAssistantConnection(connection) {
  return writeConnection(JSON.stringify(connection), connection.type === 'model' && !!connection.profile.key);
}

export async function loadPlugins() {
  const raw = await browserStorage.getItem(pluginsKey);
  if (!raw) return defaultPlugins;
  const value = JSON.parse(raw);
  return {
    images: typeof value?.images === 'boolean' ? value.images : defaultPlugins.images,
    imageMotion: typeof value?.imageMotion === 'boolean' ? value.imageMotion : defaultPlugins.imageMotion,
    list_items: value?.list_items === true,
    list_calendar: value?.list_calendar === true,
    search_notes: value?.search_notes === true,
    customize_dashboard: value?.customize_dashboard !== false,
    toolConnection: typeof value?.toolConnection === 'string' ? value.toolConnection : '',
  };
}

export function savePlugins(value) {
  return browserStorage.setItem(pluginsKey, JSON.stringify(value));
}
