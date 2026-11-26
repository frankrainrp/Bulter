import { memo, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Keyboard, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native-web';

import { BitoText as Text } from './bito/Typography.jsx';
import { BitoGlyph } from './bito/BitoGlyph.jsx';
import { ButlerCharacter } from './chat/ButlerCharacter.jsx';
import { AgentOrb } from './chat/AgentOrb.jsx';
import { WelcomeOrb } from './chat/AgentMark.jsx';
import { ChatDraft } from './chat/ChatDraft.jsx';
import { ImageReveal } from './chat/ImageReveal.jsx';
import { splitReplyImages } from './chat/replyImages.js';
import { OrbReplyReveal } from './chat/OrbReplyReveal.jsx';
import { ReplyContent, splitDesktopReplyImages } from './chat/ReplyContent.jsx';
import { DetroitCorners, IconButton, SourceButton, colors } from './ui.jsx';

const emptyText = () => '';
const noSubscription = () => () => {};

function greeting(hour = new Date().getHours()) {
  if (hour < 6) return 'Late night';
  if (hour < 11) return 'Good morning';
  if (hour < 14) return 'Good noon';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function ChatAction({ label, onPress, disabled = false }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.action, (disabled || pressed) && styles.quiet]}
    >
      <Text numberOfLines={1} ellipsizeMode="middle" style={styles.actionText}>
        {label}
      </Text>
    </Pressable>
  );
}

function ReplyControl({ sending, canSend, onSend, onStop, desktop }) {
  const unavailable = !(sending || canSend);
  return (
    <SourceButton
      testID={desktop ? 'desktop-agent-reply' : 'mobile-agent-reply'}
      accessibilityRole="button"
      accessibilityLabel={sending ? 'Stop' : 'Send'}
      disabled={unavailable}
      onPress={sending ? onStop : onSend}
      selected={!unavailable}
      tab
      visualMinHeight={34}
      style={styles.replyControl}
    >
      {(dark) => {
        const color = dark ? '#FFFFFF' : colors.deep;
        return sending ? (
          <svg width={22} height={22} viewBox="0 0 24 24" aria-hidden>
            <rect x={6} y={6} width={12} height={12} rx={1} fill={color} />
          </svg>
        ) : (
          <BitoGlyph name="send-outline" size={25} color={color} strokeWidth={5} />
        );
      }}
    </SourceButton>
  );
}

function InputPod({ assistant, onSend, onStop, onModels, compact, desktop, focusRequest }) {
  const [focused, setFocused] = useState(false);
  const { connected } = assistant;
  const canSend = connected && !!assistant.draft.trim() && !assistant.replying && !assistant.error;
  return (
    <View
      testID="assistant-composer"
      style={[
        styles.pod,
        desktop && styles.desktopPod,
        compact && styles.compactPod,
        focused && styles.podFocused,
      ]}
    >
      <View style={compact && styles.compactDraft}>
        <ChatDraft
          value={assistant.draft}
          onChange={assistant.setDraft}
          editable={!assistant.replying && !assistant.error}
          placeholder={assistant.model?.mode === 'image' ? 'Describe an image…' : 'Message Agent…'}
          canSend={canSend}
          onSubmit={onSend}
          onFocusChange={setFocused}
          compact={compact}
          focusRequest={desktop ? focusRequest : undefined}
          onStop={desktop && assistant.replying ? onStop : undefined}
        />
      </View>
      <View style={[styles.podToolbar, !compact && styles.desktopToolbar, compact && styles.compactToolbar]}>
        {!compact && (
          <ChatAction
            label={
              assistant.model
                ? (assistant.model.mode === 'image' ? 'Image · ' : '') + assistant.model.model
                : assistant.endpoint
                  ? 'Workspace server'
                  : 'Choose model'
            }
            onPress={onModels}
            disabled={assistant.replying || assistant.connectionStatus === 'loading'}
          />
        )}
        <ReplyControl
          desktop={desktop}
          sending={assistant.replying}
          canSend={canSend}
          onSend={onSend}
          onStop={onStop}
        />
      </View>
      {focused && <DetroitCorners size={8} stroke={1} color={colors.accent} />}
    </View>
  );
}

