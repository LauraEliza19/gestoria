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

import {
    fontSizes,
    radii,
    sereneColors,
    spacing,
} from '@/theme/tokens';
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
    const [remember, setRemember] = useState(true);
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
                        <View
                            pointerEvents="none"
                            style={styles.brandDecoration}
                        >
                            <View style={styles.brandGlow} />
                            <View style={styles.brandRing} />
                            <View style={styles.brandCore} />
                        </View>

                        <Image
                            accessibilityLabel="GestorIA"
                            contentFit="contain"
                            source={require('@/assets/images/gestoria-logo.png')}
                            style={styles.logo}
                        />

                        <Text style={styles.brandEyebrow}>
                            ACESSO EXECUTIVO
                        </Text>

                        <Text style={styles.brandTitle}>
                            Sua empresa, sempre por perto.
                        </Text>

                        <Text style={styles.brandDescription}>
                            Decisões claras, operação segura e tudo o que importa
                            ao seu alcance.
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
                                placeholderTextColor={sereneColors.sheetTextMuted}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                autoComplete="email"
                                textContentType="emailAddress"
                                selectionColor={sereneColors.primary}
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
                                    placeholderTextColor={
                                        sereneColors.sheetTextMuted
                                    }
                                    secureTextEntry={!showPassword}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    autoComplete="current-password"
                                    textContentType="password"
                                    selectionColor={sereneColors.primary}
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
                                <ActivityIndicator
                                    color={sereneColors.textOnPrimary}
                                />
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
        backgroundColor: sereneColors.background,
        flex: 1,
    },
    keyboardArea: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },
    brandArea: {
        justifyContent: 'center',
        minHeight: 300,
        overflow: 'hidden',
        paddingHorizontal: spacing.xxl,
        paddingVertical: spacing.xl,
        position: 'relative',
    },
    brandDecoration: {
        bottom: 0,
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
    },

    brandGlow: {
        backgroundColor: 'rgba(40, 103, 232, 0.10)',
        borderRadius: 180,
        height: 340,
        left: -130,
        position: 'absolute',
        top: -220,
        width: 400,
    },

    brandRing: {
        borderColor: 'rgba(40, 103, 232, 0.15)',
        borderRadius: 150,
        borderWidth: 38,
        height: 300,
        position: 'absolute',
        right: -160,
        top: 80,
        width: 300,
    },

    brandCore: {
        backgroundColor: 'rgba(23, 174, 230, 0.05)',
        borderRadius: 100,
        height: 200,
        position: 'absolute',
        right: -100,
        top: 130,
        width: 200,
    },

    brandEyebrow: {
        color: sereneColors.brandCyan,
        fontSize: fontSizes.caption,
        fontWeight: '600',
        letterSpacing: 1.3,
        marginBottom: spacing.sm,
    },
    logo: {
        height: 86,
        marginBottom: -8,
        marginLeft: -90,
        width: 280,
    },
    brandTitle: {
        color: sereneColors.text,
        fontSize: fontSizes.display,
        fontWeight: '600',
        letterSpacing: -0.4,
        lineHeight: 36,
        maxWidth: 360,
    },
    brandDescription: {
        color: sereneColors.textMuted,
        fontSize: fontSizes.body,
        lineHeight: 24,
        marginTop: spacing.md,
        maxWidth: 360,
    },
    formArea: {
        flexGrow: 1,
        backgroundColor: sereneColors.sheet,
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.xxl,
        paddingBottom: spacing.xl,
    },
    formHeader: {
        marginBottom: spacing.xl,
    },
    eyebrow: {
        color: sereneColors.primary,
        fontSize: fontSizes.caption,
        fontWeight: '600',
        letterSpacing: 1.3,
    },
    title: {
        color: sereneColors.sheetText,
        fontSize: fontSizes.display,
        fontWeight: '600',
        letterSpacing: -0.4,
        marginTop: spacing.sm,
    },
    description: {
        color: sereneColors.sheetTextMuted,
        fontSize: fontSizes.body,
        lineHeight: 24,
        marginTop: spacing.sm,
    },
    fieldGroup: {
        marginBottom: spacing.lg,
    },
    label: {
        color: sereneColors.sheetText,
        fontSize: fontSizes.bodySmall,
        fontWeight: '600',
        marginBottom: spacing.sm,
    },
    input: {
        backgroundColor: sereneColors.sheetSurface,
        borderColor: sereneColors.sheetBorder,
        borderRadius: radii.lg,
        borderWidth: 1,
        color: sereneColors.sheetText,
        fontSize: fontSizes.body,
        minHeight: 56,
        paddingHorizontal: spacing.lg,
    },
    passwordContainer: {
        alignItems: 'center',
        backgroundColor: sereneColors.sheetSurface,
        borderColor: sereneColors.sheetBorder,
        borderRadius: radii.lg,
        borderWidth: 1,
        flexDirection: 'row',
        minHeight: 56,
    },
    passwordInput: {
        color: sereneColors.sheetText,
        flex: 1,
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
        color: sereneColors.primary,
        fontSize: fontSizes.bodySmall,
        fontWeight: '600',
    },

    error: {
        color: '#C83E59',
        fontSize: fontSizes.bodySmall,
        lineHeight: 20,
        marginBottom: spacing.lg,
    },
    loginButton: {
        alignItems: 'center',
        backgroundColor: sereneColors.primary,
        borderRadius: radii.lg,
        justifyContent: 'center',
        marginTop: spacing.sm,
        minHeight: 56,
    },
    loginButtonPressed: {
        backgroundColor: sereneColors.primaryPressed,
        transform: [{ scale: 0.99 }],
    },
    loginButtonText: {
        color: sereneColors.textOnPrimary,
        fontSize: fontSizes.body,
        fontWeight: '600',
    },
    helpButton: {
        alignItems: 'center',
        padding: spacing.lg,
    },
    helpText: {
        color: sereneColors.primary,
        fontSize: fontSizes.bodySmall,
        fontWeight: '600',
    },
    footer: {
        color: sereneColors.sheetTextMuted,
        fontSize: fontSizes.caption,
        marginTop: 'auto',
        paddingTop: spacing.xl,
        textAlign: 'center',
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
        backgroundColor: sereneColors.sheetSurface,
        borderColor: sereneColors.sheetBorder,
        borderRadius: 6,
        borderWidth: 2,
        height: 22,
        justifyContent: 'center',
        width: 22,
    },
    rememberCheckboxActive: {
        backgroundColor: sereneColors.primary,
        borderColor: sereneColors.primary,
    },
    rememberCheck: {
        color: sereneColors.textOnPrimary,
        fontSize: 15,
        fontWeight: '600',
        lineHeight: 17,
    },
    rememberText: {
        color: sereneColors.sheetText,
        fontSize: 15,
        fontWeight: '600',
    },
});