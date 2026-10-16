import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import {
    SafeAreaView,
    useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { colors, fontSizes, radii, spacing } from '@/theme/tokens';
import { useAuth } from '@/features/auth/context/useAuth';

export function LoginScreen() {
    const insets = useSafeAreaInsets();

    const {
        error: authError,
        signIn,
        status,
        clearError,
    } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [remember, setRemember] = useState(true)
    const [formError, setFormError] = useState('');

    const isSubmitting = status === 'loading';
    const displayedError = formError || authError;

    async function handleLogin() {
        if (!email.trim() || !password) {
            setFormError('Informe seu e-mail e sua senha.');
            return;
        }

        setFormError('');
        clearError();

        try {
            await signIn({
                email,
                password,
                remember,
            });
        } catch {
            return;
        }
    }

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <StatusBar style="light" />

            <KeyboardAvoidingView
                style={styles.keyboardArea}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.brandArea}>
                        <Image
                            source={require('@/assets/images/gestoria-logo.png')}
                            style={styles.logo}
                            contentFit="contain"
                            accessibilityLabel="GestorIA"
                        />

                        <Text style={styles.brandTitle}>
                            Gestão inteligente, onde você estiver.
                        </Text>

                        <Text style={styles.brandDescription}>
                            Acompanhe sua empresa com segurança e clareza.
                        </Text>
                    </View>

                    <View
                        style={[
                            styles.formArea,
                            { paddingBottom: spacing.xl + insets.bottom },
                        ]}
                    >
                        <View style={styles.formHeader}>
                            <Text style={styles.eyebrow}>ÁREA DO CLIENTE</Text>
                            <Text style={styles.title}>Bem-vindo de volta</Text>
                            <Text style={styles.description}>
                                Entre com as credenciais da sua empresa para continuar.
                            </Text>
                        </View>

                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>E-mail</Text>

                            <TextInput
                                value={email}
                                editable={!isSubmitting}
                                onChangeText={(value) => {
                                    setEmail(value);
                                    setFormError('');
                                    clearError();
                                }}
                                style={styles.input}
                                placeholder="voce@suaempresa.com.br"
                                placeholderTextColor={colors.textMuted}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                autoComplete="email"
                                textContentType="emailAddress"
                                selectionColor={colors.primary}
                                accessibilityLabel="E-mail"
                            />
                        </View>

                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Senha</Text>

                            <View style={styles.passwordContainer}>
                                <TextInput
                                    value={password}
                                    editable={!isSubmitting}
                                    onChangeText={(value) => {
                                        setPassword(value);
                                        setFormError('');
                                        clearError();
                                    }}
                                    style={styles.passwordInput}
                                    placeholder="Sua senha"
                                    placeholderTextColor={colors.textMuted}
                                    secureTextEntry={!showPassword}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    autoComplete="current-password"
                                    textContentType="password"
                                    selectionColor={colors.primary}
                                    returnKeyType="done"
                                    onSubmitEditing={handleLogin}
                                    accessibilityLabel="Senha"
                                />

                                <Pressable
                                    onPress={() => setShowPassword((current) => !current)}
                                    style={styles.passwordAction}
                                    accessibilityRole="button"
                                    accessibilityLabel={
                                        showPassword ? 'Ocultar senha' : 'Mostrar senha'
                                    }
                                >
                                    <Text style={styles.passwordActionText}>
                                        {showPassword ? 'Ocultar' : 'Mostrar'}
                                    </Text>
                                </Pressable>
                            </View>
                        </View>

                        <Pressable
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: remember }}
                            accessibilityLabel="Manter-me conectado"
                            disabled={status === 'loading'}
                            onPress={() => setRemember((current) => !current)}
                            style={({ pressed }) => [
                                styles.rememberOption,
                                pressed && styles.rememberOptionPressed,
                            ]}
                        >
                            <View
                                style={[
                                    styles.rememberCheckbox,
                                    remember && styles.rememberCheckboxActive,
                                ]}
                            >
                                {remember ? <Text style={styles.rememberCheck}>✓</Text> : null}
                            </View>

                            <Text style={styles.rememberText}>Manter-me conectado</Text>
                        </Pressable>

                        {displayedError ? (
                            <Text style={styles.error} accessibilityRole="alert">
                                {displayedError}
                            </Text>
                        ) : null}

                        <Pressable
                            onPress={handleLogin}
                            disabled={isSubmitting}
                            style={({ pressed }) => [
                                styles.loginButton,
                                pressed && !isSubmitting && styles.loginButtonPressed,
                                isSubmitting && styles.loginButtonDisabled,
                            ]}
                            accessibilityRole="button"
                        >
                            {isSubmitting ? (
                                <ActivityIndicator color={colors.textOnDark} />
                            ) : (
                                <Text style={styles.loginButtonText}>Entrar</Text>
                            )}
                        </Pressable>

                        <Pressable
                            onPress={() =>
                                Alert.alert(
                                    'Recuperação de senha',
                                    'Este fluxo será conectado ao suporte seguro do GestorIA.'
                                )
                            }
                            style={styles.helpButton}
                            accessibilityRole="button"
                        >
                            <Text style={styles.helpText}>Preciso de ajuda para entrar</Text>
                        </Pressable>

                        <Text style={styles.footer}>GestorIA • Aplicativo mobile</Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: colors.navy,
    },
    keyboardArea: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },
    brandArea: {
        minHeight: 260,
        justifyContent: 'center',
        paddingHorizontal: spacing.xxl,
        paddingVertical: spacing.xl,
    },
    logo: {
        width: 300,
        height: 150,
        marginLeft: -48,
        marginVertical: -28,
    },
    brandTitle: {
        color: colors.textOnDark,
        fontSize: fontSizes.title,
        fontWeight: '700',
        lineHeight: 31,
        maxWidth: 310,
    },
    brandDescription: {
        color: '#BCC8E8',
        fontSize: fontSizes.body,
        lineHeight: 24,
        marginTop: spacing.sm,
        maxWidth: 310,
    },
    formArea: {
        flexGrow: 1,
        backgroundColor: colors.surface,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.xxl,
        paddingBottom: spacing.xl,
    },
    formHeader: {
        marginBottom: spacing.xl,
    },
    eyebrow: {
        color: colors.primary,
        fontSize: fontSizes.caption,
        fontWeight: '700',
        letterSpacing: 1.4,
    },
    title: {
        color: colors.text,
        fontSize: fontSizes.display,
        fontWeight: '700',
        letterSpacing: -0.8,
        marginTop: spacing.sm,
    },
    description: {
        color: colors.textMuted,
        fontSize: fontSizes.body,
        lineHeight: 24,
        marginTop: spacing.sm,
    },
    fieldGroup: {
        marginBottom: spacing.lg,
    },
    label: {
        color: colors.text,
        fontSize: fontSizes.bodySmall,
        fontWeight: '600',
        marginBottom: spacing.sm,
    },
    input: {
        minHeight: 56,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.md,
        color: colors.text,
        fontSize: fontSizes.body,
        paddingHorizontal: spacing.lg,
        backgroundColor: colors.surface,
    },
    passwordContainer: {
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.md,
        backgroundColor: colors.surface,
    },
    passwordInput: {
        flex: 1,
        color: colors.text,
        fontSize: fontSizes.body,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    passwordAction: {
        minHeight: 48,
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
    },
    passwordActionText: {
        color: colors.primary,
        fontSize: fontSizes.bodySmall,
        fontWeight: '700',
    },
    error: {
        color: colors.danger,
        fontSize: fontSizes.bodySmall,
        lineHeight: 20,
        marginBottom: spacing.lg,
    },
    loginButton: {
        minHeight: 56,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
        borderRadius: radii.md,
        marginTop: spacing.sm,
    },
    loginButtonPressed: {
        backgroundColor: colors.primaryDark,
        transform: [{ scale: 0.99 }],
    },
    loginButtonText: {
        color: colors.textOnDark,
        fontSize: fontSizes.body,
        fontWeight: '700',
    },
    helpButton: {
        alignItems: 'center',
        padding: spacing.lg,
    },
    helpText: {
        color: colors.primary,
        fontSize: fontSizes.bodySmall,
        fontWeight: '600',
    },
    footer: {
        color: colors.textMuted,
        fontSize: fontSizes.caption,
        textAlign: 'center',
        marginTop: 'auto',
        paddingTop: spacing.xl,
    },
    loginButtonDisabled: {
        opacity: 0.7,
    },
    rememberOption: {
        alignItems: 'center',
        alignSelf: 'flex-start',
        flexDirection: 'row',
        gap: 10,
        marginTop: 4,
    },
    rememberOptionPressed: {
        opacity: 0.72,
    },
    rememberCheckbox: {
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderColor: '#AAB4C8',
        borderRadius: 6,
        borderWidth: 2,
        height: 22,
        justifyContent: 'center',
        width: 22,
    },
    rememberCheckboxActive: {
        backgroundColor: '#4169F5',
        borderColor: '#4169F5',
    },
    rememberCheck: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '800',
        lineHeight: 17,
    },
    rememberText: {
        color: '#111A2E',
        fontSize: 15,
        fontWeight: '700',
    },
});