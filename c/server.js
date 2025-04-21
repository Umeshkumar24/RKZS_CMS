import { configDotenv } from 'dotenv'; // Keep user's original dotenv import style
import express from 'express';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url'; // Needed to get __dirname equivalent

import pkg from 'pg';
const { Pool } = pkg;

configDotenv()

const app = express();
app.use(express.json());
app.use(cors());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}
app.use('/uploads', express.static(uploadDir));

// --- Database Connection (PostgreSQL) ---
const pool = new Pool({
    user: 'myuser',
    password: 'mypassword',
    host: 'localhost',
    port: 5432,
    database: 'mydatabase',
});
  

// Optional: Basic check for pool connection on startup
(async () => {
    try {
      const client = await pool.connect();
      console.log("✅ Connected to the database successfully.");
  
      const result = await client.query(`
        SELECT to_regclass('public.users') AS table_exists;
      `);
      client.release();
  
      if (result.rows[0].table_exists) {
        console.log("✅ Schema initialized properly: 'users' table exists.");
      } else {
        console.error("❌ Schema not initialized: 'users' table does not exist.");
      }
    } catch (error) {
      console.error("❌ Error checking schema initialization:", error);
    }
  })();


// --- Nodemailer setup ---

const transporter = nodemailer.createTransport({
    host: 'mail.rkzs.co.in', // Replace with your SMTP host
    port: 587, // Typically 465 for SSL or 587 for TLS
    secure: false, // Use true for 465, false for other ports
    auth: {
        user: 'admin@rkzs.co.in', // Replace with your email
        pass: 'Kumar@123' // Replace with your email password
    }
});

// Verify transporter configuration (optional)
transporter.verify((error, success) => {
    if (error) {
        console.error("SMTP transporter verification failed:", error);
    } else {
        console.log("SMTP transporter is ready to send emails");
    }
});
// ------------------------


// --- JWT Secret ---
const JWT_SECRET = process.env.JWT_SECRET

