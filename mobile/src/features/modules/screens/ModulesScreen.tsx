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
  fontSizes,
  radii,
  sereneColors,
  spacing,
} from '@/theme/tokens';

type AvailableRoute = '/orders';

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
};

function ModuleCard({ item, onPress }: ModuleCardProps) {
  const available = Boolean(item.route);

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
          <Text
            style={[
              styles.moduleSymbolText,
              available && styles.moduleSymbolTextAvailable,
            ]}
          >
            {item.symbol}
          </Text>
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

        <Text
          style={[
            styles.moduleArrow,
            available && styles.moduleArrowAvailable,
          ]}
        >
          ›
        </Text>
      </View>
    </Pressable>
  );
}

export function ModulesScreen() {
  const router = useRouter();

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
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>ÁREAS DA EMPRESA</Text>
        <Text style={styles.title}>Módulos</Text>

        <Text style={styles.subtitle}>
          Acesse cada área do GestorIA sem sobrecarregar sua
          tela inicial.
        </Text>

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

        {MODULE_GROUPS.map((group) => (
          <View key={group.title} style={styles.group}>
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
                />
              ))}
            </View>
          </View>
        ))}
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
    maxWidth: 560,
    paddingBottom: spacing.xxxl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    width: '100%',
  },
  eyebrow: {
    color: sereneColors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    color: sereneColors.text,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
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
    backgroundColor: sereneColors.surface,
    borderColor: sereneColors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: spacing.xl,
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
    color: sereneColors.text,
    fontSize: fontSizes.bodySmall,
    fontWeight: '800',
  },
  noticeText: {
    color: sereneColors.textMuted,
    fontSize: fontSizes.caption,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  group: {
    marginTop: spacing.xxl,
  },
  groupHeader: {
    marginBottom: spacing.md,
  },
  groupTitle: {
    color: sereneColors.text,
    fontSize: fontSizes.subtitle,
    fontWeight: '800',
  },
  groupDescription: {
    color: sereneColors.textSubtle,
    fontSize: fontSizes.caption,
    marginTop: spacing.xs,
  },
  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  moduleCard: {
    backgroundColor: sereneColors.surface,
    borderColor: sereneColors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 158,
    padding: spacing.lg,
  },
  moduleCardPressed: {
    backgroundColor: sereneColors.surfaceElevated,
    opacity: 0.82,
  },
  moduleCardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  moduleSymbol: {
    alignItems: 'center',
    backgroundColor: sereneColors.surfaceMuted,
    borderColor: sereneColors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    minWidth: 36,
    paddingHorizontal: spacing.sm,
  },
  moduleSymbolAvailable: {
    backgroundColor: sereneColors.primarySoft,
    borderColor: sereneColors.primary,
  },
  moduleSymbolText: {
    color: sereneColors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  moduleSymbolTextAvailable: {
    color: sereneColors.primary,
  },
  statusDot: {
    borderRadius: radii.pill,
    height: 7,
    width: 7,
  },
  moduleTitle: {
    color: sereneColors.text,
    fontSize: fontSizes.bodySmall,
    fontWeight: '800',
    marginTop: spacing.lg,
  },
  moduleDescription: {
    color: sereneColors.textMuted,
    fontSize: fontSizes.caption,
    lineHeight: 17,
    marginTop: spacing.xs,
  },
  moduleFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 'auto',
    paddingTop: spacing.md,
  },
  moduleStatus: {
    color: sereneColors.textSubtle,
    fontSize: 10,
    fontWeight: '700',
  },
  moduleStatusAvailable: {
    color: sereneColors.success,
  },
  moduleArrow: {
    color: sereneColors.textSubtle,
    fontSize: fontSizes.subtitle,
  },
  moduleArrowAvailable: {
    color: sereneColors.primary,
  },
});