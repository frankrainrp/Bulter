import { randomUUID } from './id.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native-web';
import {
  ChatRequestError,
  InterruptedReply,
  defaultModelId,
  modelProfileError,
  requestReply,
  serverEndpoint,
  serverEndpointError,
} from './assistant.js';
import {
  defaultPlugins,
  loadAssistantConnection,
  loadPlugins,
  saveAssistantConnection,
  savePlugins,
} from './chat/assistantPreferences.js';
import { createLiveReplyText } from './chat/liveReplyText.js';
import { markOrbReplyStarted } from './chat/OrbReplyReveal.jsx';
import { createWorkspaceTools, toolsOff } from './chat/workspaceTools.js';
import { createDashboardTool } from './dashboard/dashboardTool.js';
import { usesOpenAIResponses } from './chat/openaiResponses.js';
import { getDashboardLayout, applyDashboardAction } from './dashboard/dashboardStore.js';
import { dateKey } from './model.js';
import { listProviderModels } from './chat/modelCatalog.js';
import { canGenerateImage, generateImage } from './chat/generateImage.js';

const replyIdleLimit = 35_000;

function sessionTitle(session) {
  return (session.messages[0]?.content || session.draft).trim().split('\n')[0] || 'New chat';
}

export function useAssistant(workspace) {
  const [endpoint, setEndpoint] = useState('');
  const [model, setModel] = useState();
  const [catalog, setCatalog] = useState([]);
  const [catalogStatus, setCatalogStatus] = useState('idle');
  const [catalogIssue, setCatalogIssue] = useState('');
  const [catalogVerified, setCatalogVerified] = useState(false);
  const [dashboardForMessage] = useState(() => createDashboardTool({ getDashboardLayout, applyDashboardAction }));
  const catalogueRequest = useRef(null);
  const allowsKeys = Platform.OS !== 'web' || globalThis.isSecureContext;
  const connected = Boolean(endpoint || model);
  const [connectionStatus, setConnectionStatus] = useState('loading');
  const [verification, setVerification] = useState('unverified');
  const [savedPlugins, setPlugins] = useState(defaultPlugins);
  const toolConnection = model ? JSON.stringify([model.provider, model.model, model.baseUrl]) : endpoint;
  const plugins = useMemo(
    () =>
      savedPlugins.toolConnection === toolConnection
        ? savedPlugins
        : { ...savedPlugins, ...toolsOff, customize_dashboard: savedPlugins.customize_dashboard, toolConnection },
    [savedPlugins, toolConnection]
  );
  const [pluginsReady, setPluginsReady] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState([]);
  const [replying, setReplying] = useState(false);
  const [replyId, setReplyId] = useState('');
  const [liveText] = useState(createLiveReplyText);
  const [failure, setFailure] = useState();
  const [chatId, setChatId] = useState(randomUUID);
  const [archivedChats, setArchivedChats] = useState([]);
  const error = failure?.message ?? '';
  const pending = useRef(null);
  const connectionProbe = useRef(null);
  const changingConnection = useRef(false);
  const changingPlugins = useRef(false);

  useEffect(() => {
    let active = true;
    void loadAssistantConnection()
      .then((value) => {
        if (!active) return;
        if (value.type === 'server') setEndpoint(value.endpoint);
        if (value.type === 'model') {
          setModel(value.profile);
          setCatalogVerified(!!value.catalogVerified);
          if (value.verified) setVerification('verified');
        }
        setConnectionStatus('ready');
      })
      .catch(() => {
        if (active) setConnectionStatus('error');
      });
    void loadPlugins()
      .then((value) => {
        if (active) setPlugins(value);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setPluginsReady(true);
      });
    return () => {
      active = false;
      pending.current?.abort();
      pending.current = null;
      liveText.clear();
      connectionProbe.current?.abort();
      connectionProbe.current = null;
      catalogueRequest.current?.abort();
      catalogueRequest.current = null;
    };
  }, [liveText]);

  function resetConversation() {
    pending.current?.abort();
    pending.current = null;
    setReplying(false);
    setReplyId('');
    setMessages([]);
    liveText.clear();
    setFailure(undefined);
  }

  function clear() {
    resetConversation();
    setDraft('');
    setChatId(randomUUID());
  }

  const currentChat = { id: chatId, messages, draft, failure };
  const hasChat = messages.length > 0 || !!draft.trim();
  const recentChats = (hasChat ? [currentChat, ...archivedChats] : archivedChats).map((session) => ({
    id: session.id,
    title: sessionTitle(session),
  }));

  function switchChat(id) {
    if (id === chatId || pending.current || changingConnection.current) return;
    const next = id ? archivedChats.find((session) => session.id === id) : undefined;
    if (id && !next) return;
    const others = archivedChats.filter((session) => session.id !== id);
    setArchivedChats(hasChat ? [currentChat, ...others] : others);
    resetConversation();
    setChatId(next?.id ?? randomUUID());
    setDraft(next?.draft ?? '');
    setMessages(next?.messages ?? []);
    setFailure(next?.failure);
  }

  async function refreshCatalog() {
    if (!model || changingConnection.current || catalogueRequest.current) return;
    const controller = new AbortController();
    catalogueRequest.current = controller;
    setCatalogStatus('loading');
    setCatalogIssue('');
    const timeout = setTimeout(() => controller.abort(), 25_000);
    try {
      const entries = await listProviderModels(model, controller.signal, fetch);
      if (catalogueRequest.current !== controller) return;
      setCatalog(entries);
      setCatalogStatus('ready');
      setCatalogVerified(true);
    } catch (cause) {
      if (catalogueRequest.current !== controller) return;
      setCatalogIssue(
        controller.signal.aborted
          ? 'Model discovery timed out. Try again.'
          : cause instanceof Error
            ? cause.message
            : 'Could not load the model catalogue.'
      );
      setCatalogStatus('error');
    } finally {
      clearTimeout(timeout);
      if (catalogueRequest.current === controller) catalogueRequest.current = null;
    }
  }

  async function persistConnection(connection, discover = false, chooseUnknown) {
    if (changingConnection.current || pending.current || connectionStatus === 'loading')
      return 'Wait for the current operation to finish.';
    changingConnection.current = true;
    if (catalogueRequest.current) setCatalogStatus(catalog.length ? 'ready' : 'idle');
    catalogueRequest.current?.abort();
    catalogueRequest.current = null;
    let entries;
    try {
      if (connection.type === 'model' && discover) {
        const controller = new AbortController();
        connectionProbe.current = controller;
        const timeout = setTimeout(() => controller.abort(), 35_000);
        try {
          entries = await listProviderModels(connection.profile, controller.signal, fetch);
          if (controller.signal.aborted) return 'The connection check took too long. Try again.';
          if (!entries.length)
            return 'The provider returned an empty catalogue. You can enter a model ID manually.';
          const chosen =
            entries.find((item) => item.id === connection.profile.model && item.kind === 'chat') ??
            entries.find((item) => item.kind === 'chat') ??
            entries.find(
              (item) => item.kind === 'image' && canGenerateImage(connection.profile.provider, item.id, item.kind)
            );
          if (!chosen) {
            const unknown = entries.filter((item) => item.kind === 'unknown');
            if (unknown.length && chooseUnknown) {
              chooseUnknown(unknown);
              return 'This provider did not specify model capabilities. Select a chat deployment or enter a model ID.';
            }
            return 'This catalogue lists no supported chat or image models. You can enter a model ID manually.';
          }
          connection.profile = {
            ...connection.profile,
            model: chosen.id,
            mode: chosen.kind === 'image' ? 'image' : 'chat',
          };
          connection.catalogVerified = true;
        } catch (cause) {
          return controller.signal.aborted
            ? 'The connection check took too long. Try again.'
            : cause instanceof Error
              ? cause.message
              : 'Couldn’t verify the connection.';
        } finally {
          clearTimeout(timeout);
          connectionProbe.current = null;
        }
      }
      await saveAssistantConnection(connection);
      const sameAccount =
        connection.type === 'model' &&
        model?.provider === connection.profile.provider &&
        model.baseUrl === connection.profile.baseUrl &&
        model.key === connection.profile.key;
      if (!sameAccount) {
        const last = messages.at(-1);
        if (failure && last?.role === 'user') setDraft((draft) => draft || last.content);
        resetConversation();
        setArchivedChats([]);
        setChatId(randomUUID());
      } else if (failure && messages.at(-1)?.role === 'user') {
        editFailedMessage();
      }
      if (entries || !sameAccount) {
        setCatalog(entries ?? []);
        setCatalogStatus(entries ? 'ready' : 'idle');
        setCatalogIssue('');
      } else if (catalogStatus === 'loading') setCatalogStatus('idle');
      setCatalogVerified(connection.type === 'model' && !!connection.catalogVerified);
      setEndpoint(connection.type === 'server' ? connection.endpoint : '');
      setModel(connection.type === 'model' ? connection.profile : undefined);
      setVerification(connection.type === 'model' && connection.verified ? 'verified' : 'unverified');
      setConnectionStatus('ready');
    } catch {
      return 'Couldn’t save the connection on this device.';
    } finally {
      changingConnection.current = false;
    }
  }

  async function saveConnection(value) {
    const url = value === '' ? '' : serverEndpoint(value);
    if (url === undefined) return serverEndpointError(value);
    if (url && url === endpoint && !model) return;
    return persistConnection(url ? { type: 'server', endpoint: url } : { type: 'none' });
  }

  async function saveModel(value, manual = false, chooseUnknown) {
    if (!allowsKeys && (value.provider !== 'custom' || value.key.trim())) {
      return 'Open this page in a secure context to use a model API key.';
    }
    const profile = {
      ...value,
      model: value.model.trim() || defaultModelId(value.provider) || 'auto',
      baseUrl: value.baseUrl.trim(),
      key: value.key.trim(),
    };
    if (model?.provider === profile.provider && model.baseUrl === profile.baseUrl && !profile.key) {
      profile.key = model.key;
    }
    const issue = modelProfileError(profile);
    if (issue) return issue;
    if (manual && !value.model.trim()) return 'Enter the model ID supplied by your provider.';
    if (manual && profile.mode === 'image' && !canGenerateImage(profile.provider, profile.model, 'image')) {
      return 'This connection does not support that image generation model.';
    }
    const sameAccount =
      model?.provider === profile.provider && model.key === profile.key && model.baseUrl === profile.baseUrl;
    return persistConnection(
      { type: 'model', profile, catalogVerified: sameAccount && catalogVerified ? true : undefined },
      !manual,
      chooseUnknown
    );
  }

  function selectModel(id, mode) {
    if (!model) return Promise.resolve('Connect a provider first.');
    const selected = catalog.find((item) => item.id === id);
    if (
      !selected ||
      selected.kind === 'other' ||
      (selected.kind === 'image') !== (mode === 'image') ||
      (mode === 'image' && !canGenerateImage(model.provider, id, selected.kind))
    ) {
      return Promise.resolve('That model is unavailable for this mode.');
    }
    return persistConnection({
      type: 'model',
      profile: { ...model, model: id, mode },
      catalogVerified: catalogVerified ? true : undefined,
    });
  }

  async function updatePlugins(value) {
    if (changingPlugins.current) return 'Wait for the current change to finish.';
    if (pending.current && Object.keys(toolsOff).some((key) => value[key] !== plugins[key])) {
      return 'Stop the reply before changing workspace access.';
    }
    changingPlugins.current = true;
    try {
      const scoped = { ...value, toolConnection };
      await savePlugins(scoped);
      setPlugins(scoped);
    } catch {
      return 'Couldn’t save plugin settings on this device.';
    } finally {
      changingPlugins.current = false;
    }
  }

  async function reply(turns) {
    if (!connected || pending.current || changingConnection.current || changingPlugins.current) return;
    const controller = new AbortController();
    const id = randomUUID();
    const imageMode = model?.mode === 'image';
    const reasoning = model && usesOpenAIResponses(model.provider, model.model, true);
    const idleLimit = imageMode ? 300_000 : reasoning ? 600_000 : replyIdleLimit;
    markOrbReplyStarted(id);
    pending.current = controller;
    setReplyId(id);
    liveText.clear();
    let lastProgress = performance.now();
    function abortIfIdle() {
      const remaining = idleLimit - (performance.now() - lastProgress);
      if (remaining > 0) timeout = setTimeout(abortIfIdle, remaining);
      else controller.abort();
    }
    let timeout = setTimeout(abortIfIdle, idleLimit);
    setReplying(true);
    setFailure(undefined);
    try {
      const now = new Date();
      const weekEnd = new Date(now);
      weekEnd.setDate(now.getDate() + 7);
      const available =
        !imageMode && workspace && pluginsReady
          ? createWorkspaceTools(
              workspace,
              plugins,
              model ? 'model' : 'server',
              dateKey(now),
              dateKey(weekEnd),
              Platform.OS === 'web' ? dashboardForMessage(turns[turns.length - 1].id) : undefined
            )
          : undefined;
      const result =
        imageMode && model
          ? await generateImage(model, turns[turns.length - 1].content, controller.signal, fetch)
          : {
              content: await requestReply(
                model ?? endpoint,
                turns,
                controller.signal,
                fetch,
                (text) => {
                  if (pending.current === controller && !controller.signal.aborted) {
                    lastProgress = performance.now();
                    liveText.receive(text);
                  }
                },
                available,
                () => {
                  lastProgress = performance.now();
                }
              ),
            };
      if (pending.current !== controller) return;
      if (controller.signal.aborted) throw new Error('The reply timed out.');
      setMessages([...turns, { id, role: 'assistant', ...result }]);
      setVerification('verified');
    } catch (cause) {
      if (pending.current !== controller) return;
      setFailure({
        message: controller.signal.aborted
          ? 'The service took too long. You can retry.'
          : cause instanceof Error
            ? cause.message
            : 'Couldn’t receive a reply.',
        checkSettings: cause instanceof ChatRequestError && cause.checkSettings,
        partial:
          cause instanceof InterruptedReply && cause.partial.trim()
            ? { id, role: 'assistant', content: cause.partial }
            : undefined,
      });
      setVerification('failed');
    } finally {
      clearTimeout(timeout);
      if (pending.current === controller) {
        pending.current = null;
        liveText.clear();
        setReplying(false);
      }
    }
  }

  function stop() {
    const controller = pending.current;
    if (!controller) return;
    pending.current = null;
    controller.abort();
    setReplying(false);
    const partialReply = liveText.read();
    if (partialReply.trim()) {
      setMessages([...messages, { id: replyId, role: 'assistant', content: partialReply, stopped: true }]);
    } else {
      const last = messages.at(-1);
      if (last?.role === 'user') {
        setDraft(last.content);
        setMessages(messages.slice(0, -1));
      }
    }
    liveText.clear();
  }

  function send() {
    const content = draft.trim();
    if (
      !content ||
      !connected ||
      pending.current ||
      error ||
      changingConnection.current ||
      changingPlugins.current ||
      messages.at(-1)?.role === 'user'
    )
      return;
    const turns = [...messages, { id: randomUUID(), role: 'user', content }];
    setDraft('');
    setMessages(turns);
    void reply(turns);
  }

  function retry() {
    if (error && messages.at(-1)?.role === 'user') void reply(messages);
  }

  function editFailedMessage() {
    const last = messages.at(-1);
    if (!error || last?.role !== 'user') return;
    setMessages(messages.slice(0, -1));
    setDraft(last.content);
    setFailure(undefined);
  }

  return {
    endpoint,
    connected,
    allowsKeys,
    connectionStatus,
    verification,
    saveConnection,
    saveModel,
    draft,
    setDraft,
    plugins,
    pluginsReady,
    updatePlugins,
    workspaceReady: !!workspace,
    catalog,
    catalogStatus,
    catalogIssue,
    catalogVerified,
    refreshCatalog,
    selectModel,
    model: model && {
      provider: model.provider,
      model: model.model,
      mode: model.mode ?? 'chat',
      baseUrl: model.baseUrl,
      hasKey: !!model.key,
    },
    messages,
    replying,
    replyId,
    liveText,
    error,
    interruptedReply: failure?.partial,
    checkModelSettings: failure?.checkSettings,
    send,
    stop,
    retry,
    editFailedMessage,
    clear,
    chatId,
    recentChats,
    switchChat,
  };
}
