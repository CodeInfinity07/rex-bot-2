import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Play, Square, RotateCw, Trash2, Activity, Lock, AlertCircle, Code, Key, FileText, Bot, Copy, Check } from "lucide-react";
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

interface ClubInfoResponse {
  success: boolean;
  data: {
    clubName: string;
    clubCode: string;
    botUid: string;
  };
}

type DialogType = 'restart' | 'clearCredentials' | 'updateToken' | 'updateOpenAI' | 'updateBotUid' | null;

export default function BotControls() {
  const { toast } = useToast();
  const [authData, setAuthData] = useState("");
  const [tokenContent, setTokenContent] = useState("");
  const [openAIKey, setOpenAIKey] = useState("");
  const [botUidInput, setBotUidInput] = useState("");
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [dialogType, setDialogType] = useState<DialogType>(null);
  const [password, setPassword] = useState("");
  const [isCopied, setIsCopied] = useState(false);

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

  // Query for club info (including BOT_UID)
  const { data: clubInfo } = useQuery<ClubInfoResponse>({
    queryKey: ["/api/jack/club-info"],
  });

  // Restart bot mutation
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

  // Clear credentials mutation
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

  // Update token mutation
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

  // Update OpenAI key mutation
  const updateOpenAIKeyMutation = useMutation({
    mutationFn: async (apiKey: string) => {
      return await apiRequest("POST", "/api/jack/update-openai-key", { apiKey });
    },
    onSuccess: () => {
      setOpenAIKey("");
      toast({
        title: "OpenAI Key Updated",
        description: "API key has been updated. Consider restarting the bot for changes to take effect.",
      });
      closePasswordDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update OpenAI key",
        variant: "destructive",
      });
      closePasswordDialog();
    },
  });

  // Update Bot UID mutation
  const updateBotUidMutation = useMutation({
    mutationFn: async (botUid: string) => {
      return await apiRequest("POST", "/api/jack/update-bot-uid", { botUid });
    },
    onSuccess: () => {
      setBotUidInput("");
      queryClient.invalidateQueries({ queryKey: ["/api/jack/club-info"] });
      toast({
        title: "Bot UID Updated",
        description: "Bot UID has been updated successfully.",
      });
      closePasswordDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update Bot UID",
        variant: "destructive",
      });
      closePasswordDialog();
    },
  });

  // Authentication mutation
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

  // Copy to clipboard function
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      toast({
        title: "Copied!",
        description: "Authentication message copied to clipboard",
      });
      
      // Reset copied state after 2 seconds
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    } catch (err) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  // Handle authentication form submission
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

  // Close password dialog
  const closePasswordDialog = () => {
    setShowPasswordDialog(false);
    setPassword("");
    setDialogType(null);
  };

  // Open password dialog
  const openPasswordDialog = (type: DialogType) => {
    setDialogType(type);
    setShowPasswordDialog(true);
  };

  // Handle password submission
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
      case 'updateOpenAI':
        if (!openAIKey.trim()) {
          toast({
            title: "Missing API Key",
            description: "Please enter the OpenAI API key",
            variant: "destructive",
          });
          return;
        }
        if (!openAIKey.trim().startsWith('sk-')) {
          toast({
            title: "Invalid Format",
            description: "OpenAI API keys should start with 'sk-'",
            variant: "destructive",
          });
          return;
        }
        updateOpenAIKeyMutation.mutate(openAIKey.trim());
        break;
      case 'updateBotUid':
        if (!botUidInput.trim()) {
          toast({
            title: "Missing Bot UID",
            description: "Please enter the Bot UID",
            variant: "destructive",
          });
          return;
        }
        updateBotUidMutation.mutate(botUidInput.trim());
        break;
    }
  };

  // Get dialog title based on type
  const getDialogTitle = () => {
    switch (dialogType) {
      case 'restart':
        return 'Restart Bot';
      case 'clearCredentials':
        return 'Clear Credentials';
      case 'updateToken':
        return 'Update Token';
      case 'updateOpenAI':
        return 'Update OpenAI API Key';
      case 'updateBotUid':
        return 'Update Bot UID';
      default:
        return 'Authentication Required';
    }
  };

  // Get dialog description based on type
  const getDialogDescription = () => {
    switch (dialogType) {
      case 'restart':
        return 'Please enter the developer password to restart the bot.';
      case 'clearCredentials':
        return 'Please enter the developer password to clear EP and KEY from .env file.';
      case 'updateToken':
        return 'Please enter the developer password to update the token.txt file.';
      case 'updateOpenAI':
        return 'Please enter the developer password to update the OpenAI API key.';
      case 'updateBotUid':
        return 'Please enter the developer password to update the Bot UID.';
      default:
        return 'Please enter the developer password.';
    }
  };

  // Check if any mutation is pending
  const isPending = restartMutation.isPending || 
                    clearCredentialsMutation.isPending || 
                    updateTokenMutation.isPending || 
                    updateOpenAIKeyMutation.isPending ||
                    updateBotUidMutation.isPending;

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-bot-controls">Bot Controls</h1>
          <p className="text-muted-foreground mt-1">Manage bot operations</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                <p className="text-center text-muted-foreground">Loading bot status...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-bot-controls">Bot Controls</h1>
          <p className="text-muted-foreground mt-1">Manage bot operations</p>
        </div>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-3 py-8">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <p className="text-center text-destructive font-semibold">Failed to load bot status</p>
              <p className="text-center text-sm text-muted-foreground">Please check your connection and try again</p>
              <Button 
                onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/jack/status"] })}
                variant="outline"
                className="mt-2"
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const botStatus = data?.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-bot-controls">Bot Controls</h1>
        <p className="text-muted-foreground mt-1">Manage bot operations and credentials</p>
      </div>

      {/* Authentication Required Alert */}
      {authStatus?.authRequired && (
        <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800 dark:text-yellow-200">
            <strong>Authentication Required:</strong> The bot needs your credentials to connect. Please paste your authentication data below.
          </AlertDescription>
        </Alert>
      )}

      {/* Authentication Message Display with Copy Button */}
      {authStatus?.authRequired && authStatus?.authMessage && (
        <Card className="border-blue-500">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-blue-900 dark:text-blue-100">Authentication Request</CardTitle>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(authStatus.authMessage)}
                className="border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
              >
                {isCopied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <CardDescription>Server authentication request message (click copy button to copy)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <pre className="bg-slate-950 text-slate-50 p-4 rounded-lg overflow-x-auto text-xs select-all">
                {authStatus.authMessage}
              </pre>
            </div>
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
            <CardDescription>Paste your base64 encoded authentication data to connect the bot</CardDescription>
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
                {authMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Authenticating...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Authenticate
                  </>
                )}
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
              {dialogType === 'updateOpenAI' && (
                <div className="space-y-2">
                  <Label htmlFor="openai-key">OpenAI API Key</Label>
                  <Input
                    id="openai-key"
                    type="password"
                    placeholder="sk-..."
                    value={openAIKey}
                    onChange={(e) => setOpenAIKey(e.target.value)}
                    disabled={isPending}
                    className="font-mono text-sm"
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">
                    Your OpenAI API key (starts with 'sk-')
                  </p>
                </div>
              )}
              {dialogType === 'updateBotUid' && (
                <div className="space-y-2">
                  <Label htmlFor="bot-uid">Bot UID</Label>
                  <Input
                    id="bot-uid"
                    type="text"
                    placeholder="Enter Bot UID..."
                    value={botUidInput}
                    onChange={(e) => setBotUidInput(e.target.value)}
                    disabled={isPending}
                    className="font-mono text-sm"
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">
                    The unique identifier for the bot
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
                  autoFocus={dialogType !== 'updateToken' && dialogType !== 'updateOpenAI'}
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
                {isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processing...
                  </>
                ) : (
                  "Confirm"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Status and Control Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Bot Status Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                <CardTitle>Bot Status</CardTitle>
              </div>
              <Badge variant="default" data-testid="badge-bot-status" className="bg-green-600">
                Running
              </Badge>
            </div>
            <CardDescription>Current operational status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {botStatus?.lastStarted && (
                <div className="flex justify-between items-center text-sm p-3 bg-muted rounded-lg">
                  <span className="text-muted-foreground font-medium">Last Started:</span>
                  <span data-testid="text-last-started" className="font-semibold">
                    {formatDistanceToNow(new Date(botStatus.lastStarted), { addSuffix: true })}
                  </span>
                </div>
              )}
              {botStatus?.lastStopped && (
                <div className="flex justify-between items-center text-sm p-3 bg-muted rounded-lg">
                  <span className="text-muted-foreground font-medium">Last Stopped:</span>
                  <span data-testid="text-last-stopped" className="font-semibold">
                    {formatDistanceToNow(new Date(botStatus.lastStopped), { addSuffix: true })}
                  </span>
                </div>
              )}
              {botStatus?.cacheCleared && (
                <div className="flex justify-between items-center text-sm p-3 bg-muted rounded-lg">
                  <span className="text-muted-foreground font-medium">Cache Cleared:</span>
                  <span data-testid="text-cache-cleared" className="font-semibold">
                    {formatDistanceToNow(new Date(botStatus.cacheCleared), { addSuffix: true })}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Control Panel Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <CardTitle>Control Panel</CardTitle>
            </div>
            <CardDescription>Manage bot operations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Button 
                disabled 
                className="w-full" 
                data-testid="button-start-bot"
                variant="outline"
              >
                <Play className="mr-2 h-4 w-4" />
                Start
              </Button>
              <Button 
                disabled 
                variant="destructive" 
                className="w-full" 
                data-testid="button-stop-bot"
              >
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
              <Button 
                disabled 
                variant="outline" 
                className="w-full" 
                data-testid="button-clear-cache"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear Cache
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bot UID Card */}
      <Card className="border-purple-500">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-purple-600" />
            <CardTitle>Bot Identity</CardTitle>
          </div>
          <CardDescription>View and manage the bot's unique identifier</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Current Bot UID</p>
                <p className="font-mono text-lg font-semibold" data-testid="text-bot-uid">
                  {clubInfo?.data?.botUid || 'Not Configured'}
                </p>
              </div>
              <Button
                onClick={() => openPasswordDialog('updateBotUid')}
                disabled={isPending}
                variant="outline"
                className="border-purple-500 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950"
              >
                <Bot className="mr-2 h-4 w-4" />
                Update UID
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              The Bot UID is used to identify the bot when connecting to the game server. Changing this will require a restart.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Credentials Management Card */}
      <Card className="border-orange-500">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-orange-600" />
            <CardTitle>Credentials Management</CardTitle>
          </div>
          <CardDescription>Manage authentication credentials and API keys (requires developer password)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
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
            <Button
              onClick={() => openPasswordDialog('updateOpenAI')}
              disabled={isPending}
              variant="outline"
              className="w-full border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
            >
              <Key className="mr-2 h-4 w-4" />
              Update OpenAI Key
            </Button>
          </div>
          <div className="mt-4 space-y-2 text-xs text-muted-foreground border-t pt-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <p className="font-semibold text-foreground mb-1">Clear EP & KEY</p>
                <p>Removes bot authentication credentials from .env file. Use when you want to reset authentication.</p>
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1">Update Token File</p>
                <p>Replaces the content of token.txt with new credentials. The bot will read from this file on next restart.</p>
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1">Update OpenAI Key</p>
                <p>Updates the OpenAI API key in .env file for ChatGPT functionality. Restart recommended after updating.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Information Card */}
      <Card>
        <CardHeader>
          <CardTitle>About Bot Controls</CardTitle>
          <CardDescription>Understanding bot control operations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="flex items-start gap-2">
                <Play className="h-4 w-4 mt-0.5 text-green-600 flex-shrink-0" />
                <span><strong className="text-foreground">Start:</strong> Activates the bot and begins monitoring chat activity.</span>
              </p>
              <p className="flex items-start gap-2">
                <Square className="h-4 w-4 mt-0.5 text-red-600 flex-shrink-0" />
                <span><strong className="text-foreground">Stop:</strong> Deactivates the bot temporarily. All settings are preserved.</span>
              </p>
            </div>
            <div className="space-y-2">
              <p className="flex items-start gap-2">
                <RotateCw className="h-4 w-4 mt-0.5 text-blue-600 flex-shrink-0" />
                <span><strong className="text-foreground">Restart:</strong> Stops and immediately restarts the bot. Useful for applying configuration changes.</span>
              </p>
              <p className="flex items-start gap-2">
                <Trash2 className="h-4 w-4 mt-0.5 text-orange-600 flex-shrink-0" />
                <span><strong className="text-foreground">Clear Cache:</strong> Clears temporary data and cache. The bot will rebuild its cache automatically.</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}