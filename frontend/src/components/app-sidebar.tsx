import {
  Home,
  User2,
  LucidePower,
  Sun,
  Moon,
  X,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import logo from "../assets/logo.svg";

interface MenuItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
}

const items: MenuItem[] = [
  {
    title: "Home",
    icon: Home,
    path: "/home",
  },
];

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { setOpenMobile } = useSidebar();

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const isActive = (path: string) => {
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

      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-800">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          className="w-full justify-center"
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>
      </div>

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
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="min-h-15">
              <a>
                <User2 />
                <div>
                  <span>{user?.username || "User"}</span>
                </div>
              </a>
            </SidebarMenuButton>
            <SidebarMenuAction
              asChild
              className="min-h-10 min-w-10 m-2 p-3"
              onClick={() => {
                logout();
              }}
            >
              <LucidePower />
            </SidebarMenuAction>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
