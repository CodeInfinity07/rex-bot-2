import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Lock, Save, UserCog } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const VPS_API_URL = "https://wickedrex-143.botpanels.live";

export default function Admins() {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [admins, setAdmins] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const verifyPassword = async () => {
    setIsVerifying(true);
    try {
      const response = await fetch(`${VPS_API_URL}/api/jack/admins/verify-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      
      if (data.success) {
        setIsAuthenticated(true);
        loadAdmins();
        toast({ title: "Success", description: "Password verified" });
      } else {
        toast({ title: "Error", description: "Invalid password", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to verify password", variant: "destructive" });
    }
    setIsVerifying(false);
  };

  const loadAdmins = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${VPS_API_URL}/api/jack/admins/list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      
      if (data.success) {
        setAdmins(data.data.join(", "));
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to load admins", variant: "destructive" });
    }
    setIsLoading(false);
  };

  const saveAdmins = async () => {
    setIsSaving(true);
    try {
      const adminList = admins
        .split(",")
        .map((a) => a.trim())
        .filter((a) => a !== "");
      
      const response = await fetch(`${VPS_API_URL}/api/jack/admins/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, data: adminList }),
      });
      const data = await response.json();
      
      if (data.success) {
        toast({ title: "Success", description: "Admins saved successfully" });
      } else {
        toast({ title: "Error", description: data.message || "Failed to save admins", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to save admins", variant: "destructive" });
    }
    setIsSaving(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Administrators</h1>
          <p className="text-muted-foreground mt-1">Password protected admin management</p>
        </div>

        <Card className="max-w-md mx-auto">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              <CardTitle>Enter Password</CardTitle>
            </div>
            <CardDescription>This page is password protected</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && verifyPassword()}
              />
              <Button onClick={verifyPassword} disabled={isVerifying || !password} className="w-full">
                {isVerifying ? "Verifying..." : "Unlock"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Administrators</h1>
        <p className="text-muted-foreground mt-1">Manage bot administrators</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            <CardTitle>Admin List</CardTitle>
          </div>
          <CardDescription>Admin usernames (comma-separated)</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading admins...</p>
          ) : (
            <div className="space-y-4">
              <Textarea
                placeholder="Admin1, Admin2, Admin3"
                value={admins}
                onChange={(e) => setAdmins(e.target.value)}
                className="min-h-[200px]"
              />
              <Button onClick={saveAdmins} disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Saving..." : "Save Admins"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
