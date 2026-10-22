import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  SereneHeader,
  SereneSheet,
} from '@/components/serene/SereneLayout';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

import {
  fontSizes,
  radii,
  sereneColors,
  spacing,
} from '@/theme/tokens';

type AvailableRoute = '/orders' | '/finance';

type ModuleItem = {
  id: string;
  title: string;
  description: string;
  symbol: string;
  route?: AvailableRoute;
};

type ModuleGroup = {
  title: string;
  description: string;
  items: ModuleItem[];
};

type IoniconName = ComponentProps<
  typeof Ionicons
>['name'];

const MODULE_ICONS: Record<string, IoniconName> = {
  customers: 'people-outline',
  orders: 'receipt-outline',
  quotes: 'document-text-outline',
  products: 'cube-outline',
  production: 'construct-outline',
  stock: 'layers-outline',
  fiscal: 'reader-outline',
  financial: 'wallet-outline',
  management: 'people-outline',
  company: 'business-outline',
};

const MODULE_GROUPS: ModuleGroup[] = [
  {
    title: 'Comercial',
    description: 'Relacionamento e vendas',
    items: [
      {
        id: 'customers',
        title: 'Clientes',
        description: 'Cadastros e relacionamento',
        symbol: 'C',
      },
      {
        id: 'orders',
        title: 'Pedidos',
        description: 'Acompanhamento comercial',
        symbol: 'P',
        route: '/orders',
      },
      {
        id: 'quotes',
        title: 'Orçamentos',
        description: 'Propostas e aprovações',
        symbol: 'O',
      },
    ],
  },
  {
    title: 'Cadastros',
    description: 'Base operacional da empresa',
    items: [
      {
        id: 'products',
        title: 'Produtos',
        description: 'Catálogo, preços e dados',
        symbol: 'PR',
      },
    ],
  },
  {
    title: 'Operação',
    description: 'Produção e disponibilidade',
    items: [
      {
        id: 'production',
        title: 'Produção',
        description: 'Fila e capacidade produtiva',
        symbol: 'PD',
      },
      {
        id: 'stock',
        title: 'Estoque',
        description: 'Saldos e movimentações',
        symbol: 'E',
      },
    ],
  },
  {
    title: 'Administração',
    description: 'Controle e gestão da empresa',
    items: [
      {
        id: 'fiscal',
        title: 'Fiscal',
        description: 'Documentos e pendências',
        symbol: 'F',
      },
      {
        id: 'financial',
        title: 'Financeiro',
        description: 'Entradas, saídas e saldo',
        symbol: 'FI',
        route: '/finance',
      },
      {
        id: 'management',
        title: 'Gestão interna',
        description: 'Equipe e centros de custo',
        symbol: 'G',
      },
      {
        id: 'company',
        title: 'Empresa',
        description: 'Dados da organização',
        symbol: 'EM',
      },
    ],
  },
];

type ModuleCardProps = {
  item: ModuleItem;
  onPress: () => void;
  wide: boolean;
};

