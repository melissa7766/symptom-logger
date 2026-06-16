import { useState } from "react";
import {
  Text,
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Each symptom defines its own ordered list of severity levels.
const DEFAULT_LEVELS = ["Mild", "Moderate", "Severe"];
const SYMPTOM_DEFS: { name: string; levels: string[] }[] = [
  { name: "Cramps", levels: DEFAULT_LEVELS },
  { name: "Fatigue", levels: DEFAULT_LEVELS },
  { name: "Bloating", levels: DEFAULT_LEVELS },
  { name: "Nausea", levels: DEFAULT_LEVELS },
  { name: "Back pain", levels: DEFAULT_LEVELS },
  { name: "Bleeding", levels: ["Spotting", "Light", "Heavy", "Flooding"] },
];

export default function HomeScreen() {
  const [painLevel, setPainLevel] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [symptoms, setSymptoms] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const levels = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  function cycleSymptom(symptom: string, symptomLevels: string[]) {
    setSymptoms((current) => {
      const cycle = [null, ...symptomLevels];
      const currentLevel = current[symptom] ?? null;
      const idx = cycle.indexOf(currentLevel);
      const next = cycle[(idx + 1) % cycle.length];
      const updated = { ...current };
      if (next === null) {
        delete updated[symptom];
      } else {
        updated[symptom] = next;
      }
      return updated;
    });
  }

  // Color deepens with severity, based on position in that symptom's scale.
  function severityStyle(level: string | null, symptomLevels: string[]) {
    if (!level) return null;
    const pos = symptomLevels.indexOf(level);
    const ratio = symptomLevels.length > 1 ? pos / (symptomLevels.length - 1) : 1;
    if (ratio < 0.34) return styles.chipLow;
    if (ratio < 0.67) return styles.chipMid;
    return styles.chipHigh;
  }

  async function handleSave() {
    if (painLevel === null) return;

    const entry = {
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      date: new Date().toISOString(),
      painLevel,
      note,
      symptoms,
    };

    try {
      const existing = await AsyncStorage.getItem("entries");
      const list = existing ? JSON.parse(existing) : [];
      list.push(entry);
      await AsyncStorage.setItem("entries", JSON.stringify(list));

      setPainLevel(null);
      setNote("");
      setSymptoms({});
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.log("Save failed", e);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>How's your pain today?</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollRow}
        >
          {levels.map((level) => (
            <Pressable
              key={level}
              onPress={() => setPainLevel(level)}
              style={[
                styles.bubble,
                painLevel === level && styles.bubbleSelected,
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  painLevel === level && styles.bubbleTextSelected,
                ]}
              >
                {level}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.label}>Symptoms</Text>
        <Text style={styles.hint}>Tap a symptom to cycle its severity</Text>
        <View style={styles.symptomWrap}>
          {SYMPTOM_DEFS.map(({ name, levels: symptomLevels }) => {
            const level = symptoms[name] ?? null;
            return (
              <Pressable
                key={name}
                onPress={() => cycleSymptom(name, symptomLevels)}
                style={[styles.chip, severityStyle(level, symptomLevels)]}
              >
                <Text style={[styles.chipText, level && styles.chipTextSelected]}>
                  {name}
                  {level ? ` · ${level}` : ""}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={styles.input}
          placeholder="Anything else about today?"
          value={note}
          onChangeText={setNote}
          multiline
        />

        <Pressable
          onPress={handleSave}
          style={[
            styles.saveButton,
            painLevel === null && styles.saveButtonDisabled,
          ]}
        >
          <Text style={styles.saveButtonText}>Save Entry</Text>
        </Pressable>

        {saved && <Text style={styles.savedMsg}>✓ Entry saved!</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16, paddingBottom: 40 },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#c2185b",
    textAlign: "center",
    marginBottom: 20,
    marginTop: 10,
  },
  scrollRow: { paddingVertical: 4, gap: 10, alignItems: "center" },
  bubble: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#f3e5f0",
    justifyContent: "center",
    alignItems: "center",
  },
  bubbleSelected: { backgroundColor: "#c2185b" },
  bubbleText: { fontSize: 18, fontWeight: "600", color: "#c2185b" },
  bubbleTextSelected: { color: "#fff" },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginTop: 28,
    marginBottom: 4,
  },
  hint: { fontSize: 12, color: "#999", marginBottom: 10 },
  symptomWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f3e5f0",
  },
  chipLow: { backgroundColor: "#f3a9cb" },
  chipMid: { backgroundColor: "#d65a8e" },
  chipHigh: { backgroundColor: "#c2185b" },
  chipText: { color: "#c2185b", fontWeight: "500" },
  chipTextSelected: { color: "#fff" },
  input: {
    borderWidth: 1,
    borderColor: "#e0c5d8",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    minHeight: 70,
    textAlignVertical: "top",
  },
  saveButton: {
    backgroundColor: "#c2185b",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 28,
  },
  saveButtonDisabled: { backgroundColor: "#e0b8cd" },
  saveButtonText: { color: "#fff", fontSize: 17, fontWeight: "600" },
  savedMsg: {
    textAlign: "center",
    color: "#2e7d32",
    fontSize: 16,
    marginTop: 16,
  },
});