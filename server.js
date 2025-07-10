// NOTE: Create a .env file in the project root with the following variables for Gmail OTP to work:
// EMAIL_USER=your-gmail-address@gmail.com
// EMAIL_PASS=your-app-password
//
// You may need to generate an App Password in your Google Account if 2FA is enabled.
const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

//database connection
const db = mysql.createConnection({
  host: 'bkairnmvqsaphl2rmoy3-mysql.services.clever-cloud.com',
  user: 'uj81pdkbwc7bv4zw',
  password: 'ffsgdxUyFoZRs3vsNf5E',
  database: 'bkairnmvqsaphl2rmoy3',
  port: 3306
});




// Create tables
const createTables = () => {
  // Users table
  db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      phone VARCHAR(20),
      location VARCHAR(100),
      profile_image VARCHAR(255),
      is_verified BOOLEAN DEFAULT FALSE,
      otp VARCHAR(6),
      otp_expires DATETIME,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Posts table
  db.execute(`
    CREATE TABLE IF NOT EXISTS posts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      crop_name VARCHAR(100) NOT NULL,
      area DECIMAL(10,2) NOT NULL,
      phone VARCHAR(20) NOT NULL,
      location VARCHAR(100),
      price DECIMAL(10,2),
      quantity VARCHAR(50),
      description TEXT,
      image VARCHAR(255),
      likes_count INT DEFAULT 0,
      sold BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Likes table
  db.execute(`
    CREATE TABLE IF NOT EXISTS likes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      post_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      UNIQUE KEY unique_like (user_id, post_id)
    )
  `);

  // Comments table
  db.execute(`
    CREATE TABLE IF NOT EXISTS comments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      post_id INT NOT NULL,
      comment TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
    )
  `);

  // Wishlist table
  db.execute(`
    CREATE TABLE IF NOT EXISTS wishlist (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      post_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      UNIQUE KEY unique_wishlist (user_id, post_id)
    )
  `);

  // Messages table
  db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sender_id INT NOT NULL,
      receiver_id INT NOT NULL,
      message TEXT NOT NULL,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);


  // Reports table
  db.execute(`
    CREATE TABLE IF NOT EXISTS reports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      reporter_id INT NOT NULL,
      reported_user_id INT,
      post_id INT,
      type ENUM('fraud', 'spam', 'inappropriate') NOT NULL,
      description TEXT NOT NULL,
      status ENUM('pending', 'reviewed', 'resolved') DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reported_user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE SET NULL
    )
  `);

  // Farming Tips table
  db.execute(`
    CREATE TABLE IF NOT EXISTS farming_tips (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tip TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

createTables();

// Optionally, you can add a scheduled cleanup for unverified users after X hours/days to keep the database clean.
// This is not required for basic OTP flow, but can be implemented with a scheduled job or manual script.


// Add status and reply columns to reports table if not present
// Add missing columns safely
function addColumnIfNotExists(table, column, type) {
  db.query(
    `SHOW COLUMNS FROM \`${table}\` LIKE ?`,
    [column],
    (err, results) => {
      if (err) return console.error(`Error checking column ${column} in ${table}:`, err);
      if (results.length === 0) {
        db.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${type}`, (err) => {
          if (err) console.error(`Failed to add column ${column} to ${table}:`, err);
          else console.log(`Added column ${column} to ${table}`);
        });
      }
    }
  );
}

// Fix reports table
addColumnIfNotExists('reports', 'reply', 'TEXT');

// Fix posts table
addColumnIfNotExists('posts', 'sold', 'BOOLEAN DEFAULT FALSE');

// Fix messages table
addColumnIfNotExists('messages', 'media_url', 'VARCHAR(255)');
addColumnIfNotExists('messages', 'media_type', 'VARCHAR(100)');


// Add sold column to posts table if not present
// const alterPostsTable = `ALTER TABLE posts ADD COLUMN IF NOT EXISTS sold BOOLEAN DEFAULT FALSE`;
// db.execute(alterPostsTable, (err) => {
//     if (err) console.error('Failed to alter posts table:', err);
// });

// Add media columns to messages table if not present
// const alterMessagesTable = `ALTER TABLE messages 
//     ADD COLUMN IF NOT EXISTS media_url VARCHAR(255),
//     ADD COLUMN IF NOT EXISTS media_type VARCHAR(100)`;
// db.execute(alterMessagesTable, (err) => {
//     if (err) console.error('Failed to alter messages table:', err);
// });

// JWT middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Endpoint to update sold status (owner only)
app.put('/api/posts/:id/sold', authenticateToken, (req, res) => {
    const postId = req.params.id;
    const { sold } = req.body;
    db.execute('UPDATE posts SET sold = ? WHERE id = ? AND user_id = ?', [sold, postId, req.user.userId], (err, result) => {
        if (err) return res.status(500).json({ error: 'Failed to update sold status' });
        if (result.affectedRows === 0) return res.status(403).json({ error: 'Not authorized or post not found' });
        res.json({ message: 'Status updated' });
    });
});

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'connects2farm@gmail.com',
    pass: process.env.EMAIL_PASS || 'gmarjwafytubujcw'
  }
});

// Routes

// Register
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password, phone, location } = req.body;
    
    // Check if user exists
    db.execute('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (results.length > 0) return res.status(400).json({ error: 'User already exists' });

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Generate OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Insert user
      db.execute(
        'INSERT INTO users (name, email, password, phone, location, otp, otp_expires) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [name, email, hashedPassword, phone, location, otp, otpExpires],
        (err, result) => {
          if (err) return res.status(500).json({ error: 'Failed to create user' });

          // Send OTP email using nodemailer
          const mailOptions = {
            from: process.env.EMAIL_USER || 'your-email@gmail.com',
            to: email,
            subject: 'FarmConnect Email Verification OTP',
            text: `Your FarmConnect OTP is: ${otp}. It is valid for 10 minutes.`
          };
          transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              console.error('Error sending OTP email:', error);
              return res.status(500).json({ error: 'Failed to send OTP email' });
            }
            res.json({ message: 'User registered. Please verify your email with OTP.', userId: result.insertId });
          });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Resend OTP
app.post('/api/resend-otp', (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'User ID required' });

  // Generate new OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Update user with new OTP
  db.execute(
    'UPDATE users SET otp = ?, otp_expires = ? WHERE id = ?',
    [otp, otpExpires, userId],
    (err, result) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      // Get user email
      db.execute('SELECT email FROM users WHERE id = ?', [userId], (err, results) => {
        if (err || results.length === 0) return res.status(500).json({ error: 'Failed to get user email' });
        const email = results[0].email;
        // Send OTP email using nodemailer
        const mailOptions = {
          from: process.env.EMAIL_USER || 'your-email@gmail.com',
          to: email,
          subject: 'FarmConnect Email Verification OTP (Resend)',
          text: `Your new FarmConnect OTP is: ${otp}. It is valid for 10 minutes.`
        };
        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.error('Error resending OTP email:', error);
            return res.status(500).json({ error: 'Failed to resend OTP email' });
          }
          res.json({ message: 'OTP resent successfully' });
        });
      });
    }
  );
});

