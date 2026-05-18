import { Text, View, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";
import { Link } from "expo-router";
import React from "react";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

export interface ExtensionSubStat {
  label: string;
  count: number;
}

export interface ExtensionCardProps {
  title: string;
  count: number;
  icon: IconName;
  color: string;
  href: string;
  substats?: ExtensionSubStat[];
  /** Display index used to stagger the entrance animation. */
  index?: number;
}

/**
 * A consistent card representing a single extension/domain on the dashboard.
 *
 * Designed to be rendered inside a two-column grid. Includes a colored
 * icon, headline count, optional sub-statistics, and a "Manage" footer
 * that navigates to the domain's dedicated page.
 */
export function ExtensionCard({
  title,
  count,
  icon,
  color,
  href,
  substats = [],
  index = 0,
}: ExtensionCardProps) {
  return (
    <Animated.View
      entering={FadeInDown.delay(150 + index * 80)}
      layout={LinearTransition.springify()}
      style={styles.cell}
    >
      <Link href={href as never} asChild>
        <TouchableOpacity activeOpacity={0.85} style={styles.card}>
          <View style={styles.header}>
            <View style={[styles.iconWrap, { backgroundColor: `${color}15` }]}>
              <MaterialCommunityIcons name={icon} size={24} color={color} />
            </View>
            <View style={styles.countPill}>
              <Text style={[styles.countText, { color }]}>{count}</Text>
            </View>
          </View>

          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>

          <View style={styles.substatsRow}>
            {substats.length > 0 ? (
              substats.map((sub) => (
                <View key={sub.label} style={styles.substat}>
                  <Text style={styles.substatCount}>{sub.count}</Text>
                  <Text style={styles.substatLabel} numberOfLines={1}>
                    {sub.label}
                  </Text>
                </View>
              ))
            ) : (
              <View style={styles.substatPlaceholder} />
            )}
          </View>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color }]}>Manage</Text>
            <MaterialCommunityIcons name="chevron-right" size={16} color={color} />
          </View>
        </TouchableOpacity>
      </Link>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cell: {
    width: "50%",
    padding: 6,
  },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 16,
    minHeight: 200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    justifyContent: "space-between",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  countPill: {
    backgroundColor: "#F0F0F0",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    minWidth: 36,
    alignItems: "center",
  },
  countText: {
    fontSize: 15,
    fontWeight: "bold",
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1A1A1A",
    marginBottom: 10,
  },
  substatsRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: "#F0F0F0",
    paddingTop: 10,
    marginBottom: 10,
    minHeight: 44,
  },
  substat: {
    flex: 1,
    alignItems: "center",
  },
  substatCount: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
  },
  substatLabel: {
    fontSize: 10,
    color: "#999",
    textTransform: "uppercase",
    fontWeight: "600",
    marginTop: 2,
    letterSpacing: 0.3,
  },
  substatPlaceholder: {
    flex: 1,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
