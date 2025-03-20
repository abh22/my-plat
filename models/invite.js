import mongoose from 'mongoose';
const InviteSchema = new mongoose.Schema({
    team: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Team",
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true 
      },
    
});
const invite= mongoose.models.Invite || mongoose.model('Invite', InviteSchema,'invites');
export default invite;