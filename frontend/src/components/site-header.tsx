import { Link } from "@tanstack/react-router";
import { Sheet, SheetHeader, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "./ui/sheet";
import { Button } from "./ui/button";
import { MenuIcon } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-border/40 bg-primary/95 backdrop-blur supports-[backdrop-filter]:bg-primary/90">
        <div className="container mx-auto flex items-center justify-between p-4">
            <div className="flex items-center space-x-4">
            <Link to="/">
                <h1 className="text-2xl font-bold">YC Better</h1>
            </Link>
            <nav className="hidden items-center space-x-4 md:flex">
                <div className="hover:underline">New</div>
                <div className="hover:underline">Top</div>
                <div className="hover:underline">Submit</div>
            </nav>
            </div>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="secondary" size="icon" className="md:hidden">
                  <MenuIcon className="size-6" />
                </Button>
              </SheetTrigger>
              <SheetContent className="md-2">
                <SheetHeader>
                  <SheetTitle>YC Better</SheetTitle>
                  <SheetDescription className="sr-only">
                    Navigation
                  </SheetDescription>
                </SheetHeader>
                <nav className="flex flex-col space-y-2">
                  <Link to="/" className="hover:underline">Home</Link>
                  <Link to="/about" className="hover:underline">About</Link>
                  <Link to="/contact" className="hover:underline">Contact</Link>
                </nav>
              </SheetContent>
            </Sheet>
        </div>
    </header>
  )
}