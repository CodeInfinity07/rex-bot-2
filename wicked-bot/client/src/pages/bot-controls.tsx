import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Play, Square, RotateCw, Trash2, Activity, Lock, AlertCircle, Code, Key, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";

interface BotStatus {
  isRunning: boolean;
  lastStarted: string | null;
  lastStopped: string | null;
  cacheCleared: string | null;
  uptime: number;
}

interface BotStatusResponse {
  success: boolean;
  data: BotStatus;
}

interface AuthStatusResponse {
  success: boolean;
  authRequired: boolean;
  connected: boolean;
  authMessage?: any;
}

type DialogType = 'restart' | 'clearCredentials' | 'updateToken' | null;

export default function BotControls() {
  const { toast } = useToast();
  const [authData, setAuthData] = useState("");
  const [tokenContent, setTokenContent] = useState("");
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [dialogType, setDialogType] = useState<DialogType>(null);
  const [password, setPassword] = useState("");

  // Query for bot status
  const { data, isLoading, isError } = useQuery<BotStatusResponse>({
    queryKey: ["/api/jack/status"],
    refetchInterval: 5000,
  });

  // Query for auth status
  const { data: authStatus } = useQuery<AuthStatusResponse>({
    queryKey: ["/api/jack/auth-status"],
    refetchInterval: 2000,
  });

  const restartMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/jack/restart");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jack/status"] });
      toast({
        title: "Bot Restarted",
        description: "The bot has been restarted successfully.",
      });
      closePasswordDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to restart bot",
        variant: "destructive",
      });
      closePasswordDialog();
    },
  });

  const clearCredentialsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/jack/clear-credentials");
    },
    onSuccess: () => {
      toast({
        title: "Credentials Cleared",
        description: "EP and KEY have been removed from .env file. Please restart the bot.",
      });
      closePasswordDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to clear credentials",
        variant: "destructive",
      });
      closePasswordDialog();
    },
  });

  const updateTokenMutation = useMutation({
    mutationFn: async (tokenContent: string) => {
      return await apiRequest("POST", "/api/jack/update-token", { tokenContent });
    },
    onSuccess: () => {
      setTokenContent("");
      toast({
        title: "Token Updated",
        description: "token.txt file has been updated. Please restart the bot to apply changes.",
      });
      closePasswordDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update token",
        variant: "destructive",
      });
      closePasswordDialog();
    },
  });

  const authMutation = useMutation({
    mutationFn: async (authData: string) => {
      return await apiRequest("POST", "/api/jack/authenticate", { authData });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jack/auth-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jack/status"] });
      setAuthData("");
      toast({
        title: "Authentication Successful",
        description: "Bot credentials have been submitted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Authentication Failed",
        description: error.message || "Failed to authenticate",
        variant: "destructive",
      });
    },
  });

  const handleAuthenticate = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!authData.trim()) {
      toast({
        title: "Missing Credentials",
        description: "Please paste the base64 authentication data",
        variant: "destructive",
      });
      return;
    }

    try {
      const decoded = atob(authData.trim());
      JSON.parse(decoded);
    } catch (err) {
      toast({
        title: "Invalid Format",
        description: "Please paste valid base64 encoded authentication data",
        variant: "destructive",
      });
      return;
    }

    authMutation.mutate(authData.trim());
  };

  const closePasswordDialog = () => {
    setShowPasswordDialog(false);
    setPassword("");
    setDialogType(null);
  };

  const openPasswordDialog = (type: DialogType) => {
    setDialogType(type);
    setShowPasswordDialog(true);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const DEVELOPER_PASSWORD = "aa00aa00";
    
    if (password !== DEVELOPER_PASSWORD) {
      toast({
        title: "Invalid Password",
        description: "The developer password is incorrect.",
        variant: "destructive",
      });
      return;
    }

    switch (dialogType) {
      case 'restart':
        restartMutation.mutate();
        break;
      case 'clearCredentials':
        clearCredentialsMutation.mutate();
        break;
      case 'updateToken':
        if (!tokenContent.trim()) {
          toast({
            title: "Missing Token",
            description: "Please paste the token content",
            variant: "destructive",
          });
          return;
        }
        updateTokenMutation.mutate(tokenContent.trim());
        break;
    }
  };

  const getDialogTitle = () => {
    switch (dialogType) {
      case 'restart':
        return 'Restart Bot';
      case 'clearCredentials':
        return 'Clear Credentials';
      case 'updateToken':
        return 'Update Token';
      default:
        return 'Authentication Required';
    }
  };

  const getDialogDescription = () => {
    switch (dialogType) {
      case 'restart':
        return 'Please enter the developer password to restart the bot.';
      case 'clearCredentials':
        return 'Please enter the developer password to clear EP and KEY from .env file.';
      case 'updateToken':
        return 'Please enter the developer password to update the token.txt file.';
      default:
        return 'Please enter the developer password.';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-bot-controls">Bot Controls</h1>
          <p className="text-muted-foreground mt-1">Manage bot operations</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Loading bot status...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-bot-controls">Bot Controls</h1>
          <p className="text-muted-foreground mt-1">Manage bot operations</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-destructive">Failed to load bot status. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const botStatus = data?.data;
  const isPending = restartMutation.isPending || clearCredentialsMutation.isPending || updateTokenMutation.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-bot-controls">Bot Controls</h1>
        <p className="text-muted-foreground mt-1">Manage bot operations</p>
      </div>

      {/* Authentication Required Alert */}
      {authStatus?.authRequired && (
        <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800 dark:text-yellow-200">
            Authentication required to connect the bot. Please paste your base64 encoded credentials below.
          </AlertDescription>
        </Alert>
      )}

      {/* Authentication Message Display */}
      {authStatus?.authRequired && authStatus?.authMessage && (
        <Card className="border-blue-500">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Code className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-blue-900 dark:text-blue-100">Authentication Request</CardTitle>
            </div>
            <CardDescription>Server authentication request message</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-slate-950 text-slate-50 p-4 rounded-lg overflow-x-auto text-xs">
              {authStatus.authMessage}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Authentication Form */}
      {authStatus?.authRequired && (
        <Card className="border-yellow-500">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-yellow-600" />
              <CardTitle>Bot Authentication</CardTitle>
            </div>
            <CardDescription>Paste your base64 encoded authentication data</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAuthenticate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="auth-data">Base64 Authentication Data</Label>
                <Textarea
                  id="auth-data"
                  placeholder="Paste your base64 encoded authentication data here..."
                  value={authData}
                  onChange={(e) => setAuthData(e.target.value)}
                  disabled={authMutation.isPending}
                  className="font-mono text-sm min-h-[150px] resize-y"
                />
                <p className="text-xs text-muted-foreground">
                  This should be the base64 encoded string containing your KEY and EP
                </p>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={authMutation.isPending}
              >
                {authMutation.isPending ? "Authenticating..." : "Authenticate"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{getDialogTitle()}</DialogTitle>
            <DialogDescription>{getDialogDescription()}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordSubmit}>
            <div className="space-y-4 py-4">
              {dialogType === 'updateToken' && (
                <div className="space-y-2">
                  <Label htmlFor="token-content">Token Content (Base64)</Label>
                  <Textarea
                    id="token-content"
                    placeholder="Paste your base64 encoded token here..."
                    value={tokenContent}
                    onChange={(e) => setTokenContent(e.target.value)}
                    disabled={isPending}
                    className="font-mono text-sm min-h-[150px] resize-y"
                  />
                  <p className="text-xs text-muted-foreground">
                    This should contain your EP and KEY in base64 format
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="developer-password">Developer Password</Label>
                <Input
                  id="developer-password"
                  type="password"
                  placeholder="Enter developer password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isPending}
                  autoFocus={dialogType !== 'updateToken'}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closePasswordDialog}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Processing..." : "Confirm"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                <CardTitle>Bot Status</CardTitle>
              </div>
              <Badge variant="default" data-testid="badge-bot-status">
                Running
              </Badge>
            </div>
            <CardDescription>Current operational status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {botStatus?.lastStarted && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Last Started:</span>
                  <span data-testid="text-last-started">
                    {formatDistanceToNow(new Date(botStatus.lastStarted), { addSuffix: true })}
                  </span>
                </div>
              )}
              {botStatus?.lastStopped && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Last Stopped:</span>
                  <span data-testid="text-last-stopped">
                    {formatDistanceToNow(new Date(botStatus.lastStopped), { addSuffix: true })}
                  </span>
                </div>
              )}
              {botStatus?.cacheCleared && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cache Cleared:</span>
                  <span data-testid="text-cache-cleared">
                    {formatDistanceToNow(new Date(botStatus.cacheCleared), { addSuffix: true })}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Control Panel</CardTitle>
            <CardDescription>Manage bot operations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Button disabled className="w-full" data-testid="button-start-bot">
                <Play className="mr-2 h-4 w-4" />
                Start
              </Button>
              <Button disabled variant="destructive" className="w-full" data-testid="button-stop-bot">
                <Square className="mr-2 h-4 w-4" />
                Stop
              </Button>
              <Button
                onClick={() => openPasswordDialog('restart')}
                disabled={isPending}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                data-testid="button-restart-bot"
              >
                <RotateCw className="mr-2 h-4 w-4" />
                Restart
              </Button>
              <Button disabled variant="outline" className="w-full" data-testid="button-clear-cache">
                <Trash2 className="mr-2 h-4 w-4" />
                Clear Cache
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Credentials Management Card */}
      <Card className="border-orange-500">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-orange-600" />
            <CardTitle>Credentials Management</CardTitle>
          </div>
          <CardDescription>Manage authentication credentials (requires developer password)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <Button
              onClick={() => openPasswordDialog('clearCredentials')}
              disabled={isPending}
              variant="outline"
              className="w-full border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Clear EP & KEY
            </Button>
            <Button
              onClick={() => openPasswordDialog('updateToken')}
              disabled={isPending}
              variant="outline"
              className="w-full border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
            >
              <FileText className="mr-2 h-4 w-4" />
              Update Token File
            </Button>
          </div>
          <div className="mt-4 space-y-2 text-xs text-muted-foreground">
            <p>
              <strong>Clear EP & KEY:</strong> Removes credentials from .env file. Use when you want to reset authentication.
            </p>
            <p>
              <strong>Update Token File:</strong> Replaces the content of token.txt with new credentials. The bot will read from this file on next restart.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About Bot Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>Start:</strong> Activates the bot and begins monitoring chat activity.
          </p>
          <p>
            <strong>Stop:</strong> Deactivates the bot temporarily. All settings are preserved.
          </p>
          <p>
            <strong>Restart:</strong> Stops and immediately restarts the bot. Useful for applying configuration changes.
          </p>
          <p>
            <strong>Clear Cache:</strong> Clears temporary data and cache. The bot will rebuild its cache automatically.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}