// Verify OTP
app.post('/api/verify-otp', (req, res) => {
  const { userId, otp } = req.body;

  db.execute(
    'SELECT * FROM users WHERE id = ? AND otp = ? AND otp_expires > NOW()',
    [userId, otp],
    (err, results) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (results.length === 0) return res.status(400).json({ error: 'Invalid or expired OTP' });

      // Update user as verified
      db.execute(
        'UPDATE users SET is_verified = TRUE, otp = NULL, otp_expires = NULL WHERE id = ?',
        [userId],
        (err) => {
          if (err) return res.status(500).json({ error: 'Failed to verify user' });
          res.json({ message: 'Email verified successfully' });
        }
      );
    }
  );
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    db.execute('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (results.length === 0) return res.status(400).json({ error: 'User not found' });

      const user = results[0];
      if (!user.is_verified) return res.status(400).json({ error: 'Please verify your email first' });

      // Ensure bcrypt is used correctly
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) return res.status(400).json({ error: 'Invalid password' });

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get posts
app.get('/api/posts', (req, res) => {
  const query = `
    SELECT p.*, u.name as user_name, u.profile_image as user_image,
           (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
           (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
           p.sold
    FROM posts p
    JOIN users u ON p.user_id = u.id
    ORDER BY p.created_at DESC
  `;

  db.execute(query, (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(results);
  });
});

// Create post
app.post('/api/posts', authenticateToken, upload.single('image'), (req, res) => {
  const { crop_name, area, phone, location, price, quantity, description } = req.body;
  const image = req.file ? req.file.filename : null;

  db.execute(
    'INSERT INTO posts (user_id, crop_name, area, phone, location, price, quantity, description, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [req.user.userId, crop_name, area, phone, location, price, quantity, description, image],
    (err, result) => {
      if (err) return res.status(500).json({ error: 'Failed to create post' });
      res.json({ message: 'Post created successfully', postId: result.insertId });
    }
  );
});

// Like/Unlike post
app.post('/api/posts/:id/like', authenticateToken, (req, res) => {
  const postId = req.params.id;
  const userId = req.user.userId;

  // Check if already liked
  db.execute('SELECT * FROM likes WHERE user_id = ? AND post_id = ?', [userId, postId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });

    if (results.length > 0) {
      // Unlike
      db.execute('DELETE FROM likes WHERE user_id = ? AND post_id = ?', [userId, postId], (err) => {
        if (err) return res.status(500).json({ error: 'Failed to unlike' });
        res.json({ message: 'Post unliked', liked: false });
      });
    } else {
      // Like
      db.execute('INSERT INTO likes (user_id, post_id) VALUES (?, ?)', [userId, postId], (err) => {
        if (err) return res.status(500).json({ error: 'Failed to like' });
        res.json({ message: 'Post liked', liked: true });
      });
    }
  });
});