function generatePasswordResetEmail(email, resetCode, date) {
    // Existing email template remains the same
    return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h2 style="color: #0078D4;">RKZS Account</h2>
      <p><strong>Password reset code</strong></p>
      <p>Please use this code to reset the password for the account associated with <strong>${email}</strong>.</p>
      <h3 style="color: #333; font-size: 1.5em; margin: 20px 0;">Here is your code: <span style="color: #0078D4;">${resetCode}</span></h3>
      <p>If you don't recognize the account <strong>${email}</strong>, you can
        ignore this email.
      </p>
      <br/>
      <p>Thanks,</p>
      <p><strong>The RKZS team</strong></p>
      <hr/>
      <p style="font-size: 0.9em; color: #666;">
        Privacy Statement<br/>
        RKZS Management, [Your Address Here]
      </p>
      <p style="font-size: 0.9em; color: #666;">Date: ${date}</p>
    </div>
    `;
}

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Ensure the uploads directory is correctly referenced
        cb(null, uploadDir); // Use the absolute path defined earlier
    },
    filename: (req, file, cb) => {
        // Sanitize filename to prevent path traversal issues
        const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, `${Date.now()}-${sanitizedFilename}`);
    }
});

const upload = multer({ storage });

// Register Route
app.post('/register', async (req, res) => {
    const { name, email, password, unique_code, role = 'franchise-admin' } = req.body;

    // Basic validation (add more robust validation as needed)
    if (!name || !email || !password || !unique_code) {
        return res.status(400).send('Missing required fields');
    }

    try {
        // Check if user already exists
        const checkQuery = 'SELECT COUNT(*) FROM users WHERE email = $1';
        const checkResult = await pool.query(checkQuery, [email]);
        if (parseInt(checkResult.rows[0].count) > 0) {
            console.log('Registration failed: User already exists', email);
            return res.status(409).send('User with this email already exists');
        }

        // Use $1, $2, ... for placeholders and RETURNING id to get the new user's ID
        const insertQuery = 'INSERT INTO users (name, email, password, unique_code, role) VALUES ($1, $2, $3, $4, $5) RETURNING id';
        const result = await pool.query(insertQuery, [name, email, password, unique_code, role]); // Note: Passwords should ideally be hashed!

        console.log('User registered:', { id: result.rows[0].id, name, email, unique_code, role });
        res.status(201).send('User registered successfully');
    } catch (err) {
        console.error('Error registering user:', err.stack);
        // Check for unique constraint errors if email column has unique constraint
        if (err.code === '23505') { // PostgreSQL unique violation error code
             return res.status(409).send('User with this email already exists');
        }
        res.status(500).send('Server error during registration');
    }
});

// Login Route
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

     // Basic validation
     if (!email || !password) {
        return res.status(400).send('Missing required fields');
    }

    try {
        const query = 'SELECT id, password, role FROM users WHERE email = $1'; // Select id, password, and role
        const results = await pool.query(query, [email]);

        if (results.rows.length === 0) {
            console.log('Login failed: User not found', email);
            return res.status(404).send('User not found');
        }

        const user = results.rows[0];
        if (password !== user.password) {
            console.log('Login failed: Invalid password for user', email);
            return res.status(401).send('Invalid password');
        }

        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        console.log('User logged in:', email);
        res.status(200).send({ auth: true, token });
    } catch (err) {
        console.error('Error logging in:', err.stack);
        res.status(500).send('Server error during login');
    }
});

// Middleware to verify token
const verifyToken = (req, res, next) => {
    const token = req.headers['x-access-token'];
    if (!token) {
        console.log('No token provided');
        return res.status(403).send('No token provided');
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            console.log('Failed to authenticate token');
            return res.status(500).send('Failed to authenticate token');
        }
        req.userId = decoded.id;
        req.userRole = decoded.role;
        console.log('Token verified for user ID:', req.userId);
        next();
    });
};

// Get User Data Route
app.get('/user', verifyToken, async (req, res) => {
    try {
        const query = 'SELECT name, unique_code, role FROM users WHERE id = $1';
        const results = await pool.query(query, [req.userId]);

        if (results.rows.length === 0) {
            console.log('Get User Data failed: User not found for ID', req.userId);
            return res.status(404).send('User not found');
        }
        console.log('User data fetched for ID:', req.userId);
        res.status(200).send(results.rows[0]);
    } catch (err) {
        console.error('Error fetching user data:', err.stack);
        res.status(500).send('Server error fetching user data');
    }
});

// Get Students Route
app.get('/students', verifyToken, async (req, res) => {
    try {
        let query;
        let params = [];

        if (req.userRole === 'admin') {
            // Ensure column names match your actual database schema
            query = 'SELECT s.*, c.course_name, u.name as franchise_name FROM students s JOIN courses c ON s.course_id = c.id JOIN users u ON s.franchise_id = u.id';
             console.log('Fetching all students for admin');
        } else {
             // Ensure column names match your actual database schema
            query = 'SELECT s.*, c.course_name FROM students s JOIN courses c ON s.course_id = c.id WHERE s.franchise_id = $1';
            params = [req.userId];
             console.log('Fetching students for franchise ID:', req.userId);
        }

        const results = await pool.query(query, params);
        res.status(200).send(results.rows);

    } catch (err) {
        console.error('Error fetching students:', err.stack);
        res.status(500).send('Server error fetching students');
    }
});

// Add Student Route
app.post('/students', verifyToken, async (req, res) => {
    // Only franchise-admins should add students
     if (req.userRole !== 'franchise-admin') {
        return res.status(403).send('Access denied');
    }

    const { name, course_id } = req.body;
     // Basic validation
     if (!name || !course_id) {
        return res.status(400).send('Missing required fields');
    }

    try {
        // Use $1, $2, $3 for placeholders, RETURNING id to get the new student ID
        const query = 'INSERT INTO students (name, course_id, franchise_id) VALUES ($1, $2, $3) RETURNING id';
        const result = await pool.query(query, [name, course_id, req.userId]);

        console.log('Student added:', { id: result.rows[0].id, name, course_id, franchise_id: req.userId });
        res.status(201).send({ message: 'Student added successfully', studentId: result.rows[0].id });
    } catch (err) {
        console.error('Error adding student:', err.stack);
        res.status(500).send('Server error adding student');
    }
});

// Get Courses Route
app.get('/courses', async (req, res) => {
    try {
        const query = 'SELECT * FROM courses';
        const results = await pool.query(query);
        console.log('Courses fetched');
        res.status(200).send(results.rows);
    } catch (err) {
        console.error('Error fetching courses:', err.stack);
        res.status(500).send('Server error fetching courses');
    }
});

// Get Users Route (Admin only)
app.get('/users', verifyToken, async (req, res) => {
    if (req.userRole !== 'admin') {
        return res.status(403).send('Access denied');
    }

    try {
        const query = 'SELECT id, name, email, role FROM users';
        const results = await pool.query(query);
        console.log('Users fetched for admin');
        res.status(200).send(results.rows);
    } catch (err) {
        console.error('Error fetching users:', err.stack);
        res.status(500).send('Server error fetching users');
    }
});

// Request Password Reset Route
app.post('/request-password-reset', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).send('Email is required');
    }

    const resetCode = crypto.randomBytes(3).toString('hex').toUpperCase(); // Use uppercase for clarity

    try {
        // Use $1, $2 for placeholders
        const updateQuery = 'UPDATE users SET reset_code = $1 WHERE email = $2 RETURNING id'; // Use RETURNING to check if user exists
        const updateResult = await pool.query(updateQuery, [resetCode, email]);

        if (updateResult.rows.length === 0) {
             console.log('Password reset request failed: User not found', email);
            return res.status(404).send('User not found');
        }

        const mailOptions = {
            from: process.env.SMTP_USER, // Use environment variable
            to: email,
            subject: "Your RKZS account password reset code",
            html: generatePasswordResetEmail(email, resetCode, new Date().toLocaleString()) // Format date nicely
        };

        // Use Promises with sendMail for better async handling
        await transporter.sendMail(mailOptions);

        console.log('Password reset email sent successfully for user:', email);
        res.status(200).send('Password reset email sent successfully');

    } catch (err) {
        console.error('Error handling password reset request or sending email:', err.stack);
         // Handle potential SMTP errors more gracefully
        if (err.message && err.message.includes('Invalid login') || err.message.includes('authentication failed')) {
             return res.status(500).send('Failed to send email: SMTP authentication failed');
        }
        res.status(500).send('Server error requesting password reset');
    }
});

// Verify Reset Code Route
app.post('/verify-reset-code', async (req, res) => {
    const { email, resetCode } = req.body;
    if (!email || !resetCode) {
        return res.status(400).send('Email and reset code are required');
    }

    try {
        const query = 'SELECT reset_code FROM users WHERE email = $1';
        const results = await pool.query(query, [email]);

        if (results.rows.length === 0) {
             console.log('Verify reset code failed: User not found', email);
            return res.status(404).send('User not found');
        }

        const user = results.rows[0];
        if (!user.reset_code || resetCode.toUpperCase() !== user.reset_code.toUpperCase()) { // Compare uppercase
             console.log('Verify reset code failed: Invalid reset code for user', email);
            return res.status(401).send('Invalid reset code');
        }

        console.log('Reset code verified for user:', email);
        res.status(200).send('Reset code verified');
    } catch (err) {
        console.error('Error verifying reset code:', err.stack);
        res.status(500).send('Server error verifying reset code');
    }
});

// Reset Password Route
app.post('/reset-password', async (req, res) => {
    const { email, newPassword } = req.body;
     if (!email || !newPassword) {
        return res.status(400).send('Email and new password are required');
    }

    try {
        // Optional: Re-verify reset code here before resetting password for extra security
        // Update password and set reset_code to NULL
        const query = 'UPDATE users SET password = $1, reset_code = NULL WHERE email = $2 RETURNING id'; // Use RETURNING to check if user exists
        const result = await pool.query(query, [newPassword, email]); // !!! WARNING: Plain text password !!!

        if (result.rows.length === 0) {
             console.log('Password reset failed: User not found', email);
            return res.status(404).send('User not found');
        }

        console.log('Password reset successful for user:', email);
        res.status(200).send('Password reset successfully');
    } catch (err) {
        console.error('Error resetting password:', err.stack);
        res.status(500).send('Server error resetting password');
    }
});

// Update Payment Status Route (Admin only)
app.put('/students/:id/payment-status', verifyToken, async (req, res) => {
    if (req.userRole !== 'admin') {
        return res.status(403).send('Access denied');
    }

    const { id } = req.params;
    const { payment_status } = req.body;
     if (!payment_status || typeof payment_status !== 'string') { // Basic validation
        return res.status(400).send('Valid payment_status is required');
    }


    try {
        // Use $1, $2 for placeholders
        const query = 'UPDATE students SET payment_status = $1 WHERE id = $2 RETURNING id'; // Use RETURNING to check if student exists
        const result = await pool.query(query, [payment_status, id]);

        if (result.rows.length === 0) {
             console.log('Update payment status failed: Student not found', id);
            return res.status(404).send('Student not found');
        }

        console.log('Payment status updated for student ID:', id);
        res.status(200).send('Payment status updated');
    } catch (err) {
        console.error('Error updating payment status:', err.stack);
        res.status(500).send('Server error updating payment status');
    }
});

// Update Completion Status Route (Franchise Admin only)
app.put('/students/:id/completion-status', verifyToken, async (req, res) => {
    if (req.userRole !== 'franchise-admin') {
        return res.status(403).send('Access denied');
    }

    const { id } = req.params;
    const { completion_status } = req.body;
     if (!completion_status || typeof completion_status !== 'string') { // Basic validation
        return res.status(400).send('Valid completion_status is required');
    }


    try {
        // Use $1, $2 for placeholders
        const query = 'UPDATE students SET completion_status = $1 WHERE id = $2 RETURNING id'; // Use RETURNING to check if student exists
         const result = await pool.query(query, [completion_status, id]);

        if (result.rows.length === 0) {
             console.log('Update completion status failed: Student not found', id);
            return res.status(404).send('Student not found');
        }

        console.log('Completion status updated for student ID:', id);
        res.status(200).send('Completion status updated');
    } catch (err) {
        console.error('Error updating completion status:', err.stack);
        res.status(500).send('Server error updating completion status');
    }
});

// Upload Certificate Route (Franchise Admin only)
app.post('/students/:id/upload-certificate', verifyToken, upload.single('certificate'), async (req, res) => {
     if (req.userRole !== 'franchise-admin') {
        // If upload middleware already ran, clean up the uploaded file
        if (req.file) {
            fs.unlink(req.file.path, (unlinkErr) => {
                if (unlinkErr) console.error('Error cleaning up uploaded file:', unlinkErr);
            });
        }
        return res.status(403).send('Access denied');
    }

    const { id } = req.params;
     if (!req.file) {
        return res.status(400).send('No file uploaded');
    }
    const certificatePath = req.file.path; // Path relative to the container's filesystem

    try {
        // Verify student exists and belongs to the franchise admin if needed
        // For now, directly update the path
        const query = 'UPDATE students SET certificate_path = $1 WHERE id = $2 RETURNING id'; // Use RETURNING to check if student exists
        const result = await pool.query(query, [certificatePath, id]);

         if (result.rows.length === 0) {
             console.log('Upload certificate failed: Student not found', id);
              // Clean up the uploaded file if student not found
            fs.unlink(certificatePath, (unlinkErr) => {
                if (unlinkErr) console.error('Error cleaning up uploaded file:', unlinkErr);
            });
            return res.status(404).send('Student not found');
        }

        console.log('Certificate path updated for student ID:', id, 'Path:', certificatePath);
        res.status(200).send('Certificate uploaded and path updated');
    } catch (err) {
        console.error('Error uploading certificate or updating database:', err.stack);
        // Clean up the uploaded file on database error
        if (req.file) {
             fs.unlink(certificatePath, (unlinkErr) => {
                if (unlinkErr) console.error('Error cleaning up uploaded file:', unlinkErr);
            });
        }
        res.status(500).send('Server error uploading certificate');
    }
});


// Create User Route (Admin only)
app.post('/users', verifyToken, async (req, res) => {
    if (req.userRole !== 'admin') {
        return res.status(403).send('Access denied');
    }

    const { name, email, password, unique_code, role } = req.body;
     // Basic validation
     if (!name || !email || !password || !unique_code || !role) {
        return res.status(400).send('Missing required fields for user creation');
    }

    try {
         // Check if user already exists
        const checkQuery = 'SELECT COUNT(*) FROM users WHERE email = $1';
        const checkResult = await pool.query(checkQuery, [email]);
        if (parseInt(checkResult.rows[0].count) > 0) {
             console.log('Create user failed: User already exists', email);
            return res.status(409).send('User with this email already exists');
        }

        // Use $1, $2, ... for placeholders and RETURNING id
        const insertQuery = 'INSERT INTO users (name, email, password, unique_code, role) VALUES ($1, $2, $3, $4, $5) RETURNING id';
        const result = await pool.query(insertQuery, [name, email, password, unique_code, role]); // !!! WARNING: Plain text password !!!

        console.log('User created by admin:', { id: result.rows[0].id, name, email, unique_code, role });
        res.status(201).send({ message: 'User created successfully', userId: result.rows[0].id });
    } catch (err) {
        console.error('Error creating user by admin:', err.stack);
         if (err.code === '23505') { // PostgreSQL unique violation error code
             return res.status(409).send('User with this email already exists');
        }
        res.status(500).send('Server error creating user');
    }
});


// Generic Error Handling Middleware (Optional but recommended)
app.use((err, req, res, next) => {
    console.error('Unhandled Application Error:', err.stack);
    res.status(500).send('An unexpected error occurred');
});


const PORT = process.env.PORT || 8080; // Use environment variable for port
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Optional: Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => { // Assuming your app.listen returns a server object
        console.log('HTTP server closed');
        pool.end(() => { // Close the database pool
            console.log('PostgreSQL pool has ended');
            process.exit(0);
        });
    });
});