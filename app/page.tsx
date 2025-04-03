"use client"; // Required for client-side hooks like useAuth

import React from 'react';
import { useAuth } from "../context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import ProjectList from '@/components/projects/ProjectList'; // Import the ProjectList component

export default function Home() {
  const { user, userData, googleSignIn, logOut } = useAuth();

  const handleSignIn = async () => {
    try {
      await googleSignIn();
      console.log("Signed in");
    } catch (error) {
      console.error("Sign in error:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await logOut();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <main className="min-h-screen px-4 py-12 sm:px-6 lg:px-8 bg-gradient-to-b from-neutral-50 to-neutral-100 dark:from-neutral-950 dark:to-neutral-900">
      <div className="container-custom">
        {/* Authentication Card - Conditionally rendered or perhaps moved to a /login route later */}
        {!user && (
          <div className="max-w-md mx-auto mb-12">
            <Card variant="glass" className="animate-slide-up">
              <CardHeader>
                <CardTitle>Authentication</CardTitle>
                <CardDescription>
                  Sign in to access your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div>
                  <p className="text-center text-neutral-600 dark:text-neutral-400">Please sign in using Google.</p>
                </div>
              </CardContent>
              <CardFooter className="justify-center"> 
                <Button
                  variant="default"
                  className="w-full max-w-xs" 
                  onClick={handleSignIn}
                  leftIcon={
                    <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                      {/* Google Icon SVG */}
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      <path d="M1 1h22v22H1z" fill="none"/>
                    </svg>
                  }
                >
                  Sign in with Google
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}

        {/* Project List - Only shown when user is logged in */}
        {user && (
          <div>
             <h2 className="heading-2 mb-6 text-center md:text-left">Проекты</h2>
             <ProjectList />
          </div>
        )}
      </div>
    </main>
  );
}
