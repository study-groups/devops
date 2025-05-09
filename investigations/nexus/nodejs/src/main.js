// Import express module
const express = require('express');
// Create an instance of express
const app = express();

// Existing code...

// Define a new route handler function
app.get('/newRoute', (req, res) => {
  res.send('This is a new route');
});

// Start the server
app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
console.log("nexus: 000m0");
