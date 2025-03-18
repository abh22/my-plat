import mongoose from 'mongoose';
import { type } from 'os';
const TeamSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    leader: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true      
    },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
});
export default mongoose.models.Team || mongoose.model('Team', TeamSchema,'teams');