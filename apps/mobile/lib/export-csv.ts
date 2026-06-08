import { cacheDirectory, writeAsStringAsync } from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

export async function shareCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.join(",")).join("\n");
  const path = `${cacheDirectory}${filename}`;
  await writeAsStringAsync(path, csv);  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, { mimeType: "text/csv", dialogTitle: "Export report" });
  }
}