const MessageBubble = memo(function MessageBubble({
  id,
  desktop,
  user = false,
  content: saved,
  generated,
  liveText,
  stopped = false,
  interrupted = false,
  plugins,
  highlighted,
}) {
  const richReply = Platform.OS === 'web' && !user;
  const stream = richReply ? undefined : liveText;
  const partial = useSyncExternalStore(stream?.subscribe ?? noSubscription, stream?.read ?? emptyText, emptyText);
  const typing = !!liveText;
  const content = typing ? partial : saved;
  const surface = user ? colors.soft : colors.paper;
  const { text, images } = generated?.length
    ? { text: content, images: generated }
    : user || !plugins.images
      ? { text: content, images: [] }
      : richReply
        ? splitDesktopReplyImages(content)
        : splitReplyImages(content);
  const state =
    stopped || interrupted
      ? 'breathing'
      : !typing
        ? 'working'
        : images.length
          ? 'shaping'
          : content
            ? 'composing'
            : 'solving';
  const label = interrupted
    ? 'Incomplete reply'
    : stopped
      ? 'Stopped'
      : !typing
        ? 'Agent replied'
        : images.length
          ? 'Sharing images'
          : content
            ? 'Replying'
            : 'Thinking';
  const replyBody = (
    <>
      {!!text &&
        (richReply ? (
          <ReplyContent content={text} />
        ) : (
          <Text selectable style={styles.message}>
            {text}
          </Text>
        ))}
      {images.length > 0 && <ImageReveal images={images} animate={plugins.imageMotion} />}
      {stopped && <Text style={styles.messageStatus}>Stopped</Text>}
      {interrupted && <Text style={styles.messageStatus}>Partial reply</Text>}
    </>
  );
  if (richReply)
    return (
      <View
        nativeID={`chat-message-${id}`}
        tabIndex={highlighted ? -1 : undefined}
        style={[styles.desktopAnswer, highlighted && styles.foundMessage]}
      >
        <OrbReplyReveal
          id={id}
          waitForContent={!!text}
          phase={stopped || interrupted ? 'interrupted' : typing ? 'pending' : 'complete'}
        >
          {replyBody}
        </OrbReplyReveal>
      </View>
    );

  return (
    <View
      nativeID={`chat-message-${id}`}
      tabIndex={highlighted ? -1 : undefined}
      style={[
        styles.bubble,
        user && styles.userBubble,
        images.length > 0 && styles.imageBubble,
        { backgroundColor: surface },
        highlighted && styles.foundMessage,
      ]}
    >
      <View style={[styles.tail, user && styles.userTail]} pointerEvents="none" aria-hidden>
        <svg width={12} height={16} viewBox="0 0 12 16" aria-hidden>
          <polygon points={user ? '0,0 12,8 0,16' : '12,0 0,8 12,16'} fill={surface} />
        </svg>
      </View>
      {!user && <AgentOrb state={state} label={label} size={typing ? 40 : 22} animate={typing} />}
      {replyBody}
    </View>
  );
});

function ChatCharacter({ replying, liveText }) {
  const hasText = useSyncExternalStore(
    liveText.subscribe,
    () => !!liveText.read(),
    () => false
  );
  return <ButlerCharacter thinking={replying && !hasText} />;
}

