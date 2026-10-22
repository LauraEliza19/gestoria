import { useWindowDimensions } from 'react-native';

import {
  responsiveLayout,
  spacing,
} from '@/theme/tokens';

export type LayoutMode =
  | 'compact'
  | 'medium'
  | 'expanded';

export function useResponsiveLayout() {
  const { width, height, fontScale } =
    useWindowDimensions();

  const mode: LayoutMode =
    width < responsiveLayout.breakpoints.medium
      ? 'compact'
      : width <
        responsiveLayout.breakpoints.expanded
        ? 'medium'
        : 'expanded';

  const isCompact = mode === 'compact';
  const isMedium = mode === 'medium';
  const isExpanded = mode === 'expanded';

  const contentMaxWidth =
    responsiveLayout.contentMaxWidth[mode];

  const horizontalGutter = isCompact
    ? spacing.xl
    : isMedium
      ? spacing.xxl
      : spacing.xxxl;

  const pageWidth = Math.min(
    width,
    contentMaxWidth
  );

  const availableContentWidth = Math.max(
    0,
    pageWidth - horizontalGutter * 2
  );

  const readableContentWidth = Math.min(
    availableContentWidth,
    responsiveLayout.readableContentMaxWidth
  );

  return {
    width,
    height,
    fontScale,
    mode,
    isCompact,
    isMedium,
    isExpanded,
    contentMaxWidth,
    pageWidth,
    horizontalGutter,
    readableContentWidth,
  };
}