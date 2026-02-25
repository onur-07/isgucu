import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getBlogPostBySlug } from "@/lib/blog-posts";

export default async function BlogDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) return notFound();

  return (
    <div className="container mx-auto px-4 md:px-6 py-10 md:py-14">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-8">
          <Link href="/blog" className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:underline">
            ← Tüm Yazılar
          </Link>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-black">
              {post.category}
            </Badge>
            <span className="text-xs font-bold text-gray-500">{post.readingMinutes} dk</span>
          </div>
        </div>

        <h1 className="text-3xl md:text-5xl font-black font-heading tracking-tight text-gray-900 leading-tight">
          {post.title}
        </h1>
        <p className="text-gray-600 font-semibold mt-4 text-base md:text-lg leading-relaxed">
          {post.excerpt}
        </p>

        <div className="mt-8 rounded-[2.5rem] overflow-hidden border border-gray-100 shadow-sm">
          <img src={post.coverImage} alt={post.title} className="w-full h-[320px] object-cover" />
        </div>

        <article className="mt-10 space-y-5">
          {post.content.map((p, idx) => (
            <p key={idx} className="text-gray-700 font-medium leading-relaxed">
              {p}
            </p>
          ))}
        </article>

        <div className="mt-12 flex flex-col sm:flex-row gap-3">
          <Link href="/register?role=freelancer" className="w-full sm:w-auto">
            <Button size="lg" variant="secondary" className="w-full sm:w-auto font-black px-10 h-12 rounded-2xl text-[#0b1f4d] border border-[#123a8f]">
              Freelancer Ol
            </Button>
          </Link>
          <Link href="/register?role=employer" className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto bg-[#0b1f4d] hover:bg-[#123a8f] text-white border border-[#0b1f4d] font-black px-10 h-12 rounded-2xl">
              İş İlanı Ver
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
