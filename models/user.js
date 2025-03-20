import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true 
  },
  password: { 
    type: String, 
    required: true 
  },
  teams: [{ type: mongoose.Schema.Types.ObjectId, ref: "teams" }]
});

// Prevent mongoose from creating model multiple times
export default mongoose.models.User || mongoose.model('User', UserSchema,'users');