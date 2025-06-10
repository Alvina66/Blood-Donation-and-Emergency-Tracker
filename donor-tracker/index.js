const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./db');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from frontend (if both in same project)
app.use(express.static(path.join(__dirname, '../donor-web')));

// Root endpoint
app.get('/', async (req, res) => {
    try {
        res.json('Welcome to Blood Donation Management System API');
    } catch (error) {
        res.status(500).json({ Error: error.message });
    }
});

// GET endpoints for all tables
const tables = [
    'blood_donation_campaigns',
    'blood_inventory',
    'blood_tests',
    'bloodbanks',
    'donations',
    'donor_eligibility',
    'donors',
    'emergency_requests',
    'hospitals',
    'request_fulfillments',
    'staff',
    'users'
];

// Helper function to get primary key column name
function getPrimaryKeyColumn(tableName) {
    const pkMap = {
        'blood_donation_campaigns': 'campaign_id',
        'blood_inventory': 'inventory_id',
        'blood_tests': 'test_id',
        'bloodbanks': 'bloodbank_id',
        'donations': 'donation_id',
        'donor_eligibility': 'eligibility_id',
        'donors': 'donor_id',
        'emergency_requests': 'request_id',
        'hospitals': 'hospital_id',
        'request_fulfillments': 'fulfillment_id',
        'staff': 'staff_id',
        'users': 'user_id'
    };

    return pkMap[tableName] || `${tableName.slice(0, -1)}_id`;
}

// Generate GET endpoints for each table
tables.forEach(table => {
    app.get(`/${table}`, async (req, res) => {
        try {
            const result = await pool.query(`SELECT * FROM ${table}`);
            res.json(result.rows);
        } catch (err) {
            console.error(`Error fetching ${table}:`, err);
            res.status(500).json({ Error: err.message });
        }
    });

    // POST endpoint for adding new records
    app.post(`/${table}`, async (req, res) => {
        try {
            const data = req.body;

            // Remove empty strings and convert to null
            Object.keys(data).forEach(key => {
                if (data[key] === '' || data[key] === undefined) {
                    data[key] = null;
                }
            });

            const columns = Object.keys(data).join(', ');
            const values = Object.values(data);
            const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');

            const query = `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`;
            console.log(`Executing POST query: ${query}`, values);

            const result = await pool.query(query, values);
            res.status(201).json(result.rows[0]);
        } catch (err) {
            console.error(`Error adding to ${table}:`, err);
            res.status(500).json({ Error: err.message });
        }
    });

    // PUT endpoint for updating records
    app.put(`/${table}/:id`, async (req, res) => {
        try {
            const { id } = req.params;
            const data = req.body;

            // Get the primary key column name
            const idColumn = getPrimaryKeyColumn(table);
            console.log(`Updating ${table} with ID column: ${idColumn}, ID: ${id}`);

            // Remove empty strings and convert to null
            Object.keys(data).forEach(key => {
                if (data[key] === '' || data[key] === undefined) {
                    data[key] = null;
                }
            });

            // Remove the primary key from update data if it exists
            if (data[idColumn]) {
                delete data[idColumn];
            }

            const columns = Object.keys(data);
            const values = Object.values(data);

            if (columns.length === 0) {
                return res.status(400).json({ Error: 'No data to update' });
            }

            const setClause = columns.map((col, index) => `${col} = $${index + 1}`).join(', ');

            const query = `UPDATE ${table} SET ${setClause} WHERE ${idColumn} = $${columns.length + 1} RETURNING *`;
            console.log(`Executing PUT query: ${query}`, [...values, id]);

            const result = await pool.query(query, [...values, id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ Error: 'Record not found' });
            }

            res.json(result.rows[0]);
        } catch (err) {
            console.error(`Error updating ${table}:`, err);
            res.status(500).json({ Error: err.message });
        }
    });

    // DELETE endpoint for deleting records
    app.delete(`/${table}/:id`, async (req, res) => {
        try {
            const { id } = req.params;

            // Get the primary key column name
            const idColumn = getPrimaryKeyColumn(table);
            console.log(`Deleting from ${table} with ID column: ${idColumn}, ID: ${id}`);

            const query = `DELETE FROM ${table} WHERE ${idColumn} = $1 RETURNING *`;
            console.log(`Executing DELETE query: ${query}`, [id]);

            const result = await pool.query(query, [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ Error: 'Record not found' });
            }

            res.json({ message: 'Record deleted successfully', deleted: result.rows[0] });
        } catch (err) {
            console.error(`Error deleting from ${table}:`, err);
            res.status(500).json({ Error: err.message });
        }
    });
});

// Count endpoints
app.get('/count-donors', async (req, res) => {
    try {
        const result = await pool.query('SELECT COUNT(*) FROM donors');
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ Error: err.message });
    }
});

app.get('/count-donations', async (req, res) => {
    try {
        const result = await pool.query('SELECT COUNT(*) FROM donations');
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ Error: err.message });
    }
});

app.get('/count-bloodbanks', async (req, res) => {
    try {
        const result = await pool.query('SELECT COUNT(*) FROM bloodbanks');
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ Error: err.message });
    }
});

// Complex query endpoints
app.get('/donor-details', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT d.*, de.eligibility_status, de.test_results, 
                   COUNT(dn.donation_id) as total_donations
            FROM donors d
            LEFT JOIN donor_eligibility de ON d.donor_id = de.donor_id
            LEFT JOIN donations dn ON d.donor_id = dn.donor_id
            GROUP BY d.donor_id, de.eligibility_id
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ Error: err.message });
    }
});

app.get('/blood-inventory-status', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT b.blood_type, b.quantity, bb.bloodbank_name, bb.location
            FROM blood_inventory b
            JOIN bloodbanks bb ON b.bloodbank_id = bb.bloodbank_id
            ORDER BY b.blood_type, bb.bloodbank_name
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ Error: err.message });
    }
});

app.get('/emergency-request-status', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT er.*, h.hospital_name, 
                   rf.fulfillment_status, rf.bloodbank_id,
                   bb.bloodbank_name
            FROM emergency_requests er
            JOIN hospitals h ON er.hospital_id = h.hospital_id
            LEFT JOIN request_fulfillments rf ON er.request_id = rf.request_id
            LEFT JOIN bloodbanks bb ON rf.bloodbank_id = bb.bloodbank_id
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ Error: err.message });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ Error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});