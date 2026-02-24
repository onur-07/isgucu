"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";

const CATEGORIES = [
    "Yazılım & Mobil",
    "Logo & Grafik",
    "Web Tasarım",
    "Video & Animasyon",
    "Çeviri & İçerik",
];

export function JobPostingForm() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    // Simple state for demonstration. In real app use React Hook Form.
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        category: "",
        budget: "",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // Simulate API call
        console.log("Job Posted:", formData);

        // Save to local storage for demo purposes
        const existingJobs = JSON.parse(localStorage.getItem("isgucu_jobs") || "[]");
        const newJob = { ...formData, id: Date.now(), createdAt: new Date().toISOString() };
        localStorage.setItem("isgucu_jobs", JSON.stringify([newJob, ...existingJobs]));

        setTimeout(() => {
            setLoading(false);
            router.push("/jobs"); // Redirect to jobs list
        }, 1000);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="title">İlan Başlığı</Label>
                    <Input
                        id="title"
                        placeholder="Örn: E-ticaret sitesi için React geliştirici aranıyor"
                        required
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="category">Kategori</Label>
                    <Select
                        required
                        onValueChange={(value) => setFormData({ ...formData, category: value })}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Kategori seçiniz" />
                        </SelectTrigger>
                        <SelectContent>
                            {CATEGORIES.map((cat) => (
                                <SelectItem key={cat} value={cat}>
                                    {cat}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="description">İş Detayları</Label>
                    <Textarea
                        id="description"
                        placeholder="Projenizden bahsedin..."
                        className="min-h-[150px]"
                        required
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="budget">Bütçe (Opsiyonel)</Label>
                    <Input
                        id="budget"
                        placeholder="Örn: 5000 - 10000 TL"
                        value={formData.budget}
                        onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                    />
                </div>
            </div>

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={loading}>
                {loading ? "Yayınlanıyor..." : "İlanı Yayınla"}
            </Button>
        </form>
    );
}
