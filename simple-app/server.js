const express = require('express');
const path = require('path');

const app = express();
const PORT = 3005;

// Serve static files
app.use(express.static(__dirname));

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log('🌐 Simple Excel to AI Chat Platform running on http://localhost:' + PORT);
    console.log('📊 Features:');
    console.log('   - Model switching');
    console.log('   - Excel upload to Contentstack');
    console.log('   - AI chat with uploaded data');
});
