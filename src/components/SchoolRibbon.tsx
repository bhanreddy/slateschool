import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TextStyle,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
} from 'react-native-svg';

import { SCHOOL_NAME } from '../constants/school';
import {
  SCHOOL_CONFIG,
  schoolColorWithAlpha,
} from '../constants/schoolConfig';

const ribbonTheme = SCHOOL_CONFIG.theme;

const STRIPE_H = 3;
const WAVE_H = 16;

/** Bottom wave depth — used by root layout for content inset. */
export const SCHOOL_RIBBON_WAVE_HEIGHT = WAVE_H;

/** How far screen content slides up under the transparent wave cutout. */
export const SCHOOL_RIBBON_OVERLAP = Math.round(WAVE_H * 0.78);

/** Mobile ribbon logo frame size (used by root layout for content inset). */
export const MOBILE_RIBBON_LOGO_SIZE = 48;

const MOBILE_RIBBON_ROW_PADDING_TOP = 3;
const MOBILE_RIBBON_ROW_PADDING_BOTTOM = 2;
const MOBILE_RIBBON_BOTTOM_PAD = 0;
/** Nudge logo upward within the ribbon row. */
const MOBILE_RIBBON_LOGO_OFFSET_UP = 12;

/** Body height below the status-bar inset (logo row + padding). */
export const MOBILE_RIBBON_CONTENT_HEIGHT =
  MOBILE_RIBBON_ROW_PADDING_TOP +
  MOBILE_RIBBON_ROW_PADDING_BOTTOM +
  MOBILE_RIBBON_LOGO_SIZE +
  MOBILE_RIBBON_BOTTOM_PAD;

const MARQUEE_GAP = '          ';
const MARQUEE_ITEM_GAP = '                         ';
const MARQUEE_SPEED_PX_PER_SEC = 52;

const formatTaglineQuotes = (tagline: string) =>
  `\u201C${tagline}\u201D`;

/* ------------------------------------------------------------------ */
/* Unified banner shape (body + wavy bottom + gold crest)              */
/* ------------------------------------------------------------------ */

function buildBannerShape(W: number, H: number) {
  const w = WAVE_H;
  const yRight = H - w * 0.22;

  // Adjusted the center join point Y-offset to H - w * 0.53 to match 
  // the tangents of both Bézier curves, removing the sharp vertex kink.
  return `
    M0 0
    H${W}
    V${yRight}
    C ${W * 0.9} ${H - w * 0.02},
      ${W * 0.72} ${H - w * 1.02},
      ${W * 0.52} ${H - w * 0.53}
    C ${W * 0.32} ${H - w * 0.04},
      ${W * 0.14} ${H - w * 0.98},
      0 ${H - w * 0.14}
    Z
  `;
}

function buildBannerCrest(W: number, H: number) {
  const w = WAVE_H;
  const yRight = H - w * 0.22;

  return `
    M${W} ${yRight}
    C ${W * 0.9} ${H - w * 0.02},
      ${W * 0.72} ${H - w * 1.02},
      ${W * 0.52} ${H - w * 0.53}
    C ${W * 0.32} ${H - w * 0.04},
      ${W * 0.14} ${H - w * 0.98},
      0 ${H - w * 0.14}
  `;
}

const BannerBackground = React.memo(function BannerBackground({
  width,
  height,
  showGoldStripe = false,
}: {
  width: number;
  height: number;
  showGoldStripe?: boolean;
}) {
  const W = Math.max(1, Math.round(width));
  const H = Math.max(1, Math.round(height));
  if (H <= 1) return null;

  const g = ribbonTheme.ribbonGradient;
  const loc = ribbonTheme.ribbonGradientLocations;
  const accent = ribbonTheme.accent;
  const gradId = `banner-grad-${W}-${H}`;
  const shape = buildBannerShape(W, H);
  const crest = buildBannerCrest(W, H);

  return (
    <Svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, { backgroundColor: 'transparent' }]}
    >
      <Defs>
        <SvgLinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={g[0]} />
          <Stop offset={String(loc[1])} stopColor={g[1]} />
          <Stop offset={String(loc[2])} stopColor={g[2]} />
          <Stop offset="1" stopColor={g[3]} />
        </SvgLinearGradient>
      </Defs>

      <Path d={shape} fill={`url(#${gradId})`} />

      {showGoldStripe ? (
        <Path
          d={`M0 0 H${W} V${STRIPE_H} H0 Z`}
          fill={accent}
        />
      ) : null}

      <Path
        d={crest}
        stroke={accent}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
});

