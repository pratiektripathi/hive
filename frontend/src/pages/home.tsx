import { Home as HomeIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function Home() {
  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="flex items-center gap-2 px-2 py-1">
        <HomeIcon className="size-5" />
        <h1 className="text-xl font-normal leading-none">Home Dashboard</h1>
        <span className="text-gray-300 dark:text-gray-600 leading-none" aria-hidden>
          |
        </span>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-none">
          Welcome to Temoter
        </p>
      </header>
      <Separator />
    </div>
  );
}
