import { useRouter } from 'expo-router';
import { useRef } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type {
  CopilotResponseStatus,
} from '../copilotTypes';
import { useCopilot } from '../useCopilot';
import { colors, fontSizes, radii, spacing } from '@/theme/tokens';

const STATUS_LABELS: Record<CopilotResponseStatus, string> = {
  answered: 'Consulta real',
  guided: 'Orientação controlada',
  confirmation_required: 'Confirmação necessária',
};

const MOBILE_PATHS = {
  '/pedidos': '/orders',
} as const;

type MobilePath = keyof typeof MOBILE_PATHS;

function isMobilePath(path: string): path is MobilePath {
  return path in MOBILE_PATHS;
}

export function CopilotScreen() {
  const router = useRouter();
  const messageScrollRef = useRef<ScrollView>(null);

  const {
    suggestions,
    messages,
    input,
    setInput,
    sending,
    newConversation,
    sendMessage,
    retryMessage,
  } = useCopilot();

  function openMobilePath(path: string) {
    if (isMobilePath(path)) {
      router.push(MOBILE_PATHS[path]);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardArea}
      >
        <View style={styles.header}>
          <View style={styles.headerIdentity}>
            <View style={styles.icon}>
              <Text style={styles.iconText}>✦</Text>
            </View>

            <View style={styles.headerText}>
              <Text style={styles.eyebrow}>ASSISTENTE EMPRESARIAL</Text>
              <Text style={styles.title}>Copiloto GestorIA</Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={sending}
            style={({ pressed }) => [
              styles.newConversationButton,
              pressed && styles.pressed,
              sending && styles.disabled,
            ]}
            onPress={newConversation}
          >
            <Text style={styles.newConversationText}>
              Nova conversa
            </Text>
          </Pressable>
        </View>

        <View style={styles.protectedContext}>
          <View style={styles.protectedDot} />
          <Text style={styles.protectedText}>Contexto protegido</Text>
        </View>

        <View style={styles.suggestionsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Perguntas sugeridas</Text>
            <Text style={styles.sectionHint}>Deslize para explorar →</Text>
          </View>

          <ScrollView
            horizontal
            contentContainerStyle={styles.suggestions}
            showsHorizontalScrollIndicator={false}
          >
            {suggestions.map((suggestion) => (
              <Pressable
                accessibilityRole="button"
                disabled={sending}
                key={suggestion.title}
                style={({ pressed }) => [
                  styles.suggestionCard,
                  pressed && styles.suggestionPressed,
                  sending && styles.disabled,
                ]}
                onPress={() => void sendMessage(suggestion.prompt)}
              >
                <Text style={styles.suggestionTitle}>
                  {suggestion.title}
                </Text>

                <Text style={styles.suggestionDescription}>
                  {suggestion.description}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <ScrollView
          ref={messageScrollRef}
          accessibilityLiveRegion="polite"
          contentContainerStyle={styles.messages}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.messageList}
          onContentSizeChange={() =>
            messageScrollRef.current?.scrollToEnd({
              animated: true,
            })
          }
        >
          {messages.map((message) => {
            const isUser = message.role === 'user';
            const isError = Boolean(message.retryPrompt);

            return (
              <View
                key={message.id}
                style={[
                  styles.messageBubble,
                  isUser
                    ? styles.userBubble
                    : isError
                      ? styles.errorBubble
                      : styles.assistantBubble,
                ]}
              >
                {message.status ? (
                  <View
                    style={[
                      styles.statusBadge,
                      message.status === 'answered'
                        ? styles.statusAnswered
                        : message.status === 'confirmation_required'
                          ? styles.statusConfirmation
                          : styles.statusGuided,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        message.status === 'answered'
                          ? styles.statusAnsweredText
                          : message.status === 'confirmation_required'
                            ? styles.statusConfirmationText
                            : styles.statusGuidedText,
                      ]}
                    >
                      {STATUS_LABELS[message.status]}
                    </Text>
                  </View>
                ) : null}

                <Text
                  style={[
                    styles.messageText,
                    isUser && styles.userMessageText,
                    isError && styles.errorMessageText,
                  ]}
                >
                  {message.text}
                </Text>

                {message.items?.map((item) => {
                  const available = isMobilePath(item.path);

                  return (
                    <Pressable
                      accessibilityRole={
                        available ? 'button' : undefined
                      }
                      disabled={!available}
                      key={item.id}
                      style={({ pressed }) => [
                        styles.resultCard,
                        !available && styles.unavailableCard,
                        pressed && available && styles.pressed,
                      ]}
                      onPress={() => openMobilePath(item.path)}
                    >
                      <Text style={styles.resultTitle}>
                        {item.title}
                      </Text>

                      <Text style={styles.resultDescription}>
                        {item.description}
                      </Text>

                      <Text style={styles.resultAction}>
                        {available
                          ? 'Abrir no aplicativo →'
                          : 'Disponível no sistema web'}
                      </Text>
                    </Pressable>
                  );
                })}

                {message.actions?.map((action) => {
                  const available = isMobilePath(action.path);

                  return (
                    <Pressable
                      accessibilityRole={
                        available ? 'button' : undefined
                      }
                      disabled={!available}
                      key={action.id}
                      style={({ pressed }) => [
                        styles.actionButton,
                        !available && styles.unavailableAction,
                        pressed && available && styles.pressed,
                      ]}
                      onPress={() => openMobilePath(action.path)}
                    >
                      <Text
                        style={[
                          styles.actionText,
                          !available && styles.unavailableActionText,
                        ]}
                      >
                        {available
                          ? `${action.label} →`
                          : `${action.label} · disponível no web`}
                      </Text>
                    </Pressable>
                  );
                })}

                {message.retryPrompt ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={sending}
                    style={({ pressed }) => [
                      styles.retryButton,
                      pressed && styles.pressed,
                      sending && styles.disabled,
                    ]}
                    onPress={() =>
                      void retryMessage(
                        message.id,
                        message.retryPrompt!
                      )
                    }
                  >
                    <Text style={styles.retryText}>
                      ↻ Tentar novamente
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}

          {sending ? (
            <View
              accessibilityLabel="Copiloto consultando"
              style={[
                styles.messageBubble,
                styles.assistantBubble,
                styles.loadingBubble,
              ]}
            >
              <ActivityIndicator
                color={colors.primary}
                size="small"
              />
              <Text style={styles.loadingText}>Consultando...</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            accessibilityLabel="Mensagem para o Copiloto"
            editable={!sending}
            maxLength={500}
            multiline
            placeholder="Pergunte algo sobre sua empresa..."
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={input}
            onChangeText={setInput}
          />

          <Pressable
            accessibilityLabel="Enviar mensagem"
            accessibilityRole="button"
            disabled={sending || !input.trim()}
            style={({ pressed }) => [
              styles.sendButton,
              pressed && styles.sendButtonPressed,
              (sending || !input.trim()) && styles.sendButtonDisabled,
            ]}
            onPress={() => void sendMessage()}
          >
            {sending ? (
              <ActivityIndicator
                color={colors.textOnDark}
                size="small"
              />
            ) : (
              <Text style={styles.sendButtonText}>↑</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardArea: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  icon: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  newConversationButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  protectedContext: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#EAF8F2',
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    marginLeft: spacing.xl,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  protectedText: {
    color: colors.success,
    fontSize: fontSizes.caption,
    fontWeight: '700',
  },
  suggestionsSection: {
    marginTop: spacing.xl,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSizes.bodySmall,
    fontWeight: '800',
  },
  sectionHint: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  suggestions: {
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  suggestionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    minHeight: 96,
    padding: spacing.lg,
    width: 210,
  },
  messageList: {
    backgroundColor: '#EEF2F8',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flex: 1,
    marginTop: spacing.xl,
  },
  messages: {
    gap: spacing.md,
    padding: spacing.xl,
  },
  messageBubble: {
    borderRadius: radii.lg,
    maxWidth: '92%',
    padding: spacing.lg,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderBottomLeftRadius: spacing.xs,
    borderColor: colors.border,
    borderWidth: 1,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderBottomRightRadius: spacing.xs,
  },
  actionButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  composer: {
    alignItems: 'flex-end',
    backgroundColor: colors.surface,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: radii.lg,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    fontSize: fontSizes.bodySmall,
    maxHeight: 110,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  headerIdentity: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    color: colors.text,
    fontSize: fontSizes.subtitle,
    fontWeight: '800',
    marginTop: 2,
  },
  iconText: {
    color: colors.textOnDark,
    fontSize: fontSizes.title,
    fontWeight: '800',
  },
  newConversationText: {
    color: colors.primary,
    fontSize: fontSizes.caption,
    fontWeight: '800',
  },
  protectedDot: {
    backgroundColor: colors.success,
    borderRadius: radii.pill,
    height: 7,
    width: 7,
  },
  suggestionPressed: {
    borderColor: colors.primary,
  },
  suggestionTitle: {
    color: colors.text,
    fontSize: fontSizes.bodySmall,
    fontWeight: '800',
  },
  suggestionDescription: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    lineHeight: 17,
    marginTop: spacing.xs,
  },
  errorBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF5F5',
    borderColor: '#F0B9B9',
    borderWidth: 1,
  },
  messageText: {
    color: colors.text,
    fontSize: fontSizes.bodySmall,
    lineHeight: 20,
  },
  userMessageText: {
    color: colors.textOnDark,
  },
  errorMessageText: {
    color: colors.danger,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  statusAnswered: {
    backgroundColor: '#EAF8F2',
  },
  statusGuided: {
    backgroundColor: colors.primarySoft,
  },
  statusConfirmation: {
    backgroundColor: '#FFF8E8',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  statusAnsweredText: {
    color: colors.success,
  },
  statusGuidedText: {
    color: colors.primary,
  },
  statusConfirmationText: {
    color: colors.warning,
  },
  resultCard: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  unavailableCard: {
    opacity: 0.65,
  },
  resultTitle: {
    color: colors.text,
    fontSize: fontSizes.bodySmall,
    fontWeight: '800',
  },
  resultDescription: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  resultAction: {
    color: colors.primary,
    fontSize: fontSizes.caption,
    fontWeight: '800',
    marginTop: spacing.sm,
  },
  unavailableAction: {
    backgroundColor: '#F2F4F7',
  },
  actionText: {
    color: colors.primary,
    fontSize: fontSizes.caption,
    fontWeight: '800',
  },
  unavailableActionText: {
    color: colors.textMuted,
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: '#E0A3A3',
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  retryText: {
    color: colors.danger,
    fontSize: fontSizes.caption,
    fontWeight: '800',
  },
  loadingBubble: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: fontSizes.bodySmall,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  sendButtonPressed: {
    backgroundColor: colors.primaryDark,
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
  sendButtonText: {
    color: colors.textOnDark,
    fontSize: fontSizes.title,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.5,
  },
});