import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { AppSidebar } from "@/components/app-sidebar";
import { TopBar } from "@/components/top-bar";
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

function Router() {
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
      <Route path="/logs" component={ActivityLogs} />
      <Route component={Overview} />
    </Switch>
  );
}

export default function App() {
  const style = {
    "--sidebar-width": "280px",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <SidebarProvider style={style as React.CSSProperties}>
            <div className="flex w-full">
              <AppSidebar />
              <div className="flex flex-col flex-1 overflow-hidden">
                <TopBar />
                <main className="flex-1 overflow-auto p-6">
                  <Router />
                </main>
              </div>
            </div>
          </SidebarProvider>
          <Toaster />
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
