import {
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Alert,
} from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { Link } from "expo-router";
import {
  useProvider,
  useIdentities,
  useKeys,
  useKeystoreStatus,
  useRootColors,
} from "@/hooks/useProvider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { DIDDocument } from "@algorandfoundation/identities-store";
import { HeaderCard } from "@/components";

export default function Identities() {
  const { identity, key } = useProvider();
  const identities = useIdentities();
  const keys = useKeys();
  const status = useKeystoreStatus();
  const { colorFor } = useRootColors();

  const handleRemoveIdentity = async (address: string) => {
    try {
      await identity.store.removeIdentity(address);
    } catch (error: any) {
      console.error("Failed to remove identity", error);
    }
  };

  const handleGenerateIdentity = async () => {
    try {
      const rootKeys = keys.filter((k) => k.type === "hd-root-key");
      if (rootKeys.length === 0) {
        Alert.alert("No Root Key", "Please import or generate a seed first on the Keys page.");
        return;
      }

      const activeSeed = rootKeys[0].id;
      // Find next index for context 1
      const context1Keys = keys.filter(
        (k) => k.metadata?.context === 1 && k.metadata?.parentKeyId === activeSeed,
      );
      const nextIndex = context1Keys.length;

      await key.store.generate({
        type: "hd-derived-ed25519",
        algorithm: "EdDSA",
        extractable: true,
        keyUsages: ["sign", "verify"],
        params: {
          parentKeyId: activeSeed,
          context: 1, // Context 1 is for Identities
          account: 0,
          index: nextIndex,
          derivation: 9,
        },
      });
    } catch (error: any) {
      Alert.alert("Failed to generate identity key", error.message);
    }
  };

  const handleExportDidDocument = (doc: DIDDocument) => {
    Alert.alert("DID Document", JSON.stringify(doc, null, 2), [{ text: "OK" }]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <HeaderCard
          label="Identities Extension"
          title={identities.length}
          icon="shield-account"
          accentColor="#5856D6"
          actions={[
            {
              label: "Generate",
              icon: "shield-plus-outline",
              onPress: handleGenerateIdentity,
              disabled: status !== "idle",
            },
            {
              label: "Clear All",
              icon: "delete-sweep-outline",
              onPress: () => identity.store.clear(),
              disabled: status !== "idle",
            },
          ]}
        />

        <Text style={styles.sectionTitle}>Identities</Text>
        {identities.length === 0 ? (
          <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No identities found.</Text>
            <Text style={styles.emptyStateSubtext}>Generate one to get started with DIDs.</Text>
          </Animated.View>
        ) : (
          identities.map((item, i) => {
            // Color-code the identity by the seed/root its underlying key descends from.
            const keyId = item.metadata?.keyId as string | undefined;
            const rootColor = colorFor(keyId);
            return (
              <Animated.View
                key={item.address || i}
                entering={FadeIn.duration(300)}
                exiting={FadeOut.duration(300)}
                layout={LinearTransition.springify()}
              >
                <Link href={`/identities/${item.address}`} asChild>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={[styles.identityCard, { borderLeftColor: rootColor }]}
                  >
                    <View style={styles.identityInfo}>
                      <View
                        style={[
                          styles.identityIconContainer,
                          { backgroundColor: `${rootColor}1F` },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="shield-account-outline"
                          size={24}
                          color={rootColor}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={styles.identityAddress}
                          numberOfLines={1}
                          ellipsizeMode="middle"
                        >
                          {item.address}
                        </Text>
                        <Text style={[styles.identityTypeLabel, { color: rootColor }]}>
                          {item.type}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.identityActions}>
                      <TouchableOpacity
                        onPress={() =>
                          item.didDocument && handleExportDidDocument(item.didDocument)
                        }
                        style={{ marginRight: 12 }}
                        hitSlop={8}
                      >
                        <MaterialCommunityIcons
                          name="file-document-outline"
                          size={24}
                          color={rootColor}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleRemoveIdentity(item.address)}
                        hitSlop={8}
                      >
                        <MaterialCommunityIcons name="delete-outline" size={24} color="#FF3B30" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                </Link>
              </Animated.View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  scrollContent: {
    padding: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1A1A1A",
    marginBottom: 16,
    marginTop: 8,
  },
  identityCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  identityInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  identityIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F0F7FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  identityAddress: {
    fontSize: 16,
    color: "#1A1A1A",
    fontWeight: "600",
    fontFamily: "System",
  },
  identityTypeLabel: {
    fontSize: 10,
    color: "#999",
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  identityActions: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 12,
  },
  emptyState: {
    padding: 40,
    alignItems: "center",
    backgroundColor: "#F0F0F0",
    borderRadius: 20,
    marginBottom: 16,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "#CCC",
  },
  emptyStateText: {
    color: "#999",
    fontSize: 16,
    fontWeight: "600",
  },
  emptyStateSubtext: {
    color: "#AAA",
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
  },
});
