"use client"

import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { signIn } from 'next-auth/react';
export default function SignIn(){
    const[email,setEmail]=useState("");
    const[password,setPassword]=useState("");
    const[error,setError]=useState("");
    const router =useRouter();
    const handleSubmit = async(e: React.FormEvent)=> {
        e.preventDefault();
        setError("");
        console.log("Email:", email); // Log to check if the email is captured
        console.log("Password:", password);
        const res = await signIn("credentials",{ redirect: false,email,password, callbackUrl: "/dashboard"});
        console.log("SignIn Response:", res);
        if(res?.error){
            setError("Invalid email or password")
        
        }else{
            router.push("/dashboard");
        }
      //   const res = await fetch("/api/auth/[...nextauth]/route", {
      //     method: "POST",
      //     headers: { "Content-Type": "application/json" },
      //     body: JSON.stringify({ email, password }),
      // });
  
      // const data = await res.json();
      // if (!res.ok) {
      //     setError("Invalid email or password");
      // } else {
      //     router.push("/dashboard");
      // }
    };
    return (
        <div className="flex justify-center items-center h-screen">
          <Card className="w-96">
            <CardHeader className="flex justify-center items-center">
              <h2 className="text-center w-full">Sign In</h2>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <Input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                {error && <p className="text-red-500">{error}</p>}
                <Button type="submit" className="w-full">Sign In</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      );
    }