const express = require('express');
const cors = require('cors');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON body parsing
app.use(cors());
app.use(express.json());

// Initialize SQLite database
const dbFile = path.join(__dirname, 'clients.sqlite');
const db = new DatabaseSync(dbFile);

// Enable foreign key support for cascade deletes
db.exec('PRAGMA foreign_keys = ON');

// Create tables if they do not exist
db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    businessType TEXT,
    leadStatus TEXT,
    phone TEXT,
    email TEXT,
    websiteUrl TEXT,
    instagramLink TEXT,
    facebookLink TEXT,
    followUpDate TEXT,
    priorityLevel TEXT,
    websiteStatus TEXT,
    socialStatus TEXT,
    auditReport TEXT,
    painPoints TEXT,
    recommendedServices TEXT,
    budgetNotes TEXT,
    notes TEXT,
    dateAdded TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS timeline_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clientId TEXT NOT NULL,
    date TEXT NOT NULL,
    note TEXT NOT NULL,
    FOREIGN KEY(clientId) REFERENCES clients(id) ON DELETE CASCADE
  )
`);

// Helper to retrieve a client with timeline events sorted newest first
function getClientWithTimeline(clientId) {
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);
  if (!client) return null;
  const timeline = db.prepare('SELECT date, note FROM timeline_events WHERE clientId = ? ORDER BY date DESC, id DESC').all(clientId);
  client.timeline = timeline;
  return client;
}

// 1. Get all clients with timeline events aggregated
app.get('/api/clients', (req, res) => {
  try {
    const clients = db.prepare('SELECT * FROM clients').all();
    const events = db.prepare('SELECT clientId, date, note FROM timeline_events ORDER BY date DESC, id DESC').all();
    
    // Group timeline events by clientId
    const eventsByClientId = {};
    for (const ev of events) {
      if (!eventsByClientId[ev.clientId]) {
        eventsByClientId[ev.clientId] = [];
      }
      eventsByClientId[ev.clientId].push({ date: ev.date, note: ev.note });
    }
    
    // Attach timeline list to each client
    for (const c of clients) {
      c.timeline = eventsByClientId[c.id] || [];
    }
    
    res.json(clients);
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ error: 'Failed to fetch clients from database' });
  }
});

// 2. Create a client and insert default timeline
app.post('/api/clients', (req, res) => {
  try {
    const data = req.body;
    const clientId = data.id || 'client_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const dateAdded = data.dateAdded || new Date().toISOString().split('T')[0];
    
    const insertClient = db.prepare(`
      INSERT INTO clients (
        id, name, businessType, leadStatus, phone, email, websiteUrl, instagramLink, facebookLink, 
        followUpDate, priorityLevel, websiteStatus, socialStatus, auditReport, painPoints, 
        recommendedServices, budgetNotes, notes, dateAdded
      ) VALUES (
        :id, :name, :businessType, :leadStatus, :phone, :email, :websiteUrl, :instagramLink, :facebookLink, 
        :followUpDate, :priorityLevel, :websiteStatus, :socialStatus, :auditReport, :painPoints, 
        :recommendedServices, :budgetNotes, :notes, :dateAdded
      )
    `);
    
    insertClient.run({
      id: clientId,
      name: data.name || 'Unnamed Client',
      businessType: data.businessType || '',
      leadStatus: data.leadStatus || 'Cold Lead',
      phone: data.phone || '',
      email: data.email || '',
      websiteUrl: data.websiteUrl || '',
      instagramLink: data.instagramLink || '',
      facebookLink: data.facebookLink || '',
      followUpDate: data.followUpDate || '',
      priorityLevel: data.priorityLevel || 'Medium',
      websiteStatus: data.websiteStatus || 'No Website',
      socialStatus: data.socialStatus || 'No Presence',
      auditReport: data.auditReport || '',
      painPoints: data.painPoints || '',
      recommendedServices: data.recommendedServices || '',
      budgetNotes: data.budgetNotes || '',
      notes: data.notes || '',
      dateAdded: dateAdded
    });
    
    // Add default creation timeline event
    const insertTimeline = db.prepare(`
      INSERT INTO timeline_events (clientId, date, note)
      VALUES (?, ?, ?)
    `);
    insertTimeline.run(clientId, dateAdded, 'Added to INTASIA CRM database');
    
    const newClient = getClientWithTimeline(clientId);
    res.status(201).json(newClient);
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ error: 'Failed to create client in database' });
  }
});

// 3. Update client details (logs timeline event automatically if leadStatus changes)
app.put('/api/clients/:id', (req, res) => {
  try {
    const id = req.params.id;
    const data = req.body;
    
    const prevClient = db.prepare('SELECT leadStatus FROM clients WHERE id = ?').get(id);
    if (!prevClient) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    const updateClient = db.prepare(`
      UPDATE clients SET
        name = :name,
        businessType = :businessType,
        leadStatus = :leadStatus,
        phone = :phone,
        email = :email,
        websiteUrl = :websiteUrl,
        instagramLink = :instagramLink,
        facebookLink = :facebookLink,
        followUpDate = :followUpDate,
        priorityLevel = :priorityLevel,
        websiteStatus = :websiteStatus,
        socialStatus = :socialStatus,
        auditReport = :auditReport,
        painPoints = :painPoints,
        recommendedServices = :recommendedServices,
        budgetNotes = :budgetNotes,
        notes = :notes
      WHERE id = :id
    `);
    
    updateClient.run({
      id: id,
      name: data.name || '',
      businessType: data.businessType || '',
      leadStatus: data.leadStatus || 'Cold Lead',
      phone: data.phone || '',
      email: data.email || '',
      websiteUrl: data.websiteUrl || '',
      instagramLink: data.instagramLink || '',
      facebookLink: data.facebookLink || '',
      followUpDate: data.followUpDate || '',
      priorityLevel: data.priorityLevel || 'Medium',
      websiteStatus: data.websiteStatus || 'No Website',
      socialStatus: data.socialStatus || 'No Presence',
      auditReport: data.auditReport || '',
      painPoints: data.painPoints || '',
      recommendedServices: data.recommendedServices || '',
      budgetNotes: data.budgetNotes || '',
      notes: data.notes || ''
    });
    
    // Log transition if the lead status changed
    if (prevClient.leadStatus !== data.leadStatus) {
      const todayStr = new Date().toISOString().split('T')[0];
      const insertTimeline = db.prepare(`
        INSERT INTO timeline_events (clientId, date, note)
        VALUES (?, ?, ?)
      `);
      insertTimeline.run(
        id, 
        todayStr, 
        `Lead status updated from "${prevClient.leadStatus}" to "${data.leadStatus}"`
      );
    }
    
    const updatedClient = getClientWithTimeline(id);
    res.json(updatedClient);
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

// 4. Delete client and cascaded timeline events
app.delete('/api/clients/:id', (req, res) => {
  try {
    const id = req.params.id;
    const result = db.prepare('DELETE FROM clients WHERE id = ?').run(id);
    res.json({ success: true, changes: result.changes });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

// 5. Add custom note to client timeline
app.post('/api/clients/:id/timeline', (req, res) => {
  try {
    const id = req.params.id;
    const { note } = req.body;
    const todayStr = new Date().toISOString().split('T')[0];
    
    if (!note) {
      return res.status(400).json({ error: 'Note content is required' });
    }
    
    const insertTimeline = db.prepare(`
      INSERT INTO timeline_events (clientId, date, note)
      VALUES (?, ?, ?)
    `);
    insertTimeline.run(id, todayStr, note);
    
    const timeline = db.prepare('SELECT date, note FROM timeline_events WHERE clientId = ? ORDER BY date DESC, id DESC').all(id);
    res.json(timeline);
  } catch (error) {
    console.error('Error adding timeline event:', error);
    res.status(500).json({ error: 'Failed to add timeline event' });
  }
});

// 6. Bulk import clients (CSV Upload Service) runs within database transaction
app.post('/api/clients/bulk', (req, res) => {
  try {
    const { clients } = req.body;
    if (!Array.isArray(clients)) {
      return res.status(400).json({ error: 'Clients list is required and must be an array' });
    }
    
    // Begin transaction for speed and atomicity
    db.exec('BEGIN TRANSACTION');
    
    const insertClient = db.prepare(`
      INSERT OR REPLACE INTO clients (
        id, name, businessType, leadStatus, phone, email, websiteUrl, instagramLink, facebookLink, 
        followUpDate, priorityLevel, websiteStatus, socialStatus, auditReport, painPoints, 
        recommendedServices, budgetNotes, notes, dateAdded
      ) VALUES (
        :id, :name, :businessType, :leadStatus, :phone, :email, :websiteUrl, :instagramLink, :facebookLink, 
        :followUpDate, :priorityLevel, :websiteStatus, :socialStatus, :auditReport, :painPoints, 
        :recommendedServices, :budgetNotes, :notes, :dateAdded
      )
    `);
    
    const insertTimeline = db.prepare(`
      INSERT INTO timeline_events (clientId, date, note)
      VALUES (?, ?, ?)
    `);
    
    const importedClients = [];
    const todayStr = new Date().toISOString().split('T')[0];
    
    for (const c of clients) {
      const clientId = c.id || 'client_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      const dateAdded = c.dateAdded || todayStr;
      
      insertClient.run({
        id: clientId,
        name: c.name || 'Imported Lead',
        businessType: c.businessType || '',
        leadStatus: c.leadStatus || 'Cold Lead',
        phone: c.phone || '',
        email: c.email || '',
        websiteUrl: c.websiteUrl || '',
        instagramLink: c.instagramLink || '',
        facebookLink: c.facebookLink || '',
        followUpDate: c.followUpDate || '',
        priorityLevel: c.priorityLevel || 'Medium',
        websiteStatus: c.websiteStatus || 'No Website',
        socialStatus: c.socialStatus || 'No Presence',
        auditReport: c.auditReport || '',
        painPoints: c.painPoints || '',
        recommendedServices: c.recommendedServices || '',
        budgetNotes: c.budgetNotes || '',
        notes: c.notes || '',
        dateAdded: dateAdded
      });
      
      insertTimeline.run(clientId, dateAdded, 'Added to INTASIA CRM database');
      
      importedClients.push({
        ...c,
        id: clientId,
        dateAdded: dateAdded,
        timeline: [{ date: dateAdded, note: 'Added to INTASIA CRM database' }]
      });
    }
    
    db.exec('COMMIT');
    res.status(201).json(importedClients);
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Rollback failed:', rollbackErr);
    }
    console.error('Error during bulk import transaction:', error);
    res.status(500).json({ error: 'Bulk client import database transaction failed' });
  }
});

// Serve frontend files statically
app.use(express.static(__dirname));

// Direct fallback to index.html for SPA if any (unneeded here but good practice)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start listening
app.listen(PORT, () => {
  console.log(`INTASIA CRM application is live!`);
  console.log(`URL: http://localhost:${PORT}`);
});
