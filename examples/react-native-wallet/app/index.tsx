import {
    Text,
    View,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    StatusBar,
    ActivityIndicator,
    Alert
} from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import {useProvider} from "@/hooks/useProvider";
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {randomBytes} from "react-native-quick-crypto";
import {useState, useEffect} from "react";
import {localStorage} from "@/stores/mmkv-local";
import {useMMKVString} from "react-native-mmkv";

// No LayoutAnimation needed anymore
export default function Index() {
    const {keys, keystore} = useProvider();
    const [status, setStatus] = useMMKVString('status', localStorage);
    console.log('INDEX RENDERED', 'STATUS', status)
    const [activeKey, setActiveKey] = useState<string | undefined>(undefined);


    const handleAddSeed = async () => {
        setStatus('generating custom seed');
        const keyId = await keystore.generate({
            type: 'hd-ed25519-derived',
            algorithm: 'EdDSA',
        })

        setActiveKey(keyId);
    };

    const handleImportSeed = async () => {
        setStatus('importing custom seed');
        const keyId = await keystore.import({
            type: 'hd-seed',
            algorithm: 'raw',
            extractable: true,
            privateKey: randomBytes(64)
        }, 'bytes')

        setActiveKey(keyId);
    }

    const handleExportKey = async (id: string) => {
        try {
            const keyData = await keystore.export(id);
            Alert.alert(
                "Key Material",
                JSON.stringify(keyData, (key, value) => {
                    if (value instanceof Uint8Array) {
                        return Array.from(value).map(b => b.toString(16).padStart(2, '0')).join('');
                    }
                    return value;
                }, 2),
                [{ text: "OK" }]
            );
        } catch (error: any) {
            Alert.alert("Export Failed", error.message);
        }
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <View style={styles.header}>
                <View>
                    <Text style={styles.welcomeText}>Keystore Status</Text>
                    <View style={styles.statusBadge}>
                        <View style={[styles.statusDot, { backgroundColor: status === 'idle' ? '#4CAF50' : status === 'generating' ? '#FF9800' : '#999' }]} />
                        <Text style={styles.statusText}>{status}</Text>
                    </View>
                </View>
                {status === 'computing' && <ActivityIndicator size="small" color="#007AFF" />}
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.balanceCard}>
                    <Text style={styles.balanceLabel}>Secure Keystore</Text>
                    <Text style={styles.balanceAmount}>{keys.length} Keys</Text>
                    <View style={styles.actionButtons}>
                        <TouchableOpacity
                            style={[styles.actionButton, status === 'computing' && {opacity: 0.5}]}
                            onPress={handleAddSeed}
                            disabled={status !== 'idle'}
                        >
                            <View style={[styles.iconCircle, {backgroundColor: '#E3F2FD'}]}>
                                <MaterialCommunityIcons name="plus-circle-outline" size={24} color="#007AFF" />
                            </View>
                            <Text style={styles.actionText}>Generate</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionButton} onPress={handleImportSeed} disabled={status !== 'idle'}>
                            <View style={[styles.iconCircle, {backgroundColor: '#E8F5E9'}]}>
                                <MaterialCommunityIcons name="import" size={24} color="#4CAF50" />
                            </View>
                            <Text style={styles.actionText}>Import</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionButton} onPress={() => keystore.clear()} disabled={status !== 'idle'}>
                            <View style={[styles.iconCircle, {backgroundColor: '#FFF3E0'}]}>
                                <MaterialCommunityIcons name="delete-sweep-outline" size={24} color="#FF9800" />
                            </View>
                            <Text style={styles.actionText}>Clear All</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>Available Keys</Text>
                {keys.length === 0 ? (
                    <Animated.View 
                        entering={FadeIn} 
                        exiting={FadeOut}
                        style={styles.emptyState}
                    >
                        <Text style={styles.emptyStateText}>No derived keys yet.</Text>
                    </Animated.View>
                ) : (
                    keys.map((item, i) => (
                        <Animated.View
                            key={item.id || i}
                            entering={FadeIn.duration(300)}
                            exiting={FadeOut.duration(300)}
                            layout={LinearTransition.springify()}
                        >
                            <TouchableOpacity
                                style={[styles.keyCard, activeKey === item.id && styles.activeKeyCard]}
                                onPress={() => setActiveKey(item.id)}
                            >
                                <View style={styles.keyInfo}>
                                    <View style={[styles.keyIconContainer, activeKey === item.id && styles.activeKeyIconContainer]}>
                                        <MaterialCommunityIcons
                                            name="key"
                                            size={20}
                                            color={activeKey === item.id ? "#007AFF" : "#666"}
                                        />
                                    </View>
                                    <View>
                                        <Text style={[styles.keyType, activeKey === item.id && styles.activeKeyType]}>{item.type}</Text>
                                        <Text style={styles.keyAddress}>{item.algorithm}</Text>
                                    </View>
                                </View>
                                <View style={styles.keyActions}>
                                    <TouchableOpacity onPress={() => handleExportKey(item.id)} style={styles.actionIcon}>
                                        <MaterialCommunityIcons name="export-variant" size={24} color="#007AFF" />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => keystore.remove(item.id)}>
                                        <MaterialCommunityIcons name="delete-outline" size={24} color="#FF3B30" />
                                    </TouchableOpacity>
                                </View>
                            </TouchableOpacity>
                        </Animated.View>
                    ))
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
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 10,
        marginBottom: 10,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        marginTop: 4,
        alignSelf: 'flex-start',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    statusText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#666',
    },
    welcomeText: {
        fontSize: 14,
        color: '#666',
    },
    walletName: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1A1A1A',
    },
    profileButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    balanceCard: {
        backgroundColor: '#FFF',
        borderRadius: 24,
        padding: 24,
        marginBottom: 32,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
        alignItems: 'center',
    },
    balanceLabel: {
        fontSize: 14,
        color: '#666',
        marginBottom: 8,
    },
    balanceAmount: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#1A1A1A',
        marginBottom: 24,
    },
    actionButtons: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
    },
    actionButton: {
        alignItems: 'center',
    },
    iconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    actionText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#333',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1A1A1A',
        marginBottom: 16,
        marginTop: 8,
    },
    keyCard: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    activeKeyCard: {
        borderColor: '#007AFF',
        backgroundColor: '#F0F7FF',
    },
    keyInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    keyIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F0F0F0',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    activeKeyIconContainer: {
        backgroundColor: '#E3F2FD',
    },
    keyType: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#666',
        marginBottom: 2,
    },
    activeKeyType: {
        color: '#007AFF',
    },
    keyAddress: {
        fontSize: 15,
        color: '#333',
        fontWeight: '500',
    },
    keyActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionIcon: {
        marginRight: 12,
    },
    keyId: {
        fontSize: 14,
        color: '#999',
    },
    emptyState: {
        padding: 20,
        alignItems: 'center',
        backgroundColor: '#F0F0F0',
        borderRadius: 12,
        marginBottom: 16,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: '#CCC',
    },
    emptyStateText: {
        color: '#999',
    },
    inputContainer: {
        flexDirection: "row",
        marginBottom: 16,
    },
    input: {
        flex: 1,
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: "#E0E0E0",
        padding: 12,
        marginRight: 10,
        borderRadius: 12,
        fontSize: 16,
    },
    addButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 20,
        justifyContent: 'center',
        borderRadius: 12,
    },
    addButtonText: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    secretItem: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 12,
        backgroundColor: '#FFF',
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    secretName: {
        fontSize: 16,
        fontWeight: "600",
        color: '#333',
    },
    secretId: {
        fontSize: 11,
        color: "#999",
    },
});