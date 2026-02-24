import { JobList } from "@/components/jobs/job-list";

export default function JobsPage() {
    return (
        <div className="container py-12">
            <div className="mb-8 space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 font-heading">
                    Açık İş İlanları
                </h1>
                <p className="text-muted-foreground">
                    Yeteneklerinize uygun projeleri keşfedin ve teklif verin.
                </p>
            </div>

            <JobList />
        </div>
    );
}
