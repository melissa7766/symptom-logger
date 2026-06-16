import { useState, useCallback } from "react";
import {
  Text,
  View,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import DateTimePicker from "@react-native-community/datetimepicker";

type Severity = "Mild" | "Moderate" | "Severe";

type Entry = {
  id?: string;
  date: string;
  painLevel: number;
  note: string;
  // old entries: string[]  |  new entries: Record<string, Severity>
  symptoms: string[] | Record<string, Severity>;
};

type FilterMode = "all" | "from" | "between";

// Normalize either shape into a list of { name, severity } pairs.
function normalizeSymptoms(
  symptoms: Entry["symptoms"]
): { name: string; severity: Severity | null }[] {
  if (Array.isArray(symptoms)) {
    return symptoms.map((name) => ({ name, severity: null }));
  }
  return Object.entries(symptoms).map(([name, severity]) => ({
    name,
    severity,
  }));
}

export default function HistoryScreen() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [name, setName] = useState("");

  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState<null | "from" | "to">(null);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const stored = await AsyncStorage.getItem("entries");
        const list: Entry[] = stored ? JSON.parse(stored) : [];
        setEntries(list.reverse());

        const savedName = await AsyncStorage.getItem("patientName");
        if (savedName) setName(savedName);
      }
      load();
    }, [])
  );

  function handleNameChange(text: string) {
    setName(text);
    AsyncStorage.setItem("patientName", text);
  }

  function startOfDay(d: Date) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }
  function endOfDay(d: Date) {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  }

  function getFilteredEntries() {
    if (filterMode === "all") return entries;
    return entries.filter((e) => {
      const d = new Date(e.date);
      if (filterMode === "from") return d >= startOfDay(fromDate);
      return d >= startOfDay(fromDate) && d <= endOfDay(toDate);
    });
  }

  function confirmDelete(entry: Entry) {
    Alert.alert("Delete entry?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteEntry(entry) },
    ]);
  }

  async function deleteEntry(entry: Entry) {
    const stored = await AsyncStorage.getItem("entries");
    const list: Entry[] = stored ? JSON.parse(stored) : [];
    const updated = list.filter((e) =>
      entry.id ? e.id !== entry.id : e.date !== entry.date
    );
    await AsyncStorage.setItem("entries", JSON.stringify(updated));
    setEntries([...updated].reverse());
  }

  function buildReportHtml(list: Entry[]) {
    const pains = list.map((e) => e.painLevel);
    const avgPain =
      pains.length > 0
        ? (pains.reduce((a, b) => a + b, 0) / pains.length).toFixed(1)
        : "—";

    const symptomCounts: Record<string, number> = {};
    list.forEach((e) =>
      normalizeSymptoms(e.symptoms).forEach(({ name }) => {
        symptomCounts[name] = (symptomCounts[name] || 0) + 1;
      })
    );
    const topSymptoms =
      Object.entries(symptomCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([s, c]) => `${s} (${c})`)
        .join(", ") || "None recorded";

    const sorted = [...list].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const rangeText =
      sorted.length > 0
        ? `${new Date(sorted[0].date).toLocaleDateString()} – ${new Date(
            sorted[sorted.length - 1].date
          ).toLocaleDateString()}`
        : "—";

    const rows = sorted
      .map((e) => {
        const symptomText =
          normalizeSymptoms(e.symptoms)
            .map((s) => (s.severity ? `${s.name} (${s.severity})` : s.name))
            .join(", ") || "—";
        return `
        <tr>
          <td>${new Date(e.date).toLocaleDateString()}</td>
          <td style="text-align:center;font-weight:600;">${e.painLevel}/10</td>
          <td>${symptomText}</td>
          <td>${e.note || "—"}</td>
        </tr>`;
      })
      .join("");

    return `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            body { font-family: -apple-system, Helvetica, sans-serif; padding: 24px; color: #222; }
            h1 { color: #c2185b; margin-bottom: 4px; }
            .meta { color: #666; font-size: 13px; margin-bottom: 20px; }
            .summary { background: #faf3f8; border: 1px solid #f0e0eb; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px; }
            .summary p { margin: 4px 0; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; }
            th { background: #c2185b; color: #fff; text-align: left; padding: 8px; }
            td { padding: 8px; border-bottom: 1px solid #eee; vertical-align: top; }
          </style>
        </head>
        <body>
          <h1>Endometriosis Symptom Report</h1>
          <div class="meta">
            ${name ? `Patient: ${name}<br/>` : ""}
            Date range: ${rangeText}<br/>
            Generated: ${new Date().toLocaleDateString()}
          </div>
          <div class="summary">
            <p><strong>Total entries:</strong> ${list.length}</p>
            <p><strong>Average pain:</strong> ${avgPain}/10</p>
            <p><strong>Most frequent symptoms:</strong> ${topSymptoms}</p>
          </div>
          <table>
            <tr><th>Date</th><th>Pain</th><th>Symptoms</th><th>Notes</th></tr>
            ${rows}
          </table>
        </body>
      </html>
    `;
  }

  async function handleExport() {
    const list = getFilteredEntries();
    if (list.length === 0) {
      Alert.alert("Nothing to export", "No entries in the selected range.");
      return;
    }
    try {
      const html = buildReportHtml(list);
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: "Share your symptom report",
      });
    } catch (e) {
      console.log("Export failed", e);
    }
  }

  function severityColor(level: Severity | null) {
    switch (level) {
      case "Mild":
        return "#f3a9cb";
      case "Moderate":
        return "#d65a8e";
      case "Severe":
        return "#c2185b";
      default:
        return "#e8d4e2";
    }
  }

  const filtered = getFilteredEntries();

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>History</Text>

      <View style={styles.nameRow}>
        <TextInput
          style={styles.nameInput}
          placeholder="Your name (for report)"
          value={name}
          onChangeText={handleNameChange}
        />
      </View>

      <View style={styles.filterRow}>
        {(["all", "from", "between"] as FilterMode[]).map((mode) => (
          <Pressable
            key={mode}
            onPress={() => setFilterMode(mode)}
            style={[
              styles.filterChip,
              filterMode === mode && styles.filterChipActive,
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                filterMode === mode && styles.filterChipTextActive,
              ]}
            >
              {mode === "all" ? "All" : mode === "from" ? "From…" : "Between…"}
            </Text>
          </Pressable>
        ))}
      </View>

      {filterMode !== "all" && (
        <View style={styles.dateButtonRow}>
          <Pressable
            style={styles.dateButton}
            onPress={() => setShowPicker("from")}
          >
            <Text style={styles.dateButtonText}>
              From: {fromDate.toLocaleDateString()}
            </Text>
          </Pressable>
          {filterMode === "between" && (
            <Pressable
              style={styles.dateButton}
              onPress={() => setShowPicker("to")}
            >
              <Text style={styles.dateButtonText}>
                To: {toDate.toLocaleDateString()}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {showPicker && (
        <DateTimePicker
          value={showPicker === "from" ? fromDate : toDate}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          onChange={(event, selected) => {
            setShowPicker(Platform.OS === "ios" ? showPicker : null);
            if (selected) {
              if (showPicker === "from") setFromDate(selected);
              else setToDate(selected);
            }
          }}
        />
      )}

      {showPicker && Platform.OS === "ios" && (
        <Pressable style={styles.doneButton} onPress={() => setShowPicker(null)}>
          <Text style={styles.doneButtonText}>Done</Text>
        </Pressable>
      )}

      {filtered.length === 0 ? (
        <Text style={styles.empty}>No entries in this range.</Text>
      ) : (
        <>
          <Pressable style={styles.exportButton} onPress={handleExport}>
            <Text style={styles.exportButtonText}>Export PDF</Text>
          </Pressable>

          <Text style={styles.hint}>Press and hold an entry to delete it.</Text>

          <FlatList
            data={filtered}
            keyExtractor={(item, index) =>
              item.id ?? item.date ?? index.toString()
            }
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const symptomList = normalizeSymptoms(item.symptoms);
              return (
                <Pressable
                  onLongPress={() => confirmDelete(item)}
                  delayLongPress={400}
                  style={styles.card}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.date}>
                      {new Date(item.date).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </Text>
                    <View style={styles.painBadge}>
                      <Text style={styles.painBadgeText}>
                        {item.painLevel}/10
                      </Text>
                    </View>
                  </View>

                  {symptomList.length > 0 && (
                    <View style={styles.symptomTagWrap}>
                      {symptomList.map((s) => (
                        <View
                          key={s.name}
                          style={[
                            styles.symptomTag,
                            { backgroundColor: severityColor(s.severity) },
                          ]}
                        >
                          <Text
                            style={[
                              styles.symptomTagText,
                              s.severity === "Mild" || s.severity === null
                                ? styles.symptomTagTextDark
                                : styles.symptomTagTextLight,
                            ]}
                          >
                            {s.name}
                            {s.severity ? ` · ${s.severity}` : ""}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {item.note ? (
                    <Text style={styles.note}>{item.note}</Text>
                  ) : null}
                </Pressable>
              );
            }}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#c2185b",
    textAlign: "center",
    marginVertical: 16,
  },
  nameRow: { paddingHorizontal: 16, marginBottom: 12 },
  nameInput: {
    borderWidth: 1,
    borderColor: "#e0c5d8",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 10,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f3e5f0",
  },
  filterChipActive: { backgroundColor: "#c2185b" },
  filterChipText: { color: "#c2185b", fontWeight: "500" },
  filterChipTextActive: { color: "#fff" },
  dateButtonRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 10,
  },
  dateButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e0c5d8",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  dateButtonText: { color: "#333", fontSize: 13 },
  doneButton: {
    alignSelf: "center",
    backgroundColor: "#c2185b",
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 10,
  },
  doneButtonText: { color: "#fff", fontWeight: "600" },
  empty: { textAlign: "center", color: "#888", marginTop: 40, fontSize: 15 },
  exportButton: {
    backgroundColor: "#c2185b",
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 6,
  },
  exportButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  hint: { textAlign: "center", color: "#999", fontSize: 12, marginBottom: 6 },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: "#faf3f8",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#f0e0eb",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  date: { fontSize: 15, fontWeight: "600", color: "#333" },
  painBadge: {
    backgroundColor: "#c2185b",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  painBadgeText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  symptomTagWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  symptomTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  symptomTagText: { fontSize: 12, fontWeight: "500" },
  symptomTagTextDark: { color: "#7a1340" },
  symptomTagTextLight: { color: "#fff" },
  note: { marginTop: 8, color: "#555", fontSize: 14 },
});