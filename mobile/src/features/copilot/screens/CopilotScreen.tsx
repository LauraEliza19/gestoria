import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
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

import {
  fontSizes,
  radii,
  sereneColors,
  spacing,
} from '@/theme/tokens';

import type { CopilotResponseStatus } from '../copilotTypes';
import { useCopilot } from '../useCopilot';

const STATUS_LABELS: Record<
  CopilotResponseStatus,
  string
> = {
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
      <StatusBar style="light" />

      <KeyboardAvoidingView
        behavior={
          Platform.OS === 'ios' ? 'padding' : undefined
        }
        style={styles.keyboardArea}
      >
        <View style={styles.header}>
          <View style={styles.headerIdentity}>
            <View style={styles.icon}>
              <Text style={styles.iconText}>✦</Text>
            </View>

            <View style={styles.headerText}>
              <Text style={styles.eyebrow}>
                ASSISTENTE EMPRESARIAL
              </Text>

              <Text style={styles.title}>
                Copiloto GestorIA
              </Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Iniciar nova conversa"
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
          <Text style={styles.protectedText}>
            Contexto protegido
          </Text>
        </View>

        <View style={styles.suggestionsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Perguntas sugeridas
            </Text>

            <Text style={styles.sectionHint}>
              Deslize para explorar →
            </Text>
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
                  pressed &&
                    styles.suggestionPressed,
                  sending && styles.disabled,
                ]}
                onPress={() =>
                  void sendMessage(suggestion.prompt)
                }
              >
                <Text style={styles.suggestionTitle}>
                  {suggestion.title}
                </Text>

                <Text
                  style={styles.suggestionDescription}
                >
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
            const isError = Boolean(
              message.retryPrompt
            );

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
                        : message.status ===
                            'confirmation_required'
                          ? styles.statusConfirmation
                          : styles.statusGuided,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        message.status === 'answered'
                          ? styles.statusAnsweredText
                          : message.status ===
                              'confirmation_required'
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
                    isUser &&
                      styles.userMessageText,
                    isError &&
                      styles.errorMessageText,
                  ]}
                >
                  {message.text}
                </Text>

                {message.items?.map((item) => {
                  const available = isMobilePath(
                    item.path
                  );

                  return (
                    <Pressable
                      accessibilityRole={
                        available
                          ? 'button'
                          : undefined
                      }
                      disabled={!available}
                      key={item.id}
                      style={({ pressed }) => [
                        styles.resultCard,
                        !available &&
                          styles.unavailableCard,
                        pressed &&
                          available &&
                          styles.pressed,
                      ]}
                      onPress={() =>
                        openMobilePath(item.path)
                      }
                    >
                      <Text style={styles.resultTitle}>
                        {item.title}
                      </Text>

                      <Text
                        style={
                          styles.resultDescription
                        }
                      >
                        {item.description}
                      </Text>

                      <Text
                        style={styles.resultAction}
                      >
                        {available
                          ? 'Abrir no aplicativo →'
                          : 'Disponível no sistema web'}
                      </Text>
                    </Pressable>
                  );
                })}

                {message.actions?.map((action) => {
                  const available = isMobilePath(
                    action.path
                  );

                  return (
                    <Pressable
                      accessibilityRole={
                        available
                          ? 'button'
                          : undefined
                      }
                      disabled={!available}
                      key={action.id}
                      style={({ pressed }) => [
                        styles.actionButton,
                        !available &&
                          styles.unavailableAction,
                        pressed &&
                          available &&
                          styles.pressed,
                      ]}
                      onPress={() =>
                        openMobilePath(action.path)
                      }
                    >
                      <Text
                        style={[
                          styles.actionText,
                          !available &&
                            styles.unavailableActionText,
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
                color={sereneColors.primary}
                size="small"
              />

              <Text style={styles.loadingText}>
                Consultando...
              </Text>
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
            placeholderTextColor={
              sereneColors.textSubtle
            }
            selectionColor={sereneColors.primary}
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
              pressed &&
                styles.sendButtonPressed,
              (sending || !input.trim()) &&
                styles.sendButtonDisabled,
            ]}
            onPress={() => void sendMessage()}
          >
            {sending ? (
              <ActivityIndicator
                color={sereneColors.textOnPrimary}
                size="small"
              />
            ) : (
              <Text style={styles.sendButtonText}>
                ↑
              </Text>
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
    backgroundColor: sereneColors.background,
  },
  keyboardArea: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    maxWidth: 560,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    width: '100%',
  },
  headerIdentity: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
  },
  icon: {
    alignItems: 'center',
    backgroundColor: sereneColors.primary,
    borderRadius: radii.md,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  iconText: {
    color: sereneColors.textOnPrimary,
    fontSize: fontSizes.subtitle,
    fontWeight: '800',
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    color: sereneColors.primary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    color: sereneColors.text,
    fontSize: fontSizes.body,
    fontWeight: '800',
    marginTop: 2,
  },
  newConversationButton: {
    backgroundColor: sereneColors.surface,
    borderColor: sereneColors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  newConversationText: {
    color: sereneColors.primary,
    fontSize: fontSizes.caption,
    fontWeight: '800',
  },
  protectedContext: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#102A25',
    borderColor: '#24473E',
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginLeft: spacing.lg,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  protectedDot: {
    backgroundColor: sereneColors.success,
    borderRadius: radii.pill,
    height: 7,
    width: 7,
  },
  protectedText: {
    color: sereneColors.success,
    fontSize: fontSizes.caption,
    fontWeight: '700',
  },
  suggestionsSection: {
    marginTop: spacing.xl,
  },
  sectionHeader: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    maxWidth: 560,
    paddingHorizontal: spacing.lg,
    width: '100%',
  },
  sectionTitle: {
    color: sereneColors.text,
    fontSize: fontSizes.bodySmall,
    fontWeight: '800',
  },
  sectionHint: {
    color: sereneColors.textSubtle,
    fontSize: 10,
    fontWeight: '600',
  },
  suggestions: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  suggestionCard: {
    backgroundColor: sereneColors.surface,
    borderColor: sereneColors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    minHeight: 92,
    padding: spacing.lg,
    width: 200,
  },
  suggestionPressed: {
    backgroundColor: sereneColors.surfaceElevated,
    borderColor: sereneColors.primary,
  },
  suggestionTitle: {
    color: sereneColors.text,
    fontSize: fontSizes.bodySmall,
    fontWeight: '800',
  },
  suggestionDescription: {
    color: sereneColors.textMuted,
    fontSize: fontSizes.caption,
    lineHeight: 17,
    marginTop: spacing.sm,
  },
  messageList: {
    backgroundColor: sereneColors.backgroundSoft,
    borderTopColor: sereneColors.border,
    borderTopWidth: 1,
    flex: 1,
    marginTop: spacing.xl,
  },
  messages: {
    alignSelf: 'center',
    gap: spacing.md,
    maxWidth: 560,
    padding: spacing.lg,
    width: '100%',
  },
  messageBubble: {
    borderRadius: radii.lg,
    maxWidth: '92%',
    padding: spacing.lg,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: sereneColors.surface,
    borderBottomLeftRadius: spacing.xs,
    borderColor: sereneColors.border,
    borderWidth: 1,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: sereneColors.primary,
    borderBottomRightRadius: spacing.xs,
  },
  errorBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#2A171D',
    borderColor: '#61303B',
    borderWidth: 1,
  },
  messageText: {
    color: sereneColors.text,
    fontSize: fontSizes.bodySmall,
    lineHeight: 20,
  },
  userMessageText: {
    color: sereneColors.textOnPrimary,
  },
  errorMessageText: {
    color: sereneColors.danger,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  statusAnswered: {
    backgroundColor: '#102A25',
  },
  statusGuided: {
    backgroundColor: sereneColors.primarySoft,
  },
  statusConfirmation: {
    backgroundColor: '#302715',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  statusAnsweredText: {
    color: sereneColors.success,
  },
  statusGuidedText: {
    color: '#7FA4FF',
  },
  statusConfirmationText: {
    color: sereneColors.warning,
  },
  resultCard: {
    backgroundColor: sereneColors.surfaceMuted,
    borderColor: sereneColors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  unavailableCard: {
    opacity: 0.62,
  },
  resultTitle: {
    color: sereneColors.text,
    fontSize: fontSizes.bodySmall,
    fontWeight: '800',
  },
  resultDescription: {
    color: sereneColors.textMuted,
    fontSize: fontSizes.caption,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  resultAction: {
    color: sereneColors.primary,
    fontSize: fontSizes.caption,
    fontWeight: '800',
    marginTop: spacing.sm,
  },
  actionButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: sereneColors.primarySoft,
    borderColor: sereneColors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  unavailableAction: {
    backgroundColor: sereneColors.surfaceMuted,
    opacity: 0.62,
  },
  actionText: {
    color: '#7FA4FF',
    fontSize: fontSizes.caption,
    fontWeight: '800',
  },
  unavailableActionText: {
    color: sereneColors.textSubtle,
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: sereneColors.surfaceMuted,
    borderColor: '#61303B',
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  retryText: {
    color: sereneColors.danger,
    fontSize: fontSizes.caption,
    fontWeight: '800',
  },
  loadingBubble: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  loadingText: {
    color: sereneColors.textMuted,
    fontSize: fontSizes.bodySmall,
  },
  composer: {
    alignItems: 'flex-end',
    backgroundColor: sereneColors.tabBar,
    borderTopColor: sereneColors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  input: {
    backgroundColor: sereneColors.surfaceMuted,
    borderColor: sereneColors.borderStrong,
    borderRadius: radii.lg,
    borderWidth: 1,
    color: sereneColors.text,
    flex: 1,
    fontSize: fontSizes.bodySmall,
    maxHeight: 110,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: sereneColors.primary,
    borderRadius: radii.pill,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  sendButtonPressed: {
    backgroundColor: sereneColors.primaryPressed,
  },
  sendButtonDisabled: {
    opacity: 0.38,
  },
  sendButtonText: {
    color: sereneColors.textOnPrimary,
    fontSize: fontSizes.title,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.5,
  },
});