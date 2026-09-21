import { Link, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Upload, ListPlus, LogOut, Vote, FileScan,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/auth/AuthContext";

const NAV = [
  { to: "/", label: "ড্যাশবোর্ড", icon: LayoutDashboard, end: true },
  { to: "/voters", label: "ভোটার তালিকা", icon: Users },
  { to: "/convert", label: "PDF কনভার্ট", icon: FileScan, adminOnly: true },
  { to: "/import", label: "ইমপোর্ট", icon: Upload, adminOnly: true },
  { to: "/fields", label: "কাস্টম ফিল্ড", icon: ListPlus, adminOnly: true },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Vote className="h-4 w-4" />
            </div>
            <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
              <span className="text-sm font-semibold">ভোটার তালিকা</span>
              <span className="text-xs text-muted-foreground">ম্যানেজমেন্ট অ্যাপ</span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>মেনু</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV.filter((item) => !item.adminOnly || user?.role === "admin").map((item) => {
                  const active = item.end
                    ? location.pathname === item.to
                    : location.pathname.startsWith(item.to);
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        render={<Link to={item.to} />}
                        isActive={active}
                        tooltip={item.label}
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <div className="flex items-center gap-2 px-2 py-1.5 group-data-[collapsible=icon]:justify-center">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-xs">
                {user?.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-1 flex-col leading-tight group-data-[collapsible=icon]:hidden">
              <span className="text-sm font-medium">{user?.username}</span>
              <span className="text-xs text-muted-foreground capitalize">{user?.role}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 group-data-[collapsible=icon]:hidden"
              onClick={() => logout()}
              title="লগআউট"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
