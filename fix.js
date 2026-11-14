const fs = require('fs');

// Read the file
let content = fs.readFileSync('./webhooks/razorpayWebhook.js', 'utf8');

// Show current last 5 lines
console.log('BEFORE - Last 5 lines:');
const lines = content.split('\n');
lines.slice(-5).forEach((line, i) => {
    console.log((lines.length - 5 + i + 1) + ': ' + line);
});

// Remove ALL module.exports lines
const newLines = lines.filter(line => !line.includes('module.exports'));

// Add correct export at the end
newLines.push('module.exports = handleRazorpayWebhook;');

// Save
const newContent = newLines.join('\n');
fs.writeFileSync('./webhooks/razorpayWebhook.js', newContent);

// Verify
console.log('\nAFTER - Last 3 lines:');
const saved = fs.readFileSync('./webhooks/razorpayWebhook.js', 'utf8').split('\n');
saved.slice(-3).forEach((line, i) => {
    console.log(line);
});

// Test import
delete require.cache[require.resolve('./webhooks/razorpayWebhook')];
const w = require('./webhooks/razorpayWebhook');
console.log('\nwebhook type:', typeof w);

if (typeof w === 'function') {
    console.log('SUCCESS! Now run: npm start');
} else {
    console.log('Still object. Check file manually.');
}