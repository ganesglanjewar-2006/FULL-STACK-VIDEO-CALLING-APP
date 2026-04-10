const express = require('express');
const path = require('path');
const app = express();

const port = process.env.PORT || 3000;

// Path to the React build folder
const buildPath = path.join(__dirname, 'build');

// Serve static files from the build directory
app.use(express.static(buildPath));

// For any request that doesn't match a static file, return index.html
// This handles client-side routing in React
app.get('*', (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
});

app.listen(port, () => {
    console.log(`Frontend server is running on port ${port}`);
    console.log(`Serving files from: ${buildPath}`);
});