/* ------------------------------------------------------------------ */
/* Decorative sparkles                                                 */
/* ------------------------------------------------------------------ */

const SPARKLE_PATH =
  'M12 2 C12.6 7 13 9.4 22 12 C13 14.6 12.6 17 12 22 C11.4 17 11 14.6 2 12 C11 9.4 11.4 7 12 2 Z';

function Sparkle({
  size,
  opacity,
  left,
  top,
}: {
  size: number;
  opacity: number;
  left: number;
  top: number;
}) {
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left, top, opacity }}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={SPARKLE_PATH} fill="#FFFFFF" />
      </Svg>
    </View>
  );
}

function HeaderSparkles({ top }: { top: number }) {
  const { width } = useWindowDimensions();

  const sparks = [
    { left: 28, top: top + 10, size: 10, opacity: 0.85 },
    { left: width * 0.42, top: top + 18, size: 7, opacity: 0.6 },
    { left: width - 118, top: top + 8, size: 8, opacity: 0.7 },
    { left: width - 48, top: top + 52, size: 9, opacity: 0.55 },
    { left: 72, top: top + 58, size: 6, opacity: 0.45 },
  ];

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {sparks.map((s, i) => (
        <Sparkle
          key={i}
          size={s.size}
          opacity={s.opacity}
          left={s.left}
          top={s.top}
        />
      ))}
    </View>
  );
}

const SCHOOL_NAME_MAX_LINES = 2;

function measureWordWidth(
  word: string,
  fontSize: number,
  charWidthFactor: number,
  letterSpacing: number,
) {
  if (!word) return 0;
  return (
    word.length * fontSize * charWidthFactor +
    Math.max(0, word.length - 1) * letterSpacing
  );
}

function estimateSchoolNameLines(
  text: string,
  availableWidth: number,
  fontSize: number,
) {
  if (!text || availableWidth <= 0) return 1;

  const safeWidth = availableWidth * 0.96;
  const charWidthFactor = 0.56;
  const letterSpacing = 0.2;
  const spaceWidth = fontSize * charWidthFactor + letterSpacing;
  const words = text.trim().split(/\s+/);
  let lines = 1;
  let lineWidth = 0;

  for (const word of words) {
    const wordWidth = measureWordWidth(
      word,
      fontSize,
      charWidthFactor,
      letterSpacing,
    );

    if (lineWidth === 0) {
      lineWidth = wordWidth;
      continue;
    }

    if (lineWidth + spaceWidth + wordWidth <= safeWidth) {
      lineWidth += spaceWidth + wordWidth;
    } else {
      lines += 1;
      lineWidth = wordWidth;
    }
  }

  return lines;
}

function estimateSchoolNameFontSize(
  text: string,
  availableWidth: number,
  maxFontSize: number,
  minFontSize: number,
  maxLines: number,
) {
  if (!text || availableWidth <= 0) return maxFontSize;

  for (let size = maxFontSize; size >= minFontSize; size -= 0.5) {
    const linesNeeded = estimateSchoolNameLines(text, availableWidth, size);
    if (linesNeeded <= maxLines) return size;
  }

  return minFontSize;
}

function AdaptiveSchoolName({
  text,
  baseStyle,
  maxFontSize,
  minFontSize,
  fallbackWidth,
  maxLines = SCHOOL_NAME_MAX_LINES,
}: {
  text: string;
  baseStyle: TextStyle;
  maxFontSize: number;
  minFontSize: number;
  fallbackWidth: number;
  maxLines?: number;
}) {
  const [containerWidth, setContainerWidth] = useState(0);
  const availableWidth = containerWidth > 0 ? containerWidth : fallbackWidth;

  const fontSize = useMemo(
    () =>
      estimateSchoolNameFontSize(
        text,
        availableWidth,
        maxFontSize,
        minFontSize,
        maxLines,
      ),
    [text, availableWidth, maxFontSize, minFontSize, maxLines],
  );

  const lineHeight = Math.round(fontSize * 1.2);

  return (
    <View
      style={adaptiveNameStyles.container}
      onLayout={(e) => {
        const nextWidth = e.nativeEvent.layout.width;
        if (nextWidth > 0 && Math.abs(nextWidth - containerWidth) > 0.5) {
          setContainerWidth(nextWidth);
        }
      }}
    >
      <Text
        style={[baseStyle, { fontSize, lineHeight }]}
        numberOfLines={maxLines}
        adjustsFontSizeToFit={Platform.OS !== 'web'}
        minimumFontScale={minFontSize / maxFontSize}
      >
        {text}
      </Text>
    </View>
  );
}

