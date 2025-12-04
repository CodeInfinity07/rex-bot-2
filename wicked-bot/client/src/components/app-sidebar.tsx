import { Home, Gamepad2, Settings, Sliders, Shield, Command, UserCheck, Users, UserSearch, Star, Terminal } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

const menuItems = [
  { title: "Overview", url: "/", icon: Home },
  { title: "Bot Controls", url: "/controls", icon: Gamepad2 },
  { title: "Configuration", url: "/configuration", icon: Settings },
  { title: "Settings", url: "/settings", icon: Sliders },
  { title: "Members", url: "/members", icon: Users },
  { title: "Protection", url: "/protection", icon: Shield },
  { title: "Exemptions", url: "/exemptions", icon: UserCheck },
  { title: "Loyal Members", url: "/loyal-members", icon: Star },
  { title: "Players", url: "/players", icon: UserSearch },
  { title: "Commands", url: "/commands", icon: Command },
  { title: "Activity Logs", url: "/logs", icon: Terminal },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { setOpenMobile, isMobile } = useSidebar();

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Gamepad2 className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base font-semibold">RexSquad Bot</h2>
            <p className="text-xs text-muted-foreground">Manager</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                    <Link href={item.url} onClick={handleNavClick}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
