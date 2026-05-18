import { Text, View, StyleSheet, ViewStyle, StyleProp } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import React from "react";

export interface DetailSectionProps {
  title: string;
  /** Optional small badge text shown to the right of the title (e.g. a count). */
  badge?: string | number;
  /** Accent color used for the badge and left border. */
  accentColor?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Card-shaped section used on detail screens to group related info rows
 * or association lists. Always tints a thin left border with the screen's
 * `accentColor` so sections stay tied to their root color.
 */
export function DetailSection({
  title,
  badge,
  accentColor = "#5856D6",
  children,
  style,
}: DetailSectionProps) {
  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      style={[styles.section, { borderLeftColor: accentColor }, style]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {badge !== undefined ? (
          <View style={[styles.badge, { backgroundColor: `${accentColor}1F` }]}>
            <Text style={[styles.badgeText, { color: accentColor }]}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <View>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1A1A",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
