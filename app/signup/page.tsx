"use client"

import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

import team from "../../models/team";
export default function SignUp(){
    const[email,setEmail]=useState("");
    const[password,setPassword]=useState("");
    const team= "biochemicals";
    const[error,setError]=useState("");
    const router =useRouter();
    const handleSubmit = async(e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        console.log("Email:", email); // Log to check if the email is captured
        console.log("Password",password);
        console.log(team);
        const res= await fetch("/api/user/signup",{
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email:email, password:password, team:team }),
        });
        console.log("Response status:", res.status);
        

        const text = await res.text();
    try {
      const data = text ? JSON.parse(text) : {};
        if (!res.ok) {
          // Display the error message to the user
          console.error('Error:', data.message);
          setError(data.message); // Assuming you have a state variable for errors
          return;
        }
      
        // Handle success
        console.log('Success:', data);
        router.push('/dashboard');
      // Redirect or show success message
      } catch (error) {
        console.error('Error:', error);
        setError('An unexpected error occurred');
      }
      
    };
    return (
        <div className="flex justify-center items-center h-screen">
          <Card className="w-96">
            <CardHeader className="flex justify-center items-center">
              <h2 className="text-center w-full">Register</h2>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <Input placeholder="Password" type="password" value={password} onChange={(e) => { setPassword(e.target.value); }} />
                {error && <p className="text-red-500">{error}</p>}
                <Button type="submit" className="w-full">Sign Up</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      );
    }