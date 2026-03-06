"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Star, ZapIcon, Sparkles, ShieldCheck, Briefcase, ArrowRight } from "lucide-react";
import { JobList } from "@/components/jobs/job-list";
import { GigList } from "@/components/gigs/gig-list";
import { useAuth } from "@/components/auth/auth-context";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { getBlogPosts } from "@/lib/blog-posts";
import { getSiteConfig, hydrateSiteConfigFromRemote } from "@/lib/site-config";

const CATEGORIES = [
  { title: "Yazılım & Mobil", slug: "yazilim-mobil", icon: "💻", color: "text-blue-600", bg: "bg-blue-50" },
  { title: "Logo & Grafik", slug: "logo-grafik", icon: "🎨", color: "text-purple-600", bg: "bg-purple-50" },
  { title: "Web Tasarım", slug: "web-tasarim", icon: "🌐", color: "text-cyan-600", bg: "bg-cyan-50" },
  { title: "Yapay Zeka", slug: "yapay-zeka", icon: "🤖", color: "text-indigo-600", bg: "bg-indigo-50" },
  { title: "Çeviri & İçerik", slug: "ceviri-icerik", icon: "✍️", color: "text-orange-600", bg: "bg-orange-50" },
];

export default function Home() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [employerQuery, setEmployerQuery] = useState("");
  const [freelancerJobCount, setFreelancerJobCount] = useState(0);
  const rotatingHeroWords = useMemo(
    () => ["Freelancerlık", "Proje Yaptırmak", "Doğru Uzmanı Bulmak"],
    []
  );
  const [activeHeroWordIndex, setActiveHeroWordIndex] = useState(0);
  const [managedHome, setManagedHome] = useState(() => {
    const config = getSiteConfig();
    return (config.managedPages || []).find((p) => p.slug === "/" || p.id === "home-system") || null;
  });

  const categories = useMemo(() => CATEGORIES, []);
  const latestPosts = useMemo(() => getBlogPosts().slice(0, 3), []);
  const normalizeJobSearch = (value: string) => {
    const trMap: Record<string, string> = { ç: "c", ğ: "g", ı: "i", İ: "i", ö: "o", ş: "s", ü: "u" };
    const stop = new Set([
      "ve", "ile", "icin", "için", "veya", "ya", "da", "de", "bir", "bu", "o", "şu", "su",
      "hizmet", "ilan", "is", "iş", "proje", "freelancer", "uzman", "teklif", "yeni", "gibi",
      "yapacağım", "yapacagim", "istiyorum", "lazım", "lazim", "var", "yok",
    ]);
    const folded = String(value || "")
      .replace(/[çğıİöşü]/g, (m) => trMap[m] || m)
      .toLocaleLowerCase("tr-TR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const tokens = folded
      .replace(/[^\p{L}0-9]+/gu, " ")
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2 && !stop.has(t));
    return tokens.slice(0, 5).join(" ");
  };
  const homeSummaryText = managedHome
    ? String(managedHome.summary || "").trim()
    : "Turkiye freelancer platformu: Hizmet bul, ilan ver, guvenle calis. Ister freelancer ol, ister is veren olarak en dogru uzmani sec.";

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveHeroWordIndex((prev) => (prev + 1) % rotatingHeroWords.length);
    }, 2200);
    return () => window.clearInterval(intervalId);
  }, [rotatingHeroWords.length]);

  useEffect(() => {
    const refreshManagedHome = () => {
      const config = getSiteConfig();
      setManagedHome((config.managedPages || []).find((p) => p.slug === "/" || p.id === "home-system") || null);
    };
    hydrateSiteConfigFromRemote().then(() => {
      refreshManagedHome();
    });
    window.addEventListener("site_config_updated", refreshManagedHome);
    return () => window.removeEventListener("site_config_updated", refreshManagedHome);
  }, []);

  if (loading) return null;

  if (isAuthenticated && user) {
    if (user.role === "freelancer") {
      return (
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-10 sm:py-12 space-y-12">
          <div className="bg-gradient-to-r from-cyan-600 to-blue-700 rounded-[2.5rem] p-8 sm:p-10 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 opacity-10 bg-[url('/grid.svg')]" />
            <div className="relative z-10 space-y-4 text-center sm:text-left">
              <span className="inline-flex bg-white/20 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10">👋 Hoş Geldin, Freelancer</span>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black font-sans leading-tight">
                Kazancınızı Artıracak <br /> Yeni İş Fırsatlarını Yakalayın!
              </h1>
              <p className="text-blue-100 font-bold text-sm max-w-xl mx-auto sm:mx-0">Yeteneklerinize uygun en son ilanları aşağıda bulabilir ve hemen teklif vererek yeni projelere başlayabilirsiniz.</p>
              <div className="pt-4 flex flex-col sm:flex-row gap-3 sm:gap-4 items-center sm:items-start">
                <Link href="/jobs">
                  <Button className="bg-white text-blue-700 font-black rounded-xl px-8 h-12 hover:bg-blue-50 w-full sm:w-auto">TÜM İLANLARI GÖR</Button>
                </Link>
                <Link href="/post-gig">
                  <Button variant="outline" className="bg-transparent border-white/60 text-white hover:bg-white/10 font-black rounded-xl px-8 h-12 uppercase text-[10px] tracking-widest w-full sm:w-auto">Yeni İlan Oluştur</Button>
                </Link>
              </div>
            </div>
            <Sparkles className="absolute right-10 bottom-10 h-32 w-32 text-white/5" />
          </div>

          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-center sm:text-left">
              <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight flex items-center justify-center sm:justify-start gap-3">
                <ZapIcon className="h-6 w-6 text-yellow-500" /> Sizin İçin Önerilen İşler
              </h2>
              <Link href="/jobs" className="text-[10px] font-black uppercase text-blue-600 hover:underline tracking-widest">
                Tümünü İncele ({freelancerJobCount}) →
              </Link>
            </div>
            <JobList
              limit={4}
              onTotalChange={setFreelancerJobCount}
              recommendedForFreelancer={{ id: user.id, username: user.username }}
            />
          </div>
        </div>
      );
    }

    if (user.role === "employer") {
      return (
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-10 sm:py-12 space-y-10 sm:space-y-12">
          <div className="bg-gradient-to-r from-amber-500 to-yellow-600 rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-10 text-white shadow-2xl relative overflow-hidden text-center md:text-left">
            <div className="absolute inset-0 opacity-10 bg-[url('/grid.svg')]" />
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="space-y-4 flex-1">
                <span className="bg-white/20 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10 italic">💼 Hoş Geldin, İş Veren</span>
                <h1 className="text-4xl md:text-5xl font-black font-heading leading-tight">
                  Projeniz İçin <br /> En İyi Uzmanı Hemen Bulun!
                </h1>
                <p className="text-yellow-50 font-bold text-sm max-w-xl">Yüzlerce profesyonel freelancer arasından seçim yapın veya ilan vererek teklifleri toplayın.</p>
                <form
                  className="w-full max-w-2xl"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const raw = employerQuery.trim();
                    if (!raw) {
                      router.push("/jobs");
                      return;
                    }
                    const normalized = normalizeJobSearch(raw);
                    router.push(`/jobs?q=${encodeURIComponent(normalized || raw)}`);
                  }}
                >
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white/95 p-2 rounded-2xl border border-white/30">
                    <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <Input
                        value={employerQuery}
                        onChange={(e) => setEmployerQuery(e.target.value)}
                        className="pl-12 h-11 border-0 shadow-none focus-visible:ring-0 text-sm text-slate-800"
                        placeholder="İlan, kategori veya anahtar kelime ara..."
                      />
                    </div>
                    <Button type="submit" size="sm" className="rounded-xl bg-slate-900 hover:bg-slate-800 h-11 px-6 font-black text-white">
                      Ara
                    </Button>
                  </div>
                </form>
                <div className="pt-4 flex gap-4 justify-center md:justify-start">
                  <Link href="/post-job">
                    <Button className="bg-white text-yellow-700 font-black rounded-xl px-8 h-12 hover:bg-yellow-50">HEMEN İLAN VER 🎯</Button>
                  </Link>
                  <Link href="/freelancers">
                    <Button className="bg-slate-900 text-white border border-slate-900 hover:bg-slate-800 font-black rounded-xl px-8 h-12 uppercase text-[10px] tracking-widest">Freelancer Ara</Button>
                  </Link>
                </div>
              </div>
              <div className="hidden lg:block">
                <div className="bg-white/10 backdrop-blur-xl p-8 rounded-[3rem] border border-white/20 shadow-2xl scale-125 -rotate-6">
                  <Star className="h-24 w-24 text-yellow-200" />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Kategorileri Keşfet</h2>
              <Link href="/categories/all" className="text-[10px] font-black uppercase text-amber-600 hover:underline tracking-widest">Kategori Listesi →</Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {categories.map((cat) => (
                <Link key={cat.slug} href={`/categories/${cat.slug}`} className="group p-6 bg-white border border-gray-100 rounded-2xl text-center hover:shadow-xl transition-all hover:-translate-y-1">
                  <div className="text-3xl mb-3">{cat.icon}</div>
                  <span className="text-[10px] font-black uppercase text-gray-600 group-hover:text-amber-600 tracking-widest">{cat.title}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Trend Hizmetler (Gigs)</h2>
              <Link href="/freelancers" className="text-[10px] font-black uppercase text-amber-600 hover:underline tracking-widest">Tüm Hizmetler →</Link>
            </div>
            <GigList limit={4} />
          </div>
        </div>
      );
    }
  }

  // Default Landing Page for Guest users
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative w-full py-16 md:py-20 lg:py-24 overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-100/40 via-transparent to-transparent"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-indigo-100/40 via-transparent to-transparent"></div>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-[1200px] bg-[url('/grid.svg')] opacity-[0.04]"></div>
          <div className="absolute -top-12 -left-12 h-48 w-48 rounded-full bg-blue-200/25 blur-3xl" />
          <div className="absolute -bottom-16 -right-10 h-56 w-56 rounded-full bg-cyan-200/30 blur-3xl" />
        </div>

        <div className="container mx-auto px-4 md:px-6 flex flex-col items-center justify-center text-center space-y-6 relative z-10">
          <p className="text-xl md:text-3xl font-black tracking-tight leading-tight">
            <span className="text-black">Burada </span>
            <span
              key={rotatingHeroWords[activeHeroWordIndex]}
              className="text-orange-500 animate-in fade-in duration-500 inline-block"
            >
              {rotatingHeroWords[activeHeroWordIndex]}
            </span>
            <span className="text-black"> çok kolay</span>
          </p>

          <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-blue-50 text-blue-700 hover:bg-blue-100 mb-4">
            ✨ Geleceğin Çalışma Modeli
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight bg-gradient-to-br from-gray-900 via-gray-800 to-gray-600 bg-clip-text text-transparent font-heading max-w-[900px] leading-tight mb-12 animate-in fade-in slide-in-from-bottom-5 duration-1000">
            Projeni <br /> <span className="text-blue-600 italic">Gerçeğe Dönüştür</span>
          </h1>

          {homeSummaryText.length > 0 && (
            <p className="max-w-[800px] text-gray-600 text-base md:text-lg font-semibold leading-relaxed">
              {homeSummaryText}
            </p>
          )}

          <div className="w-full max-w-4xl rounded-3xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-cyan-50 px-6 py-5 shadow-sm">
            <h2 className="text-lg md:text-2xl font-black text-gray-900">
              Freelancer Platformu: Proje Yaptırma, İş Bulma ve Uzman Freelancer Hizmetleri
            </h2>
            <p className="mt-2 text-sm md:text-base font-semibold text-gray-600">
              Web tasarım, yapay zeka, logo tasarım, video düzenleme ve içerik üretimi dahil yüzlerce hizmette hızlı eşleşme, güvenli ödeme ve şeffaf süreç sunuyoruz.
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {["freelancer platformu", "proje yaptırma", "uzman freelancer", "hizmet ilanı", "güvenli ödeme"].map((item) => (
                <span key={item} className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-bold text-blue-700">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <form
            className="w-full max-w-2xl"
            onSubmit={(e) => {
              e.preventDefault();
              const raw = query.trim();
              if (!raw) {
                router.push("/jobs");
                return;
              }
              const normalized = normalizeJobSearch(raw);
              router.push(`/jobs?q=${encodeURIComponent(normalized || raw)}`);
            }}
          >
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white p-3 rounded-3xl shadow-2xl border border-gray-100">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-12 h-12 border-0 shadow-none focus-visible:ring-0 text-base"
                  placeholder="Ne hizmeti arıyorsun? (ör: logo, web sitesi, seo)"
                />
              </div>
              <Button size="lg" className="rounded-2xl bg-blue-600 hover:bg-blue-700 h-12 px-10 font-black">
                Ara
              </Button>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/register?role=freelancer" className="w-full sm:w-auto">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto font-black px-10 h-14 rounded-2xl shadow-lg">
                  Freelancer Ol
                </Button>
              </Link>
              <Link href="/register?role=employer" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto bg-gray-900 hover:bg-black font-black px-10 h-14 rounded-2xl shadow-lg">
                  İş İlanı Ver
                </Button>
              </Link>
            </div>
          </form>

          <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl w-full">
            {[{
              title: "Güvenli Ödeme",
              desc: "Ödeme süreçleri kontrol altında.",
              Icon: ShieldCheck,
            }, {
              title: "Hızlı Eşleşme",
              desc: "Doğru uzmanı dakikalar içinde bul.",
              Icon: ZapIcon,
            }, {
              title: "Şeffaf Süreç",
              desc: "Teklif, teslim, onay adımları net.",
              Icon: Briefcase,
            }].map(({ title, desc, Icon }) => (
              <div key={title} className="rounded-3xl border border-gray-100 bg-white/70 backdrop-blur px-6 py-5 text-left shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-black text-gray-900">{title}</div>
                    <div className="text-xs font-bold text-gray-500 mt-0.5">{desc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-18 md:py-20 bg-white">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <h2 className="text-3xl md:text-4xl font-black font-heading tracking-tight text-gray-900">
                Kategorileri Keşfet
              </h2>
              <p className="text-gray-600 font-semibold mt-2 max-w-2xl">
                En çok talep gören alanlara göz at, doğru hizmeti bul.
              </p>
            </div>
            <Link href="/freelancers" className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:underline">
              Tüm Hizmetler →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {categories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/categories/${cat.slug}`}
                className="group rounded-[2rem] border border-gray-100 bg-white p-6 hover:shadow-xl transition-all hover:-translate-y-1"
              >
                <div className={`h-12 w-12 rounded-2xl ${cat.bg} flex items-center justify-center text-2xl mb-4`}>
                  {cat.icon}
                </div>
                <div className="text-sm font-black text-gray-900 group-hover:text-blue-600 transition-colors">
                  {cat.title}
                </div>
                <div className="mt-2 text-xs font-bold text-gray-500">
                  Popüler hizmetleri gör
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Gigs */}
      <section className="py-18 md:py-20 bg-gradient-to-b from-white to-slate-50">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <h2 className="text-3xl md:text-4xl font-black font-heading tracking-tight text-gray-900">
                Öne Çıkan Hizmetler
              </h2>
              <p className="text-gray-600 font-semibold mt-2 max-w-2xl">
                Yeni ve trend ilanları keşfet.
              </p>
            </div>
            <Link href="/freelancers" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:underline">
              Tümünü İncele <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <GigList limit={8} />
        </div>
      </section>

      {/* Latest Jobs */}
      <section className="py-18 md:py-20 bg-white">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <h2 className="text-3xl md:text-4xl font-black font-heading tracking-tight text-gray-900">
                Son İş İlanları
              </h2>
              <p className="text-gray-600 font-semibold mt-2 max-w-2xl">
                Freelancer isen hızlıca teklif ver, iş veren isen ilan aç.
              </p>
            </div>
            <Link href="/jobs" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:underline">
              İş İlanlarını Gör <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <JobList limit={6} />
        </div>
      </section>

      {/* Blog */}
      <section className="py-18 md:py-20 bg-gradient-to-b from-white to-slate-50">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <h2 className="text-3xl md:text-4xl font-black font-heading tracking-tight text-gray-900">
                Blog / Son Yazılar
              </h2>
              <p className="text-gray-600 font-semibold mt-2 max-w-2xl">
                Freelancerlığa dair pratik ipuçları, vergi/finans notları ve İşgücü güncellemeleri.
              </p>
            </div>
            <Link href="/blog" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:underline">
              Tüm Yazılar <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {latestPosts.map((post) => (
              <Card key={post.slug} className="h-full rounded-[2rem] overflow-hidden border-gray-100 hover:shadow-2xl transition-shadow flex flex-col">
                <div className="relative">
                  <Image
                    src={post.coverImage}
                    alt={post.title}
                    width={800}
                    height={400}
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
                  <CardTitle className="text-xl font-black tracking-tight leading-snug">
                    {post.title}
                  </CardTitle>
                  <div className="text-xs font-bold text-gray-500 mt-1">
                    {post.readingMinutes} dk okuma
                  </div>
                </CardHeader>
                <CardContent className="pt-0 flex-1">
                  <p className="text-sm font-semibold text-gray-600 leading-relaxed">
                    {post.excerpt}
                  </p>
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
      </section>

      {/* Features */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: "1", title: "İhtiyacınızı Belirleyin", desc: "Projenizi detaylandırarak ilan verin veya mevcut freelancer hizmetlerini inceleyin.", icon: "🎯" },
              { step: "2", title: "Doğru Uzmanı Bulun", desc: "Profil, portföy ve değerlendirmeleri karşılaştırarak en uygun freelancer'ı seçin.", icon: "🔍" },
              { step: "3", title: "Güvenle Çalışın", desc: "Ödemeniz havuz hesapta tutulur. İş teslim edilip onaylanınca freelancer'a aktarılır.", icon: "🤝" },
            ].map((item) => (
              <div key={item.step} className="text-center p-8 rounded-[2.5rem] bg-gray-50 border border-gray-100 hover:shadow-2xl transition-all hover:-translate-y-2 group">
                <div className="text-6xl mb-6 group-hover:scale-110 transition-transform">{item.icon}</div>
                <h3 className="text-xl font-black text-gray-900 mb-2 uppercase tracking-tight">{item.title}</h3>
                <p className="text-gray-500 font-medium text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="w-full py-24 bg-gradient-to-r from-blue-700 to-indigo-800 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
        <div className="container mx-auto px-4 text-center space-y-8 relative z-10">
          <h2 className="text-4xl md:text-6xl font-black font-heading tracking-tighter">İşgücü&rsquo;ne Katılın</h2>
          <p className="max-w-[700px] mx-auto text-blue-100 md:text-lg font-bold">
            Yeteneklerinizi kazanca dönüştürün veya projeniz için en iyi uzmanı hemen bulun.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register?role=freelancer"><Button size="lg" variant="secondary" className="font-black px-10 h-16 rounded-2xl shadow-2xl">FREELANCER OL</Button></Link>
            <Link href="/register?role=employer"><Button size="lg" className="bg-blue-600 hover:bg-blue-500 font-black px-10 h-16 rounded-2xl shadow-2xl border border-white/20">İŞ İLANI VER</Button></Link>
          </div>
        </div>
      </section>
    </div>
  );
}

