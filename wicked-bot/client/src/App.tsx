import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { TopBar } from "@/components/top-bar";
import Login from "@/pages/login";
import Overview from "@/pages/overview";
import Commands from "@/pages/commands";
import PlayerLookup from "@/pages/players";
import BotControls from "@/pages/bot-controls";
import Configuration from "@/pages/configuration";
import Settings from "@/pages/settings";
import Members from "@/pages/members";
import Protection from "@/pages/protection";
import Exemptions from "@/pages/exemptions";
import LoyalMembers from "@/pages/loyal-members";
import ActivityLogs from "@/pages/activity-logs";
import Moderators from "@/pages/moderators";
import Music from "@/pages/music";
import Stream from "@/pages/stream";

function ProtectedRoutes() {
  return (
    <Switch>
      <Route path="/" component={Overview} />
      <Route path="/controls" component={BotControls} />
      <Route path="/configuration" component={Configuration} />
      <Route path="/settings" component={Settings} />
      <Route path="/members" component={Members} />
      <Route path="/protection" component={Protection} />
      <Route path="/exemptions" component={Exemptions} />
      <Route path="/loyal-members" component={LoyalMembers} />
      <Route path="/players" component={PlayerLookup} />
      <Route path="/commands" component={Commands} />
      <Route path="/moderators" component={Moderators} />
      <Route path="/logs" component={ActivityLogs} />
      <Route path="/music" component={Music} />
      <Route path="/stream" component={Stream} />
      <Route component={Overview} />
    </Switch>
  );
}

function AppContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const style = {
    "--sidebar-width": "280px",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-auto p-6">
            <ProtectedRoutes />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppContent />
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