// Add comment
app.post('/api/posts/:id/comments', authenticateToken, (req, res) => {
  const postId = req.params.id;
  const { comment } = req.body;

  db.execute(
    'INSERT INTO comments (user_id, post_id, comment) VALUES (?, ?, ?)',
    [req.user.userId, postId, comment],
    (err, result) => {
      if (err) return res.status(500).json({ error: 'Failed to add comment' });
      res.json({ message: 'Comment added successfully' });
    }
  );
});

// Get comments
app.get('/api/posts/:id/comments', (req, res) => {
  const postId = req.params.id;

  const query = `
    SELECT c.*, u.name as user_name, u.profile_image as user_image
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.post_id = ?
    ORDER BY c.created_at DESC
  `;

  db.execute(query, [postId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(results);
  });
});

// Wishlist operations
app.post('/api/wishlist/:postId', authenticateToken, (req, res) => {
  const postId = req.params.postId;
  const userId = req.user.userId;

  // Check if already in wishlist
  db.execute('SELECT * FROM wishlist WHERE user_id = ? AND post_id = ?', [userId, postId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });

    if (results.length > 0) {
      // Remove from wishlist
      db.execute('DELETE FROM wishlist WHERE user_id = ? AND post_id = ?', [userId, postId], (err) => {
        if (err) return res.status(500).json({ error: 'Failed to remove from wishlist' });
        res.json({ message: 'Removed from wishlist', inWishlist: false });
      });
    } else {
      // Add to wishlist
      db.execute('INSERT INTO wishlist (user_id, post_id) VALUES (?, ?)', [userId, postId], (err) => {
        if (err) return res.status(500).json({ error: 'Failed to add to wishlist' });
        res.json({ message: 'Added to wishlist', inWishlist: true });
      });
    }
  });
});

// Get user wishlist
app.get('/api/wishlist', authenticateToken, (req, res) => {
  const query = `
    SELECT p.*, u.name as user_name, u.profile_image as user_image
    FROM wishlist w
    JOIN posts p ON w.post_id = p.id
    JOIN users u ON p.user_id = u.id
    WHERE w.user_id = ?
    ORDER BY w.created_at DESC
  `;

  db.execute(query, [req.user.userId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(results);
  });
});

// Submit report
app.post('/api/reports', authenticateToken, (req, res) => {
  const { reported_user_id, post_id, type, description } = req.body;

  db.execute(
    'INSERT INTO reports (reporter_id, reported_user_id, post_id, type, description) VALUES (?, ?, ?, ?, ?)',
    [req.user.userId, reported_user_id, post_id, type, description],
    (err, result) => {
      if (err) return res.status(500).json({ error: 'Failed to submit report' });
      res.json({ message: 'Report submitted successfully' });
    }
  );
});

// Get user profile
app.get('/api/profile', authenticateToken, (req, res) => {
  db.execute('SELECT id, name, email, phone, location, profile_image FROM users WHERE id = ?', [req.user.userId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(results[0]);
  });
});