export function AssistantChat({ assistant, onSettings, onModels, keyboardOpen, desktop, searchMessage }) {
  const scroll = useRef(null);
  const follow = useRef(true);
  const { messages, replying, replyId, error, liveText } = assistant;
  const active = messages.length > 0;
  const partial = Platform.OS === 'web' ? assistant.interruptedReply : undefined;
  const thread = replying
    ? [...messages, { id: replyId, role: 'assistant', content: '' }]
    : partial
      ? [...messages, partial]
      : messages;
  const [highlighted, setHighlighted] = useState('');
  const [focusRequest, setFocusRequest] = useState(0);
  const [readingEarlier, setReadingEarlier] = useState(false);
  const firstMessageId = messages[0]?.id;
  useEffect(() => {
    follow.current = true;
    setReadingEarlier(false);
  }, [firstMessageId]);

  useEffect(() => {
    if (!desktop || !searchMessage) return;
    const element = document.getElementById(`chat-message-${searchMessage.id}`);
    if (!element) return;
    follow.current = false;
    setHighlighted(searchMessage.id);
    const frame = requestAnimationFrame(() => {
      element.focus({ preventScroll: true });
      element.scrollIntoView({ block: 'center', behavior: 'instant' });
    });
    const timer = setTimeout(() => setHighlighted(''), 2000);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [desktop, searchMessage]);

  useEffect(() => {
    if (!active || !keyboardOpen || !follow.current) return;
    const frame = requestAnimationFrame(() => scroll.current?.scrollToEnd({ animated: false }));
    return () => cancelAnimationFrame(frame);
  }, [active, keyboardOpen]);

  function runChatAction(action) {
    action();
    if (desktop) setFocusRequest((value) => value + 1);
  }

  function send() {
    if (!desktop) Keyboard.dismiss();
    follow.current = true;
    runChatAction(assistant.send);
  }

  function jumpToLatest() {
    follow.current = true;
    setReadingEarlier(false);
    const latest = thread.at(-1);
    const bubble = latest && document.getElementById('chat-message-' + latest.id);
    if (bubble) {
      bubble.tabIndex = -1;
      bubble.focus({ preventScroll: true });
    }
    scroll.current?.scrollToEnd({ animated: false });
  }

  const composer = (
    <View style={[styles.dock, desktop && styles.desktopDock, keyboardOpen && styles.compactDock]}>
      {desktop && active && readingEarlier && (
        <View style={styles.latestAction}>
          <Pressable
            accessibilityRole="button"
            onPress={jumpToLatest}
            style={({ pressed }) => [styles.latestButton, pressed && styles.quiet]}
          >
            <Text style={styles.latestText}>Jump to latest</Text>
          </Pressable>
        </View>
      )}
      <InputPod
        assistant={assistant}
        onSend={send}
        onStop={() => runChatAction(assistant.stop)}
        onModels={onModels}
        compact={keyboardOpen}
        desktop={desktop}
        focusRequest={focusRequest}
      />
      {assistant.connectionStatus === 'error' && (
        <Text style={styles.disclaimer}>Open Settings to restore your model connection.</Text>
      )}
    </View>
  );

  return (
    <View style={styles.chat}>
      {!desktop && (
        <View style={styles.chatHeader}>
          <IconButton label="Settings" icon="menu-outline" onPress={onSettings} />
          {active ? (
            <IconButton
              label="New conversation"
              icon="create-outline"
              onPress={assistant.clear}
              disabled={replying}
            />
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>
      )}
      {!desktop && (
        <View pointerEvents="none" aria-hidden style={styles.character}>
          <ChatCharacter replying={replying} liveText={liveText} />
        </View>
      )}
      {active ? (
        <ScrollView
          key={desktop ? 'desktop-transcript' : undefined}
          ref={scroll}
          style={styles.transcript}
          contentContainerStyle={[styles.messages, desktop && styles.desktopMessages]}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={desktop ? 1 : 32}
          onScroll={({ nativeEvent }) => {
            const distance =
              nativeEvent.contentSize.height - nativeEvent.layoutMeasurement.height - nativeEvent.contentOffset.y;
            const atEnd = distance < (desktop ? 2 : 80);
            if (desktop) setReadingEarlier(!atEnd);
            follow.current = atEnd;
          }}
          onContentSizeChange={() => {
            if (!follow.current) return;
            if (desktop && thread.at(-1)?.role === 'assistant') {
              const element = document.getElementById('chat-message-' + thread.at(-1).id);
              const pane = scroll.current?.getScrollableNode();
              if (element && pane && element.offsetHeight > pane.clientHeight) {
                element.scrollIntoView({ block: 'start', behavior: 'instant' });
                return;
              }
            }
            scroll.current?.scrollToEnd({ animated: false });
          }}
        >
          {thread.map((message) => (
            <MessageBubble
              key={message.id}
              id={message.id}
              desktop={desktop}
              highlighted={desktop && message.id === highlighted}
              user={message.role === 'user'}
              content={message.content}
              generated={message.images}
              stopped={message.stopped}
              interrupted={message.id === partial?.id}
              liveText={replying && message.id === replyId ? liveText : undefined}
              plugins={assistant.plugins}
            />
          ))}
          {!!error && (
            <View style={styles.error}>
              <View style={styles.speakerRow}>
                <AgentOrb state="breathing" size={20} />
                <Text accessibilityRole="alert" style={styles.errorText}>
                  {error}
                </Text>
              </View>
              <View style={styles.actions}>
                <ChatAction label="Retry" onPress={() => runChatAction(assistant.retry)} />
                <ChatAction label="Edit message" onPress={() => runChatAction(assistant.editFailedMessage)} />
                {assistant.checkModelSettings && <ChatAction label="Open Models" onPress={onModels} />}
              </View>
            </View>
          )}
        </ScrollView>
      ) : desktop ? (
        <ScrollView
          style={styles.transcript}
          contentContainerStyle={styles.desktopWelcome}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.desktopHero}>
            {assistant.connectionStatus === 'loading' ? (
              <AgentOrb state="connecting" label="Loading connection" size={152} animate />
            ) : (
              <WelcomeOrb size={128} />
            )}
          </View>
          {composer}
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.transcript}
          contentContainerStyle={styles.welcomeScroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.welcome}>
            <View>
              <View style={styles.welcomeOrb}>
                <AgentOrb
                  state={assistant.connectionStatus === 'loading' ? 'connecting' : 'breathing'}
                  label={assistant.connectionStatus === 'loading' ? 'Loading connection' : 'Agent idle'}
                  size={keyboardOpen ? 46 : 76}
                  animate
                />
              </View>
              <Text accessibilityRole="header" style={styles.greeting}>
                {greeting()}
              </Text>
              <Text style={styles.subtitle}>How can I help?</Text>
            </View>
          </View>
        </ScrollView>
      )}
      {(!desktop || active) && composer}
    </View>
  );
}

const styles = StyleSheet.create({
  chat: { flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 9,
    zIndex: 3,
  },
  headerSpacer: { width: 44 },
  character: { position: 'absolute', zIndex: 1, bottom: 0, left: 0, right: 0, alignItems: 'center' },
  transcript: { flex: 1, zIndex: 2 },
  welcomeScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  welcome: { width: '100%', maxWidth: 720, paddingVertical: 12, gap: 22 },
  welcomeOrb: { alignSelf: 'center', marginBottom: 14 },
  greeting: {
    textAlign: 'center',
    fontSize: 27,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: colors.ink,
  },
  subtitle: { textAlign: 'center', fontSize: 14, lineHeight: 21, color: colors.muted, marginTop: 8 },
  pod: { backgroundColor: colors.paper, borderRadius: 14, minWidth: 0 },
  compactPod: { flexDirection: 'row', alignItems: 'flex-end' },
  compactDraft: { flex: 1, minWidth: 0 },
  podFocused: { backgroundColor: '#FFFFFF' },
  podToolbar: { alignItems: 'flex-end', paddingTop: 4, paddingHorizontal: 12, paddingBottom: 10 },
  compactToolbar: { paddingTop: 0, paddingHorizontal: 7, paddingBottom: 5 },
  desktopWelcome: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
    paddingHorizontal: 28,
    paddingVertical: 24,
  },
  desktopHero: { flexGrow: 1, minHeight: 144, justifyContent: 'center', alignItems: 'center' },
  desktopDock: { width: '100%', maxWidth: 800, alignSelf: 'center', paddingHorizontal: 24, paddingVertical: 16 },
  latestAction: { position: 'absolute', top: -42, right: 24, zIndex: 3 },
  latestButton: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: colors.ink,
    borderRadius: 18,
  },
  latestText: { color: colors.paper, fontSize: 13, fontWeight: '700' },
  desktopMessages: { paddingHorizontal: 32, paddingVertical: 24 },
  desktopAnswer: {
    alignSelf: 'flex-start',
    width: '100%',
    maxWidth: 780,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: colors.paper,
  },
  desktopPod: { borderRadius: 14, paddingTop: 8, backgroundColor: '#E9EEF0' },
  desktopToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 12,
  },
  foundMessage: { backgroundColor: '#C8E3F4' },
  action: { minHeight: 40, minWidth: 0, flexShrink: 1, paddingHorizontal: 6, justifyContent: 'center' },
  actionText: { fontSize: 13, fontWeight: '700', color: colors.accent },
  replyControl: { width: 68, height: 64, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  quiet: { opacity: 0.52 },
  disclaimer: { textAlign: 'center', fontSize: 11, lineHeight: 15, color: colors.muted },
  dock: { paddingTop: 8, paddingHorizontal: 10, paddingBottom: 10, gap: 6, zIndex: 2 },
  compactDock: { paddingTop: 5, paddingBottom: 5 },
  messages: { paddingTop: 14, paddingHorizontal: 15, paddingBottom: 10, gap: 16 },
  bubble: {
    maxWidth: '90%',
    alignSelf: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    gap: 4,
  },
  userBubble: { maxWidth: '80%', alignSelf: 'flex-end', paddingVertical: 10, paddingHorizontal: 14 },
  imageBubble: { width: '90%' },
  tail: { position: 'absolute', bottom: 16, left: -10 },
  userTail: { right: -10, left: 'auto', bottom: 14 },
  speakerRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  message: { color: colors.ink, fontSize: 14, lineHeight: 23 },
  messageStatus: { color: colors.muted, fontSize: 11, lineHeight: 15 },
  error: { maxWidth: '90%', backgroundColor: colors.dangerSoft, borderRadius: 14, padding: 10 },
  errorText: { flexShrink: 1, color: colors.danger, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 9 },
});
