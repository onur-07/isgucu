import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { getBlogPosts } from "@/lib/blog-posts";

export default function BlogPage() {
  const posts = getBlogPosts();

  return (
    <div className="container mx-auto px-4 md:px-6 py-10 md:py-14">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl md:text-5xl font-black font-heading tracking-tight text-gray-900">Blog</h1>
          <p className="text-gray-600 font-semibold mt-2 max-w-2xl">
            Freelancerlik, kariyer ve platform rehberleri. Daha iyi teklif ver, daha iyi calis.
          </p>
        </div>
        <Link href="/" className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:underline">
          Anasayfa →
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map((post) => (
          <Card
            key={post.slug}
            className="h-full rounded-[2rem] overflow-hidden border-gray-100 hover:shadow-2xl transition-shadow flex flex-col"
          >
            <div className="relative">
              <img
                src={post.coverImage}
                alt={post.title}
                className="h-48 w-full object-cover"
                loading="lazy"
              />
              <div className="absolute top-4 left-4">
                <Badge variant="secondary" className="font-black">
                  {post.category}
                </Badge>
              </div>
            </div>

            <CardHeader className="pb-3">
              <CardTitle className="text-xl font-black tracking-tight leading-snug">{post.title}</CardTitle>
              <div className="text-xs font-bold text-gray-500 mt-1">{post.readingMinutes} dk okuma</div>
            </CardHeader>

            <CardContent className="pt-0 flex-1">
              <p className="text-sm font-semibold text-gray-600 leading-relaxed">{post.excerpt}</p>
            </CardContent>

            <CardFooter className="pt-0 mt-auto">
              <Button
                asChild
                className="w-full rounded-2xl font-black bg-[#0b1f4d] hover:bg-[#123a8f] text-white border border-[#0b1f4d]"
              >
                <Link href={`/blog/${post.slug}`}>Yazıyı Oku</Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