// Update profile
app.put('/api/profile', authenticateToken, upload.single('profile_image'), (req, res) => {
  const { name, phone, location } = req.body;
  const profile_image = req.file ? req.file.filename : null;

  let query = 'UPDATE users SET name = ?, phone = ?, location = ?';
  let params = [name, phone, location];

  if (profile_image) {
    query += ', profile_image = ?';
    params.push(profile_image);
  }

  query += ' WHERE id = ?';
  params.push(req.user.userId);

  db.execute(query, params, (err) => {
    if (err) return res.status(500).json({ error: 'Failed to update profile' });
    res.json({ message: 'Profile updated successfully' });
  });
});

// Change password endpoint
app.post('/api/change-password', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  db.execute('SELECT password FROM users WHERE id = ?', [userId], async (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0) return res.status(404).json({ error: 'User not found' });
    const valid = await bcrypt.compare(currentPassword, results[0].password);
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });
    const hashed = await bcrypt.hash(newPassword, 10);
    db.execute('UPDATE users SET password = ? WHERE id = ?', [hashed, userId], (err) => {
      if (err) return res.status(500).json({ error: 'Failed to update password' });
      res.json({ message: 'Password changed successfully' });
    });
  });
});

// Socket.io for real-time messaging
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Remove room join logic
  // socket.on('join', (userId) => {
  //   socket.join(userId.toString());
  //   console.log(`User ${userId} joined room ${userId} (socket: ${socket.id})`);
  // });

  socket.on('sendMessage', (data) => {
    console.log('sendMessage event received:', data, 'from socket:', socket.id);
    const { senderId, receiverId, message } = data;
    // Save message to database
    db.execute(
      'INSERT INTO messages (sender_id, receiver_id, message) VALUES (?, ?, ?)',
      [senderId, receiverId, message],
      (err, result) => {
        if (!err) {
          const messageData = {
            id: result.insertId,
            sender_id: parseInt(senderId),
            receiver_id: parseInt(receiverId),
            message: message,
            created_at: new Date()
          };
          // Emit to all connected clients (clients will filter on their side)
          io.emit('newMessage', messageData);
          console.log(`Message sent from ${senderId} to ${receiverId}`);
        } else {
          console.error('Error saving message:', err);
        }
      }
    );
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});


// Get conversations
app.get('/api/conversations', authenticateToken, (req, res) => {
  const query = `
    SELECT DISTINCT 
      CASE 
        WHEN m.sender_id = ? THEN m.receiver_id 
        ELSE m.sender_id 
      END as user_id,
      u.name, u.profile_image,
      (SELECT CASE 
         WHEN media_url IS NOT NULL THEN CONCAT('[Media] ', COALESCE(message, ''))
         ELSE message 
       END FROM messages 
       WHERE (sender_id = ? AND receiver_id = user_id) OR (sender_id = user_id AND receiver_id = ?)
       ORDER BY created_at DESC LIMIT 1) as last_message,
      (SELECT created_at FROM messages 
       WHERE (sender_id = ? AND receiver_id = user_id) OR (sender_id = user_id AND receiver_id = ?)
       ORDER BY created_at DESC LIMIT 1) as last_message_time
    FROM messages m
    JOIN users u ON u.id = CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END
    WHERE m.sender_id = ? OR m.receiver_id = ?
    ORDER BY last_message_time DESC
  `;

  const userId = req.user.userId;
  db.execute(query, [userId, userId, userId, userId, userId, userId, userId, userId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(results);
  });
});

// Get messages
app.get('/api/messages/:userId', authenticateToken, (req, res) => {
  const otherUserId = req.params.userId;
  const currentUserId = req.user.userId;

  const query = `
    SELECT m.*, u.name as sender_name,
           m.media_url as media, m.media_type as mediaType
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    WHERE (m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)
    ORDER BY m.created_at ASC
  `;

  db.execute(query, [currentUserId, otherUserId, otherUserId, currentUserId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(results);
  });
});

// Mark messages as read
app.post('/api/messages/:userId/mark-read', authenticateToken, (req, res) => {
  const otherUserId = req.params.userId;
  const currentUserId = req.user.userId;

  db.execute(
    'UPDATE messages SET is_read = TRUE WHERE sender_id = ? AND receiver_id = ? AND is_read = FALSE',
    [otherUserId, currentUserId],
    (err) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ message: 'Messages marked as read' });
    }
  );
});

