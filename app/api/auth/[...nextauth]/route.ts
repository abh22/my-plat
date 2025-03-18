import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/app/models/user";
import mongoose from "mongoose";

export const authOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "text" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials, req) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error("Email and password required");
                }

                try {
                    await connectToDatabase();
                    console.log("Connected to database");
                    if (mongoose.connection.db) {
                        console.log("Database name:", mongoose.connection.db.databaseName);
                    } else {
                        console.error("Database connection is undefined");
                    }
                    const user = await User.findOne({ email: credentials.email });
                    if (!user || user.password !== credentials.password) {
                        throw new Error("No user found with this email");
                    }
                    return user;
                } catch (error: any) {
                    console.error("Authentication error:", error);
                    return null;
                }
            }
        })
    ],
    pages: {
        signIn: '../auth',
    },
    secret: process.env.NEXTAUTH_SECRET,
};
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
