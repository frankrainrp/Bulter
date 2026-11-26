import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native-web';
import { BitoText as Text } from './bito/Typography.jsx';
import { modelProviders, needsModelBaseUrl } from './assistant.js';
import { Button, Choices, Field, Icon, IconButton, PageTitle, colors, s } from './ui.jsx';
import { AssistantChat } from './AssistantChat.jsx';
import { AgentOrb } from './chat/AgentOrb.jsx';
import { useAgentMark } from './chat/AgentMark.jsx';
import { orbOptions } from './chat/orbChoices.js';

import { supportsWorkspaceTool, workspaceTools } from './chat/workspaceTools.js';

import { ProviderModelPicker } from './chat/ProviderModelPicker.jsx';

import { supportsImageGeneration } from './chat/generateImage.js';

const butlerOption = { value: 'butler', label: 'Workspace server' };

function Connection({ assistant, onClose, onUse, onBusy }) {
  const [provider, setProvider] = useState(
    assistant.model?.provider ?? (assistant.endpoint ? 'butler' : 'openai')
  );
  const [value, setValue] = useState(assistant.endpoint);
  const [model, setModel] = useState(assistant.model?.model ?? '');
  const [baseUrl, setBaseUrl] = useState(assistant.model?.baseUrl ?? '');
  const [key, setKey] = useState('');
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [customModel, setCustomModel] = useState(false);
  const [manualMode, setManualMode] = useState(assistant.model?.mode ?? 'chat');
  const [replaceKey, setReplaceKey] = useState(false);
  const [unknownModels, setUnknownModels] = useState([]);
  const [operation, setOperation] = useState();
  const saving = Boolean(operation);
  const [error, setError] = useState('');
  const customBase = provider !== 'butler' && needsModelBaseUrl(provider);
  const retainedKey =
    assistant.model?.hasKey && provider === assistant.model.provider && baseUrl.trim() === assistant.model.baseUrl;
  const checksKey = provider !== 'butler' && Boolean(key.trim() || retainedKey);
  const savedAccount = provider === assistant.model?.provider && baseUrl.trim() === assistant.model.baseUrl;
  const showModels = savedAccount && !replaceKey && !customModel;
  const savedProvider = assistant.model
    ? modelProviders.find(({ value }) => value === assistant.model?.provider)?.label
    : assistant.endpoint
      ? butlerOption.label
      : undefined;
  const providerLabel =
    provider === 'butler' ? butlerOption.label : modelProviders.find(({ value }) => value === provider)?.label;
  const status =
    assistant.connectionStatus === 'error'
      ? 'Couldn’t open the saved connection.'
      : !assistant.connected
        ? 'No model connection saved.'
        : assistant.replying
          ? 'Checking the saved connection…'
          : assistant.verification === 'verified'
            ? 'The saved connection replied successfully.'
            : assistant.verification === 'failed'
              ? 'The last request failed. Check the chat error or update this connection.'
              : assistant.catalogVerified
                ? 'Provider catalogue loaded. Choose a model for your next message.'
                : 'Connection saved. Send a message to verify it.';
  const active = useRef(true);
  const openedCatalog = useRef(false);
  useEffect(() => {
    if (!showModels || openedCatalog.current || assistant.catalogStatus !== 'idle') return;
    openedCatalog.current = true;
    void assistant.refreshCatalog();
  }, [showModels, assistant.catalogStatus, assistant.refreshCatalog]);
  useEffect(() => {
    active.current = true;
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!saving) onClose();
      return true;
    });
    return () => {
      active.current = false;
      back.remove();
    };
  }, [onClose, saving]);

  async function save(action, next = 'settings', verify = false) {
    setOperation(verify ? 'verify' : 'save');
    onBusy(true);
    setError('');
    const issue = await action();
    if (!active.current) return;
    onBusy(false);
    setOperation(undefined);
    if (issue) setError(issue);
    else if (next === 'catalogue') {
      setKey('');
      setReplaceKey(false);
      setCustomModel(false);
    } else if (next === 'chat') onUse();
    else onClose();
  }

  function saveSelection() {
    setOptionsOpen(false);
    if (provider === 'butler') {
      void save(() => assistant.saveConnection(value.trim()));
      return;
    }
    void save(
      () =>
        assistant.saveModel(
          { provider, model: customModel ? model : '', mode: manualMode, baseUrl: customBase ? baseUrl : '', key },
          customModel,
          setUnknownModels
        ),
      customModel ? 'chat' : 'catalogue',
      !customModel
    );
  }

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <PageTitle
          title="Models"
          action={<IconButton label="Back to settings" icon="chevron-back" onPress={onClose} disabled={saving} />}
        />
        <View style={styles.form}>
          <View style={[s.row, styles.providerRow]}>
            <View style={s.grow}>
              <Text style={s.itemTitle}>{providerLabel}</Text>
              <Text accessibilityLiveRegion="polite" style={s.subtitle}>
                {operation === 'verify'
                  ? 'Checking your API key…'
                  : savedProvider && savedProvider !== providerLabel
                    ? `${savedProvider}: ${status}`
                    : status}
              </Text>
            </View>
            <IconButton
              label={optionsOpen ? 'Hide connection options' : 'Change provider'}
              icon={optionsOpen ? 'chevron-up' : 'chevron-down'}
              onPress={() => setOptionsOpen(!optionsOpen)}
              disabled={saving}
            />
          </View>
          {optionsOpen && (
            <View style={styles.form}>
              <Choices
                label="Provider"
                current={provider}
                options={[...modelProviders, butlerOption]}
                onChange={(next) => {
                  setOptionsOpen(false);
                  if (next === provider) return;
                  setProvider(next);
                  setUnknownModels([]);
                  setKey('');
                  setCustomModel(false);
                  setReplaceKey(false);
                  setManualMode('chat');
                  setModel(next === assistant.model?.provider ? assistant.model.model : '');
                  setBaseUrl(next === assistant.model?.provider ? assistant.model.baseUrl : '');
                  setError('');
                }}
              />
            </View>
          )}
          {provider === 'butler' ? (
            <View style={s.field}>
              <Field
                label="Server URL"
                value={value}
                onChangeText={(text) => {
                  setValue(text);
                  setError('');
                }}
                placeholder="https://agent.example.org"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                maxLength={300}
                editable={!saving}
              />
              <Text style={s.subtitle}>Use your server’s HTTPS domain. The app adds /api/chat for you.</Text>
              <Text style={s.subtitle}>
                {assistant.allowsKeys
                  ? 'For a model API key, select its provider above.'
                  : 'For a model API key, open this page on localhost or HTTPS and select its provider.'}
              </Text>
            </View>
          ) : (
            <>
              {customBase && (
                <Field
                  label="Base URL"
                  value={baseUrl}
                  onChangeText={(text) => {
                    setBaseUrl(text);
                    setError('');
                    setUnknownModels([]);
                  }}
                  placeholder={
                    provider === 'qwen' ? 'Your Model Studio workspace URL' : 'https://your-server.example/v1'
                  }
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  maxLength={300}
                  editable={!saving}
                />
              )}
              {showModels && (
                <ProviderModelPicker
                  key={provider}
                  assistant={assistant}
                  busy={saving || assistant.replying}
                  onSelect={(id, mode) => void save(() => assistant.selectModel(id, mode), 'chat')}
                />
              )}
              {unknownModels.length > 0 && !customModel && !showModels && (
                <ProviderModelPicker
                  busy={saving}
                  unclassified
                  assistant={{
                    model: { provider, baseUrl, model: '', mode: 'chat', hasKey: Boolean(key) },
                    catalog: unknownModels,
                    catalogStatus: 'ready',
                    catalogIssue: '',
                    refreshCatalog: assistant.refreshCatalog,
                  }}
                  onSelect={(id, mode) =>
                    void save(() => assistant.saveModel({ provider, baseUrl, key, model: id, mode }, true), 'chat')
                  }
                />
              )}
              {(!savedAccount || replaceKey) &&
                (assistant.allowsKeys ? (
                  <Field
                    label="API key"
                    value={key}
                    onChangeText={(text) => {
                      setKey(text);
                      setError('');
                      setUnknownModels([]);
                    }}
                    placeholder={
                      retainedKey ? 'Keep current key' : provider === 'custom' ? 'Optional' : 'Paste your API key'
                    }
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={512}
                    editable={!saving}
                  />
                ) : (
                  provider !== 'custom' && (
                    <Text style={s.subtitle}>
                      Enter your API key in the Android app, desktop preview, or an HTTPS page.
                    </Text>
                  )
                ))}
              {customModel && supportsImageGeneration(provider) && (
                <Choices
                  label="Model purpose"
                  current={manualMode}
                  onChange={setManualMode}
                  options={[
                    { value: 'chat', label: 'Chat' },
                    { value: 'image', label: 'Create image' },
                  ]}
                />
              )}
              {customModel && (
                <Field
                  label="Model ID"
                  value={model}
                  onChangeText={(text) => {
                    setModel(text);
                    setError('');
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={150}
                  editable={!saving}
                />
              )}
            </>
          )}
          {assistant.connected && (!savedAccount || replaceKey) && (
            <Text style={s.subtitle}>Changing the provider or key clears this conversation.</Text>
          )}
          {!!error && (
            <Text accessibilityRole="alert" style={s.error}>
              {error}
            </Text>
          )}
          <View style={[s.row, s.wrap]}>
            {showModels ? (
              <Button label="Back to chat" onPress={onUse} disabled={saving} />
            ) : (
              <Button
                label={provider === 'butler' ? 'Save connection' : customModel ? 'Save model ID' : 'Connect'}
                onPress={saveSelection}
                disabled={
                  saving ||
                  assistant.replying ||
                  assistant.connectionStatus === 'loading' ||
                  (provider === 'butler'
                    ? !value.trim()
                    : (customModel && !model.trim()) ||
                      (customBase && !baseUrl.trim()) ||
                      (provider !== 'custom' && (!assistant.allowsKeys || !checksKey)))
                }
              />
            )}
            {provider !== 'butler' && !customModel && (
              <Button
                label="Enter model ID"
                secondary
                disabled={saving}
                onPress={() => {
                  setCustomModel(true);
                  setModel(assistant.model?.provider === provider ? assistant.model.model : '');
                  setError('');
                }}
              />
            )}
            {provider !== 'butler' && customModel && (
              <Button
                label="Use model catalogue"
                secondary
                disabled={saving}
                onPress={() => {
                  setCustomModel(false);
                  setError('');
                }}
              />
            )}
            {showModels && (
              <Button
                label="Replace key"
                secondary
                disabled={saving}
                onPress={() => {
                  setReplaceKey(true);
                  setError('');
                }}
              />
            )}
            {(assistant.connected || assistant.connectionStatus === 'error') && (
              <Button
                label={assistant.connected ? 'Disconnect' : 'Clear saved connection'}
                danger
                disabled={saving || assistant.replying}
                onPress={() => void save(() => assistant.saveConnection(''))}
              />
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PluginSettings({ assistant, onBack }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { plugins, pluginsReady, updatePlugins } = assistant;
  const connection = assistant.model ? 'model' : assistant.endpoint ? 'server' : 'none';
  const imageMode = assistant.model?.mode === 'image';
  const options = [
    { id: 'images', label: 'Reply images', hint: 'Show images linked in assistant replies.' },
    { id: 'imageMotion', label: 'Four-point reveal', hint: 'Animate the four corners when a reply image loads.' },
  ];

  async function change(id, value) {
    setSaving(true);
    const error = await updatePlugins({ ...plugins, [id]: value });
    setError(error ?? '');
    setSaving(false);
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <PageTitle
        title="Plugins"
        action={<IconButton label="Back to settings" icon="chevron-back" onPress={onBack} />}
      />
      <View style={styles.form}>
        <Text accessibilityRole="header" style={s.itemTitle}>
          Workspace tools
        </Text>
        <Text style={s.subtitle}>
          {connection === 'none'
            ? 'Connect a model in Models to enable workspace access.'
            : connection === 'server'
              ? 'This client can answer task-list requests from the workspace server. Other searches require a direct model connection.'
              : imageMode
                ? 'Image generation uses your description. Select a chat model to use workspace tools.'
                : 'The connected chat model can call enabled tools. Dashboard layout controls cards. The other tools share matching workspace records.'}
        </Text>
        {workspaceTools.map((tool) => {
          const available =
            assistant.workspaceReady &&
            !imageMode &&
            supportsWorkspaceTool(connection, tool.name) &&
            (tool.name !== 'customize_dashboard' || Platform.OS === 'web');
          const status = !available ? 'Unavailable' : plugins[tool.name] ? 'Enabled' : 'Off';
          return (
            <View key={tool.name} style={styles.pluginRow}>
              <View style={s.grow}>
                <Text style={s.itemTitle}>{tool.label}</Text>
                <Text style={s.subtitle}>
                  {tool.name} · {status}
                </Text>
                <Text style={s.subtitle}>{tool.hint}</Text>
              </View>
              <Switch
                accessibilityLabel={tool.label}
                value={available && plugins[tool.name]}
                disabled={!available || !pluginsReady || saving || assistant.replying}
                trackColor={{ false: colors.border, true: colors.accent }}
                onValueChange={(value) => void change(tool.name, value)}
              />
            </View>
          );
        })}
        <Text accessibilityRole="header" style={s.itemTitle}>
          Reply display
        </Text>
        {options.map(({ id, label, hint }) => (
          <View key={id} style={styles.pluginRow}>
            <View style={s.grow}>
              <Text style={s.itemTitle}>{label}</Text>
              <Text style={s.subtitle}>{hint}</Text>
            </View>
            <Switch
              accessibilityLabel={label}
              value={plugins[id]}
              disabled={!pluginsReady || saving || (id === 'imageMotion' && !plugins.images)}
              trackColor={{ false: colors.border, true: colors.accent }}
              onValueChange={(value) => void change(id, value)}
            />
          </View>
        ))}
        {!!error && (
          <Text accessibilityRole="alert" style={s.error}>
            {error}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

function AgentIcons({ onBack, desktop }) {
  const { shape, choose, warning } = useAgentMark();
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <PageTitle
        title="Agent Icons"
        action={<IconButton label="Back to settings" icon="chevron-back" onPress={onBack} />}
      />
      <View style={styles.preview}>
        <AgentOrb
          state={shape}
          label={orbOptions.find(({ value }) => value === shape)?.label}
          size={110}
          animate
        />
      </View>
      <Choices
        label={desktop ? 'Welcome orb' : 'Thinking Orbs'}
        options={orbOptions}
        current={shape}
        onChange={choose}
      />
      {!!warning && (
        <Text accessibilityRole="alert" style={s.subtitle}>
          {warning}
        </Text>
      )}
    </ScrollView>
  );
}

function SettingsPanel({ page, assistant, setPage, backToSettings, onBusy, desktop }) {
  if (page === 'models') {
    if (assistant.connectionStatus === 'loading') {
      return (
        <View style={[s.screen, s.content]}>
          <PageTitle
            title="Models"
            action={<IconButton label="Back to settings" icon="chevron-back" onPress={backToSettings} />}
          />
          <ActivityIndicator accessibilityLabel="Loading saved connection" color={colors.accent} />
        </View>
      );
    }
    return (
      <Connection
        assistant={assistant}
        onClose={backToSettings}
        onUse={() => setPage(undefined)}
        onBusy={onBusy}
      />
    );
  }
  if (page === 'plugins') return <PluginSettings assistant={assistant} onBack={backToSettings} />;
  if (page === 'icons') return <AgentIcons onBack={backToSettings} desktop={desktop} />;
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <PageTitle
        title="Settings"
        action={<IconButton label="Back to chat" icon="chevron-back" onPress={() => setPage(undefined)} />}
      />
      <View style={[styles.form, styles.settingsMenu]}>
        <Button label="Models" icon="options-outline" secondary onPress={() => setPage('models')} />
        <Button label="Plugins" icon="extension-puzzle-outline" secondary onPress={() => setPage('plugins')} />
        <Button label="Agent Icons" icon="shapes-outline" secondary onPress={() => setPage('icons')} />
      </View>
    </ScrollView>
  );
}

export function AssistantScreen({ assistant, keyboardOpen, desktop = false, searchMessageId }) {
  const [page, setPage] = useState();
  const [busy, setBusy] = useState(false);
  const [searchMessage, setSearchMessage] = useState();
  const lastSearch = useRef(undefined);
  const backToSettings = useCallback(() => setPage('settings'), []);

  useEffect(() => {
    if (!desktop || busy || !searchMessageId || lastSearch.current === searchMessageId) return;
    lastSearch.current = searchMessageId;
    setPage(undefined);
    setSearchMessage(searchMessageId);
  }, [desktop, busy, searchMessageId]);

  useEffect(() => {
    if (!page || (page === 'models' && assistant.connectionStatus !== 'loading')) return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      setPage(page === 'settings' ? undefined : 'settings');
      return true;
    });
    return () => back.remove();
  }, [assistant.connectionStatus, page]);

  function openPage(next) {
    setSearchMessage(undefined);
    setPage(next);
  }

  function selectChat(id) {
    assistant.switchChat(id);
    openPage();
  }

  const content = page ? (
    <SettingsPanel
      page={page}
      assistant={assistant}
      setPage={openPage}
      backToSettings={backToSettings}
      onBusy={setBusy}
      desktop={desktop}
    />
  ) : (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AssistantChat
        key={desktop ? assistant.chatId : 'mobile'}
        assistant={assistant}
        onSettings={() => openPage('settings')}
        onModels={() => openPage('models')}
        keyboardOpen={keyboardOpen}
        desktop={desktop}
        searchMessage={searchMessage}
      />
    </KeyboardAvoidingView>
  );

  if (!desktop) return content;

  return (
    <View testID="desktop-agent" style={styles.workspace}>
      <View style={styles.rail}>
        <Button label="New chat" icon="add" onPress={() => selectChat()} disabled={busy || assistant.replying} />
        <Text accessibilityRole="header" style={styles.railHeading}>
          Recent chats
        </Text>
        <ScrollView style={styles.recent} keyboardShouldPersistTaps="handled">
          {assistant.recentChats.length === 0 && <Text style={styles.railEmpty}>No recent chats</Text>}
          {assistant.recentChats.map((chat) => {
            const current = !page && chat.id === assistant.chatId;
            return (
              <Pressable
                key={chat.id}
                accessibilityRole="button"
                accessibilityLabel={chat.title}
                aria-current={current ? 'page' : undefined}
                disabled={busy || assistant.replying}
                onPress={() => selectChat(chat.id)}
                style={({ pressed }) => [styles.sessionRow, current && styles.currentSession, pressed && s.dim]}
              >
                <Icon
                  name="chatbubble-ellipses-outline"
                  size={16}
                  color={current ? colors.accent : colors.muted}
                />
                <Text numberOfLines={1} style={styles.sessionText}>
                  {chat.title}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Button
          label="Settings"
          icon="options-outline"
          secondary
          onPress={() => openPage('settings')}
          disabled={busy}
        />
      </View>
      <View style={styles.canvas}>{content}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 14 },
  workspace: { flex: 1, flexDirection: 'row', gap: 12, minWidth: 0, minHeight: 0 },
  rail: {
    width: 220,
    flexShrink: 0,
    minHeight: 0,
    gap: 6,
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(250,250,250,.84)',
  },
  canvas: { flex: 1, minHeight: 0, minWidth: 0 },
  recent: { flex: 1 },
  railHeading: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: colors.muted,
    marginTop: 14,
    paddingHorizontal: 7,
  },
  railEmpty: { fontSize: 13, lineHeight: 20, color: colors.muted, paddingVertical: 10, paddingHorizontal: 7 },
  sessionRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 7 },
  sessionText: { flex: 1, color: colors.ink, fontSize: 14 },
  currentSession: { backgroundColor: colors.soft },
  providerRow: { gap: 8, justifyContent: 'space-between' },
  settingsMenu: { alignItems: 'flex-start' },
  pluginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 70,
    paddingHorizontal: 12,
    backgroundColor: colors.paper,
  },
  preview: { alignItems: 'center', paddingVertical: 18, marginBottom: 12 },
});
