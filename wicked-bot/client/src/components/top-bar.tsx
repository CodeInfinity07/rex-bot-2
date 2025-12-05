import { Moon, Sun, LogOut, User, Wifi, WifiOff, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "@/components/theme-provider";
import { useAuth, getAuthHeaders } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface BotStatus {
  success: boolean;
  connected: boolean;
  connecting: boolean;
  clubCode: string;
  clubName: string;
  uptime: number;
}

export function TopBar() {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();

  const { data: status } = useQuery<BotStatus>({
    queryKey: ["/api/jack/status"],
    queryFn: async () => {
      const res = await fetch("/api/jack/status", {
        headers: getAuthHeaders(),
      });
      return res.json();
    },
    refetchInterval: 5000,
  });

  const handleLogout = async () => {
    await logout();
  };

  const isConnected = status?.connected === true;
  const isConnecting = status?.connecting === true;

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-background px-4 gap-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger data-testid="button-sidebar-toggle" />
      </div>
      <div className="flex items-center gap-3">
        {isConnecting ? (
          <div className="flex items-center gap-2 rounded-md bg-yellow-100 dark:bg-yellow-900/30 px-3 py-1.5" data-testid="status-indicator">
            <Loader2 className="h-4 w-4 text-yellow-600 dark:text-yellow-400 animate-spin" />
            <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">Connecting...</span>
          </div>
        ) : isConnected ? (
          <div className="flex items-center gap-2 rounded-md bg-green-100 dark:bg-green-900/30 px-3 py-1.5" data-testid="status-indicator">
            <Wifi className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-green-700 dark:text-green-400">Connected</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-md bg-red-100 dark:bg-red-900/30 px-3 py-1.5" data-testid="status-indicator">
            <WifiOff className="h-4 w-4 text-red-600 dark:text-red-400" />
            <span className="text-sm font-medium text-red-700 dark:text-red-400">Disconnected</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          data-testid="button-theme-toggle"
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">{user?.id}</span>
              <Badge variant={user?.role === "owner" ? "default" : "secondary"} className="ml-1">
                {user?.role}
              </Badge>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span>{user?.id}</span>
                <span className="text-xs text-muted-foreground font-normal">
                  Logged in as {user?.role}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
