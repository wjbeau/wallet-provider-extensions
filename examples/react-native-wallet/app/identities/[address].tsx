import { SafeAreaView, ScrollView, StyleSheet, StatusBar, Text, View, Alert } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import {
  useProvider,
  useIdentityByAddress,
  useKeys,
  useAccounts,
  useRootColors,
} from "@/hooks/useProvider";
import { HeaderCard, DetailSection, InfoRow, AssociationRow } from "@/components";

export default function IdentityDetail() {
  const { address } = useLocalSearchParams<{ address: string }>();
  const { identity } = useProvider();
  const router = useRouter();
  const record = useIdentityByAddress(address ?? null);
  const allKeys = useKeys();
  const accounts = useAccounts();
  const { colorFor } = useRootColors();

  const keyId = (record?.metadata as any)?.keyId as string | undefined;
  const accentColor = colorFor(keyId);

  if (!record) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: "Identity" }} />
        <StatusBar barStyle="dark-content" />
        <View style={styles.missing}>
          <MaterialCommunityIcons name="shield-off" size={40} color="#999" />
          <Text style={styles.missingText}>Identity not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const sourceKey = allKeys.find((k) => k.id === keyId);
  const linkedAccounts = accounts.filter((a) => (a.metadata as any)?.keyId === keyId);

  const verificationMethods = record.didDocument?.verificationMethod ?? [];
  const services = record.didDocument?.service ?? [];

  const handleExport = () => {
    if (!record.didDocument) {
      Alert.alert("No DID Document", "This identity has no DID document yet.");
      return;
    }
    Alert.alert("DID Document", JSON.stringify(record.didDocument, null, 2), [{ text: "OK" }]);
  };

  const handleRemove = () => {
    Alert.alert("Remove Identity", "Remove this identity from the store?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await identity.store.removeIdentity(record.address);
          router.back();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: "Identity" }} />
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <HeaderCard
          label={record.type ?? "Identity"}
          title={record.address.slice(0, 10) + "…"}
          icon="shield-account"
          accentColor={accentColor}
          actions={[
            { label: "Export DID", icon: "file-document-outline", onPress: handleExport },
            { label: "Remove", icon: "delete-outline", onPress: handleRemove },
          ]}
        />

        <DetailSection title="Overview" accentColor={accentColor}>
          <InfoRow label="Address" value={record.address} mono />
          <InfoRow label="Type" value={record.type} />
          <InfoRow label="DID" value={record.did ?? record.didDocument?.id} mono />
        </DetailSection>

        {record.metadata && Object.keys(record.metadata).length > 0 && (
          <DetailSection title="Metadata" accentColor={accentColor}>
            {Object.entries(record.metadata).map(([k, v]) => (
              <InfoRow
                key={k}
                label={k}
                value={typeof v === "object" ? JSON.stringify(v) : String(v)}
              />
            ))}
          </DetailSection>
        )}

        <DetailSection title="Source Key" accentColor={accentColor} badge={sourceKey ? 1 : 0}>
          {sourceKey ? (
            <AssociationRow
              icon="key"
              title={sourceKey.id}
              subtitle={sourceKey.type}
              accentColor={accentColor}
              href={`/keys/${sourceKey.id}`}
            />
          ) : (
            <Text style={styles.empty}>No underlying key.</Text>
          )}
        </DetailSection>

        <DetailSection
          title="Linked Accounts"
          accentColor={accentColor}
          badge={linkedAccounts.length}
        >
          {linkedAccounts.length === 0 ? (
            <Text style={styles.empty}>No accounts share this key.</Text>
          ) : (
            linkedAccounts.map((a) => (
              <AssociationRow
                key={a.address}
                icon="account"
                title={a.address}
                subtitle={a.type}
                accentColor={accentColor}
                href={`/accounts/${a.address}`}
              />
            ))
          )}
        </DetailSection>

        {verificationMethods.length > 0 && (
          <DetailSection
            title="Verification Methods"
            accentColor={accentColor}
            badge={verificationMethods.length}
          >
            {verificationMethods.map((vm) => (
              <View key={vm.id} style={styles.subBlock}>
                <InfoRow label="ID" value={vm.id} mono />
                <InfoRow label="Type" value={vm.type} />
                <InfoRow label="Controller" value={vm.controller} mono />
                <InfoRow label="Public Key" value={vm.publicKeyMultibase} mono />
              </View>
            ))}
          </DetailSection>
        )}

        {services.length > 0 && (
          <DetailSection title="Services" accentColor={accentColor} badge={services.length}>
            {services.map((svc) => (
              <View key={svc.id} style={styles.subBlock}>
                <InfoRow label="ID" value={svc.id} mono />
                <InfoRow label="Type" value={svc.type} />
              </View>
            ))}
          </DetailSection>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  scroll: { padding: 20, paddingTop: 10, paddingBottom: 40 },
  empty: { fontSize: 13, color: "#999", paddingVertical: 8 },
  subBlock: { paddingVertical: 6 },
  missing: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  missingText: { fontSize: 16, color: "#666" },
});
