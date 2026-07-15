const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'src', 'data', 'trips.json');
const raw = fs.readFileSync(dataPath, 'utf8');
const trips = JSON.parse(raw);

console.log(`Found ${trips.length} trips.`);
if (trips.length < 30) {
  console.error('Error: expected at least 30 trips in src/data/trips.json');
  process.exit(2);
}
console.log('Data check passed.');
