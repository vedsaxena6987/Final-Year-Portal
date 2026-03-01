import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext"; // Import the provider
import { SessionProvider } from "@/context/SessionContext"; // Import session provider
import FirestoreConnectionMonitor from "@/components/shared/FirestoreConnectionMonitor";


const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Project Management System",
  description: "Manage your projects efficiently",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <AuthProvider> {/* Wrap everything */}
          <SessionProvider> {/* Add session provider */}
            <TooltipProvider>
              <FirestoreConnectionMonitor />
              {children}
              <Toaster />
            </TooltipProvider>
          </SessionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
