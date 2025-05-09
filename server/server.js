const express = require("express");
const ibmdb = require("ibm_db");
const cors = require("cors");
const path = require("path");
const app = express();

app.use(express.static(path.join(__dirname, "public")));
app.use(cors());
app.use(express.json());

// Change port to 5001 since 5000 is in use
const port = 5001;

// Database connection string
const connectionString = "DATABASE=STUDENTS;HOSTNAME=localhost;UID=AKSHAY;PWD=12345;PORT=25000;PROTOCOL=TCPIP";

// Function to validate email
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Function to validate age
function isValidAge(age) {
    const numAge = parseInt(age);
    return !isNaN(numAge) && numAge > 0 && numAge < 150;
}

// Function to validate gender
function isValidGender(gender) {
    return ['M', 'F', 'O'].includes(gender.toUpperCase());
}

// Function to check if table exists
async function checkTableExists(conn, tableName) {
    try {
        const checkSQL = `SELECT 1 FROM SYSCAT.TABLES WHERE TABSCHEMA = CURRENT SCHEMA AND TABNAME = '${tableName}'`;
        const result = await conn.query(checkSQL);
        return result.length > 0;
    } catch (err) {
        console.error("Error checking table existence:", err);
        throw err;
    }
}

// Function to create table if not exists
async function createTableIfNotExists(conn) {
    const tableName = 'STUDENT_DETAILS';
    
    try {
        const tableExists = await checkTableExists(conn, tableName);
        
        if (!tableExists) {
            const createTableSQL = `
                CREATE TABLE ${tableName} (
                    ID INTEGER NOT NULL GENERATED ALWAYS AS IDENTITY,
                    NAME VARCHAR(100) NOT NULL,
                    EMAIL VARCHAR(100) NOT NULL UNIQUE,
                    AGE INTEGER NOT NULL,
                    GENDER CHAR(1) NOT NULL,
                    PRIMARY KEY (ID)
                )
            `;
            await conn.query(createTableSQL);
            console.log("Table created successfully");
        } else {
            console.log("Table already exists, proceeding with operations");
        }
    } catch (err) {
        if (err.sqlcode === 4136) {
            console.log("Table already exists, proceeding with operations");
        } else {
            console.error("Error creating table:", err);
            throw err;
        }
    }
}

// Initialize database connection and create table
async function initializeDatabase() {
    let connection;
    try {
        console.log("Connecting to DB2...");
        connection = await ibmdb.open(connectionString);
        console.log("Connected to DB2 successfully");
        await createTableIfNotExists(connection);
    } catch (err) {
        console.error("Error initializing database:", err);
    } finally {
        if (connection) {
            await connection.close();
        }
    }
}

// Initialize database when server starts
initializeDatabase();

// CRUD Operations

// Create - Add new student
app.post("/add_student", async (req, res) => {
    let connection;
    try {
        const { name, email, age, gender } = req.body;

        // Validate input
        if (!name || name.length < 2) {
            return res.status(400).json({ error: "Name must be at least 2 characters long" });
        }
        if (!isValidEmail(email)) {
            return res.status(400).json({ error: "Invalid email format" });
        }
        if (!isValidAge(age)) {
            return res.status(400).json({ error: "Invalid age. Must be between 1 and 150" });
        }
        if (!isValidGender(gender)) {
            return res.status(400).json({ error: "Invalid gender. Must be M, F, or O" });
        }

        connection = await ibmdb.open(connectionString);
        const insertSQL = `
            INSERT INTO STUDENT_DETAILS (NAME, EMAIL, AGE, GENDER) 
            VALUES (?, ?, ?, ?)
        `;
        await connection.query(insertSQL, [name, email, age, gender]);
        res.json({ success: "Student added successfully" });
    } catch (err) {
        if (err.sqlcode === -803) {
            res.status(400).json({ error: "Email already exists in database" });
        } else {
            console.error("Error adding student:", err);
            res.status(500).json({ error: "Failed to add student" });
        }
    } finally {
        if (connection) {
            await connection.close();
        }
    }
});

// Read - Get all students
app.get("/students", async (req, res) => {
    let connection;
    try {
        connection = await ibmdb.open(connectionString);
        const result = await connection.query("SELECT * FROM STUDENT_DETAILS");
      res.json(result);
    } catch (err) {
        console.error("Error fetching students:", err);
        res.status(500).json({ error: "Failed to fetch students" });
    } finally {
        if (connection) {
            await connection.close();
        }
    }
});

// Read - Get single student
app.get("/student/:id", async (req, res) => {
    let connection;
    try {
        connection = await ibmdb.open(connectionString);
        const result = await connection.query("SELECT * FROM STUDENT_DETAILS WHERE ID = ?", [req.params.id]);
        if (result.length === 0) {
            res.status(404).json({ error: "Student not found" });
        } else {
            res.json(result[0]);
        }
    } catch (err) {
        console.error("Error fetching student:", err);
        res.status(500).json({ error: "Failed to fetch student" });
    } finally {
        if (connection) {
            await connection.close();
        }
    }
});

// Update - Update student
app.put("/student/:id", async (req, res) => {
    let connection;
    try {
        const { name, email, age, gender } = req.body;

        // Validate input
        if (!name || name.length < 2) {
            return res.status(400).json({ error: "Name must be at least 2 characters long" });
        }
        if (!isValidEmail(email)) {
            return res.status(400).json({ error: "Invalid email format" });
        }
        if (!isValidAge(age)) {
            return res.status(400).json({ error: "Invalid age. Must be between 1 and 150" });
        }
        if (!isValidGender(gender)) {
            return res.status(400).json({ error: "Invalid gender. Must be M, F, or O" });
        }

        connection = await ibmdb.open(connectionString);
        const updateSQL = `
            UPDATE STUDENT_DETAILS 
            SET NAME = ?, EMAIL = ?, AGE = ?, GENDER = ? 
            WHERE ID = ?
        `;
        await connection.query(updateSQL, [name, email, age, gender, req.params.id]);
        res.json({ success: "Student updated successfully" });
    } catch (err) {
        console.error("Error updating student:", err);
        res.status(500).json({ error: "Failed to update student" });
    } finally {
        if (connection) {
            await connection.close();
        }
    }
});

// Delete - Delete student
app.delete("/student/:id", async (req, res) => {
    let connection;
    try {
        connection = await ibmdb.open(connectionString);
        await connection.query("DELETE FROM STUDENT_DETAILS WHERE ID = ?", [req.params.id]);
        res.json({ success: "Student deleted successfully" });
    } catch (err) {
        console.error("Error deleting student:", err);
        res.status(500).json({ error: "Failed to delete student" });
    } finally {
        if (connection) {
            await connection.close();
        }
    }
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
