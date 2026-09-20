import { Component, Suspense, lazy, useEffect, useRef, type ReactNode } from "react"
import { Menu } from "lucide-react"
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Button } from "@/components/ui/button"
import Home from "./home"
import { useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"

function SidebarRouteSync({ collapse }: { collapse: boolean }) {
  const { setOpen, isMobile, setOpenMobile, open } = useSidebar()
  const collapsedByRoute = useRef(false)
  const openBeforeCollapse = useRef(true)

  useEffect(() => {
    if (isMobile) {
      if (collapse) setOpenMobile(false)
      return
    }

    if (collapse) {
      if (!collapsedByRoute.current) {
        openBeforeCollapse.current = open
        collapsedByRoute.current = true
        setOpen(false)
      }
      return
    }

    if (collapsedByRoute.current) {
      collapsedByRoute.current = false
      setOpen(openBeforeCollapse.current)
    }
  }, [collapse, isMobile, open, setOpen, setOpenMobile])

  return null
}

function MobileMenuToggle() {
  const { toggleSidebar, isMobile } = useSidebar()

  if (!isMobile) {
    return null
  }

  return (
    <Button
      onClick={toggleSidebar}
      className="fixed bottom-4 left-4 z-50 h-10 w-10 rounded-full shadow-lg md:hidden"
      size="icon"
      aria-label="Toggle menu"
    >
      <Menu className="h-5 w-5" />
    </Button>
  )
}

const MyTemplates = lazy(() => import("./my-templates"))
const TemplateEditor = lazy(() => import("./template-editor"))

class PageErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || "Unknown error" };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="px-6 py-10 text-sm text-destructive">
          This page failed to load: {this.state.message}
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Layout() {
  const location = useLocation();

  const isTemplatesList = location.pathname === "/templates";
  const isTemplateEditor = location.pathname.startsWith("/templates/");

  const renderContent = () => {
    if (isTemplatesList) return <MyTemplates />;
    if (isTemplateEditor) return <TemplateEditor />;
    return <Home />;
  };

  return (
    <SidebarProvider>
      <SidebarRouteSync collapse={isTemplateEditor} />
      <AppSidebar/>
      <main className="flex h-screen w-full min-h-0 flex-col overflow-hidden bg-background dark:text-white">
        <div
          className={cn(
            "min-h-0 flex-1 bg-background",
            isTemplateEditor ? "overflow-hidden" : "overflow-auto"
          )}
        >
          <PageErrorBoundary key={location.pathname}>
            <Suspense
              fallback={
                <div className="px-6 py-10 text-sm text-muted-foreground">Loading...</div>
              }
            >
              {renderContent()}
            </Suspense>
          </PageErrorBoundary>
        </div>
      </main>
      <MobileMenuToggle />
    </SidebarProvider>
  )
}
