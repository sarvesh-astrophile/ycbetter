import { AlertTriangleIcon } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "./ui/alert";
import { Button } from "./ui/button";
import { Link, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "./ui/accordion";

export function ErrorComponent( { error }: { error: Error }) {
    const router = useRouter()
    const isDev = process.env.NODE_ENV === "development";
    const queryClientErrorBoundary = useQueryErrorResetBoundary();

    useEffect(() => {
        queryClientErrorBoundary.reset()
    }, [queryClientErrorBoundary])
    return (
        <div className="mt-8 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <Alert variant="destructive">
                    <AlertTriangleIcon className="size-4" />
                    <AlertTitle>Oops! Something went wrong.</AlertTitle>
                    <AlertDescription>We&apos;re sorry, but an error occurred while processing your request. Please try again later.</AlertDescription>
                </Alert>

                <div className="mt-4 space-y-4">
                    <Button className="w-full" onClick={() => { router.invalidate()}}>Try again</Button>
                    <Button variant="outline" className="w-full" asChild>
                        <Link to="/">Return to home</Link>
                    </Button>
                    {isDev ? 
                        <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="error-details">
                            <AccordionTrigger>View Error Details</AccordionTrigger>
                            <AccordionContent>
                                <div className="rounded-md bg-muted p-4">
                                    <h3 className="mb-2 font-semibold">Error Message:</h3>
                                    <p className="mb-4 text-sm">{error.message}</p>
                                    <h3 className="mb-2 font-semibold">Stack Trace:</h3>
                                    <pre className="overflow-x-auto whitespace-pre-wrap text-xs">{error.stack}</pre>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                        </Accordion>
                    : null}
                </div>
            </div>
            
        </div>
    )
}