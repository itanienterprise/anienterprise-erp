const mongoose = require('mongoose');
const CryptoJS = require('crypto-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const User = require('./src/models/User');

const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/erp_db';

console.log('Connecting to database...');
mongoose.connect(dbUri)
  .then(async () => {
    console.log('Connected successfully to database:', dbUri);
    
    const username = 'admin';
    const rawPassword = 'admin123';
    const hashedPassword = CryptoJS.SHA256(rawPassword).toString(CryptoJS.enc.Hex);
    
    // Find if user 'admin' already exists
    let user = await User.findOne({ username });
    
    if (user) {
      console.log('User "admin" already exists. Updating password...');
      user.password = hashedPassword;
      user.role = 'admin';
      await user.save();
      console.log('Admin user password successfully updated to "admin123"!');
    } else {
      console.log('Creating new admin user...');
      user = new User({
        username,
        password: hashedPassword,
        role: 'admin'
      });
      await user.save();
      console.log('Admin user successfully created with password "admin123"!');
    }
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Database connection or execution error:', err);
    process.exit(1);
  });