function ModuleCard({
  item,
  onPress,
  wide,
}: ModuleCardProps) {
  const available = Boolean(item.route);
  const iconName =
    MODULE_ICONS[item.id] ?? 'apps-outline';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir ${item.title}`}
      accessibilityHint={
        available
          ? 'Abre o módulo'
          : 'Informa o estado da integração'
      }
      onPress={onPress}
      style={({ pressed }) => [
        styles.moduleCard,
        wide && styles.moduleCardWide,
        pressed && styles.moduleCardPressed,
      ]}
    >
      <View style={styles.moduleCardHeader}>
        <View
          style={[
            styles.moduleSymbol,
            available && styles.moduleSymbolAvailable,
          ]}
        >
          <Ionicons
            color={
              available
                ? sereneColors.primary
                : sereneColors.sheetTextMuted
            }
            name={iconName}
            size={22}
          />
        </View>

        <View
          style={[
            styles.statusDot,
            {
              backgroundColor: available
                ? sereneColors.success
                : sereneColors.textSubtle,
            },
          ]}
        />
      </View>

      <Text style={styles.moduleTitle}>{item.title}</Text>
      <Text style={styles.moduleDescription}>
        {item.description}
      </Text>

      <View style={styles.moduleFooter}>
        <Text
          style={[
            styles.moduleStatus,
            available && styles.moduleStatusAvailable,
          ]}
        >
          {available ? 'Disponível' : 'Em integração'}
        </Text>

        <Ionicons
          color={
            available
              ? sereneColors.primary
              : sereneColors.sheetTextMuted
          }
          name="chevron-forward"
          size={19}
        />
      </View>
    </Pressable>
  );
}

export function ModulesScreen() {
  const router = useRouter();
  const {
    contentMaxWidth,
    isCompact,
  } = useResponsiveLayout();

  function openModule(item: ModuleItem) {
    if (item.route) {
      router.push(item.route);
      return;
    }

    Alert.alert(
      item.title,
      'Este módulo já existe na versão web e será integrado ao aplicativo nas próximas etapas.'
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { maxWidth: contentMaxWidth },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <SereneHeader
          description="Acesse cada área do GestorIA sem sobrecarregar sua tela inicial."
          eyebrow="Áreas da empresa"
          title="Módulos"
        />

        <SereneSheet>

          <View style={styles.notice}>
            <View style={styles.noticeAccent} />

            <View style={styles.noticeContent}>
              <Text style={styles.noticeTitle}>
                Aplicativo em expansão
              </Text>
              <Text style={styles.noticeText}>
                Os módulos serão liberados gradualmente, sempre
                conectados aos dados reais da versão web.
              </Text>
            </View>
          </View>

          {MODULE_GROUPS.map((group, groupIndex) => (
            <View
              key={group.title}
              style={[
                styles.group,
                groupIndex === 0 && styles.groupFirst,
              ]}
            >
              <View style={styles.groupHeader}>
                <Text style={styles.groupTitle}>
                  {group.title}
                </Text>
                <Text style={styles.groupDescription}>
                  {group.description}
                </Text>
              </View>

              <View style={styles.moduleGrid}>
                {group.items.map((item) => (
                  <ModuleCard
                    key={item.id}
                    item={item}
                    onPress={() => openModule(item)}
                    wide={!isCompact}
                  />
                ))}
              </View>
            </View>
          ))}
        </SereneSheet>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: sereneColors.background,
  },
  content: {
    alignSelf: 'center',
    flexGrow: 1,
    width: '100%',
  },
  eyebrow: {
    color: sereneColors.primary,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  title: {
    color: sereneColors.text,
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.3,
    marginTop: spacing.xs,
  },
  subtitle: {
    color: sereneColors.textMuted,
    fontSize: fontSizes.bodySmall,
    lineHeight: 21,
    marginTop: spacing.md,
    maxWidth: 390,
  },
  notice: {
    backgroundColor: sereneColors.sheetSurface,
    borderColor: sereneColors.sheetBorder,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    padding: spacing.lg,
  },

  noticeAccent: {
    backgroundColor: sereneColors.primary,
    borderRadius: radii.pill,
    width: 3,
  },

  noticeContent: {
    flex: 1,
    marginLeft: spacing.md,
  },

  noticeTitle: {
    color: sereneColors.sheetText,
    fontSize: fontSizes.bodySmall,
    fontWeight: '600',
  },

  noticeText: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.caption,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  groupFirst: {
    marginTop: spacing.xl,
  },
  group: {
    marginTop: spacing.xxl,
  },

  groupHeader: {
    marginBottom: spacing.md,
  },

  groupTitle: {
    color: sereneColors.sheetText,
    fontSize: fontSizes.subtitle,
    fontWeight: '600',
  },

  groupDescription: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.caption,
    marginTop: spacing.xs,
  },
  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  moduleCard: {
    backgroundColor: sereneColors.sheetSurface,
    borderColor: sereneColors.sheetBorder,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 158,
    padding: spacing.lg,
  },

  moduleCardWide: {
    flexBasis: '31%',
    flexGrow: 0,
    minWidth: 220,
  },

  moduleCardPressed: {
    backgroundColor: sereneColors.sheetPressed,
    opacity: 0.82,
  },
  moduleCardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  moduleSymbol: {
    alignItems: 'center',
    backgroundColor: sereneColors.sheetPressed,
    borderColor: sereneColors.sheetBorder,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },

  moduleTitle: {
    color: sereneColors.sheetText,
    fontSize: fontSizes.bodySmall,
    fontWeight: '600',
    marginTop: spacing.lg,
  },

  moduleDescription: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.caption,
    lineHeight: 17,
    marginTop: spacing.xs,
  },

  moduleStatus: {
    color: sereneColors.sheetTextMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  moduleSymbolAvailable: {
    backgroundColor: sereneColors.primarySoft,
    borderColor: sereneColors.primary,
  },
  statusDot: {
    borderRadius: radii.pill,
    height: 7,
    width: 7,
  },

  moduleFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 'auto',
    paddingTop: spacing.md,
  },

  moduleStatusAvailable: {
    color: sereneColors.success,
  },
});
