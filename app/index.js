import {
  ActivityIndicator,
  Alert,
  AppState,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AuthCard } from '../src/components/AuthCard';
import { deleteReminder, getReminders, sendChatMessage, updateReminder } from '../src/api/client';
import { useAuth } from '../src/context/AuthContext';
import { useTheme } from '../src/context/ThemeContext';
import {
  cancelReminderAlarm,
  rescheduleReminderAlarm,
  scheduleReminderAlarm,
  syncReminderAlarms,
} from '../src/services/alarmService';

const DRAWER_WIDTH = 304;
const CHAT_MAX_LENGTH = 700;
const LOCAL_ALARM_CHANNEL = 'LOCAL_ALARM';
const PENDING_STATUS = 'PENDING';

const initialAssistantMessage = {
  id: 'welcome',
  sender: 'assistant',
  text: 'Salut. Spune-mi natural ce vrei sa nu uiti, iar eu il transform intr-o recurenta sau intr-un reminder simplu.',
};

const quickPrompts = [
  'Aminteste-mi lunar sa achit chiria pe data de 1.',
  'In fiecare vineri la 18:00 sa imi reamintesti de raport.',
  'Pe 23 august 2027 la ora 10:00 este ziua lui Cristi. Aminteste-mi anual.',
];

function formatReminderDate(value) {
  if (!value) return 'Fara data';
  try {
    return new Intl.DateTimeFormat('ro-RO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function recurrenceLabel(value) {
  const labels = {
    NONE: 'O singura data',
    DAILY: 'Zilnic',
    WEEKLY: 'Saptamanal',
    MONTHLY: 'Lunar',
    YEARLY: 'Anual',
  };

  return labels[value] || value || 'Recurenta';
}

function channelLabel(value) {
  const labels = {
    EMAIL: 'Email',
    PUSH: 'Push',
    SMS: 'SMS',
    IN_APP: 'In app',
    LOCAL_ALARM: 'Alarma locala',
  };

  return labels[value] || value || 'In app';
}

function isLocalAlarm(reminder) {
  return reminder?.preferredChannel === LOCAL_ALARM_CHANNEL;
}

function pendingReminders(reminders = []) {
  return reminders.filter((reminder) => reminder?.status === PENDING_STATUS);
}

export default function ChatHomeScreen() {
  const { colors, colorScheme, toggleTheme } = useTheme();
  const { accessToken, isAuthenticated, user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeView, setActiveView] = useState('chat');
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([initialAssistantMessage]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const recurringReminders = useMemo(() => {
    return reminders.filter((item) => item.recurrenceType && item.recurrenceType !== 'NONE');
  }, [reminders]);

  const oneTimeReminders = useMemo(() => {
    return reminders.filter((item) => !item.recurrenceType || item.recurrenceType === 'NONE');
  }, [reminders]);

  useEffect(() => {
    if (isAuthenticated) {
      loadReminders();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        loadReminders();
      }
    });

    return () => subscription.remove();
  }, [isAuthenticated, accessToken]);

  async function loadReminders() {
    if (!accessToken) return;
    setRemindersLoading(true);
    try {
      const data = await getReminders(accessToken);
      const nextReminders = data || [];
      setReminders(nextReminders);
      await syncReminderAlarms(pendingReminders(nextReminders));
      if (selectedReminder) {
        const freshSelection = nextReminders.find((item) => item.id === selectedReminder.id);
        if (freshSelection) {
          setSelectedReminder(freshSelection);
          setEditDraft({ ...freshSelection });
        }
      }
    } catch (exception) {
      setError(exception.message);
    } finally {
      setRemindersLoading(false);
    }
  }

  async function submit() {
    const trimmedMessage = message.trim();

    if (!trimmedMessage || !accessToken || loading) {
      return;
    }

    const userMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: trimmedMessage,
    };

    setMessages((current) => [...current, userMessage]);
    setMessage('');
    setError(null);
    setLoading(true);

    try {
      const response = await sendChatMessage(accessToken, conversationId, trimmedMessage);
      setConversationId(response.conversationId);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          sender: 'assistant',
          text: response.assistantMessage,
          type: response.type,
          reminder: response.reminder,
        },
      ]);
      if (response.reminder) {
        if (response.type === 'REMINDER_CREATED') {
          await scheduleReminderAlarm(response.reminder);
        }
        await loadReminders();
      }
    } catch (exception) {
      setError(exception.message);
      setMessages((current) => [
        ...current,
        {
          id: `error-${Date.now()}`,
          sender: 'assistant',
          text: 'Nu am putut procesa mesajul. Verifica backend-ul si incearca din nou.',
          type: 'ERROR',
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 60);
    }
  }

  function openView(view) {
    setActiveView(view);
    setDrawerOpen(false);
    if (view !== 'recurrences') {
      setEditorOpen(false);
    }
    if (view === 'recurrences') {
      loadReminders();
    }
  }

  function startNewConversation(prefill = '') {
    setActiveView('chat');
    setConversationId(null);
    setMessages([initialAssistantMessage]);
    setMessage(prefill);
    setError(null);
    setEditorOpen(false);
    setDrawerOpen(false);
  }

  function createNewRecurrence() {
    startNewConversation('Vreau sa creez o recurenta pentru ');
  }

  function openReminder(reminder) {
    setActiveView('recurrences');
    setSelectedReminder(reminder);
    setEditDraft({ ...reminder });
    setEditorOpen(true);
    setDrawerOpen(false);
  }

  async function saveReminder() {
    if (!editDraft || !accessToken) return;
    try {
      const saved = await updateReminder(accessToken, editDraft);
      setSelectedReminder(saved);
      setEditDraft({ ...saved });
      await rescheduleReminderAlarm(saved);
      await loadReminders();
      setEditorOpen(false);
    } catch (exception) {
      Alert.alert('Nu am putut salva recurenta', exception.message);
    }
  }

  async function removeReminder(reminder = selectedReminder) {
    if (!reminder || !accessToken) return;
    Alert.alert('Stergi recurenta?', 'Aceasta actiune va sterge reminderul selectat.', [
      { text: 'Renunta', style: 'cancel' },
      {
        text: 'Sterge',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteReminder(accessToken, reminder.id);
            await cancelReminderAlarm(reminder.id);
            if (selectedReminder?.id === reminder.id) {
              setSelectedReminder(null);
              setEditDraft(null);
              setEditorOpen(false);
            }
            await loadReminders();
          } catch (exception) {
            Alert.alert('Nu am putut sterge recurenta', exception.message);
          }
        },
      },
    ]);
  }

  function applyPrompt(prompt) {
    setMessage(prompt);
    setActiveView('chat');
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditDraft(selectedReminder ? { ...selectedReminder } : null);
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={[styles.authScreen, { backgroundColor: colors.background }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
          style={styles.authKeyboard}
        >
          <ScrollView
            contentContainerStyle={styles.authContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.authWrap}>
              <AuthCard />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: drawerOpen ? colors.sidebar : colors.background }]}>
      {drawerOpen ? renderDrawer() : null}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        style={[
          styles.mainFrame,
          { backgroundColor: colors.background },
          drawerOpen && [styles.mainFrameShifted, { borderColor: colors.border }],
        ]}
      >
        <View style={[styles.appShell, { backgroundColor: colors.background }]}>
          <View style={[styles.topBar, { borderBottomColor: colors.hairline }]}>
            <Pressable
              onPress={() => setDrawerOpen((value) => !value)}
              style={({ pressed }) => [styles.iconButton, pressed && { backgroundColor: colors.surfaceMuted }]}
              hitSlop={10}
            >
              <Text style={[styles.iconText, { color: colors.text }]}>{drawerOpen ? '×' : '☰'}</Text>
            </Pressable>
            <View style={styles.titleWrap}>
              <Text style={[styles.appTitle, { color: colors.text }]}>{activeView === 'chat' ? 'NAPO' : activeView === 'recurrences' ? 'Recurente' : 'Setari'}</Text>
              <Text style={[styles.appSubtitle, { color: colors.muted }]}>
                {activeView === 'chat' ? (conversationId ? 'Conversatie activa' : 'Chat nou') : activeView === 'recurrences' ? `${reminders.length} remindere` : 'Preferinte'}
              </Text>
            </View>
            <Pressable
              onPress={() => startNewConversation()}
              style={({ pressed }) => [styles.iconButton, pressed && { backgroundColor: colors.surfaceMuted }]}
              hitSlop={10}
            >
              <Text style={[styles.iconText, { color: colors.text }]}>＋</Text>
            </Pressable>
          </View>

          {drawerOpen ? <Pressable style={styles.frameTapCatcher} onPress={() => setDrawerOpen(false)} /> : null}
          {activeView === 'chat' ? renderChat() : null}
          {activeView === 'recurrences' ? renderRecurrences() : null}
          {activeView === 'settings' ? renderSettings() : null}
        </View>
      </KeyboardAvoidingView>
      {activeView === 'recurrences' ? renderEditorModal() : null}
    </SafeAreaView>
  );

  function renderDrawer() {
    return (
      <View style={[styles.drawer, { backgroundColor: colors.sidebar, paddingTop: Math.max(insets.top, 10) }]}>
        <View style={styles.drawerHeader}>
          <View style={[styles.brandMark, { backgroundColor: colors.text }]}>
            <Text style={[styles.brandMarkText, { color: colors.background }]}>N</Text>
          </View>
          <View style={styles.brandCopy}>
            <Text style={[styles.drawerTitle, { color: colors.text }]}>NAPO</Text>
            <Text style={[styles.drawerSubtitle, { color: colors.muted }]} numberOfLines={1}>
              {user?.email || 'Asistentul tau'}
            </Text>
          </View>
        </View>

        <Pressable onPress={() => startNewConversation()} style={[styles.newChatButton, { borderColor: colors.border }]}>
          <Text style={[styles.newChatIcon, { color: colors.text }]}>+</Text>
          <Text style={[styles.newChatText, { color: colors.text }]}>Chat nou</Text>
        </Pressable>

        <View style={styles.menuGroup}>
          <MenuItem colors={colors} icon="◎" label="Chat" active={activeView === 'chat'} onPress={() => openView('chat')} />
          <MenuItem
            colors={colors}
            icon="⟳"
            label="Recurente"
            meta={`${recurringReminders.length}`}
            active={activeView === 'recurrences'}
            onPress={() => openView('recurrences')}
          />
          <MenuItem colors={colors} icon="⚙" label="Setari" active={activeView === 'settings'} onPress={() => openView('settings')} />
        </View>

        <View style={styles.drawerSectionHeader}>
          <Text style={[styles.drawerSectionTitle, { color: colors.muted }]}>Recente</Text>
          <Pressable onPress={loadReminders} hitSlop={10}>
            <Text style={[styles.refreshText, { color: colors.text }]}>{remindersLoading ? '...' : 'Refresh'}</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.drawerList} contentContainerStyle={styles.drawerListContent} showsVerticalScrollIndicator={false}>
          {reminders.length === 0 ? (
            <View style={[styles.emptyDrawerState, { backgroundColor: colors.sidebarMuted }]}>
              <Text style={[styles.emptyDrawerTitle, { color: colors.text }]}>Nicio recurenta inca</Text>
              <Text style={[styles.emptyDrawerText, { color: colors.muted }]}>Scrie in chat ce vrei sa-ti aminteasca NAPO.</Text>
            </View>
          ) : (
            reminders.slice(0, 10).map((reminder) => (
              <Pressable
                key={reminder.id}
                onPress={() => openReminder(reminder)}
                style={[
                  styles.drawerReminder,
                  selectedReminder?.id === reminder.id && { backgroundColor: colors.sidebarMuted },
                ]}
              >
                <Text numberOfLines={1} style={[styles.drawerReminderTitle, { color: colors.text }]}>
                  {reminder.title}
                </Text>
                <Text numberOfLines={1} style={[styles.drawerReminderMeta, { color: colors.muted }]}>
                  {formatReminderDate(reminder.remindAt)}
                </Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      </View>
    );
  }

  function renderChat() {
    return (
      <>
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.messagesContent}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
          style={styles.messages}
        >
          {messages.map((item) => {
            const isUser = item.sender === 'user';
            return (
              <View key={item.id} style={[styles.messageRow, isUser && styles.userMessageRow]}>
                {!isUser ? (
                  <View style={[styles.avatar, { backgroundColor: colors.assistantMark }]}>
                    <Text style={styles.avatarText}>N</Text>
                  </View>
                ) : null}
                <View
                  style={[
                    styles.bubble,
                    isUser ? styles.userBubble : styles.assistantBubble,
                    { backgroundColor: isUser ? colors.userBubble : 'transparent' },
                  ]}
                >
                  <Text style={[styles.messageText, { color: colors.text }]}>{item.text}</Text>
                  {item.reminder ? (
                    <Pressable
                      onPress={() => openReminder(item.reminder)}
                      style={[styles.reminderCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    >
                      <View style={styles.reminderCardTop}>
                        <Text style={[styles.reminderCardTitle, { color: colors.text }]} numberOfLines={1}>
                          {item.reminder.title}
                        </Text>
                        <Text style={[styles.reminderBadge, { color: colors.accent, backgroundColor: colors.accentMuted }]}>
                          {recurrenceLabel(item.reminder.recurrenceType)}
                        </Text>
                        {isLocalAlarm(item.reminder) ? (
                          <Text style={[styles.reminderBadge, { color: colors.accent, backgroundColor: colors.accentMuted }]}>
                            Alarma locala
                          </Text>
                        ) : null}
                      </View>
                      <Text style={[styles.reminderCardMeta, { color: colors.muted }]}>{formatReminderDate(item.reminder.remindAt)}</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })}

          {messages.length === 1 ? (
            <View style={styles.promptRack}>
              {quickPrompts.map((prompt) => (
                <Pressable
                  key={prompt}
                  onPress={() => applyPrompt(prompt)}
                  style={[styles.promptChip, { borderColor: colors.border, backgroundColor: colors.surface }]}
                >
                  <Text style={[styles.promptText, { color: colors.text }]}>{prompt}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {loading ? (
            <View style={styles.messageRow}>
              <View style={[styles.avatar, { backgroundColor: colors.assistantMark }]}>
                <Text style={styles.avatarText}>N</Text>
              </View>
              <View style={styles.loadingBubble}>
                <ActivityIndicator color={colors.accent} />
                <Text style={[styles.loadingText, { color: colors.muted }]}>NAPO gandeste...</Text>
              </View>
            </View>
          ) : null}
        </ScrollView>

        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

        <View style={[styles.composerOuter, { backgroundColor: colors.background }]}>
          <View style={[styles.composer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={CHAT_MAX_LENGTH}
              placeholder="Mesaj pentru NAPO"
              placeholderTextColor={colors.muted}
              style={[styles.input, { color: colors.text }]}
            />
            <Pressable
              onPress={submit}
              disabled={!message.trim() || loading}
              style={[
                styles.sendButton,
                { backgroundColor: !message.trim() || loading ? colors.surfaceMuted : colors.text },
              ]}
            >
              <Text style={[styles.sendButtonText, { color: colors.background }]}>↑</Text>
            </Pressable>
          </View>
        </View>
      </>
    );
  }

  function renderRecurrences() {
    return (
      <ScrollView contentContainerStyle={styles.toolContent} showsVerticalScrollIndicator={false}>
        <View style={styles.recurrenceHero}>
          <View style={styles.toolCopy}>
            <Text style={[styles.toolTitle, { color: colors.text }]}>Recurente</Text>
            <Text style={[styles.toolSubtitle, { color: colors.muted }]}>Un loc separat pentru editat ce revine in timp.</Text>
          </View>
          <Pressable onPress={createNewRecurrence} style={[styles.primaryAction, { backgroundColor: colors.text }]}>
            <Text style={[styles.primaryActionText, { color: colors.background }]}>Noua</Text>
          </Pressable>
        </View>

        <View style={[styles.statsStrip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Metric colors={colors} label="Total" value={reminders.length} />
          <Metric colors={colors} label="Recurente" value={recurringReminders.length} />
          <Metric colors={colors} label="Simple" value={oneTimeReminders.length} />
        </View>

        {remindersLoading ? (
          <View style={styles.inlineLoading}>
            <ActivityIndicator color={colors.accent} />
            <Text style={[styles.loadingText, { color: colors.muted }]}>Se incarca...</Text>
          </View>
        ) : null}

        {reminders.length === 0 ? (
          <View style={[styles.emptyPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Nu ai inca recurente</Text>
            <Text style={[styles.emptyBody, { color: colors.muted }]}>Porneste un chat nou si descrie ce vrei sa revina automat.</Text>
            <Pressable onPress={createNewRecurrence} style={[styles.emptyButton, { backgroundColor: colors.text }]}>
              <Text style={[styles.emptyButtonText, { color: colors.background }]}>Creeaza in chat</Text>
            </Pressable>
          </View>
        ) : null}

        {reminders.map((reminder) => (
          <Pressable
            key={reminder.id}
            onPress={() => openReminder(reminder)}
            style={[
              styles.reminderListItem,
              { backgroundColor: colors.surface, borderColor: colors.border },
              selectedReminder?.id === reminder.id && { borderColor: colors.text },
            ]}
          >
            <View style={styles.reminderListTop}>
              <Text style={[styles.reminderListTitle, { color: colors.text }]} numberOfLines={1}>
                {reminder.title}
              </Text>
              <Text style={[styles.statusPill, { color: colors.accent, backgroundColor: colors.accentMuted }]}>
                {reminder.status || 'ACTIVE'}
              </Text>
            </View>
            <Text style={[styles.reminderListMeta, { color: colors.muted }]}>{formatReminderDate(reminder.remindAt)}</Text>
            <View style={styles.reminderMetaRow}>
              <Text style={[styles.metaToken, { color: colors.muted, backgroundColor: colors.surfaceMuted }]}>
                {recurrenceLabel(reminder.recurrenceType)}
              </Text>
              <Text
                style={[
                  styles.metaToken,
                  {
                    color: isLocalAlarm(reminder) ? colors.accent : colors.muted,
                    backgroundColor: isLocalAlarm(reminder) ? colors.accentMuted : colors.surfaceMuted,
                  },
                ]}
              >
                {channelLabel(reminder.preferredChannel)}
              </Text>
            </View>
          </Pressable>
        ))}

      </ScrollView>
    );
  }

  function renderEditorModal() {
    return (
      <Modal visible={editorOpen && Boolean(editDraft)} transparent animationType="fade" onRequestClose={closeEditor}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalKeyboard}>
          <View style={styles.modalBackdrop}>
            <Pressable style={styles.modalDismissLayer} onPress={closeEditor} />
            <View style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.modalHandle} />
              <View style={styles.editorHeading}>
                <View style={styles.editorHeadingCopy}>
                  <Text style={[styles.editorTitle, { color: colors.text }]}>Editeaza recurenta</Text>
                  <Text style={[styles.editorSubtitle, { color: colors.muted }]} numberOfLines={1}>
                    {selectedReminder?.title || 'Reminder selectat'}
                  </Text>
                </View>
                <Pressable onPress={closeEditor} style={[styles.closeButton, { backgroundColor: colors.surfaceMuted }]}>
                  <Text style={[styles.closeButtonText, { color: colors.text }]}>×</Text>
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={styles.editorForm} showsVerticalScrollIndicator={false}>
                <Field
                  colors={colors}
                  label="Titlu"
                  value={editDraft?.title || ''}
                  onChangeText={(value) => setEditDraft((current) => ({ ...current, title: value }))}
                />
                <Field
                  colors={colors}
                  label="Data ISO"
                  value={editDraft?.remindAt || ''}
                  onChangeText={(value) => setEditDraft((current) => ({ ...current, remindAt: value }))}
                />
                <Field
                  colors={colors}
                  label="Mesaj"
                  value={editDraft?.messageToSend || ''}
                  multiline
                  onChangeText={(value) => setEditDraft((current) => ({ ...current, messageToSend: value }))}
                />
              </ScrollView>

              <View style={[styles.modalActions, { borderColor: colors.hairline }]}>
                <Pressable onPress={() => removeReminder()} style={[styles.deleteButton, { borderColor: colors.border }]}>
                  <Text style={[styles.deleteButtonText, { color: colors.danger }]}>Sterge</Text>
                </Pressable>
                <Pressable onPress={saveReminder} style={[styles.saveButton, { backgroundColor: colors.text }]}>
                  <Text style={[styles.saveButtonText, { color: colors.background }]}>Salveaza</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  function renderSettings() {
    return (
      <ScrollView contentContainerStyle={styles.toolContent} showsVerticalScrollIndicator={false}>
        <View style={styles.recurrenceHero}>
          <View>
            <Text style={[styles.toolTitle, { color: colors.text }]}>Setari</Text>
            <Text style={[styles.toolSubtitle, { color: colors.muted }]}>Cont, aspect si sesiune.</Text>
          </View>
        </View>

        <View style={[styles.settingsPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.settingsProfile}>
            <View style={[styles.profileAvatar, { backgroundColor: colors.text }]}>
              <Text style={[styles.profileAvatarText, { color: colors.background }]}>
                {(user?.displayName || user?.email || 'N').slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileText}>
              <Text style={[styles.profileName, { color: colors.text }]} numberOfLines={1}>
                {user?.displayName || 'Utilizator NAPO'}
              </Text>
              <Text style={[styles.profileEmail, { color: colors.muted }]} numberOfLines={1}>
                {user?.email}
              </Text>
            </View>
          </View>

          <View style={[styles.settingRow, { borderColor: colors.hairline }]}>
            <View>
              <Text style={[styles.settingTitle, { color: colors.text }]}>Tema</Text>
              <Text style={[styles.settingDescription, { color: colors.muted }]}>
                {colorScheme === 'dark' ? 'Dark mode activ' : 'Light mode activ'}
              </Text>
            </View>
            <Pressable onPress={toggleTheme} style={[styles.toggleButton, { backgroundColor: colors.surfaceMuted }]}>
              <Text style={[styles.toggleButtonText, { color: colors.text }]}>
                {colorScheme === 'dark' ? 'Light' : 'Dark'}
              </Text>
            </Pressable>
          </View>

          <View style={[styles.settingRow, { borderColor: colors.hairline }]}>
            <View style={styles.settingCopy}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>Chat nou</Text>
              <Text style={[styles.settingDescription, { color: colors.muted }]}>Reseteaza conversatia curenta fara sa stearga recurentele.</Text>
            </View>
            <Pressable onPress={() => startNewConversation()} style={[styles.toggleButton, { backgroundColor: colors.surfaceMuted }]}>
              <Text style={[styles.toggleButtonText, { color: colors.text }]}>Start</Text>
            </Pressable>
          </View>

          <Pressable onPress={logout} style={[styles.fullWidthDanger, { borderColor: colors.border }]}>
            <Text style={[styles.fullWidthDangerText, { color: colors.danger }]}>Log out</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }
}

function MenuItem({ colors, icon, label, meta, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuItem,
        active && { backgroundColor: colors.sidebarMuted },
        pressed && { backgroundColor: colors.sidebarMuted },
      ]}
    >
      <Text style={[styles.menuIcon, { color: active ? colors.text : colors.muted }]}>{icon}</Text>
      <Text style={[styles.menuItemText, { color: colors.text }]}>{label}</Text>
      {meta ? <Text style={[styles.menuMeta, { color: colors.muted }]}>{meta}</Text> : null}
    </Pressable>
  );
}

function Metric({ colors, label, value }) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

function Field({ colors, label, value, onChangeText, multiline = false }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.muted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        placeholder={label}
        placeholderTextColor={colors.muted}
        style={[
          styles.editorInput,
          multiline && styles.editorTextarea,
          { backgroundColor: colors.background, borderColor: colors.border, color: colors.text },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  authScreen: {
    flex: 1,
  },
  authKeyboard: {
    flex: 1,
  },
  authContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingBottom: 28,
    paddingTop: 42,
  },
  authWrap: {
    padding: 18,
  },
  safeArea: {
    flex: 1,
  },
  drawer: {
    bottom: 0,
    left: 0,
    paddingBottom: 10,
    paddingHorizontal: 12,
    position: 'absolute',
    top: 0,
    width: DRAWER_WIDTH,
  },
  drawerHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 58,
  },
  brandMark: {
    alignItems: 'center',
    borderRadius: 8,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  brandMarkText: {
    fontSize: 16,
    fontWeight: '900',
  },
  brandCopy: {
    flex: 1,
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  drawerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  newChatButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    height: 44,
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  newChatIcon: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 22,
  },
  newChatText: {
    fontSize: 15,
    fontWeight: '700',
  },
  menuGroup: {
    gap: 2,
  },
  menuItem: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 10,
    minHeight: 42,
    paddingHorizontal: 11,
  },
  menuIcon: {
    fontSize: 18,
    width: 22,
  },
  menuItemText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  menuMeta: {
    fontSize: 13,
    fontWeight: '700',
  },
  drawerSectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 8,
    paddingHorizontal: 2,
    paddingTop: 20,
  },
  drawerSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  refreshText: {
    fontSize: 13,
    fontWeight: '700',
  },
  drawerList: {
    flex: 1,
  },
  drawerListContent: {
    paddingBottom: 10,
  },
  drawerReminder: {
    borderRadius: 8,
    gap: 3,
    marginBottom: 3,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  drawerReminderTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  drawerReminderMeta: {
    fontSize: 12,
    lineHeight: 17,
  },
  emptyDrawerState: {
    borderRadius: 8,
    padding: 12,
  },
  emptyDrawerTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  emptyDrawerText: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  mainFrame: {
    flex: 1,
    overflow: 'hidden',
    transform: [{ translateX: 0 }, { scale: 1 }],
  },
  mainFrameShifted: {
    borderRadius: 22,
    borderWidth: 1,
    elevation: 16,
    marginBottom: 10,
    marginTop: 10,
    shadowColor: '#000000',
    shadowOffset: { width: -5, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    transform: [{ translateX: DRAWER_WIDTH - 10 }, { scale: 0.94 }],
  },
  appShell: {
    flex: 1,
    overflow: 'hidden',
  },
  frameTapCatcher: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 50,
  },
  topBar: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    height: 56,
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: 8,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  iconText: {
    fontSize: 24,
    fontWeight: '600',
  },
  titleWrap: {
    alignItems: 'center',
    flex: 1,
  },
  appTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  appSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  messages: {
    flex: 1,
  },
  messagesContent: {
    gap: 19,
    paddingBottom: 18,
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  messageRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  userMessageRow: {
    justifyContent: 'flex-end',
  },
  avatar: {
    alignItems: 'center',
    borderRadius: 8,
    height: 30,
    justifyContent: 'center',
    marginTop: 2,
    width: 30,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  bubble: {
    borderRadius: 18,
    maxWidth: '86%',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  assistantBubble: {
    flex: 1,
    paddingHorizontal: 0,
  },
  userBubble: {
    borderBottomRightRadius: 6,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 23,
  },
  reminderCard: {
    borderRadius: 8,
    borderWidth: 1,
    gap: 7,
    marginTop: 12,
    padding: 12,
  },
  reminderCardTop: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reminderCardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
  },
  reminderBadge: {
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  reminderCardMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  promptRack: {
    gap: 8,
    marginTop: 2,
  },
  promptChip: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  promptText: {
    fontSize: 14,
    lineHeight: 20,
  },
  loadingBubble: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
    paddingVertical: 8,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '700',
  },
  error: {
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 16,
    paddingVertical: 5,
  },
  composerOuter: {
    paddingBottom: 8,
    paddingHorizontal: 10,
    paddingTop: 6,
  },
  composer: {
    alignItems: 'flex-end',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    maxHeight: 130,
    minHeight: 36,
    paddingTop: 7,
    textAlignVertical: 'top',
  },
  sendButton: {
    alignItems: 'center',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  sendButtonText: {
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 22,
  },
  toolContent: {
    gap: 12,
    paddingBottom: 24,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  recurrenceHero: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
  },
  toolCopy: {
    flex: 1,
  },
  toolTitle: {
    fontSize: 28,
    fontWeight: '900',
  },
  toolSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 3,
  },
  primaryAction: {
    alignItems: 'center',
    borderRadius: 8,
    minWidth: 68,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryActionText: {
    fontSize: 14,
    fontWeight: '900',
  },
  statsStrip: {
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    paddingVertical: 14,
  },
  metric: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '900',
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  inlineLoading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  emptyPanel: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
  },
  emptyButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 8,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '900',
  },
  reminderListItem: {
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  reminderListTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  reminderListTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
  },
  statusPill: {
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  reminderListMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  reminderMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaToken: {
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  modalKeyboard: {
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.46)',
  },
  modalDismissLayer: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  modalSheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    maxHeight: '86%',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  modalHandle: {
    alignSelf: 'center',
    backgroundColor: '#9a9a9a',
    borderRadius: 999,
    height: 4,
    marginBottom: 14,
    opacity: 0.5,
    width: 38,
  },
  editorHeading: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  editorHeadingCopy: {
    flex: 1,
  },
  editorTitle: {
    fontSize: 20,
    fontWeight: '900',
  },
  editorSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  closeButton: {
    alignItems: 'center',
    borderRadius: 8,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  closeButtonText: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 26,
  },
  editorForm: {
    gap: 12,
    paddingBottom: 14,
    paddingTop: 16,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  editorInput: {
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  editorTextarea: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  modalActions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 14,
    paddingTop: 12,
  },
  deleteButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '900',
  },
  saveButton: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    paddingVertical: 12,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '900',
  },
  settingsPanel: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  settingsProfile: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 14,
  },
  profileAvatar: {
    alignItems: 'center',
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  profileAvatarText: {
    fontSize: 18,
    fontWeight: '900',
  },
  profileText: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '900',
  },
  profileEmail: {
    fontSize: 13,
    marginTop: 2,
  },
  settingRow: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  settingCopy: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  settingDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  toggleButton: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  fullWidthDanger: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
    paddingVertical: 12,
  },
  fullWidthDangerText: {
    fontSize: 15,
    fontWeight: '900',
  },
});
