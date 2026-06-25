const xlsx = require('xlsx');

const filepath = process.argv[2];
try {
    const workbook = xlsx.readFile(filepath);
    const result = {};
    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const json = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        result[sheetName] = json.slice(0, 15);
    }
    console.log(JSON.stringify(result, null, 2));
} catch (e) {
    console.error(e.message);
}
