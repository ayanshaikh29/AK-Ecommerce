// This server.js is the entry point for Hostinger's Node.js Application Manager.
// It runs the standalone Next.js build created inside .next/standalone.

const path = require('path');

// Set production environment variables
process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || 3000;

// Load the Next.js standalone server
require(path.join(__dirname, '.next', 'standalone', 'server.js'));