// Get unread message count
app.get('/api/messages/unread-count', authenticateToken, (req, res) => {
  const currentUserId = req.user.userId;

  db.execute(
    'SELECT COUNT(*) as unreadCount FROM messages WHERE receiver_id = ? AND is_read = FALSE',
    [currentUserId],
    (err, results) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ unreadCount: results[0].unreadCount });
    }
  );
});

// Admin endpoints (no authentication for demo)
app.get('/api/admin/users', (req, res) => {
  db.execute('SELECT id, name, email, phone, location, is_verified FROM users', (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(results);
  });
});
app.delete('/api/admin/users/:id', (req, res) => {
  db.execute('DELETE FROM users WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: 'Failed to delete user' });
    res.json({ message: 'User deleted' });
  });
});
app.get('/api/admin/crops', (req, res) => {
  db.execute('SELECT p.*, u.name as user_name FROM posts p JOIN users u ON p.user_id = u.id', (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(results);
  });
});
app.delete('/api/admin/crops/:id', (req, res) => {
  db.execute('DELETE FROM posts WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: 'Failed to delete crop' });
    res.json({ message: 'Crop deleted' });
  });
});
app.get('/api/admin/reports', (req, res) => {
  db.execute(`SELECT r.*, 
    u1.name as reporter_name, 
    u2.name as reported_user_name
    FROM reports r
    JOIN users u1 ON r.reporter_id = u1.id
    LEFT JOIN users u2 ON r.reported_user_id = u2.id`, (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(results);
  });
});
app.delete('/api/admin/reports/:id', (req, res) => {
  db.execute('DELETE FROM reports WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: 'Failed to delete report' });
    res.json({ message: 'Report deleted' });
  });
});

// --- Farming Tips Endpoints ---
// Public: Get all tips
app.get('/api/farming-tips', (req, res) => {
  db.execute('SELECT * FROM farming_tips ORDER BY created_at DESC', (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(results);
  });
});
// Admin: Add tip
app.post('/api/admin/farming-tips', (req, res) => {
  const { tip } = req.body;
  if (!tip) return res.status(400).json({ error: 'Tip required' });
  db.execute('INSERT INTO farming_tips (tip) VALUES (?)', [tip], (err, result) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ message: 'Tip added', id: result.insertId });
  });
});
// Admin: Edit tip
app.put('/api/admin/farming-tips/:id', (req, res) => {
  const { tip } = req.body;
  if (!tip) return res.status(400).json({ error: 'Tip required' });
  db.execute('UPDATE farming_tips SET tip = ? WHERE id = ?', [tip, req.params.id], (err) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ message: 'Tip updated' });
  });
});
// Admin: Delete tip
app.delete('/api/admin/farming-tips/:id', (req, res) => {
  db.execute('DELETE FROM farming_tips WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ message: 'Tip deleted' });
  });
});

// --- Platform Stats Endpoint ---
app.get('/api/platform-stats', async (req, res) => {
  try {
    db.query('SELECT COUNT(*) AS farmers FROM users', (err, usersResult) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      db.query('SELECT COUNT(*) AS crops FROM posts', (err, postsResult) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        db.query('SELECT COUNT(*) AS trades FROM posts WHERE sold = TRUE', (err, soldResult) => {
          if (err) return res.status(500).json({ error: 'Database error' });
          db.query('SELECT COUNT(*) AS available FROM posts WHERE sold = FALSE', (err, availableResult) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({
              farmers: usersResult[0].farmers,
              crops: postsResult[0].crops,
              trades: soldResult[0].trades,
              available: availableResult[0].available
            });
          });
        });
      });
    });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user's reports
app.get('/api/reports', authenticateToken, (req, res) => {
    db.execute('SELECT * FROM reports WHERE reporter_id = ? ORDER BY created_at DESC', [req.user.userId], (err, results) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch reports' });
        res.json(results);
    });
});

// Admin: update report status and reply
app.put('/api/admin/reports/:id', (req, res) => {
    const { status, reply } = req.body;
    db.execute('UPDATE reports SET status = ?, reply = ? WHERE id = ?', [status, reply, req.params.id], (err) => {
        if (err) return res.status(500).json({ error: 'Failed to update report' });
        // Optionally, send notification to reporter and reported user here
        res.json({ message: 'Report updated' });
    });
});

// Serve static files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});