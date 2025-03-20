import { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/mongodb";      
import User from "../../../models/user";
import Team from "../../../models/team";
import Invite from "../../../models/invite";
import bcrypt from "bcrypt";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method not allowed" });
      }
    try{
    await connectToDatabase();
console.log("Connected to database");
} 
    catch (error) {         
        console.error("Failed to connect to database", error);         
        return res.status(500).json({ message: "Failed to connect to database" });     
    }
    console.log("Connected to database");
    const body = req.body;
   const { email, password, team } = body;
    
    console.log("Request body:", req.body);
    console.log(password);
    const invite = await Invite
        .findOne({email})   
    if (!invite) {     
        return res.status(401).json({ message: "No invite found for this email" });
    }
let user= await User
    .findOne        
    ({email});
    if (user) {
        return res.status(401).json({ message: "User already exists" });
    }
    user = new User({email, team, password: await bcrypt.hash(password, 10)});
    await user.save();
    await Invite.deleteOne({email, team});
    await Team.findByIdAndUpdate
        (invite.team, {$push: {members: email}});      
    return res.status(200).json({ message: "User created" });

             

}
