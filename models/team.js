import mongoose from 'mongoose';
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
console.log(mongoose.models)
export default mongoose.models?.Team || mongoose.model('Team', TeamSchema, 'teams');