const adaptiveNameStyles = StyleSheet.create({
  container: {
    width: '100%',
    minWidth: 0,
  },
});

/* ------------------------------------------------------------------ */
/* Scrolling marquee (TV-style ticker)                                 */
/* ------------------------------------------------------------------ */

function MobileMarqueeSegment({
  schoolName,
  tagline,
}: {
  schoolName: string;
  tagline: string;
}) {
  return (
    <View style={marqueeStyles.segment}>
      {schoolName ? (
        <Text style={marqueeStyles.name} numberOfLines={1}>
          {schoolName}
        </Text>
      ) : null}

      {schoolName && tagline ? (
        <Text style={marqueeStyles.itemGap}>{MARQUEE_ITEM_GAP}</Text>
      ) : null}

      {tagline ? (
        <Text style={marqueeStyles.tagline} numberOfLines={1}>
          {formatTaglineQuotes(tagline)}
        </Text>
      ) : null}

      <Text style={marqueeStyles.itemGap}>{MARQUEE_GAP}</Text>
    </View>
  );
}

function MobileRibbonMarquee({
  schoolName,
  tagline,
}: {
  schoolName: string;
  tagline: string;
}) {
  const [segmentWidth, setSegmentWidth] = useState(0);
  const translateX = useSharedValue(0);

  const hasContent = Boolean(schoolName || tagline);

  useEffect(() => {
    if (!hasContent || segmentWidth <= 0) {
      cancelAnimation(translateX);
      translateX.value = 0;
      return;
    }

    cancelAnimation(translateX);
    translateX.value = 0;
    const duration = (segmentWidth / MARQUEE_SPEED_PX_PER_SEC) * 1000;
    translateX.value = withRepeat(
      withTiming(-segmentWidth, { duration, easing: Easing.linear }),
      -1,
      false,
    );
  }, [hasContent, segmentWidth, translateX]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  if (!hasContent) return null;

  return (
    <View style={marqueeStyles.clip} accessibilityRole="text">
      <View
        style={[marqueeStyles.segment, marqueeStyles.measureHidden]}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0 && Math.abs(w - segmentWidth) > 0.5) {
            setSegmentWidth(w);
          }
        }}
      >
        <MobileMarqueeSegment
          schoolName={schoolName}
          tagline={tagline}
        />
      </View>

      {segmentWidth > 0 ? (
        <Animated.View style={[marqueeStyles.track, animStyle]}>
          <MobileMarqueeSegment
            schoolName={schoolName}
            tagline={tagline}
          />
          <MobileMarqueeSegment
            schoolName={schoolName}
            tagline={tagline}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

function MarqueeSegment({
  schoolName,
  tagline,
  motto,
  baseStyle,
}: {
  schoolName: string;
  tagline: string;
  motto: string;
  baseStyle: TextStyle;
}) {
  return (
    <Text style={baseStyle} numberOfLines={1}>
      <Text style={marqueeStyles.name}>{schoolName}</Text>
      {tagline ? (
        <>
          <Text style={marqueeStyles.dot}>{'   •   '}</Text>
          <Text style={marqueeStyles.tagline}>{formatTaglineQuotes(tagline)}</Text>
        </>
      ) : null}
      {motto ? (
        <>
          <Text style={marqueeStyles.dot}>{'   •   '}</Text>
          <Text style={marqueeStyles.motto}>{motto}</Text>
        </>
      ) : null}
      <Text style={marqueeStyles.dot}>{MARQUEE_GAP}</Text>
    </Text>
  );
}

function RibbonMarquee({
  schoolName,
  tagline,
  motto,
}: {
  schoolName: string;
  tagline: string;
  motto: string;
}) {
  const [segmentWidth, setSegmentWidth] = useState(0);
  const translateX = useSharedValue(0);

  const hasContent = Boolean(schoolName || tagline || motto);

  useEffect(() => {
    if (!hasContent || segmentWidth <= 0) {
      cancelAnimation(translateX);
      translateX.value = 0;
      return;
    }

    cancelAnimation(translateX);
    translateX.value = 0;
    const duration = (segmentWidth / MARQUEE_SPEED_PX_PER_SEC) * 1000;
    translateX.value = withRepeat(
      withTiming(-segmentWidth, { duration, easing: Easing.linear }),
      -1,
      false,
    );
  }, [hasContent, segmentWidth, translateX]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  if (!hasContent) return null;

  const baseStyle = marqueeStyles.text;

  return (
    <View style={marqueeStyles.clip} accessibilityRole="text">
      <Text
        style={[baseStyle, marqueeStyles.measureHidden]}
        numberOfLines={1}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0 && Math.abs(w - segmentWidth) > 0.5) {
            setSegmentWidth(w);
          }
        }}
      >
        <MarqueeSegment
          schoolName={schoolName}
          tagline={tagline}
          motto={motto}
          baseStyle={baseStyle}
        />
      </Text>

      {segmentWidth > 0 ? (
        <Animated.View style={[marqueeStyles.track, animStyle]}>
          <MarqueeSegment
            schoolName={schoolName}
            tagline={tagline}
            motto={motto}
            baseStyle={baseStyle}
          />
          <MarqueeSegment
            schoolName={schoolName}
            tagline={tagline}
            motto={motto}
            baseStyle={baseStyle}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const marqueeStyles = StyleSheet.create({
  clip: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  measureHidden: {
    position: 'absolute',
    opacity: 0,
    left: -9999,
  },
  itemGap: {
    fontSize: 17,
    lineHeight: 22,
    color: 'transparent',
    flexShrink: 0,
  },
  text: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    color: ribbonTheme.ribbonTitle,
    flexShrink: 0,
  },
  name: {
    fontWeight: '900',
    fontSize: 17,
    lineHeight: 22,
    color: ribbonTheme.ribbonTitle,
    letterSpacing: 0.25,
    flexShrink: 0,
  },
  tagline: {
    fontWeight: '700',
    fontSize: 15,
    lineHeight: 22,
    color: ribbonTheme.ribbonTagline,
    fontStyle: 'italic',
    flexShrink: 0,
  },
  motto: {
    fontWeight: '700',
    color: ribbonTheme.ribbonBody,
    letterSpacing: 0.3,
  },
  dot: {
    color: ribbonTheme.marqueeSeparator,
    fontWeight: '700',
  },
});

/* ------------------------------------------------------------------ */
/* Mobile header                                                       */
/* ------------------------------------------------------------------ */

function MobileHeaderRibbon() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [bannerHeight, setBannerHeight] = useState(0);

  const schoolName = SCHOOL_NAME || SCHOOL_CONFIG.name;
  const tagline = SCHOOL_CONFIG.tagline?.trim() || '';

  return (
    <View
      accessibilityRole="header"
      style={headerStyles.wrapper}
    >
      <View
        style={[
          headerStyles.shell,
          { paddingBottom: MOBILE_RIBBON_BOTTOM_PAD },
        ]}
        onLayout={(e) =>
          setBannerHeight(e.nativeEvent.layout.height)
        }
      >
        <StatusBar style={ribbonTheme.statusBarOnRibbon} />

        {bannerHeight > 0 ? (
          <BannerBackground
            width={width}
            height={bannerHeight}
          />
        ) : null}

        <HeaderSparkles top={insets.top} />

        <View
          style={[
            headerStyles.contentRow,
            {
              paddingTop: insets.top + MOBILE_RIBBON_ROW_PADDING_TOP,
              paddingBottom: MOBILE_RIBBON_ROW_PADDING_BOTTOM,
            },
          ]}
        >
          <View style={headerStyles.logoFrame}>
            <Image
              source={SCHOOL_CONFIG.logo}
              style={headerStyles.logo}
              resizeMode="contain"
            />
          </View>

          <View style={headerStyles.titleBlock}>
            <MobileRibbonMarquee
              schoolName={schoolName}
              tagline={tagline}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const headerStyles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    zIndex: 10,
    pointerEvents: 'box-none',
    ...Platform.select({
      android: { elevation: 10 },
      default: {},
    }),
  },

  shell: {
    position: 'relative',
    backgroundColor: 'transparent',
  },

  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 14,
  },

  logoFrame: {
    width: MOBILE_RIBBON_LOGO_SIZE,
    height: MOBILE_RIBBON_LOGO_SIZE,
    marginTop: -MOBILE_RIBBON_LOGO_OFFSET_UP,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 5,
    borderWidth: 2,
    borderColor: schoolColorWithAlpha(ribbonTheme.accent, 0.55),

    ...Platform.select({
      web: {
        boxShadow: '0 5px 16px rgba(0,0,0,0.18)',
      } as object,

      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.22,
        shadowRadius: 8,
        elevation: 6,
      },
    }),
  },

  logo: {
    width: MOBILE_RIBBON_LOGO_SIZE - 14,
    height: MOBILE_RIBBON_LOGO_SIZE - 14,
  },

  titleBlock: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    height: MOBILE_RIBBON_LOGO_SIZE,
  },
});

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export default function SchoolRibbon() {
  if (Platform.OS === 'web') {
    return (
      <SafeAreaView
        style={shellStyles.safeTop}
        edges={['top']}
        accessibilityRole="header"
      >
        <StaticLetterheadRibbon />
      </SafeAreaView>
    );
  }

  return <MobileHeaderRibbon />;
}

