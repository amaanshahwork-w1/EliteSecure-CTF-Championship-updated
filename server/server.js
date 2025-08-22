const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');
const xlsx = require('xlsx');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Store registrations in a JSON file
const REGISTRATIONS_FILE = path.join(__dirname, 'data', 'registrations.json');

// Ensure data directory exists
async function ensureDataDir() {
    const dataDir = path.join(__dirname, 'data');
    try {
        await fs.access(dataDir);
    } catch {
        await fs.mkdir(dataDir);
    }
}

// Load registrations from file
async function loadRegistrations() {
    try {
        const data = await fs.readFile(REGISTRATIONS_FILE, 'utf8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

// Save registrations to file
async function saveRegistrations(registrations) {
    await fs.writeFile(REGISTRATIONS_FILE, JSON.stringify(registrations, null, 2));
}

// API Endpoints
app.post('/api/register', async (req, res) => {
    try {
        await ensureDataDir();
        const registrations = await loadRegistrations();
        
        const newRegistration = {
            ...req.body,
            registrationDate: new Date().toISOString(),
            id: registrations.length + 1
        };
        
        registrations.push(newRegistration);
        await saveRegistrations(registrations);
        await updateFiles(); // Update Excel and CSV files immediately
        
        res.status(201).json({ message: 'Registration successful', id: newRegistration.id });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Failed to save registration' });
    }
});

// Admin endpoint to get all registrations (should be protected in production)
app.get('/api/admin/registrations', async (req, res) => {
    try {
        const registrations = await loadRegistrations();
        res.json(registrations);
    } catch (error) {
        console.error('Error fetching registrations:', error);
        res.status(500).json({ error: 'Failed to fetch registrations' });
    }
});

// Export registrations as CSV
app.get('/api/admin/export-csv', async (req, res) => {
    try {
        const registrations = await loadRegistrations();
        const csvHeader = 'ID,Username,Email,Team,Registration Date\n';
        const csvContent = registrations.map(reg => 
            `${reg.id},${reg.username},${reg.email},${reg.team},${reg.registrationDate}`
        ).join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=registrations.csv');
        res.send(csvHeader + csvContent);
    } catch (error) {
        console.error('Error exporting CSV:', error);
        res.status(500).json({ error: 'Failed to export registrations' });
    }
});

// Function to update both CSV and Excel files
async function updateFiles() {
    try {
        const registrations = await loadRegistrations();
        
        // Update CSV
        const csvHeader = 'ID,Username,Email,Team,Registration Date\n';
        const csvContent = registrations.map(reg => 
            `${reg.id},${reg.username},${reg.email},${reg.team},${reg.registrationDate}`
        ).join('\n');
        const csvFilePath = path.join(__dirname, 'data', 'registrations.csv');
        await fs.writeFile(csvFilePath, csvHeader + csvContent);
        
        // Update Excel
        const worksheet = xlsx.utils.json_to_sheet(registrations);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Registrations');
        const excelFilePath = path.join(__dirname, 'data', 'registrations.xlsx');
        xlsx.writeFile(workbook, excelFilePath);
        
        console.log('Files updated at:', new Date().toISOString());
    } catch (error) {
        console.error('Error updating files:', error);
    }
}

// Modify the registration endpoint to update files immediately
app.post('/api/register', async (req, res) => {
    try {
        await ensureDataDir();
        const registrations = await loadRegistrations();
        
        const newRegistration = {
            ...req.body,
            registrationDate: new Date().toISOString(),
            id: registrations.length + 1
        };
        
        registrations.push(newRegistration);
        await saveRegistrations(registrations);
        await updateFiles(); // Update files immediately after registration
        
        res.status(201).json({ message: 'Registration successful', id: newRegistration.id });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Failed to save registration' });
    }
});

// Initialize data directory and start auto-update
async function initializeAutoUpdate() {
    await ensureDataDir();
    await updateFiles();
    
    // Update files every minute
    setInterval(updateFiles, 60000);
}

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    initializeAutoUpdate().catch(console.error);
});
