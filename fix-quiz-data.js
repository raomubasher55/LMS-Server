const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function fixQuizData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('Connected to MongoDB');
    
    // Find all users with quiz progress
    const users = await User.find({
      'quizProgress': { $exists: true, $not: { $size: 0 } }
    });

    console.log(`Found ${users.length} users with quiz progress`);
    
    let fixedCount = 0;
    
    for (const user of users) {
      let hasChanges = false;
      
      console.log(`\nChecking user: ${user.name} (${user.email})`);
      
      for (const qp of user.quizProgress) {
        const actualAttempts = qp.attempts.length;
        const currentTotal = qp.totalAttempts || 0;
        
        console.log(`  Course: ${qp.courseId}, Chapter: ${qp.chapterId}`);
        console.log(`  Actual attempts: ${actualAttempts}, Recorded total: ${currentTotal}`);
        console.log(`  Passed: ${qp.passed}, Approval required: ${qp.instructorApprovalRequired}`);
        
        // Fix totalAttempts
        if (currentTotal !== actualAttempts) {
          console.log(`  → Fixing totalAttempts: ${currentTotal} → ${actualAttempts}`);
          qp.totalAttempts = actualAttempts;
          hasChanges = true;
        }
        
        // Set instructor approval for students with 5+ failed attempts
        if (actualAttempts >= 5 && !qp.passed && !qp.instructorApprovalRequired) {
          console.log(`  → Setting instructor approval required (${actualAttempts} failed attempts)`);
          qp.instructorApprovalRequired = true;
          qp.instructorApprovalGranted = false;
          hasChanges = true;
        }
      }
      
      if (hasChanges) {
        await user.save();
        fixedCount++;
        console.log(`  ✓ Updated user ${user.name}`);
      } else {
        console.log(`  - No changes needed for ${user.name}`);
      }
    }
    
    console.log(`\n✅ Migration completed! Fixed ${fixedCount} users.`);
    
  } catch (error) {
    console.error('❌ Error during migration:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

fixQuizData();