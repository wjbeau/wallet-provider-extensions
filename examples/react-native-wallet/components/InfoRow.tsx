import { Text, View, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

export interface InfoRowProps {
  label: string;
  value: string | number | null | undefined;
  /** Render the value in a monospace font (good for ids/addresses). */
  mono?: boolean;
  /** Optional trailing icon button (e.g. copy/export). */
  trailingIcon?: IconName;
  onTrailingPress?: () => void;
  /** Optional accent color used for the trailing icon. */
  accentColor?: string;
}

/**
 * Single label / value row used inside detail sections.
 * Renders a muted uppercase label and a value styled for readability.
 */
export function InfoRow({
  label,
  value,
  mono,
  trailingIcon,
  onTrailingPress,
  accentColor = "#5856D6",
}: InfoRowProps) {
  const display = value === null || value === undefined || value === "" ? "—" : String(value);
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        <Text
          style={[styles.value, mono && styles.mono]}
          numberOfLines={2}
          ellipsizeMode="middle"
          selectable
        >
          {display}
        </Text>
      </View>
      {trailingIcon && onTrailingPress ? (
        <TouchableOpacity onPress={onTrailingPress} hitSlop={8} style={styles.trailing}>
          <MaterialCommunityIcons name={trailingIcon} size={20} color={accentColor} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ECECEC",
  },
  label: {
    fontSize: 11,
    color: "#888",
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  value: {
    fontSize: 15,
    color: "#1A1A1A",
    fontWeight: "500",
  },
  mono: {
    fontFamily: "Courier",
    fontSize: 13,
  },
  trailing: {
    marginLeft: 12,
    padding: 6,
  },
});
