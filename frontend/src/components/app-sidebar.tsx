import {
  User2,
  LucidePower,
  Sun,
  Moon,
  X,
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboardingTour } from "@/contexts/OnboardingTourContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  gettingStartedRemainingMs,
  isGettingStartedVisible,
} from "@/lib/onboarding";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import logo from "../assets/logo.svg";

interface MenuItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  tourId?: string;
}

const items: MenuItem[] = [
  {
    title: "My Templates",
    icon: FileText,
    path: "/templates",
    tourId: "nav-templates",
  },
];

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { setOpenMobile, state, toggleSidebar } = useSidebar();
  const { startTour } = useOnboardingTour();
  const [showGettingStarted, setShowGettingStarted] = useState(
    isGettingStartedVisible()
  );

  useEffect(() => {
    const refresh = () => setShowGettingStarted(isGettingStartedVisible());
    refresh();

    const remaining = gettingStartedRemainingMs();
    if (remaining <= 0) return;

    const timer = window.setTimeout(refresh, remaining + 50);
    const interval = window.setInterval(refresh, 5_000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [user?.id]);

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const isActive = (path: string) => {
    if (path === "/templates") {
      return location.pathname === "/templates" || location.pathname.startsWith("/templates/");
    }
    return location.pathname === path;
  };

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-gray-200 dark:border-gray-800"
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="min-h-15">
              <a>
                <img
                  src={logo}
                  alt="Temoter Logo"
                  className="h-12 w-12"
                />
                <div>
                  <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                    TEMOTER
                  </h1>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        
        <div className="md:hidden absolute top-4 right-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpenMobile(false)}
            className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Application</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    isActive={isActive(item.path)}
                    onClick={() => handleNavigation(item.path)}
                    data-tour={item.tourId}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {showGettingStarted && (
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => startTour()}
                className={`w-full ${state === "collapsed" ? "justify-center" : ""}`}
                tooltip="Getting Started"
                data-tour="getting-started"
              >
                <Sparkles className="h-4 w-4" />
                {state !== "collapsed" && <span>Getting Started</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={toggleSidebar}
              className={`w-full ${state === "collapsed" ? "justify-center" : ""}`}
              tooltip={state === "collapsed" ? "Expand" : "Collapse"}
              data-tour="sidebar-collapse"
            >
              {state === "collapsed" ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
              {state !== "collapsed" && <span>Collapse</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="min-h-15">
                  <User2 />
                  <div>
                    <span>{user?.username || "User"}</span>
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start">
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    toggleTheme();
                  }}
                >
                  {theme === "dark" ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                  <span>
                    Switch to {theme === "dark" ? "light" : "dark"} mode
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    logout();
                  }}
                >
                  <LucidePower className="h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
