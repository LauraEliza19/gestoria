import type { ReactNode } from 'react';
import {
    type StyleProp,
    StyleSheet,
    Text,
    View,
    type ViewStyle,
} from 'react-native';

import {
    fontSizes,
    sereneColors,
    spacing,
} from '@/theme/tokens';

type SereneHeaderProps = {
    eyebrow?: string;
    title: string;
    description?: string;
    actions?: ReactNode;
    children?: ReactNode;
    style?: StyleProp<ViewStyle>;
};

export function SereneHeader({
    eyebrow,
    title,
    description,
    actions,
    children,
    style,
}: SereneHeaderProps) {
    return (
        <View style={[styles.header, style]}>
            <View
                pointerEvents="none"
                style={styles.decoration}
            >
                <View style={styles.topGlow} />
                <View style={styles.decorationRing} />
                <View style={styles.decorationCore} />
            </View>

            <View style={styles.headerContent}>
                <View style={styles.headingRow}>
                    <View style={styles.headingText}>
                        {eyebrow ? (
                            <Text style={styles.eyebrow}>
                                {eyebrow}
                            </Text>
                        ) : null}

                        <Text style={styles.title}>
                            {title}
                        </Text>
                    </View>

                    {actions ? (
                        <View style={styles.actions}>
                            {actions}
                        </View>
                    ) : null}
                </View>

                {description ? (
                    <Text style={styles.description}>
                        {description}
                    </Text>
                ) : null}

                {children}
            </View>
        </View>
    );
}

type SereneSheetProps = {
    children: ReactNode;
    style?: StyleProp<ViewStyle>;
};

export function SereneSheet({
    children,
    style,
}: SereneSheetProps) {
    return (
        <View style={[styles.sheet, style]}>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        backgroundColor: sereneColors.background,
        overflow: 'hidden',
        paddingBottom: spacing.xxl,
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.lg,
        position: 'relative',
    },

    decoration: {
        bottom: 0,
        left: 0,
        overflow: 'hidden',
        position: 'absolute',
        right: 0,
        top: 0,
    },

    topGlow: {
        backgroundColor: 'rgba(40, 103, 232, 0.08)',
        borderRadius: 190,
        height: 320,
        left: -100,
        position: 'absolute',
        top: -220,
        width: 380,
    },

    decorationRing: {
        borderColor: 'rgba(40, 103, 232, 0.14)',
        borderRadius: 155,
        borderWidth: 38,
        height: 310,
        position: 'absolute',
        right: -160,
        top: 70,
        width: 310,
    },

    decorationCore: {
        backgroundColor: 'rgba(23, 174, 230, 0.04)',
        borderRadius: 100,
        height: 200,
        position: 'absolute',
        right: -92,
        top: 125,
        width: 200,
    },

    headerContent: {
        position: 'relative',
        zIndex: 1,
    },

    headingRow: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        gap: spacing.lg,
        justifyContent: 'space-between',
    },

    headingText: {
        flex: 1,
        minWidth: 0,
    },

    eyebrow: {
        color: sereneColors.brandCyan,
        fontSize: fontSizes.caption,
        fontWeight: '600',
        letterSpacing: 1.3,
        marginBottom: spacing.sm,
        textTransform: 'uppercase',
    },

    title: {
        color: sereneColors.text,
        fontSize: fontSizes.display,
        fontWeight: '600',
        letterSpacing: -0.5,
        lineHeight: 36,
    },

    description: {
        color: sereneColors.textMuted,
        fontSize: fontSizes.body,
        lineHeight: 23,
        marginTop: spacing.md,
        maxWidth: 430,
    },

    actions: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.sm,
    },

    sheet: {
        backgroundColor: sereneColors.sheet,
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
        minHeight: 520,
        paddingBottom: 140,
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.xxl,
        width: '100%',
    },
});