const shellStyles = StyleSheet.create({
  safeTop: {
    backgroundColor: ribbonTheme.accent,
    flexShrink: 0,
  },
});

/* ------------------------------------------------------------------ */
/* Web letterhead (unchanged behaviour)                                */
/* ------------------------------------------------------------------ */

function StaticLetterheadRibbon() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [bannerHeight, setBannerHeight] = useState(0);

  const schoolName =
    SCHOOL_NAME || SCHOOL_CONFIG.name;

  const tagline =
    SCHOOL_CONFIG.tagline?.trim() || '';

  const motto =
    SCHOOL_CONFIG.motto?.trim() || '';

  const address =
    SCHOOL_CONFIG.address?.trim() || '';

  const phone =
    SCHOOL_CONFIG.contact?.trim() || '';

  const email =
    SCHOOL_CONFIG.email?.trim() || '';

  const compactInfo = width < 380;
  const titleFallbackWidth = compactInfo
    ? Math.max(0, width - 76)
    : Math.max(0, width * 0.44 - 62);

  const columns = useMemo(() => {
    const items: {
      key: string;
      body: string;
    }[] = [];

    if (motto)
      items.push({
        key: 'motto',
        body: motto,
      });

    if (address)
      items.push({
        key: 'addr',
        body: address,
      });

    const contactBlock = [
      phone &&
        `${t('schoolRibbon.tel')} ${phone}`,
      email &&
        `${t('schoolRibbon.email')} ${email}`,
    ]
      .filter(Boolean)
      .join('\n');

    if (contactBlock)
      items.push({
        key: 'contact',
        body: contactBlock,
      });

    return items;
  }, [motto, address, phone, email, t]);

  return (
    <View style={styles.column}>
      <View
        pointerEvents="none"
        style={styles.ambientHalo}
      />

      <View
        style={styles.letterheadShell}
        onLayout={(e) =>
          setBannerHeight(e.nativeEvent.layout.height)
        }
      >
        {bannerHeight > 0 ? (
          <BannerBackground
            width={width}
            height={bannerHeight}
            showGoldStripe
          />
        ) : null}

        <View
          style={[
            styles.inner,
            compactInfo && styles.innerCompact,
            Platform.OS === 'web' && styles.ribbonTextReset,
          ]}
        >
          <View
            style={[
              styles.brandRow,
              compactInfo &&
                styles.brandRowCompact,
            ]}
          >
            <View style={styles.logoFrame}>
              <Image
                source={SCHOOL_CONFIG.logo}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>

            <View style={styles.titleBlock}>
              <AdaptiveSchoolName
                text={schoolName}
                baseStyle={styles.schoolName}
                maxFontSize={22}
                minFontSize={11}
                fallbackWidth={titleFallbackWidth}
              />

              {tagline ? (
                <Text
                  style={styles.tagline}
                  numberOfLines={2}
                >
                  {`"${tagline}"`}
                </Text>
              ) : null}
            </View>
          </View>

          {columns.length > 0 ? (
            compactInfo ? (
              <View style={styles.infoStack}>
                {columns.map((col, i) => (
                  <React.Fragment key={col.key}>
                    {i > 0 ? (
                      <View
                        style={styles.hDivider}
                      />
                    ) : null}

                    <Text
                      style={
                        styles.infoTextStacked
                      }
                      numberOfLines={4}
                    >
                      {col.body}
                    </Text>
                  </React.Fragment>
                ))}
              </View>
            ) : (
              <View
                style={[
                  styles.infoRow,
                  styles.infoRowWide,
                ]}
              >
                {columns.map((col, i) => (
                  <React.Fragment key={col.key}>
                    {i > 0 ? (
                      <View
                        style={styles.vDivider}
                      />
                    ) : null}

                    <View style={styles.infoCol}>
                      <Text
                        style={styles.infoText}
                        numberOfLines={4}
                      >
                        {col.body}
                      </Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>
            )
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    backgroundColor: 'transparent',
  },

  ambientHalo: {
    position: 'absolute',
    left: '15%',
    right: '15%',
    top: -18,
    height: 90,
    borderRadius: 90,
    backgroundColor: schoolColorWithAlpha(
      ribbonTheme.accent,
      0.14,
    ),

    ...Platform.select({
      web: {
        filter: 'blur(40px)',
      } as object,

      default: {},
    }),
  },

  letterheadShell: {
    position: 'relative',
    paddingBottom: 10,
    backgroundColor: 'transparent',
    flexShrink: 0,

    ...Platform.select({
      web: {
        boxShadow: `0 10px 30px ${schoolColorWithAlpha(
          ribbonTheme.ribbonGradient[0],
          0.28,
        )}`,
      } as object,

      default: {
        shadowColor: ribbonTheme.ribbonGradient[0],
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      },
    }),
  },

  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },

  innerCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
    paddingVertical: 8,
  },

  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,

    flexShrink: 0,
    maxWidth: '44%',
    minWidth: 132,
  },

  brandRowCompact: {
    maxWidth: '100%',
    width: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
  },

  logoFrame: {
    width: 52,
    height: 52,
    borderRadius: 12,

    backgroundColor:
      'rgba(255,255,255,0.14)',

    borderWidth: StyleSheet.hairlineWidth,

    borderColor: schoolColorWithAlpha(
      ribbonTheme.accent,
      0.45,
    ),

    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },

  logo: {
    width: 44,
    height: 44,
  },

  titleBlock: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },

  schoolName: {
    color: ribbonTheme.ribbonTitle,
    fontWeight: '800',
    letterSpacing: 0.35,

    textShadowColor:
      'rgba(0,0,0,0.35)',

    textShadowOffset: {
      width: 0,
      height: 1,
    },

    textShadowRadius: 2,
  },

  tagline: {
    marginTop: 2,
    color: ribbonTheme.ribbonTagline,
    fontWeight: '600',
    fontSize: 12,
    letterSpacing: 0.2,

    textShadowColor:
      'rgba(0,0,0,0.25)',

    textShadowOffset: {
      width: 0,
      height: 1,
    },

    textShadowRadius: 1,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minWidth: 0,
    gap: 0,
  },

  infoRowWide: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  infoCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },

  infoText: {
    color: '#FFFFFF',
    opacity: 0.92,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '500',
    letterSpacing: 0.15,
  },

  vDivider: {
    width: StyleSheet.hairlineWidth,

    backgroundColor: schoolColorWithAlpha(
      ribbonTheme.accent,
      0.35,
    ),

    marginVertical: 2,
  },

  infoStack: {
    width: '100%',
    paddingTop: 2,

    borderTopWidth:
      StyleSheet.hairlineWidth,

    borderTopColor: schoolColorWithAlpha(
      ribbonTheme.accent,
      0.25,
    ),
  },

  hDivider: {
    height: StyleSheet.hairlineWidth,

    backgroundColor: schoolColorWithAlpha(
      ribbonTheme.accent,
      0.3,
    ),

    marginVertical: 6,
  },

  infoTextStacked: {
    color: '#FFFFFF',
    opacity: 0.9,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '500',
  },

  /* Web: block dark-theme body color from bleeding into ribbon copy */
  ribbonTextReset: {
    color: '#FFFFFF',
  } as TextStyle,
});